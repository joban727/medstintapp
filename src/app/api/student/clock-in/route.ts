import { type NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth-clerk"
import type { UserRole } from "@/types"
import { ClockService } from "@/lib/clock-service"
import {
  ClockError,
  formatErrorResponse,
  createValidationError,
} from "@/lib/enhanced-error-handling"
import { logger } from "@/lib/logger"
import { db } from "@/database/connection-pool"
import { rotations, siteAssignments } from "@/database/schema"
import { and, eq, sql, or, isNull, lte, gte } from "drizzle-orm"
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

// CSRF-protected POST handler for clock-in
export const POST = withCSRF(async (request: NextRequest) => {
  return withErrorHandlingAsync(
    async () => {
      return TimingPerformanceMonitor.measure("student-clock-in", async () => {
        const requestId = Math.random().toString(36).substring(2)

        logger.info({ requestId }, "Clock-in API request started")

        // Get the authenticated user directly (streamlined for authenticated sessions)
        const user = await getCurrentUser()

        if (!user) {
          logger.warn({ requestId }, "Unauthenticated clock-in attempt")
          return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
        }

        // Only allow students to clock in
        if (user.role !== ("STUDENT" as UserRole as UserRole as UserRole)) {
          logger.warn(
            {
              requestId,
              role: user.role,
            },
            "Non-student clock-in attempt"
          )
          return createErrorResponse(ERROR_MESSAGES.ACCESS_DENIED, HTTP_STATUS.FORBIDDEN)
        }

        // Parse request body
        const body = await request.json()

        // Resolve rotationId from siteId if rotationId is not provided
        let resolvedRotationId: string | undefined = body.rotationId

        if (!resolvedRotationId && body.siteId) {
          const now = new Date()

          logger.info(
            {
              requestId,
              studentId: user.id,
              siteId: body.siteId,
              currentTime: now.toISOString(),
            },
            "Attempting to resolve rotationId"
          )

          // Prefer ACTIVE rotation for the student at the given site and within date range
          const activeRotation = await db
            .select({ id: rotations.id })
            .from(rotations)
            .where(
              and(
                eq(rotations.studentId, user.id),
                eq(rotations.clinicalSiteId, body.siteId),
                eq(rotations.status, "ACTIVE"),
                // Handle open-ended rotations (null endDate) and optional startDate
                or(isNull(rotations.startDate), lte(rotations.startDate, now)),
                or(isNull(rotations.endDate), gte(rotations.endDate, now))
              )
            )
            .limit(1)

          logger.info(
            {
              requestId,
              activeRotation: activeRotation[0]?.id,
            },
            "Active rotation query result"
          )

          if (activeRotation[0]?.id) {
            resolvedRotationId = activeRotation[0].id
          } else {
            // Fallback to SCHEDULED rotation if within the date window
            // This handles cases where status wasn't updated but dates indicate the rotation is current
            const scheduledRotation = await db
              .select({ id: rotations.id })
              .from(rotations)
              .where(
                and(
                  eq(rotations.studentId, user.id),
                  eq(rotations.clinicalSiteId, body.siteId),
                  eq(rotations.status, "SCHEDULED"),
                  or(isNull(rotations.startDate), lte(rotations.startDate, now)),
                  or(isNull(rotations.endDate), gte(rotations.endDate, now))
                )
              )
              .limit(1)

            logger.info(
              {
                requestId,
                scheduledRotation: scheduledRotation[0]?.id,
              },
              "Scheduled rotation query result"
            )

            if (scheduledRotation[0]?.id) {
              resolvedRotationId = scheduledRotation[0].id
            } else {
              // New fallback: use active site assignment to resolve rotationId
              const assignment = await db
                .select({ rotationId: siteAssignments.rotationId })
                .from(siteAssignments)
                .where(
                  and(
                    eq(siteAssignments.studentId, user.id),
                    eq(siteAssignments.clinicalSiteId, body.siteId),
                    eq(siteAssignments.status, "ACTIVE"),
                    or(isNull(siteAssignments.startDate), lte(siteAssignments.startDate, now)),
                    or(isNull(siteAssignments.endDate), gte(siteAssignments.endDate, now))
                  )
                )
                .limit(1)

              logger.info(
                {
                  requestId,
                  assignmentRotationId: assignment[0]?.rotationId,
                },
                "Site assignment query result"
              )

              if (assignment[0]?.rotationId) {
                resolvedRotationId = assignment[0].rotationId as string
              } else {
                // Final fallback: pick any rotation at this site in date window regardless of status
                const anyRotation = await db
                  .select({ id: rotations.id })
                  .from(rotations)
                  .where(
                    and(
                      eq(rotations.studentId, user.id),
                      eq(rotations.clinicalSiteId, body.siteId),
                      or(isNull(rotations.startDate), lte(rotations.startDate, now)),
                      or(isNull(rotations.endDate), gte(rotations.endDate, now))
                    )
                  )
                  .limit(1)

                logger.info(
                  {
                    requestId,
                    anyRotation: anyRotation[0]?.id,
                  },
                  "Any rotation fallback result"
                )

                if (anyRotation[0]?.id) {
                  resolvedRotationId = anyRotation[0].id
                }
              }
            }
          }
        }

        if (!resolvedRotationId) {
          logger.warn(
            {
              requestId,
              studentId: user.id,
              siteId: body.siteId,
            },
            "No rotation found for clock-in"
          )
          throw createValidationError(
            "No active or scheduled rotation found for selected site",
            "rotationId",
            body.siteId
          )
        }

        const clockInRequest = {
          studentId: user.id,
          rotationId: resolvedRotationId,
          timestamp: body.timestamp,
          clientTimestamp: body.clientTimestamp,
          location: body.location,
          notes: body.notes,
        }

        // Execute atomic clock-in operation
        const result = await ClockService.clockIn(clockInRequest)

        logger.info(
          {
            requestId,
            recordId: result.recordId,
          },
          "Clock-in API request completed successfully"
        )

        // Return success response with enhanced clock status
        return createSuccessResponse(
          {
            status: "clocked_in",
            clockedIn: result.clockedIn,
            currentSite: result.currentSite || {
              name: "Clinical Site",
              address: "Site Address",
            },
            clockInTime: result.clockInTime,
            clockOutTime: null,
            totalHours: "0.00",
            recordId: result.recordId,
            timeRecordId: result.recordId,
            isClocked: result.isClocked,
            currentDuration: result.currentDuration || 0,
          },
          "Successfully clocked in"
        )
      })
    },
    {
      operation: "clock-in",
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
            "Clock-in API request failed"
          )
        } else {
          logger.error(
            {
              requestId,
              error: error instanceof Error ? error.message : "Unknown error",
            },
            "Clock-in API request failed"
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
