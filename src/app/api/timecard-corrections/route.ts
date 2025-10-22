import { and, asc, desc, eq, gte, inArray, lte, type SQL } from "drizzle-orm"
import { nanoid } from "nanoid"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "../../../database/connection-pool"
import { rotations, timecardCorrections, timeRecords, users } from "../../../database/schema"
import { apiAuthMiddleware, logAuditEvent } from "../../../lib/rbac-middleware"
import { cacheIntegrationService } from '@/lib/cache-integration'


// Validation schemas
const createCorrectionSchema = z.object({
  originalTimeRecordId: z.string().min(1, "Time record ID is required"),
  correctionType: z.enum([
    "CLOCK_IN_TIME",
    "CLOCK_OUT_TIME",
    "ACTIVITIES",
    "NOTES",
    "DATE",
    "MULTIPLE",
  ]),
  requestedChanges: z.record(z.string(), z.any()).refine((data) => Object.keys(data).length > 0, {
    message: "At least one change must be requested",
  }),
  reason: z.string().min(10, "Reason must be at least 10 characters"),
  studentNotes: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  dueDate: z.string().datetime().optional(),
})

const getCorrectionSchema = z.object({
  studentId: z.string().optional(),
  rotationId: z.string().optional(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "APPLIED"]).optional(),
  correctionType: z
    .enum(["CLOCK_IN_TIME", "CLOCK_OUT_TIME", "ACTIVITIES", "NOTES", "DATE", "MULTIPLE"])
    .optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z
    .string()
    .transform((val) => Number.parseInt(val) || 1)
    .optional(),
  limit: z
    .string()
    .transform((val) => Math.min(Number.parseInt(val) || 20, 100))
    .optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "dueDate", "priority"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
})

// GET /api/timecard-corrections - Retrieve timecard corrections
export async function GET(request: NextRequest) {
  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      'api:timecard-corrections/route.ts',
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
    console.warn('Cache error in timecard-corrections/route.ts:', cacheError)
    // Continue with original logic if cache fails
  }
  
  async function executeOriginalLogic() {

  try {
    const authResult = await apiAuthMiddleware(request, {
      requiredPermissions: ["view_timecard_corrections", "approve_timesheets"],
      requireAny: true,
    })

    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { user } = authResult
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 })
    }
    const { searchParams } = new URL(request.url)
    const params = Object.fromEntries(searchParams.entries())

    const validatedParams = getCorrectionSchema.parse(params)
    const {
      studentId,
      rotationId,
      status,
      correctionType,
      priority,
      startDate,
      endDate,
      page = 1,
      limit = 20,
      sortOrder,
    } = validatedParams

    // Build query conditions based on user role
    const whereConditions: SQL[] = []

    // Role-based filtering
    if (user?.role === "STUDENT") {
      whereConditions.push(eq(timecardCorrections.studentId, user?.id))
    } else if (user?.role === "CLINICAL_PRECEPTOR") {
      // Preceptors can only see corrections for their students
      const preceptorRotations = await db
        .select({ id: rotations.id })
        .from(rotations)
        .where(eq(rotations.preceptorId, user?.id))

      const rotationIds = preceptorRotations.map((r) => r.id)
      if (rotationIds.length > 0) {
        whereConditions.push(inArray(timecardCorrections.rotationId, rotationIds))
      } else {
        // No rotations found, return empty result
        return NextResponse.json({
          corrections: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
        })
      }
    } else if (user?.role === "SCHOOL_ADMIN") {
      // School admins can see all corrections for their school
      if (user?.schoolId) {
        const schoolStudents = await db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.schoolId, user?.schoolId), eq(users.role, "STUDENT")))

        const studentIds = schoolStudents.map((s) => s.id)
        if (studentIds.length > 0) {
          whereConditions.push(inArray(timecardCorrections.studentId, studentIds))
        }
      }
    }

    // Apply additional filters
    if (studentId) {
      whereConditions.push(eq(timecardCorrections.studentId, studentId))
    }
    if (rotationId) {
      whereConditions.push(eq(timecardCorrections.rotationId, rotationId))
    }
    if (status) {
      whereConditions.push(eq(timecardCorrections.status, status))
    }
    if (correctionType) {
      whereConditions.push(eq(timecardCorrections.correctionType, correctionType))
    }
    if (priority) {
      whereConditions.push(eq(timecardCorrections.priority, priority))
    }
    if (startDate) {
      whereConditions.push(gte(timecardCorrections.createdAt, new Date(startDate)))
    }
    if (endDate) {
      whereConditions.push(lte(timecardCorrections.createdAt, new Date(endDate)))
    }

    // Build the final where clause
    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined

    // Get total count for pagination
    const totalResult = await db
      .select({ count: timecardCorrections.id })
      .from(timecardCorrections)
      .where(whereClause)

    const total = totalResult.length
    const totalPages = Math.ceil(total / limit)
    const offset = (page - 1) * limit

    // Get corrections with related data
    const corrections = await db
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
      .where(whereClause)
      .orderBy(
        sortOrder === "asc"
          ? asc(timecardCorrections.createdAt)
          : desc(timecardCorrections.createdAt)
      )
      .limit(limit)
      .offset(offset)

    await logAuditEvent({
      userId: user?.id,
      action: "VIEW_TIMECARD_CORRECTIONS",
      resource: "timecard_corrections",
      details: JSON.stringify({ filters: validatedParams }),
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    })

    return NextResponse.json({
      corrections,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    })
  } catch (error) {
    console.error("Error fetching timecard corrections:", error)
    return NextResponse.json({ error: "Failed to fetch timecard corrections" }, { status: 500 })
  }

  }
}

