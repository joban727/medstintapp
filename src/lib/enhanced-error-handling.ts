/**
 * Enhanced Error Handling Framework
 *
 * Provides comprehensive error classification, handling, and recovery mechanisms
 * for the MedStint clock tracking system.
 */

export enum ClockErrorType {
  VALIDATION_ERROR = "VALIDATION_ERROR",
  BUSINESS_LOGIC_ERROR = "BUSINESS_LOGIC_ERROR",
  SYSTEM_ERROR = "SYSTEM_ERROR",
  NETWORK_ERROR = "NETWORK_ERROR",
  AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR",
  AUTHORIZATION_ERROR = "AUTHORIZATION_ERROR",
  DATABASE_ERROR = "DATABASE_ERROR",
  EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR",
}

export enum SecurityEventType {
  UNAUTHORIZED_ACCESS = "UNAUTHORIZED_ACCESS",
  INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS",
  SUSPICIOUS_ACTIVITY = "SUSPICIOUS_ACTIVITY",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  INVALID_TOKEN = "INVALID_TOKEN",
  ACCOUNT_LOCKED = "ACCOUNT_LOCKED",
}

export class ClockError extends Error {
  public readonly timestamp: Date
  public readonly errorId: string

  constructor(
    public readonly type: ClockErrorType,
    public readonly code: string,
    message: string,
    public readonly retryable: boolean = false,
    public readonly context?: Record<string, any>
  ) {
    super(message)
    this.name = "ClockError"
    this.timestamp = new Date()
    this.errorId = `${type}_${Date.now()}_${Math.random().toString(36).substring(2)}`
  }

  toJSON() {
    return {
      errorId: this.errorId,
      type: this.type,
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
    }
  }
}

export class SecurityError extends ClockError {
  constructor(
    message: string,
    public readonly securityEventType: SecurityEventType,
    context?: Record<string, any>
  ) {
    super(ClockErrorType.AUTHORIZATION_ERROR, securityEventType, message, false, context)
    this.name = "SecurityError"
  }
}

// Error factory functions
export function createValidationError(message: string, field?: string, value?: any): ClockError {
  // Check for specific validation errors and return appropriate error codes
  if (
    message.includes("Location accuracy too low") ||
    field === "accuracy" ||
    (field && field.includes("accuracy"))
  ) {
    return new ClockError(
      ClockErrorType.VALIDATION_ERROR,
      "LOCATION_ACCURACY_TOO_LOW",
      message,
      false,
      { field, value }
    )
  }

  // Check for timestamp-related errors
  if (message.includes("too far in the future") || message.includes("future")) {
    return new ClockError(ClockErrorType.VALIDATION_ERROR, "FUTURE_TIMESTAMP", message, false, {
      field,
      value,
    })
  }

  if (message.includes("too far in the past") || message.includes("past")) {
    return new ClockError(ClockErrorType.VALIDATION_ERROR, "PAST_TIMESTAMP", message, false, {
      field,
      value,
    })
  }

  if (message.includes("Time synchronization") || message.includes("drift")) {
    return new ClockError(ClockErrorType.VALIDATION_ERROR, "TIME_SYNC_ERROR", message, false, {
      field,
      value,
    })
  }

  return new ClockError(ClockErrorType.VALIDATION_ERROR, "VALIDATION_ERROR", message, false, {
    field,
    value,
  })
}

export function createBusinessLogicError(
  message: string,
  code: string,
  context?: Record<string, any>
): ClockError {
  // Ensure we have proper error codes for common business logic errors
  let errorCode = code

  if (message.includes("already clocked in") || message.includes("already clocked")) {
    errorCode = "ALREADY_CLOCKED_IN"
  } else if (message.includes("too far from") || message.includes("Location is too far")) {
    errorCode = "LOCATION_TOO_FAR"
  } else if (message.includes("No active") || message.includes("no active session")) {
    errorCode = "NO_ACTIVE_SESSION"
  } else if (message.includes("too short") || message.includes("minimum")) {
    errorCode = "SESSION_TOO_SHORT"
  }

  return new ClockError(ClockErrorType.BUSINESS_LOGIC_ERROR, errorCode, message, false, context)
}

export function createSystemError(
  message: string,
  retryable = true,
  context?: Record<string, any>
): ClockError {
  return new ClockError(ClockErrorType.SYSTEM_ERROR, "SYSTEM_FAILURE", message, retryable, context)
}

