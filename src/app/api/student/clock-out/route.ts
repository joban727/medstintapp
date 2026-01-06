import { type NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth-clerk"
import type { UserRole } from "@/types"
import { ClockService } from "@/lib/clock-service"
import { ClockError, formatErrorResponse } from "@/lib/enhanced-error-handling"
import { logger } from "@/lib/logger"
import { TimingPerformanceMonitor } from "@/lib/high-precision-timing"
import { withCSRF } from "@/lib/csrf-middleware"

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

// CSRF-protected POST handler for clock-out
export const POST = withCSRF(async (request: NextRequest) => {
  return withErrorHandlingAsync(
    async () => {
      return TimingPerformanceMonitor.measure("student-clock-out", async () => {
        const requestId = Math.random().toString(36).substring(2)

        logger.info({ requestId }, "Clock-out API request started")

        // Get the authenticated user directly (streamlined for authenticated sessions)
        const user = await getCurrentUser()

        if (!user) {
          logger.warn({ requestId }, "Unauthenticated clock-out attempt")
          return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
        }

        // Only allow students to clock out
        if (user.role !== ("STUDENT" as UserRole as UserRole as UserRole)) {
          logger.warn(
            {
              requestId,
              role: user.role,
            },
            "Non-student clock-out attempt"
          )
          return createErrorResponse(ERROR_MESSAGES.ACCESS_DENIED, HTTP_STATUS.FORBIDDEN)
        }

        // Parse request body
        const body = await request.json()

        const clockOutRequest = {
          studentId: user.id,
          rotationId: body.rotationId, // Required by ClockOutRequest interface
          timestamp: body.timestamp,
          clientTimestamp: body.clientTimestamp,
          location: body.location,
          notes: body.notes,
          activities: body.activities,
        }

        // Execute atomic clock-out operation
        const result = await ClockService.clockOut(clockOutRequest)

        logger.info(
          {
            requestId,
            recordId: result.recordId,
            totalHours: result.totalHours,
          },
          "Clock-out API request completed successfully"
        )

        // Return success response with enhanced clock status
        return createSuccessResponse(
          {
            status: "clocked_out",
            clockedIn: result.clockedIn,
            clockInTime: result.clockInTime,
            clockOutTime: result.clockOutTime,
            totalHours: result.totalHours,
            recordId: result.recordId,
            timeRecordId: result.recordId,
            isClocked: result.isClocked,
            currentDuration: result.currentDuration || 0,
          },
          "Successfully clocked out"
        )
      })
    },
    {
      operation: "clock-out",
      customErrorHandler: (error) => {
        const requestId = Math.random().toString(36).substring(2)

        if (error instanceof ClockError) {
          logger.error(
            {
              requestId,
              type: error.type,
              code: error.code,
              retryable: error.retryable,
            },
            "Clock-out API request failed"
          )
        } else {
          logger.error(
            {
              requestId,
              error: error instanceof Error ? error.message : "Unknown error",
            },
            "Clock-out API request failed"
          )
        }

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
})
