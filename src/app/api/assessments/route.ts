import { and, desc, eq, gte, lte } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "../../../database/connection-pool"
import { assessments, competencies, programs, rotations, users } from "../../../database/schema"
import { getSchoolContext } from "../../../lib/school-utils"
import { cacheIntegrationService } from '@/lib/cache-integration'


// Validation schemas
const createAssessmentSchema = z.object({
  studentId: z.string().min(1, "Student ID is required"),
  competencyId: z.string().min(1, "Competency ID is required"),
  rotationId: z.string().optional(),
  type: z.enum(["INITIAL", "FORMATIVE", "SUMMATIVE", "FINAL"]),
  method: z.enum(["OBSERVATION", "SIMULATION", "ORAL_EXAM", "WRITTEN_EXAM", "PRACTICAL"]),
  date: z.string().datetime("Invalid date format"),
  score: z.number().min(0, "Score must be non-negative"),
  maxScore: z.number().min(1, "Max score must be at least 1"),
  feedback: z.string().min(1, "Feedback is required"),
  recommendations: z.string().optional(),
  nextAssessmentDate: z.string().datetime().optional(),
})

const updateAssessmentSchema = z.object({
  type: z.enum(["INITIAL", "FORMATIVE", "SUMMATIVE", "FINAL"]).optional(),
  method: z
    .enum(["OBSERVATION", "SIMULATION", "ORAL_EXAM", "WRITTEN_EXAM", "PRACTICAL"])
    .optional(),
  date: z.string().datetime().optional(),
  score: z.number().min(0).optional(),
  maxScore: z.number().min(1).optional(),
  feedback: z.string().min(1).optional(),
  recommendations: z.string().optional(),
  nextAssessmentDate: z.string().datetime().optional(),
})

// GET /api/assessments - Get assessments with filtering
export async function GET(request: NextRequest) {
  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      'api:assessments/route.ts',
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
    console.warn('Cache error in assessments/route.ts:', cacheError)
    // Continue with original logic if cache fails
  }
  
  async function executeOriginalLogic() {

  try {
    const context = await getSchoolContext()
    const { searchParams } = new URL(request.url)

    const studentId = searchParams.get("studentId")
    const competencyId = searchParams.get("competencyId")
    const rotationId = searchParams.get("rotationId")
    const assessorId = searchParams.get("assessorId")
    const _type = searchParams.get("type")
    const _method = searchParams.get("method")
    const passed = searchParams.get("passed")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const offset = Number.parseInt(searchParams.get("offset") || "0")

    // Build query conditions
    const conditions = []

    // Role-based filtering
    if (context.userRole === "STUDENT") {
      conditions.push(eq(assessments.studentId, context.userId))
    } else if (
      context.userRole === "CLINICAL_PRECEPTOR" ||
      context.userRole === "CLINICAL_SUPERVISOR"
    ) {
      conditions.push(eq(assessments.assessorId, context.userId))
    }

    if (studentId) {
      conditions.push(eq(assessments.studentId, studentId))
    }

    if (competencyId) {
      conditions.push(eq(assessments.competencyId, competencyId))
    }

    if (rotationId) {
      conditions.push(eq(assessments.rotationId, rotationId))
    }

    if (assessorId) {
      conditions.push(eq(assessments.assessorId, assessorId))
    }

    // Note: type and method fields are not available in SQLite schema
    // These filters are commented out for now
    // if (type) {
    //   conditions.push(eq(assessments.type, type as any))
    // }
    //
    // if (method) {
    //   conditions.push(eq(assessments.method, method as any))
    // }

    if (passed !== null) {
      conditions.push(eq(assessments.passed, passed === "true"))
    }

    if (startDate) {
      conditions.push(gte(assessments.date, new Date(startDate)))
    }

    if (endDate) {
      conditions.push(lte(assessments.date, new Date(endDate)))
    }

    // Execute query with joins
    const assessmentList = await db
      .select({
        id: assessments.id,
        studentId: assessments.studentId,
        competencyId: assessments.competencyId,
        assessorId: assessments.assessorId,
        rotationId: assessments.rotationId,
        date: assessments.date,
        score: assessments.score,
        maxScore: assessments.maxScore,
        passed: assessments.passed,
        notes: assessments.feedback,
        createdAt: assessments.createdAt,
        updatedAt: assessments.updatedAt,
        studentName: users.name,
        competencyName: competencies.name,
        competencyCategory: competencies.category,
        rotationSpecialty: rotations.specialty,
      })
      .from(assessments)
      .leftJoin(users, eq(assessments.studentId, users.id))
      .leftJoin(competencies, eq(assessments.competencyId, competencies.id))
      .leftJoin(rotations, eq(assessments.rotationId, rotations.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(assessments.date))
      .limit(limit)
      .offset(offset)

    // Calculate percentage scores
    const assessmentsWithPercentage = assessmentList.map((assessment) => {
      const maxScore = Number(assessment.maxScore || 0)
      const score = Number(assessment.score || 0)
      return {
        ...assessment,
        percentage: maxScore > 0 ? Math.round((score / maxScore) * 100) : 0,
      }
    })

    return NextResponse.json({
      success: true,
      data: assessmentsWithPercentage,
      pagination: {
        limit,
        offset,
        total: assessmentList.length,
      },
    })
  } catch (error) {
    console.error("Error fetching assessments:", error)
    return NextResponse.json({ error: "Failed to fetch assessments" }, { status: 500 })
  }

  }
}

