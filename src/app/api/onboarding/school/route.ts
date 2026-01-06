import { and, desc, eq, gte, lte } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "../../../../database/connection-pool"
import { clinicalSites, evaluations, rotations, users } from "../../../../database/schema"
import { getSchoolContext } from "../../../../lib/school-utils"
import { cacheIntegrationService } from "@/lib/cache-integration"
import type { UserRole } from "@/types"
import {
  createSuccessResponse,
  createErrorResponse,
  withErrorHandling,
  HTTP_STATUS,
} from "@/lib/api-response"

// Validation schemas
const createEvaluationSchema = z.object({
  studentId: z.string().min(1, "Student ID is required"),
  rotationId: z.string().min(1, "Rotation ID is required"),
  type: z.enum(["MIDTERM", "FINAL", "WEEKLY", "INCIDENT"]),
  date: z.string().datetime("Invalid date format"),
  overallRating: z.number().min(1).max(5, "Overall rating must be between 1 and 5"),
  clinicalSkills: z.number().min(1).max(5, "Clinical skills rating must be between 1 and 5"),
  professionalism: z.number().min(1).max(5, "Professionalism rating must be between 1 and 5"),
  communication: z.number().min(1).max(5, "Communication rating must be between 1 and 5"),
  criticalThinking: z.number().min(1).max(5, "Critical thinking rating must be between 1 and 5"),
  teamwork: z.number().min(1).max(5, "Teamwork rating must be between 1 and 5"),
  strengths: z.string().min(1, "Strengths are required"),
  areasForImprovement: z.string().min(1, "Areas for improvement are required"),
  goals: z.string().optional(),
  additionalComments: z.string().optional(),
  recommendForAdvancement: z.boolean(),
})

const updateEvaluationSchema = z.object({
  id: z.string().min(1, "Evaluation ID is required"),
  type: z.enum(["MIDTERM", "FINAL", "WEEKLY", "INCIDENT"]).optional(),
  date: z.string().datetime().optional(),
  overallRating: z.number().min(1).max(5).optional(),
  clinicalSkills: z.number().min(1).max(5).optional(),
  professionalism: z.number().min(1).max(5).optional(),
  communication: z.number().min(1).max(5).optional(),
  criticalThinking: z.number().min(1).max(5).optional(),
  teamwork: z.number().min(1).max(5).optional(),
  strengths: z.string().min(1).optional(),
  areasForImprovement: z.string().min(1).optional(),
  goals: z.string().optional(),
  additionalComments: z.string().optional(),
  recommendForAdvancement: z.boolean().optional(),
})

