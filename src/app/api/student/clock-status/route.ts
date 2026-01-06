import { type NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth-clerk"
import type { UserRole } from "@/types"
import { ClockService } from "@/lib/clock-service"
import { ClockError, formatErrorResponse } from "@/lib/enhanced-error-handling"
import { logger } from "@/lib/logger"

// Role validation utilities
const hasRole = (userRole: UserRole, allowedRoles: UserRole[]): boolean => {
  return allowedRoles.includes(userRole)
}

const isAdmin = (userRole: UserRole): boolean => {
  return hasRole(userRole, ["ADMIN" as UserRole, "SUPER_ADMIN" as UserRole])
}

const isSchoolAdmin = (userRole: UserRole): boolean => {
  return hasRole(userRole, [
    "SCHOOL_ADMIN" as UserRole,
    "ADMIN" as UserRole,
    "SUPER_ADMIN" as UserRole,
  ])
}
import {
  createSuccessResponse,
  createErrorResponse,
  withErrorHandling,
  withErrorHandlingAsync,
  HTTP_STATUS,
  ERROR_MESSAGES,
} from "@/lib/api-response"

export async function GET(request: NextRequest) {
  return withErrorHandlingAsync(
    async () => {
      const requestId = Math.random().toString(36).substring(2)

      logger.info({ requestId }, "Clock-status API request started")

      // Get the authenticated user directly (streamlined for authenticated sessions)
      const user = await getCurrentUser()

      if (!user) {
        logger.warn({ requestId }, "Unauthenticated clock-status attempt")
        return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
      }

      // Only allow students to check clock status
      if (user.role !== ("STUDENT" as UserRole as UserRole as UserRole)) {
        logger.warn(
          {
            requestId,
            role: user.role,
          },
          "Non-student clock-status attempt"
        )
        return createErrorResponse(ERROR_MESSAGES.ACCESS_DENIED, HTTP_STATUS.FORBIDDEN)
      }

      // Get current clock status
      const status = await ClockService.getClockStatus(user.id)

      logger.info(
        {
          requestId,
          clockedIn: status.clockedIn,
        },
        "Clock-status API request completed successfully"
      )

      // Return clock status
      return createSuccessResponse(status, "Clock status retrieved successfully")
    },
    {
      operation: "get-clock-status",
      customErrorHandler: (error) => {
        const requestId = Math.random().toString(36).substring(2)

        logger.error(
          {
            requestId,
            error: error instanceof Error ? error.message : "Unknown error",
          },
          "Clock-status API request failed"
        )

        // Handle ClockError instances with proper error formatting
        if (error instanceof ClockError) {
          const statusCode =
            error.type === "VALIDATION_ERROR"
              ? HTTP_STATUS.BAD_REQUEST
              : error.type === "BUSINESS_LOGIC_ERROR"
                ? HTTP_STATUS.BAD_REQUEST
                : error.type === "AUTHORIZATION_ERROR"
                  ? HTTP_STATUS.FORBIDDEN
                  : HTTP_STATUS.INTERNAL_SERVER_ERROR

          return NextResponse.json(formatErrorResponse(error), { status: statusCode })
        }

        // Return null to use default error handling
        return null
      },
    }
  )
}
