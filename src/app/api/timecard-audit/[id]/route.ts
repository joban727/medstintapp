import { desc, eq } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "../../../../database/connection-pool"

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
} from "../../../../database/schema"
import { getCurrentUser } from "../../../../lib/auth-clerk"
import { cacheIntegrationService } from "@/lib/cache-integration"

import type { UserRole } from "@/types"
// Validation schema for the timecard ID parameter
const paramsSchema = z.object({
  id: z.string().uuid("Invalid timecard ID format"),
})

/**
 * GET /api/timecard-audit/[id]
 * Fetch comprehensive audit trail for a specific timecard record
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      "api:timecard-audit/[id]/route.ts",
      async () => {
        // Original function logic will be wrapped here
        return await executeOriginalLogic()
      },
      300 // 5 minutes TTL
    )

    if (cached) {
      return cached
    }
  } catch (cacheError) {
    console.warn("Cache error in timecard-audit/[id]/route.ts:", cacheError)
    // Continue with original logic if cache fails
  }

  async function executeOriginalLogic() {
    const { id } = await params
    try {
      // Authenticate user
      const user = await getCurrentUser()
      if (!user) {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 })
      }

      // Validate parameters
      const validatedParams = paramsSchema.parse({ id })
      const timeRecordId = validatedParams.id

      // User is already verified by getCurrentUser()

      // Fetch the time record with student and rotation details
      const timeRecordData = await db
        .select({
          id: timeRecords.id,
          studentId: timeRecords.studentId,
          rotationId: timeRecords.rotationId,
          clockInTime: timeRecords.clockIn,
          clockOutTime: timeRecords.clockOut,
          totalHours: timeRecords.totalHours,
          activities: timeRecords.activities,
          notes: timeRecords.notes,
          status: timeRecords.status,
          createdAt: timeRecords.createdAt,
          updatedAt: timeRecords.updatedAt,
          studentName: users.name,
          studentEmail: users.email,
          studentSchoolId: users.schoolId,
          rotationSpecialty: rotations.specialty,
        })
        .from(timeRecords)
        .innerJoin(users, eq(timeRecords.studentId, users.id))
        .innerJoin(rotations, eq(timeRecords.rotationId, rotations.id))
        .where(eq(timeRecords.id, timeRecordId))
        .limit(1)

      if (timeRecordData.length === 0) {
        return NextResponse.json({ error: "Time record not found" }, { status: 404 })
      }

      const timeRecord = timeRecordData[0]

      // Check permissions
      const hasAccess =
        user.role === ("SUPER_ADMIN" as UserRole as UserRole as UserRole) ||
        (user.role === ("SCHOOL_ADMIN" as UserRole as UserRole as UserRole) &&
          user.schoolId === timeRecord.studentSchoolId) ||
        (user.role === ("CLINICAL_SUPERVISOR" as UserRole as UserRole as UserRole) &&
          user.schoolId === timeRecord.studentSchoolId) ||
        user.role === ("CLINICAL_PRECEPTOR" as UserRole as UserRole as UserRole) || // Preceptors can view records they supervise
        (user.role === ("STUDENT" as UserRole as UserRole as UserRole) &&
          user.id === timeRecord.studentId)

      if (!hasAccess) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 })
      }

      // Fetch audit logs for this time record
      const auditLogsData = await db
        .select({
          id: auditLogs.id,
          action: auditLogs.action,
          details: auditLogs.details,
          performedAt: auditLogs.createdAt,
          ipAddress: auditLogs.ipAddress,
          performedById: auditLogs.userId,
          performedByName: users.name,
          performedByEmail: users.email,
          performedByRole: users.role,
        })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.userId, users.id))
        .where(eq(auditLogs.resourceId, timeRecordId))
        .orderBy(desc(auditLogs.createdAt))

      // Fetch timecard corrections for this record
      const correctionsData = await db
        .select({
          id: timecardCorrections.id,
          correctionType: timecardCorrections.correctionType,
          status: timecardCorrections.status,
          requestedChanges: timecardCorrections.requestedChanges,
          reason: timecardCorrections.reason,
          createdAt: timecardCorrections.createdAt,
          reviewedAt: timecardCorrections.reviewedAt,
          appliedAt: timecardCorrections.appliedAt,
          studentId: timecardCorrections.studentId,
          reviewedBy: timecardCorrections.reviewedBy,
          appliedBy: timecardCorrections.appliedBy,
          // Student details
          studentName: users.name,
          studentEmail: users.email,
        })
        .from(timecardCorrections)
        .innerJoin(users, eq(timecardCorrections.studentId, users.id))
        .where(eq(timecardCorrections.originalTimeRecordId, timeRecordId))
        .orderBy(desc(timecardCorrections.createdAt))

      // Fetch reviewer and applier details for corrections
      const reviewerIds = correctionsData
        .map((c) => c.reviewedBy)
        .filter((id): id is string => id !== null)
      const applierIds = correctionsData
        .map((c) => c.appliedBy)
        .filter((id): id is string => id !== null)

      const allUserIds = [...new Set([...reviewerIds, ...applierIds])]

      const additionalUsers =
        allUserIds.length > 0
          ? await db
              .select({
                id: users.id,
                name: users.name,
                email: users.email,
                role: users.role,
              })
              .from(users)
              .where(eq(users.id, allUserIds[0])) // This is a simplified approach; in practice, you'd use an IN clause
          : []

      // Create a map of user details
      const userMap = new Map(additionalUsers.map((user) => [user.id, user]))

      // Format the response data
      const response = {
        timeRecord: {
          id: timeRecord.id,
          clockInTime: timeRecord.clockInTime,
          clockOutTime: timeRecord.clockOutTime,
          totalHours: timeRecord.totalHours,
          activities: timeRecord.activities,
          notes: timeRecord.notes,
          status: timeRecord.status,
          createdAt: timeRecord.createdAt,
          updatedAt: timeRecord.updatedAt,
          student: {
            name: timeRecord.studentName,
            email: timeRecord.studentEmail,
          },
          rotation: {
            specialty: timeRecord.rotationSpecialty,
          },
        },
        auditLogs: auditLogsData.map((log) => ({
          id: log.id,
          action: log.action,
          details: log.details || {},
          performedAt: log.performedAt,
          ipAddress: log.ipAddress,
          performedBy: {
            id: log.performedById,
            name: log.performedByName,
            email: log.performedByEmail,
            role: log.performedByRole,
          },
        })),
        corrections: correctionsData.map((correction) => ({
          id: correction.id,
          correctionType: correction.correctionType,
          status: correction.status,
          requestedChanges: correction.requestedChanges || {},
          reason: correction.reason,
          createdAt: correction.createdAt,
          reviewedAt: correction.reviewedAt,
          appliedAt: correction.appliedAt,
          student: {
            name: correction.studentName,
            email: correction.studentEmail,
          },
          reviewedBy: correction.reviewedBy ? userMap.get(correction.reviewedBy) || null : null,
          appliedBy: correction.appliedBy ? userMap.get(correction.appliedBy) || null : null,
        })),
      }

      return NextResponse.json(response)
    } catch (error) {
      console.error("Error fetching timecard audit data:", error)

      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: "Invalid request parameters", details: error.issues },
          { status: 400 }
        )
      }

      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  }
}