// GET /api/evaluations - Get evaluations with filtering
export const GET = withErrorHandling(async (request: NextRequest) => {
  // Try to get cached response
  try {
    const cached = await cacheIntegrationService.cachedApiResponse(
      "api:onboarding/school/route.ts",
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
    console.warn("Cache error in onboarding/school/route.ts:", cacheError)
    // Continue with original logic if cache fails
  }

  async function executeOriginalLogic() {
    const context = await getSchoolContext()
    const { searchParams } = new URL(request.url)

    const studentId = searchParams.get("studentId")
    const rotationId = searchParams.get("rotationId")
    const evaluatorId = searchParams.get("evaluatorId")
    const type = searchParams.get("type")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const _recommendForAdvancement = searchParams.get("recommendForAdvancement")
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const offset = Number.parseInt(searchParams.get("offset") || "0")

    // Build query conditions
    const conditions = []

    // Role-based filtering
    if (context.userRole === ("STUDENT" as UserRole)) {
      conditions.push(eq(evaluations.studentId, context.userId))
    } else if (
      context.userRole === ("CLINICAL_PRECEPTOR" as UserRole) ||
      context.userRole === ("CLINICAL_SUPERVISOR" as UserRole)
    ) {
      conditions.push(eq(evaluations.evaluatorId, context.userId))
    }

    if (studentId) {
      conditions.push(eq(evaluations.studentId, studentId))
    }

    if (rotationId) {
      conditions.push(eq(evaluations.rotationId, rotationId))
    }

    if (evaluatorId) {
      conditions.push(eq(evaluations.evaluatorId, evaluatorId))
    }

    if (type && ["MIDTERM", "FINAL", "WEEKLY", "INCIDENT"].includes(type)) {
      conditions.push(eq(evaluations.type, type as "MIDTERM" | "FINAL" | "WEEKLY" | "INCIDENT"))
    }

    if (startDate) {
      conditions.push(gte(evaluations.createdAt, new Date(startDate)))
    }

    if (endDate) {
      conditions.push(lte(evaluations.createdAt, new Date(endDate)))
    }

    // Execute query with joins
    const evaluationList = await db
      .select({
        id: evaluations.id,
        studentId: evaluations.studentId,
        rotationId: evaluations.rotationId,
        evaluatorId: evaluations.evaluatorId,
        type: evaluations.type,
        period: evaluations.period,
        overallRating: evaluations.overallRating,
        clinicalSkills: evaluations.clinicalSkills,
        professionalism: evaluations.professionalism,
        communication: evaluations.communication,
        criticalThinking: evaluations.criticalThinking,
        strengths: evaluations.strengths,
        areasForImprovement: evaluations.areasForImprovement,
        goals: evaluations.goals,
        comments: evaluations.comments,
        createdAt: evaluations.createdAt,
        updatedAt: evaluations.updatedAt,
        studentName: users.name,
        rotationSpecialty: rotations.specialty,
        rotationStartDate: rotations.startDate,
        rotationEndDate: rotations.endDate,
        clinicalSiteName: clinicalSites.name,
      })
      .from(evaluations)
      .leftJoin(users, eq(evaluations.studentId, users.id))
      .leftJoin(rotations, eq(evaluations.rotationId, rotations.id))
      .leftJoin(clinicalSites, eq(rotations.clinicalSiteId, clinicalSites.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(evaluations.createdAt))
      .limit(limit)
      .offset(offset)

    // Calculate average ratings
    const evaluationsWithAverages = evaluationList.map((evaluation) => {
      const ratings = [
        Number.parseFloat(evaluation.clinicalSkills),
        Number.parseFloat(evaluation.professionalism),
        Number.parseFloat(evaluation.communication),
        Number.parseFloat(evaluation.criticalThinking),
      ]
      const averageRating = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length

      return {
        ...evaluation,
        averageRating: Math.round(averageRating * 100) / 100,
      }
    })

    return createSuccessResponse({
      data: evaluationsWithAverages,
      pagination: {
        limit,
        offset,
        total: evaluationList.length,
      },
    })
  }

  return await executeOriginalLogic()
})

// POST /api/evaluations - Create new evaluation
export const POST = withErrorHandling(async (request: NextRequest) => {
  const context = await getSchoolContext()

  // Only preceptors, supervisors, and admins can create evaluations
  if (
    ![
      "SUPER_ADMIN" as UserRole,
      "SCHOOL_ADMIN" as UserRole,
      "CLINICAL_PRECEPTOR" as UserRole,
      "CLINICAL_SUPERVISOR" as UserRole,
    ].includes(context.userRole)
  ) {
    return createErrorResponse("Insufficient permissions", HTTP_STATUS.FORBIDDEN)
  }

  const body = await request.json()
  const validatedData = createEvaluationSchema.parse(body)

  // Verify student exists
  const [student] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, validatedData.studentId), eq(users.role, "STUDENT")))
    .limit(1)

  if (!student) {
    return createErrorResponse("Student not found", HTTP_STATUS.NOT_FOUND)
  }

  // Verify rotation exists and student is assigned
  const [rotation] = await db
    .select()
    .from(rotations)
    .where(eq(rotations.id, validatedData.rotationId))
    .limit(1)

  if (!rotation) {
    return createErrorResponse("Rotation not found", HTTP_STATUS.NOT_FOUND)
  }

  if (rotation.studentId !== validatedData.studentId) {
    return createErrorResponse("Student is not assigned to this rotation", HTTP_STATUS.BAD_REQUEST)
  }

  // Check if evaluation already exists for this type and rotation
  const [existingEvaluation] = await db
    .select()
    .from(evaluations)
    .where(
      and(
        eq(evaluations.studentId, validatedData.studentId),
        eq(evaluations.rotationId, validatedData.rotationId),
        eq(evaluations.type, validatedData.type)
      )
    )
    .limit(1)

  if (existingEvaluation && ["MIDTERM", "FINAL"].includes(validatedData.type)) {
    return createErrorResponse(
      `${validatedData.type} evaluation already exists for this rotation`,
      HTTP_STATUS.BAD_REQUEST
    )
  }

  // Create evaluation
  const [newEvaluation] = await db
    .insert(evaluations)
    .values({
      id: crypto.randomUUID(),
      assignmentId: crypto.randomUUID(), // Generate a default assignment ID
      studentId: validatedData.studentId,
      rotationId: validatedData.rotationId,
      evaluatorId: context.userId,
      type: validatedData.type,
      period: "Week 1", // Default period since schema expects this field
      observationDate: new Date(), // Required field
      overallRating: validatedData.overallRating.toString(),
      clinicalSkills: validatedData.clinicalSkills.toString(),
      professionalism: validatedData.professionalism.toString(),
      communication: validatedData.communication.toString(),
      criticalThinking: validatedData.criticalThinking.toString(),
      strengths: validatedData.strengths,
      areasForImprovement: validatedData.areasForImprovement,
      goals: validatedData.goals,
      comments: validatedData.additionalComments,
    })
    .returning()

  // Calculate average rating
  const ratings = [
    validatedData.clinicalSkills,
    validatedData.professionalism,
    validatedData.communication,
    validatedData.criticalThinking,
  ]
  const averageRating = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length

  // Invalidate related caches
  try {
    await cacheIntegrationService.clear()
  } catch (cacheError) {
    console.warn("Cache invalidation error in onboarding/school/route.ts:", cacheError)
  }

  return createSuccessResponse({
    data: {
      ...newEvaluation,
      averageRating: Math.round(averageRating * 100) / 100,
    },
    message: "Evaluation created successfully",
  })
})

