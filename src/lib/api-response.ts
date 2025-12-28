/**
 * Standardized API Response Utilities
 * Ensures consistent response structures across all API endpoints
 */

import { NextResponse } from "next/server"
import { ClockError, ClockErrorType } from "@/lib/enhanced-error-handling"
import { ZodError } from "zod"

export interface StandardApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  timestamp?: string
  requestId?: string
  details?: any
}

export interface ApiErrorDetails {
  field?: string
  code?: string
  details?: any
}

export interface ValidationErrorResponse {
  success: false
  error: string
  details?: ApiErrorDetails[]
  timestamp: string
}

// Ensure response has a json() method in all environments
function ensureJsonMethod<R extends Response>(response: R): R & { json: () => Promise<any> } {
  const anyResp = response as any
  if (typeof anyResp.json !== "function") {
    anyResp.json = async () => {
      const text = await response.clone().text()
      try {
        return JSON.parse(text)
      } catch {
        return text
      }
    }
  }
  return anyResp
}

/**
 * Creates a successful API response with consistent structure
 */
export function createSuccessResponse<T>(
  data: T,
  message?: string,
  status: number = 200
): NextResponse<StandardApiResponse<T>> {
  const resp = NextResponse.json(
    {
      success: true,
      data,
      message,
      timestamp: new Date().toISOString(),
    },
    { status }
  )
  return ensureJsonMethod(resp) as NextResponse<StandardApiResponse<T>>
}

/**
 * Creates an error API response with consistent structure
 */
export function createErrorResponse(
  error: string,
  status: number = 500,
  details?: ApiErrorDetails[] | Record<string, any>
): NextResponse<StandardApiResponse> {
  const resp = NextResponse.json(
    {
      success: false,
      error,
      details,
      timestamp: new Date().toISOString(),
    },
    { status }
  )
  return ensureJsonMethod(resp) as NextResponse<StandardApiResponse>
}

/**
 * Creates a validation error response
 */
export function createValidationErrorResponse(
  error: string,
  details?: ApiErrorDetails[]
): NextResponse<ValidationErrorResponse> {
  const resp = NextResponse.json(
    {
      success: false,
      error,
      details,
      timestamp: new Date().toISOString(),
    },
    { status: 400 }
  )
  return ensureJsonMethod(resp) as NextResponse<ValidationErrorResponse>
}

/**
 * Standard HTTP status codes for consistent usage
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  PAYLOAD_TOO_LARGE: 413,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const

/**
 * Standard error messages for consistent usage
 */
export const ERROR_MESSAGES = {
  UNAUTHORIZED: "Unauthorized",
  FORBIDDEN: "Insufficient permissions",
  INSUFFICIENT_PERMISSIONS: "Insufficient permissions",
  NOT_FOUND: "Resource not found",
  VALIDATION_ERROR: "Validation failed",
  INTERNAL_ERROR: "Internal server error",
  INVALID_REQUEST: "Invalid request format",
  RESOURCE_EXISTS: "Resource already exists",
  ACCESS_DENIED: "Access denied",
} as const

/**
 * Wraps async API handlers with consistent error handling.
 * Use this with: export const GET = withErrorHandling(handler)
 * Returns a wrapped callable handler suitable for Next.js route handlers.
 */
