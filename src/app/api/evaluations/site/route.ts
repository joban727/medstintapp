import { auth } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/database/connection-pool"
import { siteEvaluations, rotations, users, clinicalSites } from "@/database/schema"
import { withCSRF } from "@/lib/csrf-middleware"
import {
  withErrorHandling,
  createSuccessResponse,
  createErrorResponse,
  HTTP_STATUS,
} from "@/lib/api-response"
import { auditLogger } from "@/lib/logger"

const siteEvaluationSchema = z.object({
  rotationId: z.string().min(1, "Rotation ID is required"),
  clinicalSiteId: z.string().min(1, "Clinical Site ID is required"),
  preceptorId: z.string().optional().nullable(),
  rating: z.number().min(1).max(5),
  feedback: z.string().optional(),
  learningOpportunitiesRating: z.number().min(1).max(5).optional(),
  preceptorSupportRating: z.number().min(1).max(5).optional(),
  facilityQualityRating: z.number().min(1).max(5).optional(),
  recommendToOthers: z.boolean().default(true),
  isAnonymous: z.boolean().default(false),
})

export const POST = withCSRF(
  withErrorHandling(async (request: NextRequest) => {
    const { userId } = await auth()
    if (!userId) {
      return createErrorResponse("Unauthorized", HTTP_STATUS.UNAUTHORIZED)
    }

    const body = await request.json()
    const validatedData = siteEvaluationSchema.parse(body)

    // Verify rotation exists and belongs to student
    const [rotation] = await db
      .select()
      .from(rotations)
      .where(eq(rotations.id, validatedData.rotationId))
      .limit(1)

    if (!rotation || rotation.studentId !== userId) {
      return createErrorResponse(
        "Rotation not found or does not belong to you",
        HTTP_STATUS.NOT_FOUND
      )
    }

    // Check for existing evaluation
    const [existingEval] = await db
      .select()
      .from(siteEvaluations)
      .where(eq(siteEvaluations.rotationId, validatedData.rotationId))
      .limit(1)

    if (existingEval) {
      return createErrorResponse(
        "Evaluation already submitted for this rotation",
        HTTP_STATUS.CONFLICT
      )
    }

    // Insert evaluation
    const [newEval] = await db
      .insert(siteEvaluations)
      .values({
        studentId: userId,
        rotationId: validatedData.rotationId,
        clinicalSiteId: validatedData.clinicalSiteId,
        preceptorId: validatedData.preceptorId || null,
        rating: validatedData.rating,
        feedback: validatedData.feedback,
        learningOpportunitiesRating: validatedData.learningOpportunitiesRating,
        preceptorSupportRating: validatedData.preceptorSupportRating,
        facilityQualityRating: validatedData.facilityQualityRating,
        recommendToOthers: validatedData.recommendToOthers,
        isAnonymous: validatedData.isAnonymous,
      })
      .returning()

    // Audit log
    await auditLogger.log({
      userId,
      action: "SUBMIT_SITE_EVALUATION",
      resource: "site_evaluations",
      resourceId: newEval.id,
      details: {
        clinicalSiteId: validatedData.clinicalSiteId,
        rotationId: validatedData.rotationId,
        rating: validatedData.rating,
      },
      severity: "LOW",
      status: "SUCCESS",
    })

    return createSuccessResponse(
      {
        message: "Evaluation submitted successfully",
        evaluation: newEval,
      },
      undefined,
      HTTP_STATUS.CREATED
    )
  })
)

export const GET = withErrorHandling(async (request: NextRequest) => {
  const { userId, sessionClaims } = await auth()
  if (!userId) {
    return createErrorResponse("Unauthorized", HTTP_STATUS.UNAUTHORIZED)
  }

  interface SessionClaims {
    metadata: {
      role?: string
    }
  }
  const userRole = (sessionClaims as unknown as SessionClaims)?.metadata?.role

  if (userRole === "SCHOOL_ADMIN" || userRole === "SUPER_ADMIN") {
    // Admins see all with site and student names
    const allEvals = await db
      .select({
        id: siteEvaluations.id,
        studentId: siteEvaluations.studentId,
        studentName: users.name,
        rotationId: siteEvaluations.rotationId,
        clinicalSiteId: siteEvaluations.clinicalSiteId,
        clinicalSiteName: clinicalSites.name,
        preceptorId: siteEvaluations.preceptorId,
        rating: siteEvaluations.rating,
        feedback: siteEvaluations.feedback,
        learningOpportunitiesRating: siteEvaluations.learningOpportunitiesRating,
        preceptorSupportRating: siteEvaluations.preceptorSupportRating,
        facilityQualityRating: siteEvaluations.facilityQualityRating,
        recommendToOthers: siteEvaluations.recommendToOthers,
        isAnonymous: siteEvaluations.isAnonymous,
        createdAt: siteEvaluations.createdAt,
      })
      .from(siteEvaluations)
      .innerJoin(users, eq(siteEvaluations.studentId, users.id))
      .innerJoin(clinicalSites, eq(siteEvaluations.clinicalSiteId, clinicalSites.id))
      .orderBy(siteEvaluations.createdAt)

    // Mask names for anonymous evaluations if needed,
    // but usually admins can see them. Let's keep them for now
    // and handle masking in the UI if preferred.

    return createSuccessResponse({ evaluations: allEvals })
  } else if (userRole === "STUDENT") {
    // Students see their own with site names
    const studentEvals = await db
      .select({
        id: siteEvaluations.id,
        studentId: siteEvaluations.studentId,
        rotationId: siteEvaluations.rotationId,
        clinicalSiteId: siteEvaluations.clinicalSiteId,
        clinicalSiteName: clinicalSites.name,
        preceptorId: siteEvaluations.preceptorId,
        rating: siteEvaluations.rating,
        feedback: siteEvaluations.feedback,
        learningOpportunitiesRating: siteEvaluations.learningOpportunitiesRating,
        preceptorSupportRating: siteEvaluations.preceptorSupportRating,
        facilityQualityRating: siteEvaluations.facilityQualityRating,
        recommendToOthers: siteEvaluations.recommendToOthers,
        isAnonymous: siteEvaluations.isAnonymous,
        createdAt: siteEvaluations.createdAt,
      })
      .from(siteEvaluations)
      .innerJoin(clinicalSites, eq(siteEvaluations.clinicalSiteId, clinicalSites.id))
      .where(eq(siteEvaluations.studentId, userId))
      .orderBy(siteEvaluations.createdAt)

    return createSuccessResponse({ evaluations: studentEvals })
  } else {
    return createErrorResponse("Forbidden", HTTP_STATUS.FORBIDDEN)
  }
})
