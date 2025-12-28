import { and, count, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { type ZodIssue, z } from "zod"
import type { UserRole } from "@/types"
import { db } from "../../../database/connection-pool"

// Role validation utilities
const hasRole = (userRole: UserRole, allowedRoles: UserRole[]): boolean => {
  return allowedRoles.includes(userRole)
}

const isAdmin = (userRole: UserRole): boolean => {
  return hasRole(userRole, ["ADMIN" as UserRole, "SUPER_ADMIN" as UserRole])
}

const isSchoolAdmin = (userRole: UserRole): boolean => {
  return hasRole(userRole, [
    "SCHOOL_ADMIN" as UserRole,
    "ADMIN" as UserRole,
    "SUPER_ADMIN" as UserRole,
  ])
}
import {
  competencies,
  competencyAssignments,
  competencySubmissions,
  evaluations,
  users,
} from "../../../database/schema"
import { getCurrentUser } from "../../../lib/auth-clerk"
import {
  addSecurityHeaders,
  canSubmitCompetencies,
  createAuditLog,
  rateLimit,
  updateAssignmentProgress,
  validateSubmissionTarget,
} from "../../../lib/competency-utils"
import { getClientIP } from "../../../lib/network-security"
import { cacheIntegrationService } from "@/lib/cache-integration"
import { withErrorHandling } from "@/lib/error-handling"

// Validation schemas
const competencySubmissionSchema = z.object({
  assignmentId: z.string().uuid("Invalid assignment ID format"),
  studentId: z.string().uuid("Invalid student ID format"),
  competencyId: z.string().uuid("Invalid competency ID format"),
  evaluationData: z.object({
    rating: z.number().min(1).max(5, "Rating must be between 1 and 5"),
    feedback: z.string().optional(),
    observationDate: z.string().datetime("Invalid observation date format"),
    clinicalSiteId: z.string().uuid("Invalid clinical site ID format").optional(),
    rotationId: z.string().uuid("Invalid rotation ID format").optional(),
    criteria: z
      .array(
        z.object({
          criteriaId: z.string().uuid("Invalid criteria ID format"),
          rating: z.number().min(1).max(5, "Criteria rating must be between 1 and 5"),
          comments: z.string().optional(),
        })
      )
      .optional(),
  }),
  metadata: z
    .object({
      submissionMethod: z.enum(["direct", "batch", "import"]).default("direct"),
      notes: z.string().optional(),
      tags: z.array(z.string()).optional(),
    })
    .optional(),
})

const batchSubmissionSchema = z.object({
  submissions: z
    .array(competencySubmissionSchema)
    .min(1, "At least one submission is required")
    .max(50, "Maximum 50 submissions per batch"),
  batchMetadata: z
    .object({
      batchName: z.string().optional(),
      description: z.string().optional(),
      submissionDate: z.string().datetime().optional(),
    })
    .optional(),
})

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  studentId: z.string().uuid().optional(),
  competencyId: z.string().uuid().optional(),
  assignmentId: z.string().uuid().optional(),
  submittedBy: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  status: z.enum(["ASSIGNED", "IN_PROGRESS", "COMPLETED", "OVERDUE"]).optional(),
  search: z.string().optional(),
  sortBy: z.enum(["createdAt", "submissionDate", "rating", "studentName"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
})

/**
 * GET /api/competency-submissions
 * Retrieve competency submissions with filtering and pagination
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      "api:competency-submissions/route.ts",
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
    console.warn("Cache error in competency-submissions/route.ts:", cacheError)
    // Continue with original logic if cache fails
  }

  async function executeOriginalLogic() {
    try {
      // Rate limiting
      const clientIP = getClientIP(request)
      const rateLimitResult = rateLimit(clientIP, 100, 60000)
      if (!rateLimitResult) {
        const errorResponse = NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
        return addSecurityHeaders(errorResponse)
      }

      // Authentication and authorization
      const user = await getCurrentUser()
      if (!user) {
        const errorResponse = NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        return addSecurityHeaders(errorResponse)
      }

      const userRole = user.role as UserRole
      const userId = user.id
      const userSchoolId = user.schoolId

      // Role-based access control
      const allowedRoles: UserRole[] = [
        "SUPER_ADMIN",
        "SCHOOL_ADMIN",
        "CLINICAL_SUPERVISOR",
        "CLINICAL_PRECEPTOR",
        "STUDENT",
      ]

      if (!allowedRoles.includes(userRole)) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
      }

      // Parse and validate query parameters
      const url = new URL(request.url)
      const queryParams = Object.fromEntries(url.searchParams.entries())
      const validatedQuery = querySchema.parse(queryParams)

      const {
        page,
        limit,
        studentId,
        competencyId,
        assignmentId,
        submittedBy,
        dateFrom,
        dateTo,
        status,
        search,
        sortBy,
        sortOrder,
      } = validatedQuery

      // Build query conditions based on user role and school
      const conditions = []

      // School-based filtering for non-super admins
      if (userRole !== ("SUPER_ADMIN" as UserRole) && userSchoolId) {
        conditions.push(eq(users.schoolId, userSchoolId))
      }

      // Role-specific filtering
      if (userRole === ("STUDENT" as UserRole)) {
        // Students can only see their own submissions
        conditions.push(eq(competencyAssignments.userId, userId))
      } else if (
        userRole === ("CLINICAL_PRECEPTOR" as UserRole) ||
        userRole === ("CLINICAL_SUPERVISOR" as UserRole)
      ) {
        // Clinical staff can see submissions they made or for students in their programs
        conditions.push(or(eq(competencySubmissions.reviewedBy, userId), eq(users.role, "STUDENT")))
        // Add school filtering separately to avoid aliasing conflicts
        if (userSchoolId) {
          conditions.push(eq(users.schoolId, userSchoolId))
        }
      }

      // Additional filters
      if (studentId) {
        conditions.push(eq(users.id, studentId))
      }
      if (competencyId) {
        conditions.push(eq(competencies.id, competencyId))
      }
      if (assignmentId) {
        conditions.push(eq(competencyAssignments.id, assignmentId))
      }
      if (submittedBy) {
        conditions.push(eq(competencySubmissions.reviewedBy, submittedBy))
      }
      if (dateFrom) {
        conditions.push(gte(competencySubmissions.submittedAt, new Date(dateFrom)))
      }
      if (dateTo) {
        conditions.push(lte(competencySubmissions.submittedAt, new Date(dateTo)))
      }
      if (status) {
        conditions.push(eq(competencyAssignments.status, status))
      }
      if (search) {
        conditions.push(
          or(ilike(users.name, `%${search}%`), ilike(competencies.name, `%${search}%`))
        )
      }

      // Calculate offset for pagination
      const offset = (page - 1) * limit

      // Build sort clause
      const sortColumn = {
        createdAt: competencySubmissions.createdAt,
        submissionDate: competencySubmissions.submittedAt,
        rating: competencySubmissions.createdAt, // No rating field, use createdAt as fallback
        studentName: users.name,
      }[sortBy]

      const orderClause = sortOrder === "desc" ? desc(sortColumn) : sortColumn

      // Execute query with joins
      const [submissions, totalCount] = await Promise.all([
        db
          .select({
            id: competencyAssignments.id,
            assignmentId: competencyAssignments.id,
            competencyId: competencies.id,
            competencyName: competencies.name,
            competencyDescription: competencies.description,
            studentId: users.id,
            studentName: users.name,
            studentEmail: users.email,
            evaluatorId: competencySubmissions.reviewedBy,
            evaluatorName: sql`NULL`, // Will be populated separately if needed
            rating: sql`NULL`,
            feedback: competencySubmissions.feedback,
            observationDate: competencySubmissions.submittedAt,
            submissionDate: competencySubmissions.submittedAt,
            status: competencyAssignments.status,
            progress: competencyAssignments.progressPercentage,
            rotationId: competencySubmissions.rotationId,
            createdAt: competencySubmissions.createdAt,
            updatedAt: competencySubmissions.updatedAt,
          })
          .from(competencyAssignments)
          .innerJoin(competencies, eq(competencyAssignments.competencyId, competencies.id))
          .innerJoin(users, eq(competencyAssignments.userId, users.id))
          .leftJoin(
            competencySubmissions,
            and(
              eq(competencySubmissions.studentId, competencyAssignments.userId),
              eq(competencySubmissions.competencyId, competencyAssignments.competencyId)
            )
          )
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(orderClause)
          .limit(limit)
          .offset(offset),

        db
          .select({ count: count() })
          .from(competencyAssignments)
          .innerJoin(competencies, eq(competencyAssignments.competencyId, competencies.id))
          .innerJoin(users, eq(competencyAssignments.userId, users.id))
          .leftJoin(
            competencySubmissions,
            and(
              eq(competencySubmissions.studentId, competencyAssignments.userId),
              eq(competencySubmissions.competencyId, competencyAssignments.competencyId)
            )
          )
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .then((result) => result[0]?.count || 0),
      ])

      // Calculate pagination metadata
      const totalPages = Math.ceil(totalCount / limit)
      const hasNextPage = page < totalPages
      const hasPreviousPage = page > 1

      // Log audit event
      await createAuditLog({
        userId,
        action: "VIEW_COMPETENCY_SUBMISSIONS",
        resourceId: "competency_submissions",
        details: JSON.stringify({
          filters: validatedQuery,
          resultCount: submissions.length,
          totalCount,
        }),
      })

      // Update assignment progress automatically (only if competencyId is provided)
      if (validatedQuery.competencyId) {
        await updateAssignmentProgress(userId, validatedQuery.competencyId, "submitted")
      }

      return NextResponse.json({
        success: true,
        data: submissions,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasNextPage,
          hasPreviousPage,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: crypto.randomUUID(),
        },
      })
    } catch (error) {
      console.error("Error fetching competency submissions:", error)

      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: "Invalid query parameters",
            details: error.issues.map((e: z.ZodIssue) => ({
              field: e.path.join("."),
              message: e.message,
            })),
          },
          { status: 400 }
        )
      }

      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  }
})

/**
 * POST /api/competency-submissions
 * Submit competencies on behalf of students (individual or batch)
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  try {
    // Rate limiting
    const clientIP = getClientIP(request)
    const rateLimitResult = rateLimit(clientIP, 50, 60000)
    if (!rateLimitResult) {
      const errorResponse = NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
      return addSecurityHeaders(errorResponse)
    }

    // Authentication and authorization
    const user = await getCurrentUser()
    if (!user) {
      const errorResponse = NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      return addSecurityHeaders(errorResponse)
    }

    const userRole = user.role as UserRole
    const userId = user.id
    const userSchoolId = user.schoolId

    // Check if user has permission to submit competencies
    if (!canSubmitCompetencies(userRole)) {
      const errorResponse = NextResponse.json(
        { error: "Insufficient permissions to submit competencies" },
        { status: 403 }
      )
      return addSecurityHeaders(errorResponse)
    }

    // Parse request body
    const body = await request.json()

    // Determine if this is a batch submission
    const isBatchSubmission = Array.isArray(body.submissions)

    let validatedData:
      | z.infer<typeof batchSubmissionSchema>
      | z.infer<typeof competencySubmissionSchema>
    if (isBatchSubmission) {
      validatedData = batchSubmissionSchema.parse(body)
    } else {
      validatedData = { submissions: [competencySubmissionSchema.parse(body)] }
    }

    const results = []
    const errors = []

    // Process each submission
    for (const [index, submission] of validatedData.submissions.entries()) {
      try {
        const { assignmentId, studentId, competencyId, evaluationData, metadata } = submission

        // Validate that the assignment exists and belongs to the student
        const assignment = await db
          .select({
            id: competencyAssignments.id,
            userId: competencyAssignments.userId,
            competencyId: competencyAssignments.competencyId,
            deploymentId: competencyAssignments.deploymentId,
            programId: competencyAssignments.programId,
            status: competencyAssignments.status,
            progressPercentage: competencyAssignments.progressPercentage,
          })
          .from(competencyAssignments)
          .where(
            and(
              eq(competencyAssignments.id, assignmentId),
              eq(competencyAssignments.userId, studentId),
              eq(competencyAssignments.competencyId, competencyId)
            )
          )
          .limit(1)

        if (!assignment.length) {
          errors.push({
            index,
            error: "Assignment not found or does not match student/competency",
            assignmentId,
            studentId,
            competencyId,
          })
          continue
        }

        const assignmentData = assignment[0]

        // Validate that the student exists and belongs to the same school (for non-super admins)
        if (userRole !== ("SUPER_ADMIN" as UserRole) && userSchoolId) {
          const student = await db
            .select({ id: users.id, schoolId: users.schoolId, role: users.role })
            .from(users)
            .where(
              and(
                eq(users.id, studentId),
                eq(users.schoolId, userSchoolId),
                eq(users.role, "STUDENT")
              )
            )
            .limit(1)

          if (!student.length) {
            errors.push({
              index,
              error: "Student not found in your school or invalid student role",
              studentId,
            })
            continue
          }
        }

        // Validate submission target (prevent self-submission for non-admin roles)
        if (!validateSubmissionTarget(userId, studentId, userRole)) {
          errors.push({
            index,
            error:
              "Invalid submission target - users cannot submit competencies for themselves unless they are administrators",
            studentId,
          })
          continue
        }

        // Check if evaluation already exists for this assignment
        const existingEvaluation = await db
          .select({ id: evaluations.id })
          .from(evaluations)
          .where(
            and(eq(evaluations.assignmentId, assignmentId), eq(evaluations.evaluatorId, userId))
          )
          .limit(1)

        if (existingEvaluation.length > 0) {
          errors.push({
            index,
            error: "Evaluation already exists for this assignment by this evaluator",
            assignmentId,
            evaluatorId: userId,
          })
          continue
        }

        // Create the evaluation record
        const now = new Date()

        const [insertedEvaluation] = await db
          .insert(evaluations)
          .values({
            id: crypto.randomUUID(),
            assignmentId,
            studentId,
            evaluatorId: userId,
            rotationId: evaluationData.rotationId || "default-rotation-id",
            overallRating: evaluationData.rating.toString(),
            feedback: evaluationData.feedback,
            observationDate: new Date(evaluationData.observationDate),
            clinicalSiteId: evaluationData.clinicalSiteId,
            type: "FINAL",
            clinicalSkills: evaluationData.rating.toString(),
            communication: evaluationData.rating.toString(),
            professionalism: evaluationData.rating.toString(),
            criticalThinking: evaluationData.rating.toString(),
            criteria: evaluationData.criteria ? JSON.stringify(evaluationData.criteria) : null,
            metadata: metadata
              ? JSON.stringify({
                  ...metadata,
                  submittedOnBehalfOf: studentId,
                  submissionType: isBatchSubmission ? "batch" : "individual",
                })
              : JSON.stringify({
                  submittedOnBehalfOf: studentId,
                  submissionType: isBatchSubmission ? "batch" : "individual",
                }),
            createdAt: now,
            updatedAt: now,
          })
          .returning({ id: evaluations.id })

        const evaluationId = insertedEvaluation.id

        // Calculate new progress percentage
        const totalEvaluations = await db
          .select({ count: count() })
          .from(evaluations)
          .where(eq(evaluations.assignmentId, assignmentId))
          .then((result) => result[0]?.count || 0)

        const completedEvaluations = await db
          .select({ count: count() })
          .from(evaluations)
          .where(
            and(
              eq(evaluations.assignmentId, assignmentId),
              gte(evaluations.overallRating, "3") // Assuming 3+ is considered "completed"
            )
          )
          .then((result) => result[0]?.count || 0)

        const newProgressPercentage =
          totalEvaluations > 0 ? Math.round((completedEvaluations / totalEvaluations) * 100) : 0

        // Determine new status
        const newStatus = newProgressPercentage >= 100 ? "COMPLETED" : "IN_PROGRESS"

        // Update assignment progress
        await db
          .update(competencyAssignments)
          .set({
            progressPercentage: newProgressPercentage.toString(),
            status: newStatus,
            completionDate: newStatus === "COMPLETED" ? now : null,
            updatedAt: now,
          })
          .where(eq(competencyAssignments.id, assignmentId))

        // Create competency submission record
        const [insertedSubmission] = await db
          .insert(competencySubmissions)
          .values({
            id: crypto.randomUUID(),
            studentId,
            competencyId,
            submittedBy: userId,
            evaluationId: evaluationId,
            rotationId: evaluationData.rotationId,
            status: "SUBMITTED",
            submissionType: isBatchSubmission ? "BATCH" : "INDIVIDUAL",
            evidence: evaluationData.feedback,
            notes: metadata?.notes,
            submittedAt: now,
            metadata: JSON.stringify({
              submittedOnBehalfOf: studentId,
              submissionType: isBatchSubmission ? "batch" : "individual",
              ipAddress:
                request.headers.get("x-forwarded-for") ||
                request.headers.get("x-real-ip") ||
                "unknown",
              userAgent: request.headers.get("user-agent"),
            }),
          })
          .returning({ id: competencySubmissions.id })

        const submissionId = insertedSubmission.id

        // Create audit log
        await createAuditLog({
          action: "COMPETENCY_SUBMITTED",
          details: `Submitted competency ${competencyId} for student ${studentId}`,
          userId,
          targetUserId: studentId,
          resourceId: competencyId,
          metadata: {
            competencyId,
            evaluationId: evaluationId,
            submissionId: submissionId,
            ipAddress:
              request.headers.get("x-forwarded-for") ||
              request.headers.get("x-real-ip") ||
              "unknown",
            userAgent: request.headers.get("user-agent"),
          },
        })

        results.push({
          index,
          success: true,
          submissionId,
          evaluationId,
          assignmentId,
          studentId,
          competencyId,
          previousProgress: assignmentData.progressPercentage,
          newProgress: newProgressPercentage,
          statusChange:
            assignmentData.status !== newStatus
              ? {
                  from: assignmentData.status,
                  to: newStatus,
                }
              : null,
        })
      } catch (submissionError) {
        console.error(`Error processing submission ${index}:`, submissionError)
        errors.push({
          index,
          error: "Failed to process submission",
          details: submissionError instanceof Error ? submissionError.message : "Unknown error",
        })
      }
    }

    // Log batch completion
    if (isBatchSubmission) {
      await createAuditLog({
        action: "BATCH_SUBMIT_COMPETENCIES",
        details: `Batch submitted ${validatedData.submissions.length} competencies`,
        userId,
        resourceId: crypto.randomUUID(),
        metadata: {
          totalSubmissions: validatedData.submissions.length,
          successfulSubmissions: results.length,
          failedSubmissions: errors.length,
          submissionIds: results.map((r) => r.evaluationId),
          ipAddress:
            request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
          userAgent: request.headers.get("user-agent"),
        },
      })
    }

    // Update assignment progress for successful submissions
    for (const result of results) {
      await updateAssignmentProgress(result.studentId, result.competencyId, "submitted")
    }

    const response = {
      success: errors.length === 0,
      message:
        errors.length === 0
          ? `Successfully processed ${results.length} submission(s)`
          : `Processed ${results.length} submission(s) with ${errors.length} error(s)`,
      data: {
        successful: results,
        failed: errors,
        summary: {
          total: validatedData.submissions.length,
          successful: results.length,
          failed: errors.length,
        },
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        submissionType: isBatchSubmission ? "batch" : "individual",
      },
    }

    const statusCode = errors.length === 0 ? 201 : results.length > 0 ? 207 : 400
    const jsonResponse = NextResponse.json(response, { status: statusCode })
    return addSecurityHeaders(jsonResponse)
  } catch (error) {
    console.error("Error submitting competencies:", error)

    if (error instanceof z.ZodError) {
      // Invalidate related caches
      try {
        await cacheIntegrationService.invalidateByTags(['competency'])
      } catch (cacheError) {
        console.warn("Cache invalidation error in competency-submissions/route.ts:", cacheError)
      }

      return NextResponse.json(
        {
          error: "Invalid submission data",
          details: error.issues.map((e: ZodIssue) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        },
        { status: 400 }
      )
    }

    const errorResponse = NextResponse.json({ error: "Internal server error" }, { status: 500 })
    return addSecurityHeaders(errorResponse)
  }
})

