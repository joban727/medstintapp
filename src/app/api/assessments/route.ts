import { and, desc, eq, gte, lte } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "../../../database/connection-pool"
import { assessments, competencies, programs, rotations, users } from "../../../database/schema"
import { getSchoolContext } from "../../../lib/school-utils"
import { cacheIntegrationService } from "@/lib/cache-integration"
import {
  withErrorHandling,
  createErrorResponse,
  HTTP_STATUS,
  ERROR_MESSAGES,
} from "@/lib/api-response"

import type { UserRole } from "@/types"
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

// Helper function for validation error responses
function createValidationErrorResponse(error: z.ZodError) {
  return NextResponse.json(
    {
      success: false,
      error: "Validation failed",
      details: error.issues.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      })),
    },
    { status: HTTP_STATUS.BAD_REQUEST }
  )
}

// GET /api/assessments - Get assessments with filtering
export const GET = withErrorHandling(async (request: NextRequest) => {
  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      "api:assessments/route.ts",
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
    console.warn("Cache error in assessments/route.ts:", cacheError)
    // Continue with original logic if cache fails
  }

  async function executeOriginalLogic() {
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
    if (context.userRole === ("STUDENT" as UserRole)) {
      conditions.push(eq(assessments.studentId, context.userId))
    } else if (
      context.userRole === ("CLINICAL_PRECEPTOR" as UserRole) ||
      context.userRole === ("CLINICAL_SUPERVISOR" as UserRole)
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
  }

  try {
    return await executeOriginalLogic()
  } catch (error) {
    console.error("Error fetching assessments:", error)
    return createErrorResponse("Failed to fetch assessments", HTTP_STATUS.INTERNAL_SERVER_ERROR)
  }
})

// POST /api/assessments - Create new assessment
export const POST = withErrorHandling(async (request: NextRequest) => {
  try {
    const context = await getSchoolContext()

    // Only preceptors, supervisors, and admins can create assessments
    if (
      ![
        "SUPER_ADMIN" as UserRole,
        "SCHOOL_ADMIN" as UserRole,
        "CLINICAL_PRECEPTOR" as UserRole,
        "CLINICAL_SUPERVISOR" as UserRole,
      ].includes(context.userRole)
    ) {
      return createErrorResponse(ERROR_MESSAGES.FORBIDDEN, HTTP_STATUS.FORBIDDEN)
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
      return createErrorResponse("Competency not found", HTTP_STATUS.NOT_FOUND)
    }

    // Verify rotation if provided
    if (validatedData.rotationId) {
      const [rotation] = await db
        .select()
        .from(rotations)
        .where(eq(rotations.id, validatedData.rotationId))
        .limit(1)

      if (!rotation) {
        return createErrorResponse("Rotation not found", HTTP_STATUS.NOT_FOUND)
      }

      // Verify student is assigned to this rotation
      if (rotation.studentId !== validatedData.studentId) {
        return createErrorResponse(
          "Student is not assigned to this rotation",
          HTTP_STATUS.BAD_REQUEST
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

    // Invalidate related caches
    try {
      await cacheIntegrationService.clear()
    } catch (cacheError) {
      console.warn("Cache invalidation error in assessments/route.ts:", cacheError)
    }

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
      return createValidationErrorResponse(error)
    }

    return createErrorResponse("Failed to create assessment", HTTP_STATUS.INTERNAL_SERVER_ERROR)
  }
})

// PUT /api/assessments - Update assessment
export const PUT = withErrorHandling(async (request: NextRequest) => {
  try {
    const context = await getSchoolContext()
    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return createErrorResponse("Assessment ID is required", HTTP_STATUS.BAD_REQUEST)
    }

    // Only assessors and admins can update assessments
    if (
      ![
        "SUPER_ADMIN" as UserRole,
        "SCHOOL_ADMIN" as UserRole,
        "CLINICAL_PRECEPTOR" as UserRole,
        "CLINICAL_SUPERVISOR" as UserRole,
      ].includes(context.userRole)
    ) {
      return createErrorResponse(ERROR_MESSAGES.FORBIDDEN, HTTP_STATUS.FORBIDDEN)
    }

    const validatedData = updateAssessmentSchema.parse(updateData)

    // Get existing assessment
    const [existingAssessment] = await db
      .select()
      .from(assessments)
      .where(eq(assessments.id, id))
      .limit(1)

    if (!existingAssessment) {
      return createErrorResponse("Assessment not found", HTTP_STATUS.NOT_FOUND)
    }

    // Only the original assessor or admins can update
    if (
      context.userRole !== ("SUPER_ADMIN" as UserRole) &&
      context.userRole !== ("SCHOOL_ADMIN" as UserRole)
    ) {
      if (existingAssessment.assessorId !== context.userId) {
        return createErrorResponse(
          "Only the original assessor can update this assessment",
          HTTP_STATUS.FORBIDDEN
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
      return createValidationErrorResponse(error)
    }

    // Invalidate cache for this endpoint
    try {
      await cacheIntegrationService.clear()
    } catch (cacheError) {
      console.warn("Cache invalidation error in assessments/route.ts:", cacheError)
    }

    return createErrorResponse("Failed to update assessment", HTTP_STATUS.INTERNAL_SERVER_ERROR)
  }
})

// DELETE /api/assessments - Delete assessment
export const DELETE = withErrorHandling(async (request: NextRequest) => {
  try {
    const context = await getSchoolContext()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return createErrorResponse("Assessment ID is required", HTTP_STATUS.BAD_REQUEST)
    }

    // Only clinical preceptors and supervisors can delete assessments
    if (
      context.userRole !== ("CLINICAL_PRECEPTOR" as UserRole) &&
      context.userRole !== ("CLINICAL_SUPERVISOR" as UserRole)
    ) {
      return createErrorResponse(
        "Only clinical preceptors and supervisors can delete assessments",
        HTTP_STATUS.FORBIDDEN
      )
    }

    // Get existing assessment
    const [existingAssessment] = await db
      .select()
      .from(assessments)
      .where(eq(assessments.id, id))
      .limit(1)

    if (!existingAssessment) {
      return createErrorResponse("Assessment not found", HTTP_STATUS.NOT_FOUND)
    }

    // Check if user is the assessor who created this assessment
    if (existingAssessment.assessorId !== context.userId) {
      return createErrorResponse(
        "You can only delete assessments you created",
        HTTP_STATUS.FORBIDDEN
      )
    }

    await db.delete(assessments).where(eq(assessments.id, id))

    // Invalidate cache for this endpoint
    try {
      await cacheIntegrationService.clear()
    } catch (cacheError) {
      console.warn("Cache invalidation error in assessments/route.ts:", cacheError)
    }

    return NextResponse.json({
      success: true,
      message: "Assessment deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting assessment:", error)

    // Invalidate related caches
    try {
      await cacheIntegrationService.clear()
    } catch (cacheError) {
      console.warn("Cache invalidation error in assessments/route.ts:", cacheError)
    }

    return createErrorResponse("Failed to delete assessment", HTTP_STATUS.INTERNAL_SERVER_ERROR)
  }
})