// POST /api/timecard-corrections - Create a new timecard correction request
export async function POST(request: NextRequest) {
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
    const validatedData = createCorrectionSchema.parse(body)

    // Verify the original time record exists and belongs to the user (if student)
    const originalRecord = await db
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
      })
      .from(timeRecords)
      .where(eq(timeRecords.id, validatedData.originalTimeRecordId))
      .limit(1)

    if (originalRecord.length === 0) {
      return NextResponse.json({ error: "Time record not found" }, { status: 404 })
    }

    const record = originalRecord[0]

    // Students can only request corrections for their own records
    if (user?.role === "STUDENT" && record.studentId !== user?.id) {
      return NextResponse.json(
        { error: "You can only request corrections for your own time records" },
        { status: 403 }
      )
    }

    // Check if there's already a pending correction for this record
    const existingCorrection = await db
      .select({ id: timecardCorrections.id })
      .from(timecardCorrections)
      .where(
        and(
          eq(timecardCorrections.originalTimeRecordId, validatedData.originalTimeRecordId),
          inArray(timecardCorrections.status, ["PENDING", "APPROVED"])
        )
      )
      .limit(1)

    if (existingCorrection.length > 0) {
      return NextResponse.json(
        { error: "A correction request for this time record is already pending or approved" },
        { status: 409 }
      )
    }

    // Create the correction request
    const correctionId = nanoid()
    const dueDate = validatedData.dueDate ? new Date(validatedData.dueDate) : null

    const newCorrection = await db
      .insert(timecardCorrections)
      .values({
        id: correctionId,
        originalTimeRecordId: validatedData.originalTimeRecordId,
        studentId: record.studentId,
        rotationId: record.rotationId,
        correctionType: validatedData.correctionType,
        requestedChanges: JSON.stringify(validatedData.requestedChanges),
        reason: validatedData.reason,
        studentNotes: validatedData.studentNotes,
        status: "PENDING",
        originalData: JSON.stringify(record),
        priority: validatedData.priority,
        dueDate,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()

    await logAuditEvent({
      userId: user?.id,
      action: "CREATE_TIMECARD_CORRECTION",
      resource: "timecard_corrections",
      resourceId: correctionId,
      details: JSON.stringify({
        originalTimeRecordId: validatedData.originalTimeRecordId,
        correctionType: validatedData.correctionType,
        priority: validatedData.priority,
      }),
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    })

    return NextResponse.json(
      {
        message: "Timecard correction request created successfully",
        correction: newCorrection[0],
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error creating timecard correction:", error)

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
      console.warn('Cache invalidation error in timecard-corrections/route.ts:', cacheError)
    }
    
    return NextResponse.json(
      { error: "Failed to create timecard correction request" },
      { status: 500 }
    )
  }
}
