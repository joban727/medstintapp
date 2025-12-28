// Comprehensive Error Handling Utilities
// Provides standardized error handling, logging, and recovery mechanisms

import { logger } from "./logger"

export type ErrorSeverity = "low" | "medium" | "high" | "critical"
export type ErrorCategory =
  | "validation"
  | "authentication"
  | "authorization"
  | "database"
  | "network"
  | "system"
  | "user"

interface ErrorContext {
  userId?: string
  sessionId?: string
  requestId?: string
  component?: string
  action?: string
  metadata?: Record<string, unknown>
}

export interface AppError {
  code: string
  message: string
  severity: ErrorSeverity
  category: ErrorCategory
  context?: ErrorContext
  originalError?: Error
  timestamp: Date
  recoverable: boolean
  userMessage?: string
}

// Standard error codes
export const ERROR_CODES = {
  // Authentication errors
  AUTH_REQUIRED: "AUTH_REQUIRED",
  AUTH_INVALID: "AUTH_INVALID",
  AUTH_EXPIRED: "AUTH_EXPIRED",
  AUTH_INSUFFICIENT_PERMISSIONS: "AUTH_INSUFFICIENT_PERMISSIONS",

  // Validation errors
  VALIDATION_REQUIRED_FIELD: "VALIDATION_REQUIRED_FIELD",
  VALIDATION_INVALID_FORMAT: "VALIDATION_INVALID_FORMAT",
  VALIDATION_OUT_OF_RANGE: "VALIDATION_OUT_OF_RANGE",

  // Database errors
  DB_CONNECTION_FAILED: "DB_CONNECTION_FAILED",
  DB_QUERY_FAILED: "DB_QUERY_FAILED",
  DB_CONSTRAINT_VIOLATION: "DB_CONSTRAINT_VIOLATION",
  DB_RECORD_NOT_FOUND: "DB_RECORD_NOT_FOUND",

  // Network errors
  NETWORK_TIMEOUT: "NETWORK_TIMEOUT",
  NETWORK_UNAVAILABLE: "NETWORK_UNAVAILABLE",
  NETWORK_RATE_LIMITED: "NETWORK_RATE_LIMITED",

  // System errors
  SYSTEM_UNAVAILABLE: "SYSTEM_UNAVAILABLE",
  SYSTEM_OVERLOADED: "SYSTEM_OVERLOADED",
  SYSTEM_MAINTENANCE: "SYSTEM_MAINTENANCE",

  // User errors
  USER_NOT_FOUND: "USER_NOT_FOUND",
  USER_ALREADY_EXISTS: "USER_ALREADY_EXISTS",
  USER_ONBOARDING_INCOMPLETE: "USER_ONBOARDING_INCOMPLETE",
} as const

export class AppErrorHandler {
  private static instance: AppErrorHandler

  static getInstance(): AppErrorHandler {
    if (!AppErrorHandler.instance) {
      AppErrorHandler.instance = new AppErrorHandler()
    }
    return AppErrorHandler.instance
  }

  createError(
    code: string,
    message: string,
    severity: ErrorSeverity,
    category: ErrorCategory,
    context?: ErrorContext,
    originalError?: Error
  ): AppError {
    return {
      code,
      message,
      severity,
      category,
      context,
      originalError,
      timestamp: new Date(),
      recoverable: this.isRecoverable(code, severity),
      userMessage: this.getUserMessage(code, message),
    }
  }

  handleError(error: AppError | Error, context?: ErrorContext): AppError {
    let appError: AppError

    if (error instanceof Error) {
      appError = this.convertToAppError(error, context)
    } else {
      appError = error
    }

    // Log the error
    this.logError(appError)

    // Report to monitoring service if critical
    if (appError.severity === "critical") {
      this.reportCriticalError(appError)
    }

    return appError
  }

  private convertToAppError(error: Error, context?: ErrorContext): AppError {
    // Try to categorize the error based on its properties
    let code = "SYSTEM_UNKNOWN_ERROR"
    let severity: ErrorSeverity = "medium"
    let category: ErrorCategory = "system"

    // Database errors
    if (error.message.includes("database") || error.message.includes("connection")) {
      code = ERROR_CODES.DB_CONNECTION_FAILED
      severity = "high"
      category = "database"
    }

    // Network errors
    if (error.message.includes("fetch") || error.message.includes("network")) {
      code = ERROR_CODES.NETWORK_UNAVAILABLE
      severity = "medium"
      category = "network"
    }

    // Authentication errors
    if (error.message.includes("unauthorized") || error.message.includes("auth")) {
      code = ERROR_CODES.AUTH_INVALID
      severity = "medium"
      category = "authentication"
    }

    return this.createError(code, error.message, severity, category, context, error)
  }