// POST /api/assessments - Create new assessment
export async function POST(request: NextRequest) {
  try {
    const context = await getSchoolContext()

    // Only preceptors, supervisors, and admins can create assessments
    if (
      !["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_PRECEPTOR", "CLINICAL_SUPERVISOR"].includes(
        context.userRole
      )
    ) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createAssessmentSchema.parse(body)

    // Verify student exists
    const [student] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, validatedData.studentId), eq(users.role, "STUDENT")))
      .limit(1)

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    // Verify competency exists
    const [competency] = await db
      .select({
        id: competencies.id,
        name: competencies.name,
        programId: competencies.programId,
        schoolId: programs.schoolId,
      })
      .from(competencies)
      .leftJoin(programs, eq(competencies.programId, programs.id))
      .where(eq(competencies.id, validatedData.competencyId))
      .limit(1)

    if (!competency) {
      return NextResponse.json({ error: "Competency not found" }, { status: 404 })
    }

    // Verify rotation if provided
    if (validatedData.rotationId) {
      const [rotation] = await db
        .select()
        .from(rotations)
        .where(eq(rotations.id, validatedData.rotationId))
        .limit(1)

      if (!rotation) {
        return NextResponse.json({ error: "Rotation not found" }, { status: 404 })
      }

      // Verify student is assigned to this rotation
      if (rotation.studentId !== validatedData.studentId) {
        return NextResponse.json(
          { error: "Student is not assigned to this rotation" },
          { status: 400 }
        )
      }
    }

    // Calculate if passed (you can adjust this logic based on requirements)
    const percentage = (validatedData.score / validatedData.maxScore) * 100
    const passed = percentage >= 70 // 70% passing grade

    // Get current attempt number for this student-competency combination
    const existingAssessments = await db
      .select({
        id: assessments.id,
      })
      .from(assessments)
      .where(
        and(
          eq(assessments.studentId, validatedData.studentId),
          eq(assessments.competencyId, validatedData.competencyId)
        )
      )

    const attempts = existingAssessments.length + 1

    // Create assessment
    const assessmentData = {
      id: crypto.randomUUID(),
      studentId: validatedData.studentId,
      competencyId: validatedData.competencyId,
      assessorId: context.userId,
      rotationId: validatedData.rotationId || null,
      type: validatedData.type || "FORMATIVE",
      method: validatedData.method || "OBSERVATION",
      date: new Date(validatedData.date),
      score: validatedData.score.toString(),
      maxScore: validatedData.maxScore.toString(),
      passed,
      attempts,
      feedback: validatedData.feedback || "",
      recommendations: validatedData.recommendations || null,
      nextAssessmentDate: validatedData.nextAssessmentDate
        ? new Date(validatedData.nextAssessmentDate)
        : null,
    }

    const [newAssessment] = await db.insert(assessments).values(assessmentData).returning()

    return NextResponse.json({
      success: true,
      data: {
        ...newAssessment,
        percentage,
      },
      message: "Assessment created successfully",
    })
  } catch (error) {
    console.error("Error creating assessment:", error)
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
      console.warn('Cache invalidation error in assessments/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Failed to create assessment" }, { status: 500 })
  }
}