// PUT /api/evaluations - Update evaluation
export const PUT = withErrorHandling(async (request: NextRequest) => {
  const context = await getSchoolContext()

  // Only preceptors, supervisors, and admins can update evaluations
  if (
    ![
      "SUPER_ADMIN" as UserRole,
      "SCHOOL_ADMIN" as UserRole,
      "CLINICAL_PRECEPTOR" as UserRole,
      "CLINICAL_SUPERVISOR" as UserRole,
    ].includes(context.userRole)
  ) {
    return createErrorResponse("Insufficient permissions", HTTP_STATUS.FORBIDDEN)
  }

  const body = await request.json()
  const validatedData = updateEvaluationSchema.parse(body)

  // Verify evaluation exists
  const [existingEvaluation] = await db
    .select()
    .from(evaluations)
    .where(eq(evaluations.id, validatedData.id))
    .limit(1)

  if (!existingEvaluation) {
    return createErrorResponse("Evaluation not found", HTTP_STATUS.NOT_FOUND)
  }

  // Only the original evaluator or admins can update
  if (
    existingEvaluation.evaluatorId !== context.userId &&
    !["SUPER_ADMIN" as UserRole, "SCHOOL_ADMIN" as UserRole].includes(context.userRole)
  ) {
    return createErrorResponse("Can only update your own evaluations", HTTP_STATUS.FORBIDDEN)
  }

  // Prepare update values
  const updateValues: any = {}
  if (validatedData.overallRating !== undefined)
    updateValues.overallRating = validatedData.overallRating.toString()
  if (validatedData.clinicalSkills !== undefined)
    updateValues.clinicalSkills = validatedData.clinicalSkills.toString()
  if (validatedData.professionalism !== undefined)
    updateValues.professionalism = validatedData.professionalism.toString()
  if (validatedData.communication !== undefined)
    updateValues.communication = validatedData.communication.toString()
  if (validatedData.criticalThinking !== undefined)
    updateValues.criticalThinking = validatedData.criticalThinking.toString()
  if (validatedData.strengths !== undefined) updateValues.strengths = validatedData.strengths
  if (validatedData.areasForImprovement !== undefined)
    updateValues.areasForImprovement = validatedData.areasForImprovement
  if (validatedData.goals !== undefined) updateValues.goals = validatedData.goals
  if (validatedData.additionalComments !== undefined)
    updateValues.comments = validatedData.additionalComments

  // Update evaluation
  const [updatedEvaluation] = await db
    .update(evaluations)
    .set(updateValues)
    .where(eq(evaluations.id, validatedData.id))
    .returning()

  // Calculate average rating
  const ratings = [
    parseInt(updatedEvaluation.clinicalSkills),
    parseInt(updatedEvaluation.professionalism),
    parseInt(updatedEvaluation.communication),
    parseInt(updatedEvaluation.criticalThinking),
  ]
  const averageRating = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length

  // Invalidate related caches
  try {
    await cacheIntegrationService.clear()
  } catch (cacheError) {
    console.warn("Cache invalidation error in onboarding/school/route.ts:", cacheError)
  }

  return createSuccessResponse({
    data: {
      ...updatedEvaluation,
      averageRating: Math.round(averageRating * 100) / 100,
    },
    message: "Evaluation updated successfully",
  })
})

// DELETE /api/evaluations - Delete evaluation
export const DELETE = withErrorHandling(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const evaluationId = searchParams.get("id")

  if (!evaluationId) {
    return createErrorResponse("Evaluation ID is required", HTTP_STATUS.BAD_REQUEST)
  }

  const context = await getSchoolContext()

  // Only admins can delete evaluations
  if (!["SUPER_ADMIN" as UserRole, "SCHOOL_ADMIN" as UserRole].includes(context.userRole)) {
    return createErrorResponse("Insufficient permissions", HTTP_STATUS.FORBIDDEN)
  }

  // Verify evaluation exists
  const [existingEvaluation] = await db
    .select()
    .from(evaluations)
    .where(eq(evaluations.id, evaluationId))
    .limit(1)

  if (!existingEvaluation) {
    return createErrorResponse("Evaluation not found", HTTP_STATUS.NOT_FOUND)
  }

  // Delete evaluation
  await db.delete(evaluations).where(eq(evaluations.id, evaluationId))

  // Invalidate related caches
  try {
    await cacheIntegrationService.clear()
  } catch (cacheError) {
    console.warn("Cache invalidation error in onboarding/school/route.ts:", cacheError)
  }

  return createSuccessResponse({
    message: "Evaluation deleted successfully",
  })
})
