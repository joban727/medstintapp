import type { UserRole } from "@/types"
import { logger } from "@/lib/logger"
import { and, desc, eq, gte, isNull, lte } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "../../../database/connection-pool"
import { ValidationRules } from "@/lib/clock-validation"
import { rotations, timeRecords, users } from "../../../database/schema"
import { logAuditEvent } from "../../../lib/rbac-middleware"
import { getSchoolContext } from "../../../lib/school-utils"
import {
  createSuccessResponse,
  createErrorResponse,
  createValidationErrorResponse,
  HTTP_STATUS,
  ERROR_MESSAGES,
  withErrorHandling,
} from "../../../lib/api-response"

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
export const GET = withErrorHandling(async (request: NextRequest) => {
  try {
    const context = await getSchoolContext()
    const { searchParams } = new URL(request.url)

    const studentId = searchParams.get("studentId")
    const schoolIdParam = searchParams.get("schoolId")
    const rotationId = searchParams.get("rotationId")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const status = searchParams.get("status")
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const offset = Number.parseInt(searchParams.get("offset") || "0")

    // Build query conditions
    const conditions = []

    // Role-based filtering
    if (context.userRole === ("STUDENT" as UserRole)) {
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

    // Add schoolId condition if we have a valid one
    if (context.userRole === ("STUDENT" as UserRole) && context.schoolId) {
      conditions.push(eq(users.schoolId, context.schoolId))
    } else if (schoolIdParam) {
      conditions.push(eq(users.schoolId, schoolIdParam))
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

    return createSuccessResponse({
      data: records,
      pagination: {
        limit,
        offset,
        total: records.length,
      },
    })
  } catch (error) {
    logger.error(
      { route: "GET /api/time-records", error: error as Error },
      "Error fetching time records"
    )
    return createErrorResponse(ERROR_MESSAGES.INTERNAL_ERROR, HTTP_STATUS.INTERNAL_SERVER_ERROR)
  }
})

// POST /api/time-records - Create new time record or clock in
export const POST = withErrorHandling(async (request: NextRequest) => {
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
        return createErrorResponse("Rotation not found", HTTP_STATUS.NOT_FOUND)
      }

      // Students can only clock in for their own rotations
      if (context.userRole === ("STUDENT" as UserRole) && rotation.studentId !== context.userId) {
        return createErrorResponse(ERROR_MESSAGES.ACCESS_DENIED, HTTP_STATUS.FORBIDDEN)
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
        return createErrorResponse("Student is already clocked in", HTTP_STATUS.BAD_REQUEST)
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

      return createSuccessResponse({
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
      return createErrorResponse("Rotation not found", HTTP_STATUS.NOT_FOUND)
    }

    // Students can only create records for their own rotations
    if (context.userRole === ("STUDENT" as UserRole) && rotation.studentId !== context.userId) {
      return createErrorResponse(ERROR_MESSAGES.ACCESS_DENIED, HTTP_STATUS.FORBIDDEN)
    }

    if (context.userRole === ("STUDENT" as UserRole)) {
      const referenceTime = new Date(validatedData.clockIn)
      const submissionWindow = ValidationRules.validateStudentSubmissionWindow(referenceTime)
      if (!submissionWindow.valid) {
        return createErrorResponse(
          submissionWindow.reason || "Submission window elapsed",
          HTTP_STATUS.BAD_REQUEST
        )
      }
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

    return createSuccessResponse({
      data: newRecord,
      message: "Time record created successfully",
    })
  } catch (error) {
    console.error("Error creating time record:", error)
    if (error instanceof z.ZodError) {
      return createValidationErrorResponse(
        ERROR_MESSAGES.VALIDATION_ERROR,
        error.issues.map((err) => ({
          field: err.path.join("."),
          code: err.code,
          details: err.message,
        }))
      )
    }
    return createErrorResponse(ERROR_MESSAGES.INTERNAL_ERROR, HTTP_STATUS.INTERNAL_SERVER_ERROR)
  }
})

// PUT /api/time-records - Update time record (clock out, approve, etc.)
export const PUT = withErrorHandling(async (request: NextRequest) => {
  try {
    const context = await getSchoolContext()
    const body = await request.json()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return createErrorResponse("Time record ID is required", HTTP_STATUS.BAD_REQUEST)
    }

    // Validate request body
    const validationResult = updateTimeRecordSchema.safeParse(body)
    if (!validationResult.success) {
      return createValidationErrorResponse(
        ERROR_MESSAGES.VALIDATION_ERROR,
        validationResult.error.issues.map((err) => ({
          field: err.path.join("."),
          code: err.code,
          details: err.message,
        }))
      )
    }

    const updateData = validationResult.data

    // Get existing record
    const existingRecord = await db
      .select()
      .from(timeRecords)
      .where(eq(timeRecords.id, id))
      .limit(1)

    if (!existingRecord.length) {
      return createErrorResponse("Time record not found", HTTP_STATUS.NOT_FOUND)
    }

    const record = existingRecord[0]

    // Check permissions and submission window
    if (context.userRole === "STUDENT") {
      if (record.studentId !== context.userId || record.status !== "PENDING") {
        return createErrorResponse("Cannot modify approved time records", HTTP_STATUS.FORBIDDEN)
      }
      if (!record.clockIn) {
        return createErrorResponse(
          "Invalid time record: missing clock in time",
          HTTP_STATUS.BAD_REQUEST
        )
      }
      const windowResult = ValidationRules.validateStudentSubmissionWindow(record.clockIn)
      if (!windowResult.valid) {
        return createErrorResponse(
          windowResult.reason || "Submission window elapsed",
          HTTP_STATUS.FORBIDDEN
        )
      }
    } else if (
      !["CLINICAL_PRECEPTOR", "CLINICAL_SUPERVISOR", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(
        context.userRole
      )
    ) {
      return createErrorResponse(ERROR_MESSAGES.ACCESS_DENIED, HTTP_STATUS.FORBIDDEN)
    }

    // Prepare update values
    const updateValues: Partial<typeof timeRecords.$inferInsert> = {
      updatedAt: new Date(),
    }

    if (updateData.clockOut) {
      updateValues.clockOut = new Date(updateData.clockOut)

      // Recalculate total hours
      if (!record.clockIn) {
        return createErrorResponse(
          "Invalid time record: missing clock in time",
          HTTP_STATUS.BAD_REQUEST
        )
      }
      const clockInTime = new Date(record.clockIn)
      const clockOutTime = new Date(updateData.clockOut)
      const diffMs = clockOutTime.getTime() - clockInTime.getTime()
      updateValues.totalHours = (diffMs / (1000 * 60 * 60)).toFixed(2)

      // Auto-approve on student clock-out when enabled and validation passes
      const autoApprove = (process.env.AUTO_APPROVE_ON_CLOCK_OUT ?? "true").toLowerCase() === "true"
      if (autoApprove && context.userRole === ("STUDENT" as UserRole)) {
        const validation = ValidationRules.validateClockOutTime(clockInTime, clockOutTime)
        if (validation.valid) {
          updateValues.status = "APPROVED"
          updateValues.approvedAt = new Date()
        }
      }
    }

    if (updateData.activities) {
      updateValues.activities = JSON.stringify(updateData.activities)
    }

    if (updateData.notes !== undefined) {
      updateValues.notes = updateData.notes
    }

    // Only supervisors/preceptors can approve/reject
    if (
      updateData.status &&
      ["CLINICAL_PRECEPTOR", "CLINICAL_SUPERVISOR", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(
        context.userRole
      )
    ) {
      updateValues.status = updateData.status
      if (updateData.status === "APPROVED") {
        updateValues.approvedBy = context.userId
        updateValues.approvedAt = new Date()
      }
    }

    // Audit auto-approval occurring via student PUT clock-out
    if (updateValues.status === "APPROVED" && context.userRole === ("STUDENT" as UserRole)) {
      await logAuditEvent({
        userId: context.userId,
        action: "TIME_RECORD_AUTO_APPROVED",
        resource: "TIME_RECORD",
        resourceId: id,
        details: {
          rotationId: record.rotationId,
          totalHours: updateValues.totalHours,
        },
        ipAddress:
          request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || undefined,
        severity: "LOW",
        status: "SUCCESS",
      })
    }

    const [updatedRecord] = await db
      .update(timeRecords)
      .set(updateValues)
      .where(eq(timeRecords.id, id))
      .returning()

    // Log audit event
    const auditAction = updateData.clockOut
      ? "CLOCK_OUT"
      : updateData.status
        ? `TIME_RECORD_${updateData.status}`
        : "UPDATE_TIME_RECORD"

    await logAuditEvent({
      userId: context.userId,
      action: auditAction,
      resource: "TIME_RECORD",
      resourceId: id,
      details: {
        studentId: record.studentId,
        rotationId: record.rotationId,
        updatedFields: Object.keys(updateValues).filter((key) => key !== "updatedAt"),
        clockOut: updateData.clockOut,
        status: updateData.status,
        totalHours: updateValues.totalHours,
      },
      ipAddress:
        request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
      userAgent: request.headers.get("user-agent") || undefined,
      severity: updateData.status ? "MEDIUM" : "LOW",
      status: "SUCCESS",
    })

    return createSuccessResponse({
      data: updatedRecord,
      message: "Time record updated successfully",
    })
  } catch (error) {
    console.error("Error updating time record:", error)
    if (error instanceof z.ZodError) {
      return createValidationErrorResponse(
        ERROR_MESSAGES.VALIDATION_ERROR,
        error.issues.map((err) => ({
          field: err.path.join("."),
          code: err.code,
          details: err.message,
        }))
      )
    }
    return createErrorResponse(ERROR_MESSAGES.INTERNAL_ERROR, HTTP_STATUS.INTERNAL_SERVER_ERROR)
  }
})

// DELETE /api/time-records - Delete time record
export const DELETE = withErrorHandling(async (request: NextRequest) => {
  try {
    const context = await getSchoolContext()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return createErrorResponse("Time record ID is required", HTTP_STATUS.BAD_REQUEST)
    }

    // Get existing record
    const [existingRecord] = await db
      .select()
      .from(timeRecords)
      .where(eq(timeRecords.id, id))
      .limit(1)

    if (!existingRecord) {
      return createErrorResponse("Time record not found", HTTP_STATUS.NOT_FOUND)
    }

    // Only allow deletion by student (if pending) or admin/supervisor
    if (context.userRole === ("STUDENT" as UserRole)) {
      if (existingRecord.studentId !== context.userId || existingRecord.status !== "PENDING") {
        return createErrorResponse("Cannot delete approved time records", HTTP_STATUS.FORBIDDEN)
      }
    } else if (
      ![
        "CLINICAL_PRECEPTOR" as UserRole,
        "CLINICAL_SUPERVISOR" as UserRole,
        "SCHOOL_ADMIN" as UserRole,
        "SUPER_ADMIN" as UserRole,
      ].includes(context.userRole)
    ) {
      return createErrorResponse("Insufficient permissions", HTTP_STATUS.FORBIDDEN)
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

    return createSuccessResponse({
      message: "Time record deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting time record:", error)
    return createErrorResponse(ERROR_MESSAGES.INTERNAL_ERROR, HTTP_STATUS.INTERNAL_SERVER_ERROR)
  }
})
