/**
 * Clock Service - Enhanced Clock Operations with Atomic Transactions and Time Synchronization
 * 
 * Provides atomic clock-in/out operations with comprehensive error handling,
 * data validation, business rule enforcement, and time synchronization validation.
 */

import { db } from "@/database/connection-pool"
import { timeRecords, rotations, clinicalSites } from "@/database/schema"
import { and, eq, isNull } from "drizzle-orm"
import { 
  ClockError, 
  ClockErrorType, 
  createValidationError, 
  createBusinessLogicError, 
  createDatabaseError,
  RetryManager,
  CircuitBreaker
} from "./enhanced-error-handling"
import { 
  clockInSchema, 
  clockOutSchema, 
  ValidationRules 
} from "./clock-validation"
import { logger } from "./logger"
import { TimeSyncService } from "./time-sync-service"
import { offlineQueue } from './offline-queue'

// Clock operation interfaces
export interface ClockInRequest {
  studentId: string
  rotationId: string
  timestamp?: string
  clientTimestamp?: string // Client-side timestamp for drift detection
  location?: {
    latitude: number
    longitude: number
    accuracy: number
    timestamp?: string
  }
  notes?: string
}

export interface ClockOutRequest {
  studentId: string
  timestamp?: string
  clientTimestamp?: string // Client-side timestamp for drift detection
  location?: {
    latitude: number
    longitude: number
    accuracy: number
    timestamp?: string
  }
  notes?: string
  activities?: string[]
}

export interface ClockStatus {
  isClocked: boolean
  clockedIn: boolean
  currentSite?: {
    id: string
    name: string
    address: string
  }
  clockInTime?: Date
  clockOutTime?: Date
  totalHours?: string
  recordId?: string
  currentDuration?: number
}

// Circuit breaker for database operations
const dbCircuitBreaker = new CircuitBreaker(5, 60000, 2)

// Time validation configuration
interface TimeValidationConfig {
  maxDriftMs: number // Maximum allowed drift between client and server
  maxFutureMs: number // Maximum allowed future timestamp
  maxPastMs: number // Maximum allowed past timestamp
  requireSync: boolean // Whether to require time synchronization
}

const DEFAULT_TIME_VALIDATION: TimeValidationConfig = {
  maxDriftMs: 5000, // 5 seconds
  maxFutureMs: 60000, // 1 minute
  maxPastMs: 300000, // 5 minutes
  requireSync: true
}

export class ClockService {
  /**
   * Validate timestamp against server time with drift detection
   */
  private static async validateTimestamp(
    clientTimestamp?: string,
    providedTimestamp?: string,
    config: TimeValidationConfig = DEFAULT_TIME_VALIDATION
  ): Promise<{ 
    validatedTime: Date, 
    drift: number, 
    accuracy: 'high' | 'medium' | 'low',
    warnings: string[] 
  }> {
    const serverTime = new Date()
    const warnings: string[] = []
    
    // Use provided timestamp or current server time
    let targetTime = providedTimestamp ? new Date(providedTimestamp) : serverTime
    let drift = 0
    let accuracy: 'high' | 'medium' | 'low' = 'high'
    
    // If client timestamp is provided, calculate drift
    if (clientTimestamp) {
      const clientTime = new Date(clientTimestamp)
      drift = Math.abs(serverTime.getTime() - clientTime.getTime())
      
      // Determine accuracy based on drift
      if (drift > config.maxDriftMs) {
        accuracy = 'low'
        warnings.push(`High time drift detected: ${drift}ms`)
        
        if (config.requireSync) {
          throw createValidationError(
            `Time synchronization required. Drift: ${drift}ms exceeds maximum: ${config.maxDriftMs}ms`,
            'timestamp',
            clientTimestamp
          )
        }
      } else if (drift > config.maxDriftMs / 2) {
        accuracy = 'medium'
        warnings.push(`Moderate time drift detected: ${drift}ms`)
      }
    }
    
    // Validate timestamp bounds
    const timeDiff = targetTime.getTime() - serverTime.getTime()
    
    if (timeDiff > config.maxFutureMs) {
      throw createValidationError(
        `Timestamp too far in the future: ${Math.abs(timeDiff)}ms`,
        'timestamp',
        targetTime.toISOString()
      )
    }
    
    if (timeDiff < -config.maxPastMs) {
      throw createValidationError(
        `Timestamp too far in the past: ${Math.abs(timeDiff)}ms`,
        'timestamp',
        targetTime.toISOString()
      )
    }
    
    // If drift is significant, use server time instead
    if (drift > config.maxDriftMs && !providedTimestamp) {
      targetTime = serverTime
      warnings.push('Using server time due to client drift')
    }
    
    return {
      validatedTime: targetTime,
      drift,
      accuracy,
      warnings
    }
  }

