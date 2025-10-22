/**
 * Comprehensive tests for the ClockService class
 * Tests atomic operations, error handling, and business logic validation
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import { ClockService } from '@/lib/clock-service'
import { ClockError } from '@/lib/enhanced-error-handling'
import { db } from '@/database/connection-pool'
import { timeRecords, rotations, clinicalSites } from '@/database/schema'
import { eq, and } from 'drizzle-orm'

// Mock dependencies
vi.mock('@/database/connection-pool', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  }
}))

vi.mock('@/lib/database-optimization', () => ({
  getCachedSiteData: vi.fn(),
  getActiveTimeRecord: vi.fn(),
  invalidateStudentCache: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }
}))

describe('ClockService', () => {
  let clockService: ClockService
  let mockDb: any

  beforeEach(() => {
    clockService = new ClockService()
    mockDb = db as any
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('clockIn', () => {
    const validClockInRequest = {
      studentId: 'student-123',
      rotationId: 'rotation-456',
      location: {
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 10
      },
      notes: 'Starting morning shift',
      timestamp: new Date().toISOString()
    }

    it('should successfully clock in a student', async () => {
      // Mock site data
      const mockSiteData = {
        id: 'rotation-456',
        name: 'Test Hospital',
        address: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        latitude: 40.7128,
        longitude: -74.0060
      }

      // Mock database responses
      mockDb.transaction.mockImplementation(async (callback: Function) => {
        return await callback({
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                for: vi.fn().mockResolvedValue([]) // No active records
              })
            })
          }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{
                id: 'record-789',
                studentId: 'student-123',
                rotationId: 'rotation-456',
                clockInTime: new Date(),
                status: 'ACTIVE'
              }])
            })
          })
        })
      })

      const { getCachedSiteData } = await import('@/lib/database-optimization')
      ;(getCachedSiteData as Mock).mockResolvedValue(mockSiteData)

      const result = await clockService.clockIn(validClockInRequest)

      expect(result.success).toBe(true)
      expect(result.data?.timeRecordId).toBe('record-789')
      expect(result.data?.status).toBe('ACTIVE')
      expect(mockDb.transaction).toHaveBeenCalled()
    })

    it('should prevent double clock-in', async () => {
      // Mock existing active record
      mockDb.transaction.mockImplementation(async (callback: Function) => {
        return await callback({
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                for: vi.fn().mockResolvedValue([{
                  id: 'existing-record',
                  studentId: 'student-123',
                  status: 'ACTIVE'
                }])
              })
            })
          })
        })
      })

      const { getCachedSiteData } = await import('@/lib/database-optimization')
      ;(getCachedSiteData as Mock).mockResolvedValue({
        id: 'rotation-456',
        name: 'Test Hospital'
      })

      await expect(clockService.clockIn(validClockInRequest))
        .rejects.toThrow(ClockError)

      const error = await clockService.clockIn(validClockInRequest).catch(e => e)
      expect(error.code).toBe('ALREADY_CLOCKED_IN')
    })

    it('should validate location proximity', async () => {
      const invalidLocationRequest = {
        ...validClockInRequest,
        location: {
          latitude: 41.0000, // Too far from site
          longitude: -75.0000,
          accuracy: 10
        }
      }

      const mockSiteData = {
        id: 'rotation-456',
        name: 'Test Hospital',
        latitude: 40.7128,
        longitude: -74.0060
      }

      const { getCachedSiteData } = await import('@/lib/database-optimization')
      ;(getCachedSiteData as Mock).mockResolvedValue(mockSiteData)

      await expect(clockService.clockIn(invalidLocationRequest))
        .rejects.toThrow(ClockError)

      const error = await clockService.clockIn(invalidLocationRequest).catch(e => e)
      expect(error.code).toBe('LOCATION_TOO_FAR')
    })

    it('should handle future timestamps', async () => {
      const futureTimestamp = new Date(Date.now() + 60000).toISOString() // 1 minute in future

      const futureRequest = {
        ...validClockInRequest,
        timestamp: futureTimestamp
      }

      await expect(clockService.clockIn(futureRequest))
        .rejects.toThrow(ClockError)

      const error = await clockService.clockIn(futureRequest).catch(e => e)
      expect(error.code).toBe('FUTURE_TIMESTAMP')
    })

    it('should handle database errors gracefully', async () => {
      mockDb.transaction.mockRejectedValue(new Error('Database connection failed'))

      const { getCachedSiteData } = await import('@/lib/database-optimization')
      ;(getCachedSiteData as Mock).mockResolvedValue({
        id: 'rotation-456',
        name: 'Test Hospital',
        latitude: 40.7128,
        longitude: -74.0060
      })

      await expect(clockService.clockIn(validClockInRequest))
        .rejects.toThrow(ClockError)

      const error = await clockService.clockIn(validClockInRequest).catch(e => e)
      expect(error.code).toBe('DATABASE_ERROR')
    })
  })

  describe('clockOut', () => {
    const validClockOutRequest = {
      studentId: 'student-123',
      timeRecordId: 'record-789',
      location: {
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 10
      },
      notes: 'Ending shift',
      timestamp: new Date().toISOString()
    }

    it('should successfully clock out a student', async () => {
      const mockActiveRecord = {
        id: 'record-789',
        studentId: 'student-123',
        rotationId: 'rotation-456',
        clockInTime: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8 hours ago
        status: 'ACTIVE'
      }

      mockDb.transaction.mockImplementation(async (callback: Function) => {
        return await callback({
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                for: vi.fn().mockResolvedValue([mockActiveRecord])
              })
            })
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([{
                  ...mockActiveRecord,
                  clockOutTime: new Date(),
                  totalHours: 8.0,
                  status: 'COMPLETED'
                }])
              })
            })
          })
        })
      })

      const result = await clockService.clockOut(validClockOutRequest)

      expect(result.success).toBe(true)
      expect(result.data?.status).toBe('COMPLETED')
      expect(result.data?.totalHours).toBeGreaterThan(0)
      expect(mockDb.transaction).toHaveBeenCalled()
    })

    it('should prevent clock out without active session', async () => {
      mockDb.transaction.mockImplementation(async (callback: Function) => {
        return await callback({
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                for: vi.fn().mockResolvedValue([]) // No active record
              })
            })
          })
        })
      })

      await expect(clockService.clockOut(validClockOutRequest))
        .rejects.toThrow(ClockError)

      const error = await clockService.clockOut(validClockOutRequest).catch(e => e)
      expect(error.code).toBe('NO_ACTIVE_SESSION')
    })

    it('should validate minimum session duration', async () => {
      const mockActiveRecord = {
        id: 'record-789',
        studentId: 'student-123',
        rotationId: 'rotation-456',
        clockInTime: new Date(Date.now() - 30000), // 30 seconds ago (too short)
        status: 'ACTIVE'
      }

      mockDb.transaction.mockImplementation(async (callback: Function) => {
        return await callback({
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                for: vi.fn().mockResolvedValue([mockActiveRecord])
              })
            })
          })
        })
      })

      await expect(clockService.clockOut(validClockOutRequest))
        .rejects.toThrow(ClockError)

      const error = await clockService.clockOut(validClockOutRequest).catch(e => e)
      expect(error.code).toBe('SESSION_TOO_SHORT')
    })

    it('should validate maximum session duration', async () => {
      const mockActiveRecord = {
        id: 'record-789',
        studentId: 'student-123',
        rotationId: 'rotation-456',
        clockInTime: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago (too long)
        status: 'ACTIVE'
      }

      mockDb.transaction.mockImplementation(async (callback: Function) => {
        return await callback({
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                for: vi.fn().mockResolvedValue([mockActiveRecord])
              })
            })
          })
        })
      })

      await expect(clockService.clockOut(validClockOutRequest))
        .rejects.toThrow(ClockError)

      const error = await clockService.clockOut(validClockOutRequest).catch(e => e)
      expect(error.code).toBe('SESSION_TOO_LONG')
    })
  })

  describe('getClockStatus', () => {
    it('should return active session status', async () => {
      const mockActiveRecord = {
        id: 'record-789',
        studentId: 'student-123',
        rotationId: 'rotation-456',
        clockInTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        status: 'ACTIVE',
        notes: 'Morning shift'
      }

      const { getActiveTimeRecord } = await import('@/lib/database-optimization')
      ;(getActiveTimeRecord as Mock).mockResolvedValue(mockActiveRecord)

      const result = await clockService.getClockStatus('student-123')

      expect(result.success).toBe(true)
      expect(result.data?.isActive).toBe(true)
      expect(result.data?.timeRecordId).toBe('record-789')
      expect(result.data?.currentDuration).toBeGreaterThan(0)
    })

    it('should return inactive status when no active session', async () => {
      const { getActiveTimeRecord } = await import('@/lib/database-optimization')
      ;(getActiveTimeRecord as Mock).mockResolvedValue(null)

      const result = await clockService.getClockStatus('student-123')

      expect(result.success).toBe(true)
      expect(result.data?.isActive).toBe(false)
      expect(result.data?.timeRecordId).toBeNull()
    })

    it('should handle database errors in status check', async () => {
      const { getActiveTimeRecord } = await import('@/lib/database-optimization')
      ;(getActiveTimeRecord as Mock).mockRejectedValue(new Error('Database error'))

      await expect(clockService.getClockStatus('student-123'))
        .rejects.toThrow(ClockError)

      const error = await clockService.getClockStatus('student-123').catch(e => e)
      expect(error.code).toBe('DATABASE_ERROR')
    })
  })

  describe('Circuit Breaker', () => {
    it('should open circuit after consecutive failures', async () => {
      // Mock consecutive database failures
      mockDb.transaction.mockRejectedValue(new Error('Database error'))

      const { getCachedSiteData } = await import('@/lib/database-optimization')
      ;(getCachedSiteData as Mock).mockResolvedValue({
        id: 'rotation-456',
        name: 'Test Hospital',
        latitude: 40.7128,
        longitude: -74.0060
      })

      const validRequest = {
        studentId: 'student-123',
        rotationId: 'rotation-456',
        location: {
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 10
        },
        timestamp: new Date().toISOString()
      }

      // Trigger multiple failures to open circuit
      for (let i = 0; i < 6; i++) {
        try {
          await clockService.clockIn(validRequest)
        } catch (error) {
          // Expected to fail
        }
      }

      // Next call should fail immediately due to open circuit
      const error = await clockService.clockIn(validRequest).catch(e => e)
      expect(error.code).toBe('SERVICE_UNAVAILABLE')
    })
  })

  describe('Input Validation', () => {
    it('should validate required fields for clock in', async () => {
      const invalidRequest = {
        studentId: '',
        rotationId: 'rotation-456',
        location: {
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 10
        },
        timestamp: new Date().toISOString()
      }

      await expect(clockService.clockIn(invalidRequest))
        .rejects.toThrow(ClockError)

      const error = await clockService.clockIn(invalidRequest).catch(e => e)
      expect(error.code).toBe('VALIDATION_ERROR')
    })

    it('should validate location accuracy', async () => {
      const lowAccuracyRequest = {
        studentId: 'student-123',
        rotationId: 'rotation-456',
        location: {
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 1000 // Very low accuracy
        },
        timestamp: new Date().toISOString()
      }

      await expect(clockService.clockIn(lowAccuracyRequest))
        .rejects.toThrow(ClockError)

      const error = await clockService.clockIn(lowAccuracyRequest).catch(e => e)
      expect(error.code).toBe('LOCATION_ACCURACY_TOO_LOW')
    })

    it('should validate coordinate ranges', async () => {
      const invalidCoordinatesRequest = {
        studentId: 'student-123',
        rotationId: 'rotation-456',
        location: {
          latitude: 91, // Invalid latitude
          longitude: -74.0060,
          accuracy: 10
        },
        timestamp: new Date().toISOString()
      }

      await expect(clockService.clockIn(invalidCoordinatesRequest))
        .rejects.toThrow(ClockError)

      const error = await clockService.clockIn(invalidCoordinatesRequest).catch(e => e)
      expect(error.code).toBe('VALIDATION_ERROR')
    })
  })
})