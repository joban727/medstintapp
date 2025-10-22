import { auth } from "@clerk/nextjs/server"
import { and, eq } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "../../../../../database/connection-pool"
import { rotations, timecardCorrections, timeRecords, users } from "../../../../../database/schema"
import { logAuditEvent } from "../../../../../lib/rbac-middleware"
import { cacheIntegrationService } from '@/lib/cache-integration'


// Validation schema for approval/rejection
const approvalSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  reviewerNotes: z.string().optional(),
  applyImmediately: z.boolean().default(false),
})

// POST /api/timecard-corrections/[id]/approve - Approve or reject a timecard correction
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const correctionId = id
    const body = await request.json()
    const validatedData = approvalSchema.parse(body)

    // Get the correction
    const [correction] = await db
      .select()
      .from(timecardCorrections)
      .where(eq(timecardCorrections.id, correctionId))
      .limit(1)

    if (!correction) {
      return NextResponse.json({ error: "Correction not found" }, { status: 404 })
    }

    // Check if correction is still pending
    if (correction.status !== "PENDING") {
      return NextResponse.json({ error: "Correction has already been reviewed" }, { status: 409 })
    }

    // Get current user and verify permissions
    const [currentUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1)

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Check if user has permission to approve/reject
    let hasPermission = false

    if (["SCHOOL_ADMIN", "CLINICAL_SUPERVISOR", "SUPER_ADMIN"].includes(currentUser.role)) {
      hasPermission = true
    } else if (currentUser.role === "CLINICAL_PRECEPTOR") {
      // Check if the preceptor is assigned to the rotation
      const [rotation] = await db
        .select()
        .from(rotations)
        .where(and(eq(rotations.id, correction.rotationId), eq(rotations.preceptorId, userId)))
        .limit(1)

      if (rotation) {
        hasPermission = true
      }
    }

    if (!hasPermission) {
      return NextResponse.json(
        { error: "You don't have permission to review this correction" },
        { status: 403 }
      )
    }

    // Update the correction status
    const now = new Date()
    const newStatus = validatedData.action === "APPROVE" ? "APPROVED" : "REJECTED"

    await db
      .update(timecardCorrections)
      .set({
        status: newStatus,
        reviewedBy: userId,
        reviewedAt: now,
        reviewerNotes: validatedData.reviewerNotes || null,
        updatedAt: now,
      })
      .where(eq(timecardCorrections.id, correctionId))

    // If approved and applyImmediately is true, apply the changes
    let appliedChanges = false
    if (validatedData.action === "APPROVE" && validatedData.applyImmediately) {
      try {
        const requestedChanges = JSON.parse(correction.requestedChanges)

        // Get the original time record
        const [originalRecord] = await db
          .select()
          .from(timeRecords)
          .where(eq(timeRecords.id, correction.originalTimeRecordId))
          .limit(1)

        if (originalRecord) {
          // Prepare update fields
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
            updateFields.clockIn = new Date(requestedChanges.clockIn)
          }
          if (requestedChanges.clockOut) {
            updateFields.clockOut = new Date(requestedChanges.clockOut)
          }
          if (requestedChanges.activities) {
            updateFields.activities = requestedChanges.activities
          }
          if (requestedChanges.notes) {
            updateFields.notes = requestedChanges.notes
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
              const diffHours = diffMs / (1000 * 60 * 60)
              updateFields.totalHours = Math.max(0, Math.round(diffHours * 100) / 100).toString()
            }
          }

          // Update the time record
          await db
            .update(timeRecords)
            .set(updateFields)
            .where(eq(timeRecords.id, correction.originalTimeRecordId))

          // Update correction to mark as applied
          await db
            .update(timecardCorrections)
            .set({
              appliedBy: userId,
              appliedAt: now,
              updatedAt: now,
            })
            .where(eq(timecardCorrections.id, correctionId))

          appliedChanges = true
        }
      } catch (error) {
        console.error("Error applying correction changes:", error)
        // Don't fail the approval, just log the error
      }
    }

    // Log audit event
    await logAuditEvent({
      userId: userId,
      action: `TIMECARD_CORRECTION_${validatedData.action}`,
      resource: "TIMECARD_CORRECTION",
      resourceId: correctionId,
      details: {
        correctionId,
        originalTimeRecordId: correction.originalTimeRecordId,
        studentId: correction.studentId,
        action: validatedData.action,
        reviewerNotes: validatedData.reviewerNotes,
        appliedImmediately: appliedChanges,
        correctionType: correction.correctionType,
      },
      ipAddress:
        request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
      userAgent: request.headers.get("user-agent") || undefined,
      severity: validatedData.action === "APPROVE" ? "MEDIUM" : "LOW",
      status: "SUCCESS",
    })

    const responseMessage =
      validatedData.action === "APPROVE"
        ? `Timecard correction approved${appliedChanges ? " and applied" : ""} successfully`
        : "Timecard correction rejected successfully"

    return NextResponse.json({
      message: responseMessage,
      status: newStatus,
      appliedChanges,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      )
    }

    console.error("Error processing correction approval:", error)
    
    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateAllCache()
    } catch (cacheError) {
      console.warn('Cache invalidation error in timecard-corrections/[id]/approve/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Failed to process correction approval" }, { status: 500 })
  }
}

// GET /api/timecard-corrections/[id]/approve - Get correction details for review
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      'api:timecard-corrections/[id]/approve/route.ts',
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
    console.warn('Cache error in timecard-corrections/[id]/approve/route.ts:', cacheError)
    // Continue with original logic if cache fails
  }
  
  async function executeOriginalLogic() {

  const { id } = await params
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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
        originalData: timecardCorrections.originalData,
        priority: timecardCorrections.priority,
        dueDate: timecardCorrections.dueDate,
        createdAt: timecardCorrections.createdAt,
        updatedAt: timecardCorrections.updatedAt,
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
      return NextResponse.json({ error: "Correction not found" }, { status: 404 })
    }

    // Check permissions
    const [currentUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1)

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Verify user has permission to view this correction
    let hasPermission = false

    if (["SCHOOL_ADMIN", "CLINICAL_SUPERVISOR", "SUPER_ADMIN"].includes(currentUser.role)) {
      hasPermission = true
    } else if (currentUser.role === "CLINICAL_PRECEPTOR") {
      // Check if the preceptor is assigned to the rotation
      const [rotation] = await db
        .select()
        .from(rotations)
        .where(and(eq(rotations.id, correctionData.rotationId), eq(rotations.preceptorId, userId)))
        .limit(1)

      if (rotation) {
        hasPermission = true
      }
    } else if (currentUser.role === "STUDENT" && correctionData.studentId === userId) {
      hasPermission = true
    }

    if (!hasPermission) {
      return NextResponse.json(
        { error: "You don't have permission to view this correction" },
        { status: 403 }
      )
    }

    // Parse requested changes
    let requestedChanges = {}
    try {
      requestedChanges = JSON.parse(correctionData.requestedChanges)
    } catch (error) {
      console.error("Error parsing requested changes:", error)
    }

    return NextResponse.json({
      ...correctionData,
      requestedChanges,
    })
  } catch (error) {
    console.error("Error fetching correction details:", error)
    return NextResponse.json({ error: "Failed to fetch correction details" }, { status: 500 })
  }

  }
}