  /**
   * Get server time for synchronization
   */
  static async getServerTime(): Promise<{
    timestamp: string
    unixTimestamp: number
    timezone: string
    accuracy: 'high' | 'medium' | 'low'
    source: string
  }> {
    const serverTime = new Date()
    
    // Try to get high-precision time from time sync service
    const accuracy: 'high' | 'medium' | 'low' = 'medium'
    const source = 'server'
    
    try {
      const syncService = TimeSyncService.getInstance()
      if (syncService.isConnected()) {
        const syncedTime = syncService.getCurrentTime()
        const syncAccuracy = syncService.getAccuracy()
        
        return {
          timestamp: syncedTime.toISOString(),
          unixTimestamp: syncedTime.getTime(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          accuracy: syncAccuracy,
          source: 'ntp-sync'
        }
      }
    } catch (error) {
      logger.warn('Failed to get synchronized time, using server time', { error })
    }
    
    return {
      timestamp: serverTime.toISOString(),
      unixTimestamp: serverTime.getTime(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      accuracy,
      source
    }
  }

  /**
   * Atomic clock-in operation with comprehensive validation and time sync
   */
  static async clockIn(request: ClockInRequest): Promise<ClockStatus & { 
    timeValidation: { 
      drift: number, 
      accuracy: 'high' | 'medium' | 'low', 
      warnings: string[] 
    } 
  }> {
    const operationId = `clock-in-${request.studentId}-${Date.now()}`
    
    try {
      logger.info('Clock-in operation started', { operationId, studentId: request.studentId })
      
      // Validate and synchronize timestamp
      const timeValidation = await ClockService.validateTimestamp(
        request.clientTimestamp,
        request.timestamp
      )
      
      // Validate input data
      const validatedData = clockInSchema.parse({
        rotationId: request.rotationId,
        timestamp: timeValidation.validatedTime.toISOString(),
        location: request.location,
        notes: request.notes
      })
      
      // Business rule validation with validated time
      const eligibilityCheck = await ValidationRules.validateClockInEligibility(
        request.studentId,
        validatedData.rotationId,
        timeValidation.validatedTime
      )
      
      if (!eligibilityCheck.valid) {
        throw createBusinessLogicError(
          eligibilityCheck.reason || 'Clock-in not allowed',
          'CLOCK_IN_NOT_ALLOWED',
          { studentId: request.studentId, rotationId: validatedData.rotationId }
        )
      }
      
      // Execute atomic clock-in operation with retry
      const result = await RetryManager.executeWithRetry(
        () => ClockService.executeAtomicClockIn(request.studentId, validatedData, timeValidation.validatedTime),
        3,
        1000,
        (error) => error instanceof ClockError && error.retryable
      )
      
      logger.info('Clock-in operation completed successfully', { 
        operationId, 
        recordId: result.recordId,
        timeValidation: {
          drift: timeValidation.drift,
          accuracy: timeValidation.accuracy,
          warnings: timeValidation.warnings
        }
      })
      
      return {
        ...result,
        timeValidation: {
          drift: timeValidation.drift,
          accuracy: timeValidation.accuracy,
          warnings: timeValidation.warnings
        }
      }
      
    } catch (error) {
      logger.error('Clock-in operation failed', {
        operationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      
      if (error instanceof ClockError) {
        throw error
      }
      
      throw createDatabaseError('Clock-in operation failed', 'clock-in', true)
    }
  }
  
  /**
   * Atomic clock-out operation with comprehensive validation and time sync
   */
  static async clockOut(request: ClockOutRequest): Promise<ClockStatus & { 
    timeValidation: { 
      drift: number, 
      accuracy: 'high' | 'medium' | 'low', 
      warnings: string[] 
    } 
  }> {
    const operationId = `clock-out-${request.studentId}-${Date.now()}`
    
    try {
      logger.info('Clock-out operation started', { operationId, studentId: request.studentId })
      
      // Validate and synchronize timestamp
      const timeValidation = await ClockService.validateTimestamp(
        request.clientTimestamp,
        request.timestamp
      )
      
      // Validate input data
      const validatedData = clockOutSchema.parse({
        timestamp: timeValidation.validatedTime.toISOString(),
        location: request.location,
        notes: request.notes,
        activities: request.activities
      })
      
      // Execute atomic clock-out operation with retry
      const result = await RetryManager.executeWithRetry(
        () => ClockService.executeAtomicClockOut(request.studentId, validatedData, timeValidation.validatedTime),
        3,
        1000,
        (error) => error instanceof ClockError && error.retryable
      )
      
      logger.info('Clock-out operation completed successfully', { 
        operationId, 
        recordId: result.recordId,
        timeValidation: {
          drift: timeValidation.drift,
          accuracy: timeValidation.accuracy,
          warnings: timeValidation.warnings
        }
      })
      
      return {
        ...result,
        timeValidation: {
          drift: timeValidation.drift,
          accuracy: timeValidation.accuracy,
          warnings: timeValidation.warnings
        }
      }
      
    } catch (error) {
      logger.error('Clock-out operation failed', {
        operationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      
      if (error instanceof ClockError) {
        throw error
      }
      
      throw createDatabaseError('Clock-out operation failed', 'clock-out', true)
    }
  }
  
  /**
   * Get current clock status for a student
   */
  static async getClockStatus(studentId: string): Promise<ClockStatus> {
    try {
      const activeRecord = await dbCircuitBreaker.execute(async () => {
        const [record] = await db
          .select({
            id: timeRecords.id,
            clockIn: timeRecords.clockIn,
            clockOut: timeRecords.clockOut,
            rotationId: timeRecords.rotationId,
            notes: timeRecords.notes
          })
          .from(timeRecords)
          .where(
            and(
              eq(timeRecords.studentId, studentId),
              isNull(timeRecords.clockOut)
            )
          )
          .limit(1)
        
        return record
      })
      
      if (!activeRecord) {
        return {
          isClocked: false,
          clockedIn: false,
          currentDuration: 0
        }
      }
      
      // Get rotation to get the clinical site ID
      const [rotation] = await db
        .select({
          clinicalSiteId: rotations.clinicalSiteId
        })
        .from(rotations)
        .where(eq(rotations.id, activeRecord.rotationId))
        .limit(1)
      
      // Get site information
      const siteInfo = rotation ? await ClockService.getSiteInfo(rotation.clinicalSiteId) : undefined
      
      // Calculate current duration
      const clockInTime = new Date(activeRecord.clockIn)
      const now = new Date()
      const durationMs = now.getTime() - clockInTime.getTime()
      const currentDuration = Math.floor(durationMs / 1000) // in seconds
      
      return {
        isClocked: true,
        clockedIn: true,
        currentSite: siteInfo,
        clockInTime: clockInTime,
        recordId: activeRecord.id,
        currentDuration
      }
      
    } catch (error) {
      logger.error('Failed to get clock status', {
        studentId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      
      throw createDatabaseError('Failed to get clock status', 'get-status', true)
    }
  }
  
  /**
   * Enhanced clockIn with offline support
   */
  async clockIn(request: ClockInRequest): Promise<ClockStatus> {
    try {
      // Check if online
      if (!navigator.onLine) {
        return this.handleOfflineClockIn(request)
      }
  
      // Validate timestamp with server time
      const timeValidation = await this.validateTimestamp(request.clientTimestamp)
      
      if (!timeValidation.isValid) {
        throw new Error(`Time validation failed: ${timeValidation.reason}`)
      }
  
      // Execute atomic clock-in operation with retry
      const result = await RetryManager.executeWithRetry(
        () => ClockService.executeAtomicClockIn(request.studentId, validatedData, timeValidation.validatedTime),
        3,
        1000,
        (error) => error instanceof ClockError && error.retryable
      )
      
      logger.info('Clock-in operation completed successfully', { 
        operationId, 
        recordId: result.recordId,
        timeValidation: {
          drift: timeValidation.drift,
          accuracy: timeValidation.accuracy,
          warnings: timeValidation.warnings
        }
      })
      
      return {
        ...result,
        timeValidation: {
          drift: timeValidation.drift,
          accuracy: timeValidation.accuracy,
          warnings: timeValidation.warnings
        }
      }
      
    } catch (error) {
      logger.error('Clock in failed', { 
        studentId: request.studentId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      
      // If network error, queue for offline processing
      if (this.isNetworkError(error)) {
        return this.handleOfflineClockIn(request)
      }
      
      throw error
    }
  }

  /**
   * Enhanced clockOut with offline support
   */
  async clockOut(request: ClockOutRequest): Promise<ClockStatus> {
    try {
      // Check if online
      if (!navigator.onLine) {
        return this.handleOfflineClockOut(request)
      }
  
      // Validate timestamp with server time
      const timeValidation = await this.validateTimestamp(request.clientTimestamp)
      
      if (!timeValidation.isValid) {
        throw new Error(`Time validation failed: ${timeValidation.reason}`)
      }
  
      // Execute atomic clock-out operation with retry
      const result = await RetryManager.executeWithRetry(
        () => ClockService.executeAtomicClockOut(request.studentId, validatedData, timeValidation.validatedTime),
        3,
        1000,
        (error) => error instanceof ClockError && error.retryable
      )
      
      logger.info('Clock-out operation completed successfully', { 
        operationId, 
        recordId: result.recordId,
        timeValidation: {
          drift: timeValidation.drift,
          accuracy: timeValidation.accuracy,
          warnings: timeValidation.warnings
        }
      })
      
      return {
        ...result,
        timeValidation: {
          drift: timeValidation.drift,
          accuracy: timeValidation.accuracy,
          warnings: timeValidation.warnings
        }
      }
      
    } catch (error) {
      logger.error('Clock out failed', { 
        studentId: request.studentId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      
      // If network error, queue for offline processing
      if (this.isNetworkError(error)) {
        return this.handleOfflineClockOut(request)
      }
      
      throw error
    }
  }

  /**
   * Handle offline clock-in operation
   */
  private async handleOfflineClockIn(request: ClockInRequest): Promise<ClockStatus> {
    const offlineTimestamp = this.timeSyncService.getCurrentTime()
    
    // Queue the operation for when back online
    await offlineQueue.enqueue({
      type: 'clock-in',
      data: {
        ...request,
        offlineTimestamp: offlineTimestamp.getTime()
      },
      timestamp: Date.now(),
      maxRetries: 3,
      priority: 'high'
    })
    
    logger.info('Clock-in queued for offline processing', {
      studentId: request.studentId,
      offlineTimestamp: offlineTimestamp.toISOString()
    })
    
    // Return optimistic response
    return {
      studentId: request.studentId,
      isClocked: true,
      clockedInAt: offlineTimestamp,
      currentSite: request.siteId ? await this.getSiteInfo(request.siteId) : null,
      totalHoursToday: 0, // Will be calculated when synced
      isOffline: true,
      timeValidation: {
        isValid: true,
        serverTime: offlineTimestamp,
        clientTime: new Date(request.clientTimestamp),
        drift: 0,
        accuracy: this.timeSyncService.getOfflineAccuracy(),
        reason: 'Offline mode - queued for sync'
      }
    }
  }

  /**
   * Handle offline clock-out operation
   */
  private async handleOfflineClockOut(request: ClockOutRequest): Promise<ClockStatus> {
    const offlineTimestamp = this.timeSyncService.getCurrentTime()
    
    // Queue the operation for when back online
    await offlineQueue.enqueue({
      type: 'clock-out',
      data: {
        ...request,
        offlineTimestamp: offlineTimestamp.getTime()
      },
      timestamp: Date.now(),
      maxRetries: 3,
      priority: 'high'
    })
    
    logger.info('Clock-out queued for offline processing', {
      studentId: request.studentId,
      offlineTimestamp: offlineTimestamp.toISOString()
    })
    
    // Return optimistic response
    return {
      studentId: request.studentId,
      isClocked: false,
      clockedInAt: null,
      clockedOutAt: offlineTimestamp,
      currentSite: null,
      totalHoursToday: 0, // Will be calculated when synced
      isOffline: true,
      timeValidation: {
        isValid: true,
        serverTime: offlineTimestamp,
        clientTime: new Date(request.clientTimestamp),
        drift: 0,
        accuracy: this.timeSyncService.getOfflineAccuracy(),
        reason: 'Offline mode - queued for sync'
      }
    }
  }

  /**
   * Check if error is network-related
   */
  private isNetworkError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      return message.includes('network') || 
             message.includes('fetch') || 
             message.includes('connection') ||
             message.includes('timeout')
    }
    return false
  }

  /**
   * Process queued offline operations
   */
  async processOfflineQueue(): Promise<void> {
    try {
      const operations = await offlineQueue.getAll()
      
      for (const operation of operations) {
        if (operation.type === 'clock-in') {
          await this.processOfflineClockIn(operation)
        } else if (operation.type === 'clock-out') {
          await this.processOfflineClockOut(operation)
        }
      }
      
    } catch (error) {
      logger.error('Failed to process offline queue', { error })
    }
  }

  /**
   * Process offline clock-in operation
   */
  private async processOfflineClockIn(operation: any): Promise<void> {
    try {
      const request = operation.data
      const result = await this.executeAtomicClockIn({
        studentId: request.studentId,
        siteId: request.siteId,
        location: request.location,
        clientTimestamp: request.offlineTimestamp
      })
      
      await offlineQueue.markCompleted(operation.id)
      logger.info('Offline clock-in processed successfully', { 
        operationId: operation.id,
        studentId: request.studentId 
      })
      
    } catch (error) {
      await offlineQueue.markFailed(operation.id, error instanceof Error ? error.message : 'Unknown error')
      logger.error('Failed to process offline clock-in', { 
        operationId: operation.id,
        error 
      })
    }
  }

  /**
   * Process offline clock-out operation
   */
  private async processOfflineClockOut(operation: any): Promise<void> {
    try {
      const request = operation.data
      const result = await this.executeAtomicClockOut({
        studentId: request.studentId,
        clientTimestamp: request.offlineTimestamp
      })
      
      await offlineQueue.markCompleted(operation.id)
      logger.info('Offline clock-out processed successfully', { 
        operationId: operation.id,
        studentId: request.studentId 
      })
      
    } catch (error) {
      await offlineQueue.markFailed(operation.id, error instanceof Error ? error.message : 'Unknown error')
      logger.error('Failed to process offline clock-out', { 
        operationId: operation.id,
        error 
      })
    }
  }

  /**
   * Get site information for display
   */
  private static async getSiteInfo(siteId: string): Promise<{ id: string; name: string; address: string } | undefined> {
    try {
      // Use cached site data for better performance
      const { getCachedSiteData } = await import('@/lib/database-optimization')
      const site = await getCachedSiteData(siteId)

      if (site) {
        return {
          id: site.id,
          name: site.name,
          address: site.address
        }
      }

      return {
        id: siteId,
        name: 'Unknown Site',
        address: 'Unknown Address'
      }
    } catch (error) {
      logger.warn('Failed to get site information', { siteId })
      return {
        id: siteId,
        name: 'Unknown Site',
        address: 'Unknown Address'
      }
    }
  }

  /**
   * Instance method wrapper for validateTimestamp
   */
  async validateTimestamp(
    clientTimestamp?: string,
    providedTimestamp?: string,
    config?: TimeValidationConfig
  ) {
    return ClockService.validateTimestamp(clientTimestamp, providedTimestamp, config)
  }

  /**
   * Instance method wrapper for getClockStatus
   */
  async getClockStatus(studentId: string) {
    try {
      const status = await ClockService.getClockStatus(studentId)
      return {
        success: true,
        data: status
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}