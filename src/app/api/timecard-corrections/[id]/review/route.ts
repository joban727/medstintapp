import { eq } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "../../../../../database/connection-pool"
import { rotations, timecardCorrections, timeRecords, users } from "../../../../../database/schema"
import { apiAuthMiddleware, logAuditEvent } from "../../../../../lib/rbac-middleware"
import { cacheIntegrationService } from '@/lib/cache-integration'


// Validation schema for reviewing corrections
const reviewCorrectionSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  reviewerNotes: z.string().min(5, "Reviewer notes must be at least 5 characters").optional(),
  applyImmediately: z.boolean().default(false), // Whether to apply approved changes immediately
})

// POST /api/timecard-corrections/[id]/review - Review (approve/reject) correction request
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const authResult = await apiAuthMiddleware(request, {
      requiredPermissions: ["approve_timesheets"],
    })

    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { user } = authResult
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 })
    }
    const body = await request.json()
    const validatedData = reviewCorrectionSchema.parse(body)

    // Get the correction with related data
    const correction = await db
      .select({
        id: timecardCorrections.id,
        originalTimeRecordId: timecardCorrections.originalTimeRecordId,
        studentId: timecardCorrections.studentId,
        rotationId: timecardCorrections.rotationId,
        correctionType: timecardCorrections.correctionType,
        requestedChanges: timecardCorrections.requestedChanges,
        reason: timecardCorrections.reason,
        status: timecardCorrections.status,
        originalData: timecardCorrections.originalData,
      })
      .from(timecardCorrections)
      .where(eq(timecardCorrections.id, id))
      .limit(1)

    if (correction.length === 0) {
      return NextResponse.json({ error: "Timecard correction not found" }, { status: 404 })
    }

    const correctionData = correction[0]

    // Only allow review of pending corrections
    if (correctionData.status !== "PENDING") {
      return NextResponse.json(
        { error: "Only pending corrections can be reviewed" },
        { status: 400 }
      )
    }

    // Check if the reviewer has permission to review this correction
    if (user.role === "CLINICAL_PRECEPTOR") {
      // Check if this correction is for a student under this preceptor
      const rotation = await db
        .select({ preceptorId: rotations.preceptorId })
        .from(rotations)
        .where(eq(rotations.id, correctionData.rotationId))
        .limit(1)

      if (rotation.length === 0 || rotation[0].preceptorId !== user?.id) {
        return NextResponse.json(
          { error: "You can only review corrections for your students" },
          { status: 403 }
        )
      }
    } else if (user.role === "SCHOOL_ADMIN") {
      // Check if the student belongs to the same school
      const student = await db
        .select({ schoolId: users.schoolId })
        .from(users)
        .where(eq(users.id, correctionData.studentId))
        .limit(1)

      if (student.length === 0 || student[0].schoolId !== user?.schoolId) {
        return NextResponse.json(
          { error: "You can only review corrections for students in your school" },
          { status: 403 }
        )
      }
    } else {
      return NextResponse.json(
        { error: "Insufficient permissions to review corrections" },
        { status: 403 }
      )
    }

    const reviewedAt = new Date()
    const newStatus = validatedData.action === "APPROVE" ? "APPROVED" : "REJECTED"

    // Start transaction for atomic operations
    const result = await db.transaction(async (tx) => {
      // Update the correction status
      const updatedCorrection = await tx
        .update(timecardCorrections)
        .set({
          status: newStatus,
          reviewedBy: user?.id,
          reviewedAt: reviewedAt,
          reviewerNotes: validatedData.reviewerNotes || null,
          updatedAt: new Date(),
        })
        .where(eq(timecardCorrections.id, id))
        .returning()

      let appliedTimeRecord = null

      // If approved and should apply immediately, update the original time record
      if (validatedData.action === "APPROVE" && validatedData.applyImmediately) {
        const requestedChanges: Record<string, unknown> = JSON.parse(
          correctionData.requestedChanges as string
        )

        // Prepare update data for time record
        const timeRecordUpdate: {
          updatedAt: Date
          clockIn?: Date
          clockOut?: Date
          activities?: string
          notes?: string
          date?: Date
          totalHours?: string
        } = {
          updatedAt: new Date(),
        }

        // Apply the requested changes based on correction type
        if (correctionData.correctionType === "CLOCK_IN_TIME" && requestedChanges.clockIn) {
          timeRecordUpdate.clockIn = new Date(requestedChanges.clockIn as string)
        }
        if (correctionData.correctionType === "CLOCK_OUT_TIME" && requestedChanges.clockOut) {
          timeRecordUpdate.clockOut = new Date(requestedChanges.clockOut as string)
        }
        if (correctionData.correctionType === "ACTIVITIES" && requestedChanges.activities) {
          timeRecordUpdate.activities = JSON.stringify(requestedChanges.activities)
        }
        if (correctionData.correctionType === "NOTES" && requestedChanges.notes !== undefined) {
          timeRecordUpdate.notes = requestedChanges.notes as string
        }
        if (correctionData.correctionType === "DATE" && requestedChanges.date) {
          timeRecordUpdate.date = new Date(requestedChanges.date as string)
        }
        if (correctionData.correctionType === "MULTIPLE") {
          // Handle multiple field updates
          if (requestedChanges.clockIn)
            timeRecordUpdate.clockIn = new Date(requestedChanges.clockIn as string)
          if (requestedChanges.clockOut)
            timeRecordUpdate.clockOut = new Date(requestedChanges.clockOut as string)
          if (requestedChanges.activities)
            timeRecordUpdate.activities = JSON.stringify(requestedChanges.activities)
          if (requestedChanges.notes !== undefined)
            timeRecordUpdate.notes = requestedChanges.notes as string
          if (requestedChanges.date)
            timeRecordUpdate.date = new Date(requestedChanges.date as string)
        }

        // Recalculate total hours if clock times were updated
        if (timeRecordUpdate.clockIn || timeRecordUpdate.clockOut) {
          const timeRecord = await tx
            .select({ clockIn: timeRecords.clockIn, clockOut: timeRecords.clockOut })
            .from(timeRecords)
            .where(eq(timeRecords.id, correctionData.originalTimeRecordId))
            .limit(1)

          if (timeRecord.length > 0) {
            const clockIn = timeRecordUpdate.clockIn || timeRecord[0].clockIn
            const clockOut = timeRecordUpdate.clockOut || timeRecord[0].clockOut

            if (clockIn && clockOut) {
              const diffMs = new Date(clockOut).getTime() - new Date(clockIn).getTime()
              timeRecordUpdate.totalHours = (
                Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100
              ).toString()
            }
          }
        }

        // Update the original time record
        appliedTimeRecord = await tx
          .update(timeRecords)
          .set(timeRecordUpdate)
          .where(eq(timeRecords.id, correctionData.originalTimeRecordId))
          .returning()

        // Update correction status to APPLIED
        await tx
          .update(timecardCorrections)
          .set({
            status: "APPLIED",
            appliedBy: user?.id,
            appliedAt: reviewedAt,
          })
          .where(eq(timecardCorrections.id, id))
      }

      return { updatedCorrection: updatedCorrection[0], appliedTimeRecord: appliedTimeRecord?.[0] }
    })

    // Log audit event
    await logAuditEvent({
      userId: user?.id,
      action: `${validatedData.action}_TIMECARD_CORRECTION`,
      resource: "timecard_corrections",
      resourceId: id,
      details: JSON.stringify({
        correctionId: id,
        action: validatedData.action,
        applyImmediately: validatedData.applyImmediately,
        originalTimeRecordId: correctionData.originalTimeRecordId,
        studentId: correctionData.studentId,
      }),
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    })

    const responseMessage =
      validatedData.action === "APPROVE"
        ? validatedData.applyImmediately
          ? "Timecard correction approved and applied successfully"
          : "Timecard correction approved successfully"
        : "Timecard correction rejected"

    return NextResponse.json({
      message: responseMessage,
      correction: result.updatedCorrection,
      appliedTimeRecord: result.appliedTimeRecord,
    })
  } catch (error) {
    console.error("Error reviewing timecard correction:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      )
    }

    
    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateAllCache()
    } catch (cacheError) {
      console.warn('Cache invalidation error in timecard-corrections/[id]/review/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Failed to review timecard correction" }, { status: 500 })
  }
}

