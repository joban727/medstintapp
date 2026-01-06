import { and, eq } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "../../../../database/connection-pool"
import { rotations, timecardCorrections, timeRecords, users } from "../../../../database/schema"
import { apiAuthMiddleware, logAuditEvent } from "../../../../lib/rbac-middleware"
import { cacheIntegrationService } from "@/lib/cache-integration"
import { withCSRF } from "@/lib/csrf-middleware"
import type { UserRole } from "@/types"

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
  createValidationErrorResponse,
  withErrorHandlingAsync,
  HTTP_STATUS,
  ERROR_MESSAGES,
} from "@/lib/api-response"

// Validation schema for updating corrections
const updateCorrectionSchema = z.object({
  requestedChanges: z
    .record(
      z.string(),
      z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.null(),
        z.date(),
        z.record(z.string(), z.unknown()), // Allow nested objects
      ])
    )
    .optional(),
  reason: z.string().min(10, "Reason must be at least 10 characters").optional(),
  studentNotes: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  dueDate: z.string().datetime().optional().nullable(),
})

// GET /api/timecard-corrections/[id] - Get specific correction details
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandlingAsync(async () => {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      "api:timecard-corrections/[id]/route.ts",
      async () => {
        // Original function logic will be wrapped here
        return await executeOriginalLogic()
      },
      300 // 5 minutes TTL
    )

    if (cached) {
      return cached
    }

    return await executeOriginalLogic()

    async function executeOriginalLogic() {
      const { id } = await params
      const authResult = await apiAuthMiddleware(request, {
        requiredPermissions: ["view_timecard_corrections", "approve_timesheets"],
        requireAny: true,
      })

      if (!authResult.success) {
        return createErrorResponse(
          authResult.error || ERROR_MESSAGES.UNAUTHORIZED,
          authResult.status || HTTP_STATUS.UNAUTHORIZED
        )
      }

      const { user } = authResult
      if (!user) {
        return createErrorResponse(ERROR_MESSAGES.NOT_FOUND, HTTP_STATUS.UNAUTHORIZED)
      }

      // Get correction with related data
      const correction = await db
        .select({
          id: timecardCorrections.id,
          originalTimeRecordId: timecardCorrections.originalTimeRecordId,
          studentId: timecardCorrections.studentId,
          studentName: users.name,
          studentEmail: users.email,
          rotationId: timecardCorrections.rotationId,
          correctionType: timecardCorrections.correctionType,
          requestedChanges: timecardCorrections.requestedChanges,
          reason: timecardCorrections.reason,
          studentNotes: timecardCorrections.studentNotes,
          status: timecardCorrections.status,
          reviewedBy: timecardCorrections.reviewedBy,
          reviewedAt: timecardCorrections.reviewedAt,
          reviewerNotes: timecardCorrections.reviewerNotes,
          appliedBy: timecardCorrections.appliedBy,
          appliedAt: timecardCorrections.appliedAt,
          originalData: timecardCorrections.originalData,
          priority: timecardCorrections.priority,
          dueDate: timecardCorrections.dueDate,
          createdAt: timecardCorrections.createdAt,
          updatedAt: timecardCorrections.updatedAt,
        })
        .from(timecardCorrections)
        .leftJoin(users, eq(timecardCorrections.studentId, users.id))
        .where(eq(timecardCorrections.id, id))
        .limit(1)

      if (correction.length === 0) {
        return createErrorResponse("Timecard correction not found", HTTP_STATUS.NOT_FOUND)
      }

      const correctionData = correction[0]

      // Check access permissions
      if (
        user.role === ("STUDENT" as UserRole as UserRole as UserRole) &&
        correctionData.studentId !== user.id
      ) {
        return createErrorResponse(
          "You can only view your own correction requests",
          HTTP_STATUS.FORBIDDEN
        )
      }

      if (user.role === ("CLINICAL_PRECEPTOR" as UserRole as UserRole as UserRole)) {
        // Check if this correction is for a student under this preceptor
        const rotation = await db
          .select({ preceptorId: rotations.preceptorId })
          .from(rotations)
          .where(eq(rotations.id, correctionData.rotationId))
          .limit(1)

        if (rotation.length === 0 || rotation[0].preceptorId !== user.id) {
          return createErrorResponse(
            "You can only view corrections for your students",
            HTTP_STATUS.FORBIDDEN
          )
        }
      }

      if (user.role === ("SCHOOL_ADMIN" as UserRole as UserRole as UserRole)) {
        // Check if the student belongs to the same school
        const student = await db
          .select({ schoolId: users.schoolId })
          .from(users)
          .where(eq(users.id, correctionData.studentId))
          .limit(1)

        if (student.length === 0 || student[0].schoolId !== user.schoolId) {
          return createErrorResponse(
            "You can only view corrections for students in your school",
            HTTP_STATUS.FORBIDDEN
          )
        }
      }

      // Get the original time record for comparison
      const originalTimeRecord = await db
        .select()
        .from(timeRecords)
        .where(eq(timeRecords.id, correctionData.originalTimeRecordId))
        .limit(1)

      await logAuditEvent({
        userId: user.id,
        action: "VIEW_TIMECARD_CORRECTION",
        resource: "timecard_corrections",
        resourceId: id,
        details: JSON.stringify({ correctionId: id }),
        ipAddress: request.headers.get("x-forwarded-for") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
      })

      return createSuccessResponse({
        correction: correctionData,
        originalTimeRecord: originalTimeRecord[0] || null,
      })
    }
  })
}

