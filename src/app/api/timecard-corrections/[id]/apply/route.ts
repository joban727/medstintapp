import { and, eq } from "drizzle-orm"
import { nanoid } from "nanoid"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "../../../../../database/connection-pool"

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
  auditLogs,
  rotations,
  timecardCorrections,
  timeRecords,
  users,
} from "../../../../../database/schema"
import { getCurrentUser } from "../../../../../lib/auth-clerk"
import { cacheIntegrationService } from "@/lib/cache-integration"
import type { UserRole } from "@/types"
import {
  createSuccessResponse,
  createErrorResponse,
  createValidationErrorResponse,
  withErrorHandlingAsync,
  HTTP_STATUS,
  ERROR_MESSAGES,
} from "@/lib/api-response"

// Validation schema for applying corrections
const applySchema = z.object({
  confirmApply: z.boolean().refine((val) => val === true, {
    message: "You must confirm the application of changes",
  }),
  adminNotes: z.string().optional(),
})

// POST /api/timecard-corrections/[id]/apply - Apply an approved timecard correction
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandlingAsync(async () => {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) {
      return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
    }

    const correctionId = id
    const body = await request.json()
    let validatedData
    try {
      validatedData = applySchema.parse(body)
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

    // Get the correction
    const [correction] = await db
      .select()
      .from(timecardCorrections)
      .where(eq(timecardCorrections.id, correctionId))
      .limit(1)

    if (!correction) {
      return createErrorResponse("Correction not found", HTTP_STATUS.NOT_FOUND)
    }

    // Check if correction is approved
    if (correction.status !== "APPROVED") {
      return createErrorResponse("Only approved corrections can be applied", HTTP_STATUS.CONFLICT)
    }

    // Check if correction has already been applied
    if (correction.appliedBy && correction.appliedAt) {
      return createErrorResponse("Correction has already been applied", HTTP_STATUS.CONFLICT)
    }

    // Check if user has permission to apply corrections
    let hasPermission = false

    if (
      [
        "SCHOOL_ADMIN" as UserRole,
        "CLINICAL_SUPERVISOR" as UserRole,
        "SUPER_ADMIN" as UserRole,
      ].includes(user.role)
    ) {
      hasPermission = true
    } else if (user.role === ("CLINICAL_PRECEPTOR" as UserRole as UserRole as UserRole)) {
      // Check if the preceptor is assigned to the rotation
      const [rotation] = await db
        .select()
        .from(rotations)
        .where(and(eq(rotations.id, correction.rotationId), eq(rotations.preceptorId, user.id)))
        .limit(1)

      if (rotation) {
        hasPermission = true
      }
    }

    if (!hasPermission) {
      return createErrorResponse(
        "You don't have permission to apply this correction",
        HTTP_STATUS.FORBIDDEN
      )
    }

    // Get the original time record
    const [originalRecord] = await db
      .select()
      .from(timeRecords)
      .where(eq(timeRecords.id, correction.originalTimeRecordId))
      .limit(1)

    if (!originalRecord) {
      return createErrorResponse("Original time record not found", HTTP_STATUS.NOT_FOUND)
    }

    // Parse requested changes
    let requestedChanges: Record<string, unknown> = {}
    try {
      requestedChanges = JSON.parse(correction.requestedChanges)
    } catch (_error) {
      return createErrorResponse("Invalid correction data format", HTTP_STATUS.BAD_REQUEST)
    }

    // Store original data before making changes (for audit trail)
    const originalDataBeforeChange = {
      date: originalRecord.date,
      clockIn: originalRecord.clockIn,
      clockOut: originalRecord.clockOut,
      totalHours: originalRecord.totalHours,
      activities: originalRecord.activities,
      notes: originalRecord.notes,
      status: originalRecord.status,
    }

    // Prepare update fields
    const now = new Date()
    const updateFields: {
      updatedAt: Date
      clockIn?: Date
      clockOut?: Date
      activities?: string
      notes?: string
      date?: Date
      totalHours?: string
    } = {
      updatedAt: now,
    }

    // Apply requested changes
    if (requestedChanges.clockIn) {
      updateFields.clockIn = new Date(requestedChanges.clockIn as string)
    }
    if (requestedChanges.clockOut) {
      updateFields.clockOut = new Date(requestedChanges.clockOut as string)
    }
    if (requestedChanges.activities !== undefined) {
      updateFields.activities = requestedChanges.activities as string
    }
    if (requestedChanges.notes !== undefined) {
      updateFields.notes = requestedChanges.notes as string
    }
    if (requestedChanges.date) {
      updateFields.date = new Date(requestedChanges.date as string)
    }

    // Recalculate total hours if clock times changed
    if (requestedChanges.clockIn || requestedChanges.clockOut) {
      const clockIn = requestedChanges.clockIn
        ? new Date(requestedChanges.clockIn as string)
        : originalRecord.clockIn
      const clockOut = requestedChanges.clockOut
        ? new Date(requestedChanges.clockOut as string)
        : originalRecord.clockOut

      if (clockIn && clockOut) {
        const diffMs = clockOut.getTime() - clockIn.getTime()
        if (diffMs < 0) {
          return createErrorResponse(
            "Clock out time cannot be before clock in time",
            HTTP_STATUS.BAD_REQUEST
          )
        }
        const diffHours = diffMs / (1000 * 60 * 60)
        updateFields.totalHours = Math.max(0, Math.round(diffHours * 100) / 100).toString()
      }
    }

    // Validate the changes make sense
    if (updateFields.totalHours && Number.parseFloat(updateFields.totalHours) > 24) {
      return createErrorResponse(
        "Total hours cannot exceed 24 hours per day",
        HTTP_STATUS.BAD_REQUEST
      )
    }

    try {
      // Start transaction-like operations
      // Update the time record
      await db
        .update(timeRecords)
        .set(updateFields)
        .where(eq(timeRecords.id, correction.originalTimeRecordId))

      // Mark correction as applied
      await db
        .update(timecardCorrections)
        .set({
          appliedBy: user.id,
          appliedAt: now,
          updatedAt: now,
        })
        .where(eq(timecardCorrections.id, correctionId))

      // Create detailed audit log entry
      await db.insert(auditLogs).values({
        id: nanoid(),
        userId: user.id,
        action: "TIMECARD_CORRECTION_APPLIED",
        resource: "TIME_RECORD",
        resourceId: correction.originalTimeRecordId,
        details: JSON.stringify({
          correctionId,
          originalTimeRecordId: correction.originalTimeRecordId,
          studentId: correction.studentId,
          rotationId: correction.rotationId,
          correctionType: correction.correctionType,
          originalData: originalDataBeforeChange,
          appliedChanges: requestedChanges,
          finalData: {
            ...originalDataBeforeChange,
            ...updateFields,
          },
          adminNotes: validatedData.adminNotes,
          appliedBy: user.id,
          appliedAt: now.toISOString(),
        }),
        ipAddress:
          request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
        createdAt: now,
      })

      return createSuccessResponse({
        message: "Timecard correction applied successfully",
        appliedChanges: requestedChanges,
        appliedAt: now.toISOString(),
        appliedBy: user.id,
      })
    } catch (error) {
      console.error("Error applying correction:", error)
      return createErrorResponse(
        "Failed to apply correction changes",
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  })
}

// GET /api/timecard-corrections/[id]/apply - Get correction application preview
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandlingAsync(async () => {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      "api:timecard-corrections/[id]/apply/route.ts",
      async () => {
        // Original function logic will be wrapped here
        return await executeOriginalLogic()
      },
      300 // 5 minutes TTL
    )

    if (cached) {
      return cached
    }

    async function executeOriginalLogic() {
      const { id } = await params
      const user = await getCurrentUser()
      if (!user) {
        return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
      }

      const correctionId = id

      // Get the correction with related data
      const [correctionData] = await db
        .select({
          // Correction data
          id: timecardCorrections.id,
          originalTimeRecordId: timecardCorrections.originalTimeRecordId,
          studentId: timecardCorrections.studentId,
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
          priority: timecardCorrections.priority,
          dueDate: timecardCorrections.dueDate,
          createdAt: timecardCorrections.createdAt,
          // Student data
          studentName: users.name,
          studentEmail: users.email,
          // Original time record data
          originalRecordDate: timeRecords.date,
          originalRecordClockIn: timeRecords.clockIn,
          originalRecordClockOut: timeRecords.clockOut,
          originalRecordTotalHours: timeRecords.totalHours,
          originalRecordActivities: timeRecords.activities,
          originalRecordNotes: timeRecords.notes,
          originalRecordStatus: timeRecords.status,
        })
        .from(timecardCorrections)
        .leftJoin(users, eq(timecardCorrections.studentId, users.id))
        .leftJoin(timeRecords, eq(timecardCorrections.originalTimeRecordId, timeRecords.id))
        .where(eq(timecardCorrections.id, correctionId))
        .limit(1)

      if (!correctionData) {
        return createErrorResponse("Correction not found", HTTP_STATUS.NOT_FOUND)
      }

      // Verify user has permission to view this correction
      let hasPermission = false

      if (
        [
          "SCHOOL_ADMIN" as UserRole,
          "CLINICAL_SUPERVISOR" as UserRole,
          "SUPER_ADMIN" as UserRole,
        ].includes(user.role)
      ) {
        hasPermission = true
      } else if (user.role === ("CLINICAL_PRECEPTOR" as UserRole as UserRole as UserRole)) {
        // Check if the preceptor is assigned to the rotation
        const [rotation] = await db
          .select()
          .from(rotations)
          .where(
            and(eq(rotations.id, correctionData.rotationId), eq(rotations.preceptorId, user.id))
          )
          .limit(1)

        if (rotation) {
          hasPermission = true
        }
      }

      if (!hasPermission) {
        return createErrorResponse(
          "You don't have permission to view this correction",
          HTTP_STATUS.FORBIDDEN
        )
      }

      // Parse requested changes
      let requestedChanges: Record<string, unknown> = {}
      try {
        requestedChanges = JSON.parse(correctionData.requestedChanges)
      } catch (error) {
        console.error("Error parsing requested changes:", error)
      }

      // Calculate preview of final data after applying changes
      const originalData = {
        date: correctionData.originalRecordDate,
        clockIn: correctionData.originalRecordClockIn,
        clockOut: correctionData.originalRecordClockOut,
        totalHours: correctionData.originalRecordTotalHours,
        activities: correctionData.originalRecordActivities,
        notes: correctionData.originalRecordNotes,
        status: correctionData.originalRecordStatus,
      }

      const previewData = { ...originalData }

      // Apply requested changes to preview
      if (requestedChanges.clockIn) {
        previewData.clockIn = new Date(requestedChanges.clockIn as string)
      }
      if (requestedChanges.clockOut) {
        previewData.clockOut = new Date(requestedChanges.clockOut as string)
      }
      if (requestedChanges.activities !== undefined) {
        previewData.activities = requestedChanges.activities as string
      }
      if (requestedChanges.notes !== undefined) {
        previewData.notes = requestedChanges.notes as string
      }
      if (requestedChanges.date) {
        previewData.date = new Date(requestedChanges.date as string)
      }

      // Recalculate total hours for preview
      if (requestedChanges.clockIn || requestedChanges.clockOut) {
        const clockIn = requestedChanges.clockIn
          ? new Date(requestedChanges.clockIn as string)
          : correctionData.originalRecordClockIn
        const clockOut = requestedChanges.clockOut
          ? new Date(requestedChanges.clockOut as string)
          : correctionData.originalRecordClockOut

        if (clockIn && clockOut) {
          const diffMs = clockOut.getTime() - clockIn.getTime()
          const diffHours = diffMs / (1000 * 60 * 60)
          previewData.totalHours = String(Math.max(0, Math.round(diffHours * 100) / 100))
        }
      }

      return createSuccessResponse({
        correction: {
          ...correctionData,
          requestedChanges,
        },
        originalData,
        previewData,
        canApply: correctionData.status === "APPROVED" && !correctionData.appliedBy,
      })
    }

    return await executeOriginalLogic()
  })
}
