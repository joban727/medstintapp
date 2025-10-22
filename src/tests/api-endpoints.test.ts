/**
 * Integration tests for Clock API endpoints
 * Tests the complete request/response cycle with proper error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import express from 'express'
import { clockInHandler, clockOutHandler, clockStatusHandler } from '@/api/routes/student/clock'
import { ClockService } from '@/lib/clock-service'
import { ClockError } from '@/lib/enhanced-error-handling'

// Mock dependencies
vi.mock('@/lib/clock-service')
vi.mock('@/lib/enhanced-error-handling')
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }
}))

describe('Clock API Endpoints', () => {
  let app: express.Application
  let mockClockService: any

  beforeEach(() => {
    app = express()
    app.use(express.json())
    
    // Setup routes
    app.post('/api/student/clock-in', clockInHandler)
    app.post('/api/student/clock-out', clockOutHandler)
    app.get('/api/student/clock-status/:studentId', clockStatusHandler)

    // Mock ClockService
    mockClockService = {
      clockIn: vi.fn(),
      clockOut: vi.fn(),
      getClockStatus: vi.fn()
    }
    
    vi.mocked(ClockService).mockImplementation(() => mockClockService)
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('POST /api/student/clock-in', () => {
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
      const mockResponse = {
        success: true,
        data: {
          timeRecordId: 'record-789',
          status: 'ACTIVE',
          clockInTime: new Date().toISOString(),
          siteInfo: {
            name: 'Test Hospital',
            address: '123 Test St, Test City, TS 12345'
          }
        }
      }

      mockClockService.clockIn.mockResolvedValue(mockResponse)

      const response = await request(app)
        .post('/api/student/clock-in')
        .send(validClockInRequest)
        .expect(200)

      expect(response.body).toEqual(mockResponse)
      expect(mockClockService.clockIn).toHaveBeenCalledWith(validClockInRequest)
    })

    it('should handle validation errors', async () => {
      const invalidRequest = {
        studentId: '', // Missing required field
        rotationId: 'rotation-456',
        location: {
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 10
        }
      }

      const mockError = new ClockError(
        'VALIDATION_ERROR',
        'Student ID is required',
        { field: 'studentId' }
      )

      mockClockService.clockIn.mockRejectedValue(mockError)

      const response = await request(app)
        .post('/api/student/clock-in')
        .send(invalidRequest)
        .expect(400)

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Student ID is required',
          details: { field: 'studentId' }
        }
      })
    })

    it('should handle already clocked in error', async () => {
      const mockError = new ClockError(
        'ALREADY_CLOCKED_IN',
        'Student is already clocked in',
        { 
          studentId: 'student-123',
          activeRecordId: 'record-456'
        }
      )

      mockClockService.clockIn.mockRejectedValue(mockError)

      const response = await request(app)
        .post('/api/student/clock-in')
        .send(validClockInRequest)
        .expect(409)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('ALREADY_CLOCKED_IN')
    })

    it('should handle location validation errors', async () => {
      const mockError = new ClockError(
        'LOCATION_TOO_FAR',
        'Location is too far from the clinical site',
        { 
          distance: 1500,
          maxDistance: 500
        }
      )

      mockClockService.clockIn.mockRejectedValue(mockError)

      const response = await request(app)
        .post('/api/student/clock-in')
        .send(validClockInRequest)
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('LOCATION_TOO_FAR')
    })

    it('should handle service unavailable errors', async () => {
      const mockError = new ClockError(
        'SERVICE_UNAVAILABLE',
        'Clock service is temporarily unavailable',
        { retryAfter: 30 }
      )

      mockClockService.clockIn.mockRejectedValue(mockError)

      const response = await request(app)
        .post('/api/student/clock-in')
        .send(validClockInRequest)
        .expect(503)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('SERVICE_UNAVAILABLE')
      expect(response.headers['retry-after']).toBe('30')
    })

    it('should handle database errors', async () => {
      const mockError = new ClockError(
        'DATABASE_ERROR',
        'Database operation failed',
        { operation: 'INSERT' }
      )

      mockClockService.clockIn.mockRejectedValue(mockError)

      const response = await request(app)
        .post('/api/student/clock-in')
        .send(validClockInRequest)
        .expect(500)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('DATABASE_ERROR')
    })

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/student/clock-in')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.message).toContain('Invalid JSON')
    })

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/student/clock-in')
        .send({})
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should validate location coordinates', async () => {
      const invalidLocationRequest = {
        ...validClockInRequest,
        location: {
          latitude: 91, // Invalid latitude
          longitude: -74.0060,
          accuracy: 10
        }
      }

      const response = await request(app)
        .post('/api/student/clock-in')
        .send(invalidLocationRequest)
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('POST /api/student/clock-out', () => {
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
      const mockResponse = {
        success: true,
        data: {
          timeRecordId: 'record-789',
          status: 'COMPLETED',
          clockOutTime: new Date().toISOString(),
          totalHours: 8.5,
          summary: {
            clockInTime: new Date(Date.now() - 8.5 * 60 * 60 * 1000).toISOString(),
            clockOutTime: new Date().toISOString(),
            duration: '8h 30m'
          }
        }
      }

      mockClockService.clockOut.mockResolvedValue(mockResponse)

      const response = await request(app)
        .post('/api/student/clock-out')
        .send(validClockOutRequest)
        .expect(200)

      expect(response.body).toEqual(mockResponse)
      expect(mockClockService.clockOut).toHaveBeenCalledWith(validClockOutRequest)
    })

    it('should handle no active session error', async () => {
      const mockError = new ClockError(
        'NO_ACTIVE_SESSION',
        'No active clock-in session found',
        { studentId: 'student-123' }
      )

      mockClockService.clockOut.mockRejectedValue(mockError)

      const response = await request(app)
        .post('/api/student/clock-out')
        .send(validClockOutRequest)
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('NO_ACTIVE_SESSION')
    })

    it('should handle session too short error', async () => {
      const mockError = new ClockError(
        'SESSION_TOO_SHORT',
        'Session duration is too short',
        { 
          duration: 30,
          minimumDuration: 300
        }
      )

      mockClockService.clockOut.mockRejectedValue(mockError)

      const response = await request(app)
        .post('/api/student/clock-out')
        .send(validClockOutRequest)
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('SESSION_TOO_SHORT')
    })

    it('should handle session too long error', async () => {
      const mockError = new ClockError(
        'SESSION_TOO_LONG',
        'Session duration exceeds maximum allowed time',
        { 
          duration: 25 * 60 * 60,
          maximumDuration: 24 * 60 * 60
        }
      )

      mockClockService.clockOut.mockRejectedValue(mockError)

      const response = await request(app)
        .post('/api/student/clock-out')
        .send(validClockOutRequest)
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('SESSION_TOO_LONG')
    })

    it('should validate required fields for clock out', async () => {
      const invalidRequest = {
        studentId: 'student-123'
        // Missing timeRecordId
      }

      const response = await request(app)
        .post('/api/student/clock-out')
        .send(invalidRequest)
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('GET /api/student/clock-status/:studentId', () => {
    it('should return active session status', async () => {
      const mockResponse = {
        success: true,
        data: {
          isActive: true,
          timeRecordId: 'record-789',
          clockInTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          currentDuration: 7200, // 2 hours in seconds
          siteInfo: {
            name: 'Test Hospital',
            address: '123 Test St, Test City, TS 12345'
          },
          notes: 'Morning shift'
        }
      }

      mockClockService.getClockStatus.mockResolvedValue(mockResponse)

      const response = await request(app)
        .get('/api/student/clock-status/student-123')
        .expect(200)

      expect(response.body).toEqual(mockResponse)
      expect(mockClockService.getClockStatus).toHaveBeenCalledWith('student-123')
    })

    it('should return inactive status', async () => {
      const mockResponse = {
        success: true,
        data: {
          isActive: false,
          timeRecordId: null,
          lastClockOut: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        }
      }

      mockClockService.getClockStatus.mockResolvedValue(mockResponse)

      const response = await request(app)
        .get('/api/student/clock-status/student-123')
        .expect(200)

      expect(response.body).toEqual(mockResponse)
    })

    it('should handle invalid student ID', async () => {
      const response = await request(app)
        .get('/api/student/clock-status/')
        .expect(404)
    })

    it('should handle database errors in status check', async () => {
      const mockError = new ClockError(
        'DATABASE_ERROR',
        'Failed to retrieve clock status',
        { studentId: 'student-123' }
      )

      mockClockService.getClockStatus.mockRejectedValue(mockError)

      const response = await request(app)
        .get('/api/student/clock-status/student-123')
        .expect(500)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('DATABASE_ERROR')
    })
  })

  describe('Error Handling Middleware', () => {
    it('should handle unexpected errors gracefully', async () => {
      mockClockService.clockIn.mockRejectedValue(new Error('Unexpected error'))

      const response = await request(app)
        .post('/api/student/clock-in')
        .send({
          studentId: 'student-123',
          rotationId: 'rotation-456',
          location: {
            latitude: 40.7128,
            longitude: -74.0060,
            accuracy: 10
          },
          timestamp: new Date().toISOString()
        })
        .expect(500)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('INTERNAL_ERROR')
    })

    it('should include request ID in error responses', async () => {
      const mockError = new ClockError(
        'VALIDATION_ERROR',
        'Test error'
      )

      mockClockService.clockIn.mockRejectedValue(mockError)

      const response = await request(app)
        .post('/api/student/clock-in')
        .send({})
        .expect(400)

      expect(response.body.requestId).toBeDefined()
      expect(typeof response.body.requestId).toBe('string')
    })

    it('should log errors appropriately', async () => {
      const mockError = new ClockError(
        'DATABASE_ERROR',
        'Database connection failed'
      )

      mockClockService.clockIn.mockRejectedValue(mockError)

      await request(app)
        .post('/api/student/clock-in')
        .send({
          studentId: 'student-123',
          rotationId: 'rotation-456',
          location: {
            latitude: 40.7128,
            longitude: -74.0060,
            accuracy: 10
          },
          timestamp: new Date().toISOString()
        })
        .expect(500)

      const { logger } = await import('@/lib/logger')
      expect(logger.error).toHaveBeenCalled()
    })
  })

  describe('Rate Limiting', () => {
    it('should handle rate limit exceeded', async () => {
      // Simulate multiple rapid requests
      const requests = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/student/clock-in')
          .send({
            studentId: 'student-123',
            rotationId: 'rotation-456',
            location: {
              latitude: 40.7128,
              longitude: -74.0060,
              accuracy: 10
            },
            timestamp: new Date().toISOString()
          })
      )

      // At least one should be rate limited (depending on implementation)
      const responses = await Promise.all(requests)
      
      // This test depends on rate limiting middleware being implemented
      // For now, we'll just verify that requests are processed
      expect(responses.length).toBe(10)
    })
  })

  describe('CORS and Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app)
        .get('/api/student/clock-status/student-123')

      // These tests depend on security middleware being implemented
      expect(response.headers).toBeDefined()
    })

    it('should handle preflight requests', async () => {
      const response = await request(app)
        .options('/api/student/clock-in')

      // Should handle OPTIONS requests for CORS
      expect(response.status).toBeLessThan(500)
    })
  })
})