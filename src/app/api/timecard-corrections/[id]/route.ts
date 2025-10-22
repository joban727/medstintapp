import { eq } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "../../../../database/connection-pool"
import { rotations, timecardCorrections, timeRecords, users } from "../../../../database/schema"
import { apiAuthMiddleware, logAuditEvent } from "../../../../lib/rbac-middleware"
import { cacheIntegrationService } from '@/lib/cache-integration'


// Validation schema for updating corrections
const updateCorrectionSchema = z.object({
  requestedChanges: z.record(z.string(), z.any()).optional(),
  reason: z.string().min(10, "Reason must be at least 10 characters").optional(),
  studentNotes: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  dueDate: z.string().datetime().optional().nullable(),
})

// GET /api/timecard-corrections/[id] - Get specific correction details
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      'api:timecard-corrections/[id]/route.ts',
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
    console.warn('Cache error in timecard-corrections/[id]/route.ts:', cacheError)
    // Continue with original logic if cache fails
  }
  
  async function executeOriginalLogic() {

  const { id } = await params
  try {
    const authResult = await apiAuthMiddleware(request, {
      requiredPermissions: ["view_timecard_corrections", "approve_timesheets"],
      requireAll: true,
    })

    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { user } = authResult
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 })
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
      return NextResponse.json({ error: "Timecard correction not found" }, { status: 404 })
    }

    const correctionData = correction[0]

    // Check access permissions
    if (user.role === "STUDENT" && correctionData.studentId !== user.id) {
      return NextResponse.json(
        { error: "You can only view your own correction requests" },
        { status: 403 }
      )
    }

    if (user.role === "CLINICAL_PRECEPTOR") {
      // Check if this correction is for a student under this preceptor
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
      // Check if the student belongs to the same school
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

    return NextResponse.json({
      correction: correctionData,
      originalTimeRecord: originalTimeRecord[0] || null,
    })
  } catch (error) {
    console.error("Error fetching timecard correction:", error)
    return NextResponse.json({ error: "Failed to fetch timecard correction" }, { status: 500 })
  }

  }
}

// PUT /api/timecard-corrections/[id] - Update correction request (only for pending corrections)
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const authResult = await apiAuthMiddleware(request, {
      requiredPermissions: ["submit_timecard_corrections"],
    })

    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { user } = authResult
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 })
    }
    const body = await request.json()
    const validatedData = updateCorrectionSchema.parse(body)

    // Get the existing correction
    const existingCorrection = await db
      .select()
      .from(timecardCorrections)
      .where(eq(timecardCorrections.id, id))
      .limit(1)

    if (existingCorrection.length === 0) {
      return NextResponse.json({ error: "Timecard correction not found" }, { status: 404 })
    }

    const correction = existingCorrection[0]

    // Only students can update their own pending corrections
    if (user.role === "STUDENT" && correction.studentId !== user.id) {
      return NextResponse.json(
        { error: "You can only update your own correction requests" },
        { status: 403 }
      )
    }

    // Only allow updates to pending corrections
    if (correction.status !== "PENDING") {
      return NextResponse.json(
        { error: "Only pending corrections can be updated" },
        { status: 400 }
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

    return NextResponse.json({
      message: "Timecard correction updated successfully",
      correction: updatedCorrection[0],
    })
  } catch (error) {
    console.error("Error updating timecard correction:", error)

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
      console.warn('Cache invalidation error in timecard-corrections/[id]/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Failed to update timecard correction" }, { status: 500 })
  }
}

// DELETE /api/timecard-corrections/[id] - Cancel/delete correction request
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const authResult = await apiAuthMiddleware(request, {
      requiredPermissions: ["submit_timecard_corrections"],
    })

    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { user } = authResult
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 })
    }

    // Get the existing correction
    const existingCorrection = await db
      .select()
      .from(timecardCorrections)
      .where(eq(timecardCorrections.id, id))
      .limit(1)

    if (existingCorrection.length === 0) {
      return NextResponse.json({ error: "Timecard correction not found" }, { status: 404 })
    }

    const correction = existingCorrection[0]

    // Only students can delete their own pending corrections
    if (user.role === "STUDENT" && correction.studentId !== user.id) {
      return NextResponse.json(
        { error: "You can only delete your own correction requests" },
        { status: 403 }
      )
    }

    // Only allow deletion of pending corrections
    if (correction.status !== "PENDING") {
      return NextResponse.json(
        { error: "Only pending corrections can be deleted" },
        { status: 400 }
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

    return NextResponse.json({
      message: "Timecard correction deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting timecard correction:", error)
    
    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateAllCache()
    } catch (cacheError) {
      console.warn('Cache invalidation error in timecard-corrections/[id]/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Failed to delete timecard correction" }, { status: 500 })
  }
}
