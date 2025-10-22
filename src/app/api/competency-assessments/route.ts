import { auth } from "@clerk/nextjs/server"
import { and, desc, eq, sql } from "drizzle-orm"
import { nanoid } from "nanoid"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "../../../database/connection-pool"
import { competencies, competencySubmissions, users } from "../../../database/schema"
import { cacheIntegrationService } from '@/lib/cache-integration'


// Validation schemas
const assessmentQuerySchema = z.object({
  userId: z.string().optional(),
  competencyId: z.string().optional(),
  assignmentId: z.string().optional(),
  status: z
    .enum(["SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "REQUIRES_REVISION"])
    .optional(),
  assessorId: z.string().optional(),
  limit: z.string().transform(Number).optional().default(50),
  offset: z.string().transform(Number).optional().default(0),
})

const assessmentCreateSchema = z.object({
  studentId: z.string(),
  competencyId: z.string(),
  assessmentId: z.string().optional(),
  evaluationId: z.string().optional(),
  rotationId: z.string().optional(),
  submissionType: z.enum(["INDIVIDUAL", "BATCH"]).optional(),
  evidence: z.string().optional(),
  notes: z.string().optional(),
  feedback: z.string().optional(),
  status: z
    .enum(["SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "REQUIRES_REVISION"])
    .default("SUBMITTED"),
  dueDate: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
})

// Assessment update schema for future use
// const assessmentUpdateSchema = z.object({
//   rubricScores: z.record(z.number().min(0).max(5)).optional(),
//   overallScore: z.number().min(0).max(5).optional(),
//   feedback: z.string().optional(),
//   status: z.enum(["pending", "in_progress", "completed"]).optional(),
// })

const bulkAssessmentSchema = z.object({
  assessments: z.array(
    z.object({
      submissionId: z.string(),
      feedback: z.string().optional(),
      notes: z.string().optional(),
      status: z.enum(["APPROVED", "REJECTED"]),
    })
  ),
})

// Helper function to check permissions
async function checkPermissions(userId: string, targetUserId?: string) {
  const { userId: clerkUserId } = await auth()
  if (!clerkUserId) {
    throw new Error("Unauthorized")
  }

  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1)

  if (!user.length) {
    throw new Error("User not found")
  }

  const userRole = user[0].role
  const isAdmin = ["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(userRole)
  const isSupervisor = ["CLINICAL_SUPERVISOR", "CLINICAL_PRECEPTOR"].includes(userRole)
  const isStudent = userRole === "STUDENT"
  const isOwnData = userId === targetUserId

  return {
    canView: isAdmin || isSupervisor || (isStudent && isOwnData),
    canAssess: isAdmin || isSupervisor,
    canModify: isAdmin || isSupervisor,
    userRole,
    schoolId: user[0].schoolId,
  }
}

// Helper function for future progress calculations
// function calculateProgressPercentage(overallScore: number): number {
//   return Math.round((overallScore / 5) * 100)
// }

// GET /api/competency-assessments - Get assessments/submissions
export async function GET(request: NextRequest) {
  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      'api:competency-assessments/route.ts',
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
    console.warn('Cache error in competency-assessments/route.ts:', cacheError)
    // Continue with original logic if cache fails
  }
  
  async function executeOriginalLogic() {

  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = assessmentQuerySchema.parse(Object.fromEntries(searchParams))

    // Check permissions
    const permissions = await checkPermissions(userId, query.userId)
    if (!permissions.canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Build query conditions
    const conditions = []

    if (query.userId) {
      conditions.push(eq(competencySubmissions.studentId, query.userId))
    } else if (permissions.userRole === "STUDENT") {
      // Students can only see their own submissions
      conditions.push(eq(competencySubmissions.studentId, userId))
    } else if (permissions.schoolId && !permissions.userRole.includes("SUPER_ADMIN")) {
      // School-level filtering for non-super admins
      conditions.push(eq(users.schoolId, permissions.schoolId))
    }

    if (query.competencyId) {
      conditions.push(eq(competencySubmissions.competencyId, query.competencyId))
    }

    // Note: assignmentId field doesn't exist in competencySubmissions schema
    // Removed assignmentId filter

    if (query.status) {
      conditions.push(eq(competencySubmissions.status, query.status))
    }

    if (query.assessorId) {
      conditions.push(eq(competencySubmissions.reviewedBy, query.assessorId))
    }

    // Execute query with joins
    const results = await db
      .select({
        id: competencySubmissions.id,
        studentId: competencySubmissions.studentId,
        competencyId: competencySubmissions.competencyId,
        assessmentId: competencySubmissions.assessmentId,
        evaluationId: competencySubmissions.evaluationId,
        rotationId: competencySubmissions.rotationId,
        reviewedBy: competencySubmissions.reviewedBy,
        status: competencySubmissions.status,
        submissionType: competencySubmissions.submissionType,
        evidence: competencySubmissions.evidence,
        notes: competencySubmissions.notes,
        feedback: competencySubmissions.feedback,
        reviewedAt: competencySubmissions.reviewedAt,
        submittedAt: competencySubmissions.submittedAt,
        dueDate: competencySubmissions.dueDate,
        completionDate: competencySubmissions.completionDate,
        metadata: competencySubmissions.metadata,
        createdAt: competencySubmissions.createdAt,
        updatedAt: competencySubmissions.updatedAt,
        // User info
        userName: users.name,
        userEmail: users.email,
        // Competency info
        competencyName: competencies.name,
        competencyCategory: competencies.category,
        competencyDescription: competencies.description,
      })
      .from(competencySubmissions)
      .leftJoin(users, eq(competencySubmissions.studentId, users.id))
      .leftJoin(competencies, eq(competencySubmissions.competencyId, competencies.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(competencySubmissions.submittedAt))
      .limit(query.limit)
      .offset(query.offset)

    // Get total count for pagination
    const totalCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(competencySubmissions)
      .leftJoin(users, eq(competencySubmissions.studentId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)

    return NextResponse.json({
      data: results,
      pagination: {
        total: totalCount[0]?.count || 0,
        limit: query.limit,
        offset: query.offset,
        hasMore: query.offset + query.limit < (totalCount[0]?.count || 0),
      },
    })
  } catch (error) {
    console.error("Error fetching assessments:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }

  }
}

// POST /api/competency-assessments - Create/Submit assessment
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const data = assessmentCreateSchema.parse(body)

    // Check permissions
    const permissions = await checkPermissions(userId, data.studentId)
    if (!permissions.canAssess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Verify the competency exists
    const competency = await db
      .select()
      .from(competencies)
      .where(eq(competencies.id, data.competencyId))
      .limit(1)

    if (!competency.length) {
      return NextResponse.json({ error: "Competency not found" }, { status: 404 })
    }

    // Create assessment submission
    const submission = {
      id: nanoid(),
      studentId: data.studentId,
      competencyId: data.competencyId,
      submittedBy: data.studentId, // The student who submitted
      assessmentId: data.assessmentId || null,
      evaluationId: data.evaluationId || null,
      rotationId: data.rotationId || null,
      status: data.status,
      submissionType: data.submissionType,
      evidence: data.evidence || null,
      notes: data.notes || null,
      feedback: data.feedback || null,
      reviewedBy: data.status === "APPROVED" || data.status === "REJECTED" ? userId : null,
      reviewedAt: data.status === "APPROVED" || data.status === "REJECTED" ? new Date() : null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      completionDate: data.status === "APPROVED" ? new Date() : null,
      metadata: data.metadata ? JSON.stringify(data.metadata) : null,
    }

    const result = await db.insert(competencySubmissions).values([submission]).returning()

    // If assessment is approved, create/update progress snapshot
    if (data.status === "APPROVED") {
      // Note: Progress tracking would be implemented here
      // Currently simplified due to schema changes
    }

    // Log assessment submission for monitoring
    console.log("Assessment submitted:", {
      type: "assessment_submitted",
      assessment: result[0],
      userId: data.studentId,
      competencyId: data.competencyId,
      status: data.status,
    })

    return NextResponse.json({
      message: "Assessment submitted successfully",
      data: result[0],
    })
  } catch (error) {
    console.error("Error creating assessment:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      )
    }
    
    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateCompetencyCache()
    } catch (cacheError) {
      console.warn('Cache invalidation error in competency-assessments/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT /api/competency-assessments - Bulk update assessments
export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { assessments } = bulkAssessmentSchema.parse(body)

    // Check permissions
    const permissions = await checkPermissions(userId)
    if (!permissions.canAssess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const results = []

    for (const assessment of assessments) {
      const { submissionId, ...updateData } = assessment

      // Update submission
      const result = await db
        .update(competencySubmissions)
        .set({
          ...updateData,
          reviewedBy: userId,
          reviewedAt: new Date(),
          completionDate: assessment.status === "APPROVED" ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(competencySubmissions.id, submissionId))
        .returning()

      if (result.length > 0) {
        results.push(result[0])

        // If approved, log progress update
        if (assessment.status === "APPROVED") {
          const _submission = result[0]
        }
      }
    }

    // Note: Progress tracking would be implemented here
    // Currently simplified due to schema changes

    // Log bulk assessment updates for monitoring
    if (results.length > 0) {
      console.log("Bulk assessments updated:", {
        type: "assessments_bulk_updated",
        assessments: results,
        count: results.length,
      })
    }

    return NextResponse.json({
      message: `Updated ${results.length} assessments`,
      data: results,
    })
  } catch (error) {
    console.error("Error updating assessments:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      )
    }
    
    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateCompetencyCache()
    } catch (cacheError) {
      console.warn('Cache invalidation error in competency-assessments/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