  private isRecoverable(code: string, severity: ErrorSeverity): boolean {
    // Critical errors are generally not recoverable
    if (severity === "critical") return false

    // Some specific errors are recoverable
    const recoverableErrors = [
      ERROR_CODES.NETWORK_TIMEOUT,
      ERROR_CODES.NETWORK_RATE_LIMITED,
      ERROR_CODES.VALIDATION_REQUIRED_FIELD,
      ERROR_CODES.VALIDATION_INVALID_FORMAT,
    ]

    return recoverableErrors.includes(code as (typeof recoverableErrors)[number])
  }

  private getUserMessage(code: string, _defaultMessage: string): string {
    const userMessages: Record<string, string> = {
      [ERROR_CODES.AUTH_REQUIRED]: "Please sign in to continue.",
      [ERROR_CODES.AUTH_INVALID]: "Your session has expired. Please sign in again.",
      [ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS]:
        "You don't have permission to perform this action.",
      [ERROR_CODES.DB_CONNECTION_FAILED]:
        "We're experiencing technical difficulties. Please try again later.",
      [ERROR_CODES.NETWORK_TIMEOUT]:
        "The request timed out. Please check your connection and try again.",
      [ERROR_CODES.NETWORK_UNAVAILABLE]:
        "Unable to connect to our servers. Please check your internet connection.",
      [ERROR_CODES.USER_NOT_FOUND]: "User not found. Please check your information and try again.",
      [ERROR_CODES.USER_ONBOARDING_INCOMPLETE]: "Please complete your profile setup to continue.",
      [ERROR_CODES.VALIDATION_REQUIRED_FIELD]: "Please fill in all required fields.",
      [ERROR_CODES.VALIDATION_INVALID_FORMAT]: "Please check your input format and try again.",
    }

    return userMessages[code] || "An unexpected error occurred. Please try again."
  }

  private logError(error: AppError): void {
    const logLevel = this.getLogLevel(error.severity)

    if (logLevel === "error") {
      logger.error(
        {
          code: error.code,
          severity: error.severity,
          category: error.category,
          recoverable: error.recoverable,
          context: error.context ? JSON.stringify(error.context) : undefined,
          timestamp: error.timestamp.toISOString(),
          originalError: error.originalError,
        },
        `${error.code}: ${error.message}`
      )
    } else {
      logger[logLevel]({
        code: error.code,
        severity: error.severity,
        category: error.category,
        recoverable: error.recoverable,
        context: error.context ? JSON.stringify(error.context) : undefined,
        timestamp: error.timestamp.toISOString(),
      }, `${error.code}: ${error.message}`)
    }
  }

  private getLogLevel(severity: ErrorSeverity): "debug" | "info" | "warn" | "error" {
    switch (severity) {
      case "low":
        return "warn"
      case "medium":
        return "error"
      case "high":
        return "error"
      case "critical":
        return "error"
      default:
        return "error"
    }
  }

  private reportCriticalError(error: AppError): void {
    // In a real application, this would send to an error monitoring service
    // like Sentry, Bugsnag, or similar
    console.error("CRITICAL ERROR REPORTED:", {
      code: error.code,
      message: error.message,
      context: error.context,
      timestamp: error.timestamp,
      stack: error.originalError?.stack,
    })
  }
}

// Convenience functions
export const errorHandler = AppErrorHandler.getInstance()

export function createError(
  code: string,
  message: string,
  severity: ErrorSeverity = "medium",
  category: ErrorCategory = "system",
  context?: ErrorContext
): AppError {
  return errorHandler.createError(code, message, severity, category, context)
}

export function handleError(error: Error | AppError, context?: ErrorContext): AppError {
  return errorHandler.handleError(error, context)
}

// React error boundary helper
// Note: This would be implemented with a proper React Error Boundary component
export function withErrorBoundary<T extends Record<string, unknown>>(
  Component: React.ComponentType<T>,
  _fallback?: React.ComponentType<{ error: AppError; retry: () => void }>
) {
  // This is a placeholder - actual implementation would use React Error Boundary
  return Component
}

// API error response helper
export function createErrorResponse(error: AppError, status?: number) {
  const statusCode = status || getStatusCodeFromError(error)

  return {
    error: {
      code: error.code,
      message: error.userMessage || error.message,
      severity: error.severity,
      recoverable: error.recoverable,
      timestamp: error.timestamp,
    },
    status: statusCode,
  }
}

function getStatusCodeFromError(error: AppError): number {
  switch (error.category) {
    case "authentication":
      return error.code === ERROR_CODES.AUTH_REQUIRED ? 401 : 401
    case "authorization":
      return 403
    case "validation":
      return 400
    case "database":
      return error.code === ERROR_CODES.DB_RECORD_NOT_FOUND ? 404 : 500
    case "network":
      return 503
    case "system":
      return 500
    default:
      return 500
  }
}

// Async operation wrapper with error handling
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context?: ErrorContext
): Promise<{ data?: T; error?: AppError }> {
  try {
    const data = await operation()
    return { data }
  } catch (error) {
    const appError = handleError(error as Error, context)
    return { error: appError }
  }
}