// PUT /api/timecard-corrections/[id] - Update correction request (only for pending corrections)
export const PUT = withCSRF(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    return withErrorHandlingAsync(async () => {
      const { id } = await params
      const authResult = await apiAuthMiddleware(request, {
        requiredPermissions: ["submit_timecard_corrections"],
      })

      if (!authResult.success) {
        return createErrorResponse(
          authResult.error || ERROR_MESSAGES.UNAUTHORIZED,
          authResult.status || HTTP_STATUS.UNAUTHORIZED
        )
      }

      const { user } = authResult
      if (!user) {
        return createErrorResponse(ERROR_MESSAGES.NOT_FOUND, HTTP_STATUS.UNAUTHORIZED)
      }

      const body = await request.json()
      let validatedData
      try {
        validatedData = updateCorrectionSchema.parse(body)
      } catch (error) {
        if (error instanceof z.ZodError) {
          return createValidationErrorResponse(
            ERROR_MESSAGES.VALIDATION_ERROR,
            error.issues.map((issue) => ({
              field: issue.path.join("."),
              code: issue.code,
              details: issue.message,
            }))
          )
        }
        throw error
      }

      // Get the existing correction
      const existingCorrection = await db
        .select()
        .from(timecardCorrections)
        .where(eq(timecardCorrections.id, id))
        .limit(1)

      if (existingCorrection.length === 0) {
        return createErrorResponse("Timecard correction not found", HTTP_STATUS.NOT_FOUND)
      }

      const correction = existingCorrection[0]

      // Only students can update their own pending corrections
      if (
        user.role === ("STUDENT" as UserRole as UserRole as UserRole) &&
        correction.studentId !== user.id
      ) {
        return createErrorResponse(
          "You can only update your own correction requests",
          HTTP_STATUS.FORBIDDEN
        )
      }

      // Only allow updates to pending corrections
      if (correction.status !== "PENDING") {
        return createErrorResponse(
          "Only pending corrections can be updated",
          HTTP_STATUS.BAD_REQUEST
        )
      }

      // Prepare update data
      const updateData: {
        updatedAt: Date
        requestedChanges?: string
        reason?: string
        studentNotes?: string
        priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
        dueDate?: Date | null
      } = {
        updatedAt: new Date(),
      }

      if (validatedData.requestedChanges !== undefined) {
        updateData.requestedChanges = JSON.stringify(validatedData.requestedChanges)
      }
      if (validatedData.reason !== undefined) {
        updateData.reason = validatedData.reason
      }
      if (validatedData.studentNotes !== undefined) {
        updateData.studentNotes = validatedData.studentNotes
      }
      if (validatedData.priority !== undefined) {
        updateData.priority = validatedData.priority
      }
      if (validatedData.dueDate !== undefined) {
        updateData.dueDate = validatedData.dueDate ? new Date(validatedData.dueDate) : null
      }

      // Update the correction
      const updatedCorrection = await db
        .update(timecardCorrections)
        .set(updateData)
        .where(eq(timecardCorrections.id, id))
        .returning()

      await logAuditEvent({
        userId: user.id,
        action: "UPDATE_TIMECARD_CORRECTION",
        resource: "timecard_corrections",
        resourceId: id,
        details: JSON.stringify({
          correctionId: id,
          updatedFields: Object.keys(updateData),
        }),
        ipAddress: request.headers.get("x-forwarded-for") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
      })

      // Invalidate related caches
      try {
        await cacheIntegrationService.clear()
      } catch (cacheError) {
        console.warn("Cache invalidation error in timecard-corrections/[id]/route.ts:", cacheError)
      }

      return createSuccessResponse({
        message: "Timecard correction updated successfully",
        correction: updatedCorrection[0],
      })
    })
  }
)