export function createDatabaseError(
  message: string,
  operation?: string,
  retryable = true
): ClockError {
  return new ClockError(
    ClockErrorType.DATABASE_ERROR,
    "DATABASE_OPERATION_FAILED",
    message,
    retryable,
    { operation }
  )
}

export function createSecurityError(
  message: string,
  eventType: SecurityEventType,
  context?: Record<string, any>
): SecurityError {
  return new SecurityError(message, eventType, context)
}

// Error handler interface
export interface ErrorHandler {
  handle(error: ClockError): Promise<void>
  canHandle(error: ClockError): boolean
}

// Retry mechanism
export class RetryManager {
  private static readonly DEFAULT_MAX_ATTEMPTS = 3
  private static readonly DEFAULT_BASE_DELAY = 1000 // 1 second

  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxAttempts: number = RetryManager.DEFAULT_MAX_ATTEMPTS,
    baseDelay: number = RetryManager.DEFAULT_BASE_DELAY,
    shouldRetry?: (error: any) => boolean
  ): Promise<T> {
    let lastError: any

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error

        // Check if error is retryable
        const isRetryable = shouldRetry
          ? shouldRetry(error)
          : error instanceof ClockError
            ? error.retryable
            : true

        if (!isRetryable || attempt === maxAttempts) {
          throw error
        }

        // Exponential backoff with jitter
        const delay = baseDelay * 2 ** (attempt - 1) + Math.random() * 1000
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    throw lastError
  }
}

// Circuit breaker pattern
export class CircuitBreaker {
  private failures = 0
  private lastFailureTime = 0
  private state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED"

  constructor(
    private readonly failureThreshold: number = 5,
    private readonly recoveryTimeout: number = 60000, // 1 minute
    private readonly successThreshold: number = 2
  ) { }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailureTime < this.recoveryTimeout) {
        throw createSystemError("Circuit breaker is OPEN", false)
      }
      this.state = "HALF_OPEN"
    }

    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess(): void {
    this.failures = 0
    this.state = "CLOSED"
  }

  private onFailure(): void {
    this.failures++
    this.lastFailureTime = Date.now()

    if (this.failures >= this.failureThreshold) {
      this.state = "OPEN"
    }
  }

  getState(): string {
    return this.state
  }
}

// Error response formatter
export function formatErrorResponse(error: ClockError | Error, includeStack = false) {
  if (error instanceof ClockError) {
    return {
      success: false,
      error: {
        id: error.errorId,
        type: error.type,
        code: error.code,
        message: error.message,
        retryable: error.retryable,
        timestamp: error.timestamp.toISOString(),
        ...(includeStack && { stack: error.stack }),
      },
    }
  }

  // Handle generic errors
  return {
    success: false,
    error: {
      id: `GENERIC_${Date.now()}_${Math.random().toString(36).substring(2)}`,
      type: ClockErrorType.SYSTEM_ERROR,
      code: "UNKNOWN_ERROR",
      message: error.message || "An unexpected error occurred",
      retryable: false,
      timestamp: new Date().toISOString(),
      ...(includeStack && { stack: error.stack }),
    },
  }
}

// Audit logger for security events
export class AuditLogger {
  static log(eventType: SecurityEventType, details: Record<string, any>): void {
    const auditEvent = {
      timestamp: new Date().toISOString(),
      eventType,
      details: {
        ...details,
        // Remove sensitive information
        userId: details.userId ? `user_${details.userId.substring(0, 8)}***` : undefined,
      },
    }

    // In production, this would go to a secure audit log
    console.log("[AUDIT]", JSON.stringify(auditEvent))
  }
}

// Global error handler
export function setupGlobalErrorHandlers(): void {
  // Handle unhandled promise rejections
  process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason)
    AuditLogger.log(SecurityEventType.SUSPICIOUS_ACTIVITY, {
      type: "unhandled_rejection",
      reason: reason instanceof Error ? reason.message : String(reason),
    })
  })

  // Handle uncaught exceptions
  process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error)
    AuditLogger.log(SecurityEventType.SUSPICIOUS_ACTIVITY, {
      type: "uncaught_exception",
      error: error.message,
    })

    // In production, you might want to gracefully shutdown
    // process.exit(1)
  })
}