// PUT /api/assessments - Update assessment
export async function PUT(request: NextRequest) {
  try {
    const context = await getSchoolContext()
    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: "Assessment ID is required" }, { status: 400 })
    }

    // Only assessors and admins can update assessments
    if (
      !["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_PRECEPTOR", "CLINICAL_SUPERVISOR"].includes(
        context.userRole
      )
    ) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const validatedData = updateAssessmentSchema.parse(updateData)

    // Get existing assessment
    const [existingAssessment] = await db
      .select()
      .from(assessments)
      .where(eq(assessments.id, id))
      .limit(1)

    if (!existingAssessment) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 })
    }

    // Only the original assessor or admins can update
    if (context.userRole !== "SUPER_ADMIN" && context.userRole !== "SCHOOL_ADMIN") {
      if (existingAssessment.assessorId !== context.userId) {
        return NextResponse.json(
          { error: "Only the original assessor can update this assessment" },
          { status: 403 }
        )
      }
    }

    // Prepare update values
    const updateValues: {
      date?: Date
      feedback?: string
      score?: string
      maxScore?: string
      passed?: boolean
    } = {}

    // Set fields that are provided
    if (validatedData.date) updateValues.date = new Date(validatedData.date)
    if (validatedData.feedback) updateValues.feedback = validatedData.feedback

    // Handle score updates
    if (validatedData.score !== undefined || validatedData.maxScore !== undefined) {
      const newScore =
        validatedData.score !== undefined ? validatedData.score : Number(existingAssessment.score)
      const newMaxScore =
        validatedData.maxScore !== undefined
          ? validatedData.maxScore
          : Number(existingAssessment.maxScore)

      updateValues.score = newScore.toString()
      updateValues.maxScore = newMaxScore.toString()

      // Recalculate passed status
      const percentage = (newScore / newMaxScore) * 100
      updateValues.passed = percentage >= 70
    }

    const [updatedAssessment] = await db
      .update(assessments)
      .set(updateValues)
      .where(eq(assessments.id, id))
      .returning()

    return NextResponse.json({
      success: true,
      data: {
        ...updatedAssessment,
        percentage:
          Number(updatedAssessment.maxScore) > 0
            ? Math.round(
                (Number(updatedAssessment.score) / Number(updatedAssessment.maxScore)) * 100
              )
            : 0,
      },
      message: "Assessment updated successfully",
    })
  } catch (error) {
    console.error("Error updating assessment:", error)
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
      console.warn('Cache invalidation error in assessments/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Failed to update assessment" }, { status: 500 })
  }
}

// DELETE /api/assessments - Delete assessment
export async function DELETE(request: NextRequest) {
  try {
    const context = await getSchoolContext()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Assessment ID is required" }, { status: 400 })
    }

    // Only super admins and school admins can delete assessments
    if (!["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(context.userRole)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Get existing assessment
    const [existingAssessment] = await db
      .select()
      .from(assessments)
      .where(eq(assessments.id, id))
      .limit(1)

    if (!existingAssessment) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 })
    }

    await db.delete(assessments).where(eq(assessments.id, id))

    return NextResponse.json({
      success: true,
      message: "Assessment deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting assessment:", error)
    
    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateAllCache()
    } catch (cacheError) {
      console.warn('Cache invalidation error in assessments/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Failed to delete assessment" }, { status: 500 })
  }
}
