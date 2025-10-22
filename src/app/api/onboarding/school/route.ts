import { and, desc, eq, gte, lte } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "../../../../database/connection-pool"
import { clinicalSites, evaluations, rotations, users } from "../../../../database/schema"
import { getSchoolContext } from "../../../../lib/school-utils"
import { cacheIntegrationService } from '@/lib/cache-integration'


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
export async function GET(request: NextRequest) {
  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      'api:onboarding/school/route.ts',
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
    console.warn('Cache error in onboarding/school/route.ts:', cacheError)
    // Continue with original logic if cache fails
  }
  
  async function executeOriginalLogic() {

  try {
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
    if (context.userRole === "STUDENT") {
      conditions.push(eq(evaluations.studentId, context.userId))
    } else if (
      context.userRole === "CLINICAL_PRECEPTOR" ||
      context.userRole === "CLINICAL_SUPERVISOR"
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

    return NextResponse.json({
      success: true,
      data: evaluationsWithAverages,
      pagination: {
        limit,
        offset,
        total: evaluationList.length,
      },
    })
  } catch (error) {
    console.error("Error fetching evaluations:", error)
    return NextResponse.json({ error: "Failed to fetch evaluations" }, { status: 500 })
  }

  }
}

// POST /api/evaluations - Create new evaluation
export async function POST(request: NextRequest) {
  try {
    const context = await getSchoolContext()

    // Only preceptors, supervisors, and admins can create evaluations
    if (
      !["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_PRECEPTOR", "CLINICAL_SUPERVISOR"].includes(
        context.userRole
      )
    ) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
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
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    // Verify rotation exists and student is assigned
    const [rotation] = await db
      .select()
      .from(rotations)
      .where(eq(rotations.id, validatedData.rotationId))
      .limit(1)

    if (!rotation) {
      return NextResponse.json({ error: "Rotation not found" }, { status: 404 })
    }

    if (rotation.studentId !== validatedData.studentId) {
      return NextResponse.json(
        { error: "Student is not assigned to this rotation" },
        { status: 400 }
      )
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
      return NextResponse.json(
        { error: `${validatedData.type} evaluation already exists for this rotation` },
        { status: 400 }
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

    return NextResponse.json({
      success: true,
      data: {
        ...newEvaluation,
        averageRating: Math.round(averageRating * 100) / 100,
      },
      message: "Evaluation created successfully",
    })
  } catch (error) {
    console.error("Error creating evaluation:", error)
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
      console.warn('Cache invalidation error in onboarding/school/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Failed to create evaluation" }, { status: 500 })
  }
}

// PUT /api/evaluations - Update evaluation
export async function PUT(request: NextRequest) {
  try {
    const context = await getSchoolContext()
    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: "Evaluation ID is required" }, { status: 400 })
    }

    // Only evaluators and admins can update evaluations
    if (
      !["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_PRECEPTOR", "CLINICAL_SUPERVISOR"].includes(
        context.userRole
      )
    ) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const validatedData = updateEvaluationSchema.parse(updateData)

    // Get existing evaluation
    const [existingEvaluation] = await db
      .select()
      .from(evaluations)
      .where(eq(evaluations.id, id))
      .limit(1)

    if (!existingEvaluation) {
      return NextResponse.json({ error: "Evaluation not found" }, { status: 404 })
    }

    // Only the original evaluator or admins can update
    if (context.userRole !== "SUPER_ADMIN" && context.userRole !== "SCHOOL_ADMIN") {
      if (existingEvaluation.evaluatorId !== context.userId) {
        return NextResponse.json(
          { error: "Only the original evaluator can update this evaluation" },
          { status: 403 }
        )
      }
    }

    // Prepare update values
    const updateValues: Record<string, unknown> = {
      updatedAt: new Date(),
    }

    // Set fields that are provided
    if (validatedData.type) updateValues.type = validatedData.type
    // Period is set to default value, not updated via API
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
    if (validatedData.strengths) updateValues.strengths = validatedData.strengths
    if (validatedData.areasForImprovement)
      updateValues.areasForImprovement = validatedData.areasForImprovement
    if (validatedData.goals !== undefined) updateValues.goals = validatedData.goals
    if (validatedData.additionalComments !== undefined)
      updateValues.comments = validatedData.additionalComments

    const [updatedEvaluation] = await db
      .update(evaluations)
      .set(updateValues)
      .where(eq(evaluations.id, id))
      .returning()

    // Calculate average rating
    const ratings = [
      Number.parseFloat(updatedEvaluation.clinicalSkills),
      Number.parseFloat(updatedEvaluation.professionalism),
      Number.parseFloat(updatedEvaluation.communication),
      Number.parseFloat(updatedEvaluation.criticalThinking),
    ]
    const averageRating = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length

    return NextResponse.json({
      success: true,
      data: {
        ...updatedEvaluation,
        averageRating: Math.round(averageRating * 100) / 100,
      },
      message: "Evaluation updated successfully",
    })
  } catch (error) {
    console.error("Error updating evaluation:", error)
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
      console.warn('Cache invalidation error in onboarding/school/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Failed to update evaluation" }, { status: 500 })
  }
}

// DELETE /api/evaluations - Delete evaluation
export async function DELETE(request: NextRequest) {
  try {
    const context = await getSchoolContext()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Evaluation ID is required" }, { status: 400 })
    }

    // Only super admins and school admins can delete evaluations
    if (!["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(context.userRole)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Get existing evaluation
    const [existingEvaluation] = await db
      .select()
      .from(evaluations)
      .where(eq(evaluations.id, id))
      .limit(1)

    if (!existingEvaluation) {
      return NextResponse.json({ error: "Evaluation not found" }, { status: 404 })
    }

    await db.delete(evaluations).where(eq(evaluations.id, id))

    return NextResponse.json({
      success: true,
      message: "Evaluation deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting evaluation:", error)
    
    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateAllCache()
    } catch (cacheError) {
      console.warn('Cache invalidation error in onboarding/school/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Failed to delete evaluation" }, { status: 500 })
  }
}
