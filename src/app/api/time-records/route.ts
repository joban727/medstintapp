import { and, desc, eq, gte, isNull, lte } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "../../../database/connection-pool"
import { rotations, timeRecords, users } from "../../../database/schema"
import { logAuditEvent } from "../../../lib/rbac-middleware"
import { getSchoolContext } from "../../../lib/school-utils"

// Validation schemas
const createTimeRecordSchema = z.object({
  rotationId: z.string().min(1, "Rotation ID is required"),
  date: z.string().datetime("Invalid date format"),
  clockIn: z.string().datetime("Invalid clock in time"),
  clockOut: z.string().datetime("Invalid clock out time").optional(),
  activities: z.array(z.string()).optional(),
  notes: z.string().optional(),
})

const updateTimeRecordSchema = z.object({
  clockOut: z.string().datetime("Invalid clock out time").optional(),
  activities: z.array(z.string()).optional(),
  notes: z.string().optional(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
})

const clockInSchema = z.object({
  rotationId: z.string().min(1, "Rotation ID is required"),
  activities: z.array(z.string()).optional(),
  notes: z.string().optional(),
})

// GET /api/time-records - Get time records with filtering
export async function GET(request: NextRequest) {
  try {
    const context = await getSchoolContext()
    const { searchParams } = new URL(request.url)

    const studentId = searchParams.get("studentId")
    const rotationId = searchParams.get("rotationId")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const status = searchParams.get("status")
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const offset = Number.parseInt(searchParams.get("offset") || "0")

    // Build query conditions
    const conditions = []

    // Role-based filtering
    if (context.userRole === "STUDENT") {
      conditions.push(eq(timeRecords.studentId, context.userId))
    } else if (studentId) {
      conditions.push(eq(timeRecords.studentId, studentId))
    }

    if (rotationId) {
      conditions.push(eq(timeRecords.rotationId, rotationId))
    }

    if (startDate) {
      conditions.push(gte(timeRecords.date, new Date(startDate)))
    }

    if (endDate) {
      conditions.push(lte(timeRecords.date, new Date(endDate)))
    }

    if (status) {
      conditions.push(eq(timeRecords.status, status as "PENDING" | "APPROVED" | "REJECTED"))
    }

    // Execute query with joins
    const records = await db
      .select({
        id: timeRecords.id,
        studentId: timeRecords.studentId,
        rotationId: timeRecords.rotationId,
        date: timeRecords.date,
        clockIn: timeRecords.clockIn,
        clockOut: timeRecords.clockOut,
        totalHours: timeRecords.totalHours,
        activities: timeRecords.activities,
        notes: timeRecords.notes,
        status: timeRecords.status,
        approvedBy: timeRecords.approvedBy,
        approvedAt: timeRecords.approvedAt,
        createdAt: timeRecords.createdAt,
        updatedAt: timeRecords.updatedAt,
        studentName: users.name,
        rotationSpecialty: rotations.specialty,
      })
      .from(timeRecords)
      .leftJoin(users, eq(timeRecords.studentId, users.id))
      .leftJoin(rotations, eq(timeRecords.rotationId, rotations.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(timeRecords.date), desc(timeRecords.clockIn))
      .limit(limit)
      .offset(offset)

    return NextResponse.json({
      success: true,
      data: records,
      pagination: {
        limit,
        offset,
        total: records.length,
      },
    })
  } catch (error) {
    console.error("Error fetching time records:", error)
    return NextResponse.json({ error: "Failed to fetch time records" }, { status: 500 })
  }
}

// POST /api/time-records - Create new time record or clock in
export async function POST(request: NextRequest) {
  try {
    const context = await getSchoolContext()
    const body = await request.json()

    // Check if this is a clock-in request
    if (body.action === "clock-in") {
      const validatedData = clockInSchema.parse(body)

      // Verify rotation exists and user has access
      const [rotation] = await db
        .select()
        .from(rotations)
        .where(eq(rotations.id, validatedData.rotationId))
        .limit(1)

      if (!rotation) {
        return NextResponse.json({ error: "Rotation not found" }, { status: 404 })
      }

      // Students can only clock in for their own rotations
      if (context.userRole === "STUDENT" && rotation.studentId !== context.userId) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 })
      }

      // Check if student is already clocked in
      const [existingRecord] = await db
        .select()
        .from(timeRecords)
        .where(
          and(
            eq(timeRecords.studentId, rotation.studentId),
            eq(timeRecords.rotationId, validatedData.rotationId),
            isNull(timeRecords.clockOut)
          )
        )
        .limit(1)

      if (existingRecord) {
        return NextResponse.json({ error: "Student is already clocked in" }, { status: 400 })
      }

      // Create new time record
      const now = new Date()
      const recordId = crypto.randomUUID()
      const [newRecord] = await db
        .insert(timeRecords)
        .values({
          id: recordId,
          studentId: rotation.studentId,
          rotationId: validatedData.rotationId,
          date: now,
          clockIn: now,
          activities: JSON.stringify(validatedData.activities || []),
          notes: validatedData.notes,
          status: "PENDING",
        })
        .returning()

      // Log audit event
      await logAuditEvent({
        userId: context.userId,
        action: "CLOCK_IN",
        resource: "TIME_RECORD",
        resourceId: recordId,
        details: {
          studentId: rotation.studentId,
          rotationId: validatedData.rotationId,
          clockInTime: now.toISOString(),
          activities: validatedData.activities || [],
        },
        ipAddress:
          request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || undefined,
        severity: "LOW",
        status: "SUCCESS",
      })

      return NextResponse.json({
        success: true,
        data: newRecord,
        message: "Successfully clocked in",
      })
    }

    // Regular time record creation
    const validatedData = createTimeRecordSchema.parse(body)

    // Verify rotation exists and user has access
    const [rotation] = await db
      .select()
      .from(rotations)
      .where(eq(rotations.id, validatedData.rotationId))
      .limit(1)

    if (!rotation) {
      return NextResponse.json({ error: "Rotation not found" }, { status: 404 })
    }

    // Students can only create records for their own rotations
    if (context.userRole === "STUDENT" && rotation.studentId !== context.userId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Calculate total hours if both clock in and out are provided
    let totalHours = "0"
    if (validatedData.clockOut) {
      const clockInTime = new Date(validatedData.clockIn)
      const clockOutTime = new Date(validatedData.clockOut)
      const diffMs = clockOutTime.getTime() - clockInTime.getTime()
      totalHours = (diffMs / (1000 * 60 * 60)).toFixed(2)
    }

    const recordId = crypto.randomUUID()
    const [newRecord] = await db
      .insert(timeRecords)
      .values({
        id: recordId,
        studentId: rotation.studentId,
        rotationId: validatedData.rotationId,
        date: new Date(validatedData.date),
        clockIn: new Date(validatedData.clockIn),
        clockOut: validatedData.clockOut ? new Date(validatedData.clockOut) : null,
        totalHours,
        activities: JSON.stringify(validatedData.activities || []),
        notes: validatedData.notes,
        status: "PENDING",
      })
      .returning()

    // Log audit event
    await logAuditEvent({
      userId: context.userId,
      action: "CREATE_TIME_RECORD",
      resource: "TIME_RECORD",
      resourceId: recordId,
      details: {
        studentId: rotation.studentId,
        rotationId: validatedData.rotationId,
        date: validatedData.date,
        clockIn: validatedData.clockIn,
        clockOut: validatedData.clockOut,
        totalHours,
        activities: validatedData.activities || [],
      },
      ipAddress:
        request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
      userAgent: request.headers.get("user-agent") || undefined,
      severity: "LOW",
      status: "SUCCESS",
    })

    return NextResponse.json({
      success: true,
      data: newRecord,
      message: "Time record created successfully",
    })
  } catch (error) {
    console.error("Error creating time record:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: "Failed to create time record" }, { status: 500 })
  }
}

// PUT /api/time-records - Update time record (clock out, approve, etc.)
export async function PUT(request: NextRequest) {
  try {
    const context = await getSchoolContext()
    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: "Time record ID is required" }, { status: 400 })
    }

    const validatedData = updateTimeRecordSchema.parse(updateData)

    // Get existing record
    const [existingRecord] = await db
      .select()
      .from(timeRecords)
      .where(eq(timeRecords.id, id))
      .limit(1)

    if (!existingRecord) {
      return NextResponse.json({ error: "Time record not found" }, { status: 404 })
    }

    // Check permissions
    if (context.userRole === "STUDENT" && existingRecord.studentId !== context.userId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Prepare update values
    const updateValues: Partial<typeof timeRecords.$inferInsert> = {
      updatedAt: new Date(),
    }

    if (validatedData.clockOut) {
      updateValues.clockOut = new Date(validatedData.clockOut)

      // Recalculate total hours
      const clockInTime = new Date(existingRecord.clockIn)
      const clockOutTime = new Date(validatedData.clockOut)
      const diffMs = clockOutTime.getTime() - clockInTime.getTime()
      updateValues.totalHours = (diffMs / (1000 * 60 * 60)).toFixed(2)
    }

    if (validatedData.activities) {
      updateValues.activities = JSON.stringify(validatedData.activities)
    }

    if (validatedData.notes !== undefined) {
      updateValues.notes = validatedData.notes
    }

    // Only supervisors/preceptors can approve/reject
    if (
      validatedData.status &&
      ["CLINICAL_PRECEPTOR", "CLINICAL_SUPERVISOR", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(
        context.userRole
      )
    ) {
      updateValues.status = validatedData.status
      if (validatedData.status === "APPROVED") {
        updateValues.approvedBy = context.userId
        updateValues.approvedAt = new Date()
      }
    }

    const [updatedRecord] = await db
      .update(timeRecords)
      .set(updateValues)
      .where(eq(timeRecords.id, id))
      .returning()

    // Log audit event
    const auditAction = validatedData.clockOut
      ? "CLOCK_OUT"
      : validatedData.status
        ? `TIME_RECORD_${validatedData.status}`
        : "UPDATE_TIME_RECORD"

    await logAuditEvent({
      userId: context.userId,
      action: auditAction,
      resource: "TIME_RECORD",
      resourceId: id,
      details: {
        studentId: existingRecord.studentId,
        rotationId: existingRecord.rotationId,
        updatedFields: Object.keys(updateValues).filter((key) => key !== "updatedAt"),
        clockOut: validatedData.clockOut,
        status: validatedData.status,
        totalHours: updateValues.totalHours,
      },
      ipAddress:
        request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
      userAgent: request.headers.get("user-agent") || undefined,
      severity: validatedData.status ? "MEDIUM" : "LOW",
      status: "SUCCESS",
    })

    return NextResponse.json({
      success: true,
      data: updatedRecord,
      message: "Time record updated successfully",
    })
  } catch (error) {
    console.error("Error updating time record:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: "Failed to update time record" }, { status: 500 })
  }
}

// DELETE /api/time-records - Delete time record
export async function DELETE(request: NextRequest) {
  try {
    const context = await getSchoolContext()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Time record ID is required" }, { status: 400 })
    }

    // Get existing record
    const [existingRecord] = await db
      .select()
      .from(timeRecords)
      .where(eq(timeRecords.id, id))
      .limit(1)

    if (!existingRecord) {
      return NextResponse.json({ error: "Time record not found" }, { status: 404 })
    }

    // Only allow deletion by student (if pending) or admin/supervisor
    if (context.userRole === "STUDENT") {
      if (existingRecord.studentId !== context.userId || existingRecord.status !== "PENDING") {
        return NextResponse.json({ error: "Cannot delete approved time records" }, { status: 403 })
      }
    } else if (
      !["CLINICAL_PRECEPTOR", "CLINICAL_SUPERVISOR", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(
        context.userRole
      )
    ) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    await db.delete(timeRecords).where(eq(timeRecords.id, id))

    // Log audit event
    await logAuditEvent({
      userId: context.userId,
      action: "DELETE_TIME_RECORD",
      resource: "TIME_RECORD",
      resourceId: id,
      details: {
        studentId: existingRecord.studentId,
        rotationId: existingRecord.rotationId,
        date: existingRecord.date.toISOString(),
        status: existingRecord.status,
        totalHours: existingRecord.totalHours,
      },
      ipAddress:
        request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
      userAgent: request.headers.get("user-agent") || undefined,
      severity: "HIGH",
      status: "SUCCESS",
    })

    return NextResponse.json({
      success: true,
      message: "Time record deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting time record:", error)
    return NextResponse.json({ error: "Failed to delete time record" }, { status: 500 })
  }
}
