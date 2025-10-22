/**
 * Comprehensive error handling and validation system for time tracking
 */

// Error types and interfaces
export interface TimeTrackingError {
  code: string
  message: string
  details?: Record<string, any>
  timestamp: Date
  userId?: string
  context?: string
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export interface RetryOptions {
  maxAttempts: number
  baseDelay: number
  maxDelay: number
  backoffMultiplier: number
}

// Error codes
export const ERROR_CODES = {


  
  // Time tracking errors
  ALREADY_CLOCKED_IN: 'ALREADY_CLOCKED_IN',
  NOT_CLOCKED_IN: 'NOT_CLOCKED_IN',
  INVALID_TIME_RECORD: 'INVALID_TIME_RECORD',
  TIME_OVERLAP_DETECTED: 'TIME_OVERLAP_DETECTED',
  FUTURE_TIME_NOT_ALLOWED: 'FUTURE_TIME_NOT_ALLOWED',
  
  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // Authentication errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  
  // Validation errors
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',
  OUT_OF_RANGE: 'OUT_OF_RANGE',
  
  // System errors
  DATABASE_ERROR: 'DATABASE_ERROR',
  WEBSOCKET_ERROR: 'WEBSOCKET_ERROR',
  CACHE_ERROR: 'CACHE_ERROR'
} as const

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES]

// Error classes
export class TimeTrackingError extends Error {
  public readonly code: ErrorCode
  public readonly details?: Record<string, any>
  public readonly timestamp: Date
  public readonly userId?: string
  public readonly context?: string

  constructor(
    code: ErrorCode,
    message: string,
    details?: Record<string, any>,
    userId?: string,
    context?: string
  ) {
    super(message)
    this.name = 'TimeTrackingError'
    this.code = code
    this.details = details
    this.timestamp = new Date()
    this.userId = userId
    this.context = context
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
      userId: this.userId,
      context: this.context,
      stack: this.stack
    }
  }
}

// Validation functions
export class TimeTrackingValidator {
  static validateClockInData(data: {
    rotationId?: string
    manualAddress?: string
    notes?: string
  }): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Required fields
    if (!data.rotationId) {
      errors.push('Rotation ID is required')
    }



    // Notes validation
    if (data.notes && data.notes.length > 1000) {
      warnings.push('Notes are quite long and may be truncated')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  static validateClockOutData(data: {
    timeRecordId?: string
    notes?: string
  }): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Required fields
    if (!data.timeRecordId) {
      errors.push('Time record ID is required for clock out')
    }



    // Notes validation
    if (!data.notes || data.notes.trim().length === 0) {
      warnings.push('No activities recorded for this shift')
    }

    if (data.notes && data.notes.length > 1000) {
      warnings.push('Notes are quite long and may be truncated')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  static validateTimeRecord(record: {
    clockInTime: Date
    clockOutTime?: Date
    totalHours?: number
  }): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    const now = new Date()
    
    // Clock in time validation
    if (record.clockInTime > now) {
      errors.push('Clock in time cannot be in the future')
    }

    // Clock out time validation
    if (record.clockOutTime) {
      if (record.clockOutTime > now) {
        errors.push('Clock out time cannot be in the future')
      }

      if (record.clockOutTime <= record.clockInTime) {
        errors.push('Clock out time must be after clock in time')
      }

      // Check for reasonable shift duration
      const durationHours = (record.clockOutTime.getTime() - record.clockInTime.getTime()) / (1000 * 60 * 60)
      
      if (durationHours > 24) {
        warnings.push('Shift duration exceeds 24 hours')
      }

      if (durationHours < 0.1) {
        warnings.push('Very short shift duration (less than 6 minutes)')
      }

      // Validate total hours calculation
      if (record.totalHours !== undefined) {
        const calculatedHours = Math.round(durationHours * 10000) / 10000 // 4 decimal places
        if (Math.abs(calculatedHours - record.totalHours) > 0.0001) {
          errors.push('Total hours calculation mismatch')
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }
}

// Retry mechanism with exponential backoff
export class RetryManager {
  private static readonly DEFAULT_OPTIONS: RetryOptions = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2
  }

  static async withRetry<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {}
  ): Promise<T> {
    const config = { ...RetryManager.DEFAULT_OPTIONS, ...options }
    let lastError: Error

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error as Error
        
        if (attempt === config.maxAttempts) {
          break
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          config.baseDelay * config.backoffMultiplier ** (attempt - 1),
          config.maxDelay
        )

        // Add jitter to prevent thundering herd
        const jitteredDelay = delay + Math.random() * 1000

        await new Promise(resolve => setTimeout(resolve, jitteredDelay))
      }
    }

    throw new TimeTrackingError(
      ERROR_CODES.NETWORK_ERROR,
      `Operation failed after ${config.maxAttempts} attempts: ${lastError.message}`,
      { originalError: lastError.message, attempts: config.maxAttempts }
    )
  }
}