// GET /api/timecard-corrections/[id]/review - Get review history and details
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      'api:timecard-corrections/[id]/review/route.ts',
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
    console.warn('Cache error in timecard-corrections/[id]/review/route.ts:', cacheError)
    // Continue with original logic if cache fails
  }
  
  async function executeOriginalLogic() {

  const { id } = await params
  try {
    const authResult = await apiAuthMiddleware(request, {
      requiredRoles: ["CLINICAL_PRECEPTOR", "SCHOOL_ADMIN", "SUPER_ADMIN"],
    })

    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { user } = authResult
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 })
    }

    // Get correction with reviewer information
    const correction = await db
      .select({
        id: timecardCorrections.id,
        originalTimeRecordId: timecardCorrections.originalTimeRecordId,
        studentId: timecardCorrections.studentId,
        rotationId: timecardCorrections.rotationId,
        status: timecardCorrections.status,
        reviewedBy: timecardCorrections.reviewedBy,
        reviewedAt: timecardCorrections.reviewedAt,
        reviewerNotes: timecardCorrections.reviewerNotes,
        appliedBy: timecardCorrections.appliedBy,
        appliedAt: timecardCorrections.appliedAt,
        reviewerName: users.name,
        reviewerEmail: users.email,
      })
      .from(timecardCorrections)
      .leftJoin(users, eq(timecardCorrections.reviewedBy, users.id))
      .where(eq(timecardCorrections.id, id))
      .limit(1)

    if (correction.length === 0) {
      return NextResponse.json({ error: "Timecard correction not found" }, { status: 404 })
    }

    const correctionData = correction[0]

    // Check access permissions (same logic as individual correction route)
    if (user?.role === "STUDENT" && correctionData.studentId !== user?.id) {
      return NextResponse.json(
        { error: "You can only view your own correction requests" },
        { status: 403 }
      )
    }

    if (user.role === "CLINICAL_PRECEPTOR") {
      const rotation = await db
        .select({ preceptorId: rotations.preceptorId })
        .from(rotations)
        .where(eq(rotations.id, correctionData.rotationId))
        .limit(1)

      if (rotation.length === 0 || rotation[0].preceptorId !== user.id) {
        return NextResponse.json(
          { error: "You can only view corrections for your students" },
          { status: 403 }
        )
      }
    }

    if (user.role === "SCHOOL_ADMIN") {
      const student = await db
        .select({ schoolId: users.schoolId })
        .from(users)
        .where(eq(users.id, correctionData.studentId))
        .limit(1)

      if (student.length === 0 || student[0].schoolId !== user.schoolId) {
        return NextResponse.json(
          { error: "You can only view corrections for students in your school" },
          { status: 403 }
        )
      }
    }

    return NextResponse.json({
      reviewDetails: correctionData,
    })
  } catch (error) {
    console.error("Error fetching correction review details:", error)
    return NextResponse.json(
      { error: "Failed to fetch correction review details" },
      { status: 500 }
    )
  }

  }
}