export function withErrorHandling(
  handler: (...args: any[]) => Promise<NextResponse<any>>
): (...args: any[]) => Promise<NextResponse<any>> {
  return async (...args: any[]): Promise<NextResponse<any>> => {
    try {
      const resp = await handler(...args)
      return ensureJsonMethod(resp)
    } catch (error) {
      console.error("API Error:", error)

      // Map ClockError to appropriate HTTP status and include structured details
      if (error instanceof ClockError) {
        const status = mapClockErrorToStatus(error)
        const details = error.toJSON()
        const resp = createErrorResponse(error.message, status, details)
        return ensureJsonMethod(resp)
      }

      // Handle Zod validation errors explicitly
      if (error instanceof ZodError) {
        const details = error.issues.map((issue) => ({
          field: issue.path?.join(".") || "",
          code: issue.code,
          details: issue.message,
        }))
        const resp = createValidationErrorResponse(ERROR_MESSAGES.VALIDATION_ERROR, details)
        return ensureJsonMethod(resp)
      }

      // Fallback: generic error
      const resp = createErrorResponse(
        error instanceof Error ? error.message : ERROR_MESSAGES.INTERNAL_ERROR,
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
      return ensureJsonMethod(resp)
    }
  }
}

/**
 * Options for withErrorHandlingAsync
 */
interface ErrorHandlingOptions {
  operation?: string
  customErrorHandler?: (error: unknown) => NextResponse<any> | null
}

/**
 * Async version of withErrorHandling for use inside async function handlers.
 * Use this with: return withErrorHandlingAsync(async () => {...})
 * Immediately executes the handler and returns the result.
 */
export async function withErrorHandlingAsync(
  handler: () => Promise<NextResponse<any>>,
  options?: ErrorHandlingOptions
): Promise<NextResponse<any>> {
  try {
    const resp = await handler()
    return ensureJsonMethod(resp)
  } catch (error) {
    console.error(`API Error${options?.operation ? ` (${options.operation})` : ""}:`, error)

    // Try custom error handler first if provided
    if (options?.customErrorHandler) {
      const customResponse = options.customErrorHandler(error)
      if (customResponse) {
        return ensureJsonMethod(customResponse)
      }
    }

    // Map ClockError to appropriate HTTP status and include structured details
    if (error instanceof ClockError) {
      const status = mapClockErrorToStatus(error)
      const details = error.toJSON()
      const resp = createErrorResponse(error.message, status, details)
      return ensureJsonMethod(resp)
    }

    // Handle Zod validation errors explicitly
    if (error instanceof ZodError) {
      const details = error.issues.map((issue) => ({
        field: issue.path?.join(".") || "",
        code: issue.code,
        details: issue.message,
      }))
      const resp = createValidationErrorResponse(ERROR_MESSAGES.VALIDATION_ERROR, details)
      return ensureJsonMethod(resp)
    }

    // Fallback: generic error
    const resp = createErrorResponse(
      error instanceof Error ? error.message : ERROR_MESSAGES.INTERNAL_ERROR,
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    )
    return ensureJsonMethod(resp)
  }
}



/**
 * Maps ClockError types/codes to appropriate HTTP status codes
 */
function mapClockErrorToStatus(error: ClockError): number {
  switch (error.type) {
    case ClockErrorType.VALIDATION_ERROR:
      // Use 422 for semantic validation issues (e.g., rotation not found)
      return HTTP_STATUS.UNPROCESSABLE_ENTITY
    case ClockErrorType.BUSINESS_LOGIC_ERROR:
      // Business rule violations also typically map to 422
      return HTTP_STATUS.UNPROCESSABLE_ENTITY
    case ClockErrorType.AUTHENTICATION_ERROR:
      return HTTP_STATUS.UNAUTHORIZED
    case ClockErrorType.AUTHORIZATION_ERROR:
      return HTTP_STATUS.FORBIDDEN
    case ClockErrorType.NETWORK_ERROR:
      // Treat transient network issues as 503 Service Unavailable
      return 503
    case ClockErrorType.EXTERNAL_SERVICE_ERROR:
      // Bad gateway when upstream fails
      return 502
    case ClockErrorType.DATABASE_ERROR:
      return HTTP_STATUS.INTERNAL_SERVER_ERROR
    case ClockErrorType.SYSTEM_ERROR:
    default:
      return HTTP_STATUS.INTERNAL_SERVER_ERROR
  }
}

/**
 * Validates required fields in request data
 */
export function validateRequiredFields(
  data: Record<string, any>,
  requiredFields: string[]
): ApiErrorDetails[] | null {
  const errors: ApiErrorDetails[] = []

  for (const field of requiredFields) {
    if (!data[field] || (typeof data[field] === "string" && data[field].trim() === "")) {
      errors.push({
        field,
        code: "REQUIRED",
        details: `${field} is required`,
      })
    }
  }

  return errors.length > 0 ? errors : null
}

/**
 * Creates a paginated response structure
 */
export interface PaginatedResponse<T> {
  items: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

export function createPaginatedResponse<T>(
  items: T[],
  page: number,
  limit: number,
  total: number
): NextResponse<StandardApiResponse<PaginatedResponse<T>>> {
  const totalPages = Math.ceil(total / limit)

  return createSuccessResponse({
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  })
}