// Error recovery strategies
export class ErrorRecoveryManager {
  static getRecoveryStrategy(error: TimeTrackingError): {
    canRecover: boolean
    strategy: string
    userMessage: string
    actionRequired?: string
  } {
    switch (error.code) {


      case ERROR_CODES.NETWORK_ERROR:
        return {
          canRecover: true,
          strategy: 'retry_with_backoff',
          userMessage: 'Network connection issue. Retrying automatically.',
          actionRequired: 'Check your internet connection'
        }

      case ERROR_CODES.ALREADY_CLOCKED_IN:
        return {
          canRecover: false,
          strategy: 'refresh_status',
          userMessage: 'You are already clocked in. Please refresh to see current status.',
          actionRequired: 'Clock out from current location first'
        }

      case ERROR_CODES.RATE_LIMIT_EXCEEDED:
        return {
          canRecover: true,
          strategy: 'wait_and_retry',
          userMessage: 'Too many requests. Please wait a moment before trying again.',
          actionRequired: 'Wait 30 seconds before retrying'
        }

      case ERROR_CODES.SESSION_EXPIRED:
        return {
          canRecover: true,
          strategy: 'refresh_session',
          userMessage: 'Your session has expired. Please log in again.',
          actionRequired: 'Refresh the page and log in again'
        }

      default:
        return {
          canRecover: false,
          strategy: 'manual_intervention',
          userMessage: 'An unexpected error occurred. Please contact support if the problem persists.',
          actionRequired: 'Contact technical support'
        }
    }
  }

  static async handleError(error: Error, context?: string): Promise<{
    handled: boolean
    recovery?: any
    userMessage: string
  }> {
    let timeTrackingError: TimeTrackingError

    if (error instanceof TimeTrackingError) {
      timeTrackingError = error
    } else {
      // Convert generic errors to TimeTrackingError
      timeTrackingError = new TimeTrackingError(
        ERROR_CODES.NETWORK_ERROR,
        error.message,
        { originalError: error.name },
        undefined,
        context
      )
    }

    const recovery = ErrorRecoveryManager.getRecoveryStrategy(timeTrackingError)

    // Log error for monitoring
    console.error('Time tracking error:', timeTrackingError.toJSON())

    return {
      handled: recovery.canRecover,
      recovery,
      userMessage: recovery.userMessage
    }
  }
}

// Network error detection and handling
export class NetworkErrorHandler {
  static isNetworkError(error: Error): boolean {
    return (
      error.message.includes('fetch') ||
      error.message.includes('network') ||
      error.message.includes('timeout') ||
      error.message.includes('connection') ||
      error.name === 'TypeError' && error.message.includes('Failed to fetch')
    )
  }

  static categorizeHttpError(status: number): ErrorCode {
    if (status >= 400 && status < 500) {
      switch (status) {
        case 401:
          return ERROR_CODES.UNAUTHORIZED
        case 403:
          return ERROR_CODES.FORBIDDEN
        case 409:
          return ERROR_CODES.ALREADY_CLOCKED_IN
        case 429:
          return ERROR_CODES.RATE_LIMIT_EXCEEDED
        default:
          return ERROR_CODES.NETWORK_ERROR
      }
    }if (status >= 500) {
      return ERROR_CODES.SERVER_ERROR
    }
    
    return ERROR_CODES.NETWORK_ERROR
  }
}

// Audit logging for errors
export class ErrorAuditLogger {
  private static errors: TimeTrackingError[] = []

  static log(error: TimeTrackingError): void {
    ErrorAuditLogger.errors.push(error)
    
    // Keep only last 100 errors in memory
    if (ErrorAuditLogger.errors.length > 100) {
      ErrorAuditLogger.errors = ErrorAuditLogger.errors.slice(-100)
    }

    // In production, this would send to a logging service
    if (process.env.NODE_ENV === 'production') {
      ErrorAuditLogger.sendToLoggingService(error)
    }
  }

  private static async sendToLoggingService(error: TimeTrackingError): Promise<void> {
    try {
      // This would be replaced with actual logging service integration
      await fetch('/api/logging/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(error.toJSON())
      })
    } catch (loggingError) {
      console.error('Failed to log error to service:', loggingError)
    }
  }

  static getRecentErrors(limit = 10): TimeTrackingError[] {
    return ErrorAuditLogger.errors.slice(-limit)
  }

  static getErrorsByCode(code: ErrorCode): TimeTrackingError[] {
    return ErrorAuditLogger.errors.filter(error => error.code === code)
  }
}