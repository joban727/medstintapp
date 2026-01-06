import { and, desc, eq } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "../../../../database/connection-pool"
import { complianceSubmissions, complianceRequirements, users } from "../../../../database/schema"
import { getSchoolContext } from "../../../../lib/school-utils"
import {
  createSuccessResponse,
  createErrorResponse,
  HTTP_STATUS,
  ERROR_MESSAGES,
  withErrorHandling,
} from "@/lib/api-response"
import { logger } from "@/lib/logger"
import { notifyComplianceStatusChange } from "@/lib/compliance-notifications"

// Role type guards
const ADMIN_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN"]
const isAdmin = (role: string): boolean => ADMIN_ROLES.includes(role)

// Validation schemas
const createSubmissionSchema = z.object({
  requirementId: z.string().min(1, "Requirement ID is required"),
  submissionData: z.record(z.string(), z.unknown()).optional(),
  documentId: z.string().optional(),
  notes: z.string().optional(),
})

const reviewSubmissionSchema = z.object({
  id: z.string().min(1, "Submission ID is required"),
  status: z.enum(["APPROVED", "REJECTED"]),
  notes: z.string().optional(),
  expiresAt: z.string().optional(), // ISO string
})

// GET /api/compliance/submissions - List submissions
export const GET = withErrorHandling(async (request: NextRequest) => {
  const context = await getSchoolContext()
  const { searchParams } = new URL(request.url)

  const studentId = searchParams.get("studentId")
  const status = searchParams.get("status") as
    | "PENDING"
    | "APPROVED"
    | "REJECTED"
    | "EXPIRED"
    | null
  const schoolId = searchParams.get("schoolId") || context.schoolId

  // If student is requesting, they can only see their own
  if (context.userRole === "STUDENT") {
    const submissions = await db
      .select({
        submission: complianceSubmissions,
        requirement: complianceRequirements,
      })
      .from(complianceSubmissions)
      .innerJoin(
        complianceRequirements,
        eq(complianceSubmissions.requirementId, complianceRequirements.id)
      )
      .where(eq(complianceSubmissions.studentId, context.userId))
      .orderBy(desc(complianceSubmissions.createdAt))

    return createSuccessResponse(submissions)
  }

  // Admins can see all for their school or a specific student
  if (!isAdmin(context.userRole)) {
    return createErrorResponse(ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS, HTTP_STATUS.FORBIDDEN)
  }

  const conditions = []
  if (studentId) conditions.push(eq(complianceSubmissions.studentId, studentId))
  if (status) conditions.push(eq(complianceSubmissions.status, status))

  // Filter by school requirements
  const submissions = await db
    .select({
      submission: complianceSubmissions,
      requirement: complianceRequirements,
      studentName: users.name,
    })
    .from(complianceSubmissions)
    .innerJoin(
      complianceRequirements,
      eq(complianceSubmissions.requirementId, complianceRequirements.id)
    )
    .innerJoin(users, eq(complianceSubmissions.studentId, users.id))
    .where(and(eq(complianceRequirements.schoolId, schoolId!), ...conditions))
    .orderBy(desc(complianceSubmissions.createdAt))

  return createSuccessResponse(submissions)
})

// POST /api/compliance/submissions - Submit a requirement
export const POST = withErrorHandling(async (request: NextRequest) => {
  const context = await getSchoolContext()

  if (context.userRole !== "STUDENT") {
    return createErrorResponse("Only students can submit requirements", HTTP_STATUS.FORBIDDEN)
  }

  const body = await request.json()
  const validatedData = createSubmissionSchema.parse(body)

  // Verify requirement exists and belongs to student's school
  const [requirement] = await db
    .select()
    .from(complianceRequirements)
    .where(eq(complianceRequirements.id, validatedData.requirementId))
    .limit(1)

  if (!requirement) {
    return createErrorResponse("Requirement not found", HTTP_STATUS.NOT_FOUND)
  }

  // Create or update submission
  const [existing] = await db
    .select()
    .from(complianceSubmissions)
    .where(
      and(
        eq(complianceSubmissions.studentId, context.userId),
        eq(complianceSubmissions.requirementId, validatedData.requirementId)
      )
    )
    .limit(1)

  let result
  if (existing) {
    ;[result] = await db
      .update(complianceSubmissions)
      .set({
        status: "PENDING",
        submissionData: validatedData.submissionData,
        documentId: validatedData.documentId,
        notes: validatedData.notes,
        updatedAt: new Date(),
        reviewedBy: null,
        reviewedAt: null,
      })
      .where(eq(complianceSubmissions.id, existing.id))
      .returning()
  } else {
    ;[result] = await db
      .insert(complianceSubmissions)
      .values({
        id: crypto.randomUUID(),
        studentId: context.userId,
        requirementId: validatedData.requirementId,
        status: "PENDING",
        submissionData: validatedData.submissionData,
        documentId: validatedData.documentId,
        notes: validatedData.notes,
      })
      .returning()
  }

  return createSuccessResponse(result, "Requirement submitted successfully")
})

// PUT /api/compliance/submissions - Review a submission
export const PUT = withErrorHandling(async (request: NextRequest) => {
  const context = await getSchoolContext()

  if (!isAdmin(context.userRole)) {
    return createErrorResponse(ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS, HTTP_STATUS.FORBIDDEN)
  }

  const body = await request.json()
  const validatedData = reviewSubmissionSchema.parse(body)

  const [submission] = await db
    .select()
    .from(complianceSubmissions)
    .where(eq(complianceSubmissions.id, validatedData.id))
    .limit(1)

  if (!submission) {
    return createErrorResponse("Submission not found", HTTP_STATUS.NOT_FOUND)
  }

  // Update
  const [updated] = await db
    .update(complianceSubmissions)
    .set({
      status: validatedData.status,
      notes: validatedData.notes,
      expiresAt: validatedData.expiresAt ? new Date(validatedData.expiresAt) : null,
      reviewedBy: context.userId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(complianceSubmissions.id, validatedData.id))
    .returning()

  // Notify student
  const [requirement] = await db
    .select()
    .from(complianceRequirements)
    .where(eq(complianceRequirements.id, updated.requirementId))
    .limit(1)

  if (requirement && updated.status !== "PENDING") {
    await notifyComplianceStatusChange({
      studentId: updated.studentId,
      requirementName: requirement.name,
      status: updated.status as "APPROVED" | "REJECTED" | "EXPIRED",
      notes: updated.notes || undefined,
    })
  }

  return createSuccessResponse(updated, "Submission reviewed successfully")
})