// DELETE /api/timecard-corrections/[id] - Cancel/delete correction request
export const DELETE = withCSRF(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    return withErrorHandlingAsync(async () => {
      const { id } = await params
      const authResult = await apiAuthMiddleware(request, {
        requiredPermissions: ["submit_timecard_corrections"],
      })

      if (!authResult.success) {
        return createErrorResponse(
          authResult.error || ERROR_MESSAGES.UNAUTHORIZED,
          authResult.status || HTTP_STATUS.UNAUTHORIZED
        )
      }

      const { user } = authResult
      if (!user) {
        return createErrorResponse(ERROR_MESSAGES.NOT_FOUND, HTTP_STATUS.UNAUTHORIZED)
      }

      // Get the existing correction
      const existingCorrection = await db
        .select()
        .from(timecardCorrections)
        .where(eq(timecardCorrections.id, id))
        .limit(1)

      if (existingCorrection.length === 0) {
        return createErrorResponse("Timecard correction not found", HTTP_STATUS.NOT_FOUND)
      }

      const correction = existingCorrection[0]

      // Authorization: Scope delete access appropriately per role
      if (user.role === ("STUDENT" as UserRole)) {
        // Students can only delete their own pending corrections
        if (correction.studentId !== user.id) {
          return createErrorResponse(
            "You can only delete your own correction requests",
            HTTP_STATUS.FORBIDDEN
          )
        }
      } else if (user.role === ("CLINICAL_PRECEPTOR" as UserRole)) {
        // Preceptors can only delete corrections for their students' rotations
        const preceptorRotation = await db
          .select({ id: rotations.id })
          .from(rotations)
          .where(and(eq(rotations.id, correction.rotationId), eq(rotations.preceptorId, user.id)))
          .limit(1)

        if (preceptorRotation.length === 0) {
          return createErrorResponse(
            "You can only delete corrections for your assigned students",
            HTTP_STATUS.FORBIDDEN
          )
        }
      } else if (
        user.role === ("CLINICAL_SUPERVISOR" as UserRole) ||
        user.role === ("SCHOOL_ADMIN" as UserRole)
      ) {
        // Supervisors and school admins can only delete corrections for their school's students
        if (user.schoolId) {
          const student = await db
            .select({ schoolId: users.schoolId })
            .from(users)
            .where(eq(users.id, correction.studentId))
            .limit(1)

          if (student.length === 0 || student[0].schoolId !== user.schoolId) {
            return createErrorResponse(
              "You can only delete corrections for students in your school",
              HTTP_STATUS.FORBIDDEN
            )
          }
        }
      }
      // SUPER_ADMIN: no additional checks, can delete any correction

      // Only allow deletion of pending corrections
      if (correction.status !== "PENDING") {
        return createErrorResponse(
          "Only pending corrections can be deleted",
          HTTP_STATUS.BAD_REQUEST
        )
      }

      // Delete the correction
      await db.delete(timecardCorrections).where(eq(timecardCorrections.id, id))

      await logAuditEvent({
        userId: user.id,
        action: "DELETE_TIMECARD_CORRECTION",
        resource: "timecard_corrections",
        resourceId: id,
        details: JSON.stringify({
          correctionId: id,
          originalTimeRecordId: correction.originalTimeRecordId,
        }),
        ipAddress: request.headers.get("x-forwarded-for") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
      })

      // Invalidate related caches
      try {
        await cacheIntegrationService.clear()
      } catch (cacheError) {
        console.warn("Cache invalidation error in timecard-corrections/[id]/route.ts:", cacheError)
      }

      return createSuccessResponse({
        message: "Timecard correction deleted successfully",
      })
    })
  }
)
