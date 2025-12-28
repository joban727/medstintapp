import { auth } from "@clerk/nextjs/server"
import { and, eq } from "drizzle-orm"
import { type NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/database/connection-pool"
import type { UserRole } from "@/types"
import { siteAssignments, users, clinicalSites } from "@/database/schema"
import { getSchoolContext } from "@/lib/school-utils"
import { apiAuthMiddleware } from "@/lib/rbac-middleware"
import {
  createSuccessResponse,
  createErrorResponse,
  createValidationErrorResponse,
  withErrorHandling,
  HTTP_STATUS,
  ERROR_MESSAGES,
} from "@/lib/api-response"

// Validation schemas
const createSiteAssignmentSchema = z.object({
  studentId: z.string().min(1, "Student ID is required"),
  clinicalSiteId: z.string().min(1, "Clinical site ID is required"),
  rotationId: z.string().optional(),
  startDate: z
    .string()
    .transform((str) => new Date(str))
    .optional(),
  endDate: z
    .string()
    .transform((str) => new Date(str))
    .optional(),
  notes: z.string().optional(),
})

const bulkAssignSchema = z.object({
  clinicalSiteId: z.string().min(1, "Clinical site ID is required"),
  studentIds: z.array(z.string()).min(1, "At least one student ID is required"),
  rotationId: z.string().optional(),
  startDate: z
    .string()
    .transform((str) => new Date(str))
    .optional(),
  endDate: z
    .string()
    .transform((str) => new Date(str))
    .optional(),
  notes: z.string().optional(),
})

// GET /api/site-assignments - Get site assignments
export const GET = withErrorHandling(async (request: NextRequest) => {
  const authResult = await apiAuthMiddleware(request)

  if (!authResult.success) {
    return createErrorResponse(
      authResult.error || "Unauthorized",
      authResult.status || HTTP_STATUS.UNAUTHORIZED
    )
  }

  const context = await getSchoolContext()

  // Students cannot view site assignments
  if (context.userRole === ("STUDENT" as UserRole)) {
    return createErrorResponse(
      "Access denied. Insufficient permissions to view site assignments.",
      HTTP_STATUS.FORBIDDEN
    )
  }

  const { searchParams } = new URL(request.url)
  const studentId = searchParams.get("studentId") || undefined
  const clinicalSiteId = searchParams.get("siteId") || undefined
  const statusParam = searchParams.get("status") as
    | "ACTIVE"
    | "INACTIVE"
    | "COMPLETED"
    | "CANCELLED"
    | null

  // Build query conditions
  const conditions = [] as any[]

  if (studentId) {
    conditions.push(eq(siteAssignments.studentId, studentId))
  }

  if (clinicalSiteId) {
    conditions.push(eq(siteAssignments.clinicalSiteId, clinicalSiteId))
  }

  if (statusParam) {
    conditions.push(eq(siteAssignments.status, statusParam))
  }

  // For school admins, only show assignments for their school
  if (context.userRole === ("SCHOOL_ADMIN" as UserRole) && context.schoolId) {
    conditions.push(eq(siteAssignments.schoolId, context.schoolId))
  }

  const assignments = await db
    .select({
      id: siteAssignments.id,
      studentId: siteAssignments.studentId,
      clinicalSiteId: siteAssignments.clinicalSiteId,
      rotationId: siteAssignments.rotationId,
      schoolId: siteAssignments.schoolId,
      status: siteAssignments.status,
      startDate: siteAssignments.startDate,
      endDate: siteAssignments.endDate,
      assignedBy: siteAssignments.assignedBy,
      notes: siteAssignments.notes,
      createdAt: siteAssignments.createdAt,
      updatedAt: siteAssignments.updatedAt,
      studentName: users.name,
      studentEmail: users.email,
      siteName: clinicalSites.name,
      siteType: clinicalSites.type,
      siteAddress: clinicalSites.address,
    })
    .from(siteAssignments)
    .leftJoin(users, eq(siteAssignments.studentId, users.id))
    .leftJoin(clinicalSites, eq(siteAssignments.clinicalSiteId, clinicalSites.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)

  return createSuccessResponse(assignments)
})

// POST /api/site-assignments - Create site assignments
export const POST = withErrorHandling(async (request: NextRequest) => {
  try {
    const authResult = await apiAuthMiddleware(request)

    if (!authResult.success) {
      return createErrorResponse(
        authResult.error || "Unauthorized",
        authResult.status || HTTP_STATUS.UNAUTHORIZED
      )
    }

    const context = await getSchoolContext()

    // Only admins can create site assignments
    if (!context.userRole || !(["SUPER_ADMIN", "SCHOOL_ADMIN"] as UserRole[]).includes(context.userRole)) {
      return createErrorResponse(ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS, HTTP_STATUS.FORBIDDEN)
    }

    const body = await request.json()

    // Check if this is a bulk assignment request
    if (body.studentIds && Array.isArray(body.studentIds)) {
      const validatedData = bulkAssignSchema.parse(body)

      // Verify clinical site exists and belongs to the school (for school admins)
      const siteQuery = db
        .select({ id: clinicalSites.id })
        .from(clinicalSites)
        .where(eq(clinicalSites.id, validatedData.clinicalSiteId))
        .limit(1)

      const [site] = await siteQuery

      if (!site) {
        return createErrorResponse("Clinical site not found", HTTP_STATUS.NOT_FOUND)
      }

      // Verify all students exist and belong to the school
      const studentConditions = [
        eq(users.role, "STUDENT"),
      ]
      if (context.userRole === ("SCHOOL_ADMIN" as UserRole) && context.schoolId) {
        studentConditions.push(eq(users.schoolId, context.schoolId))
      }
      const studentsQuery = await db
        .select({ id: users.id, schoolId: users.schoolId })
        .from(users)
        .where(and(...studentConditions))

      const validStudents = studentsQuery.filter((student) =>
        validatedData.studentIds.includes(student.id)
      )

      if (validStudents.length !== validatedData.studentIds.length) {
        return createErrorResponse(
          "Some students not found or not accessible",
          HTTP_STATUS.BAD_REQUEST
        )
      }

      // Fetch existing ACTIVE assignments for the site
      const existingForSite = await db
        .select()
        .from(siteAssignments)
        .where(
          and(
            eq(siteAssignments.clinicalSiteId, validatedData.clinicalSiteId),
            eq(siteAssignments.status, "ACTIVE")
          )
        )

      // Overlap helper
      const overlaps = (
        aStart: Date | null,
        aEnd: Date | null | undefined,
        bStart: Date | undefined,
        bEnd: Date | undefined
      ) => {
        if (!aStart || !bStart) return false
        const aE = aEnd ?? new Date(8640000000000000)
        const bE = bEnd ?? new Date(8640000000000000)
        return aStart <= bE && bStart <= aE
      }

      const overlappingAssignments = existingForSite.filter((a) =>
        overlaps(a.startDate, a.endDate, validatedData.startDate, validatedData.endDate)
      )

      // Capacity enforcement
      const [siteDetails] = await db
        .select({ capacity: clinicalSites.capacity })
        .from(clinicalSites)
        .where(eq(clinicalSites.id, validatedData.clinicalSiteId))
        .limit(1)

      const capacity = siteDetails?.capacity ?? 0
      const currentOverlapDistinct = new Set(overlappingAssignments.map((a) => a.studentId)).size
      const projected = currentOverlapDistinct + validStudents.length
      if (capacity > 0 && projected > capacity) {
        return createErrorResponse(
          `Capacity exceeded: ${projected}/${capacity} overlapping assignments for selected period`,
          HTTP_STATUS.BAD_REQUEST
        )
      }

      // Prevent overlapping per-student at this site
      const invalidStudents = new Set<string>()
      for (const s of validStudents) {
        const hasOverlap = overlappingAssignments.some((a) => a.studentId === s.id)
        if (hasOverlap) invalidStudents.add(s.id)
      }
      if (invalidStudents.size > 0) {
        return createErrorResponse(
          "Some students already have overlapping assignments at this site",
          HTTP_STATUS.BAD_REQUEST
        )
      }

      // Create assignments for all students
      const assignmentPromises = validStudents.map((student) =>
        db
          .insert(siteAssignments)
          .values({
            id: crypto.randomUUID(),
            studentId: student.id,
            clinicalSiteId: validatedData.clinicalSiteId,
            rotationId: validatedData.rotationId,
            schoolId: student.schoolId ?? "",
            status: "ACTIVE",
            startDate: validatedData.startDate ?? null,
            endDate: validatedData.endDate ?? null,
            assignedBy: context.userId,
            notes: validatedData.notes,
          })
          .returning()
      )

      const results = await Promise.all(assignmentPromises)

      return createSuccessResponse(
        results.flat(),
        `Successfully assigned ${results.length} students to clinical site`
      )
    } else {
      // Single assignment
      const validatedData = createSiteAssignmentSchema.parse(body)

      // Verify clinical site exists
      const [site] = await db
        .select({ id: clinicalSites.id })
        .from(clinicalSites)
        .where(eq(clinicalSites.id, validatedData.clinicalSiteId))
        .limit(1)

      if (!site) {
        return createErrorResponse("Clinical site not found", HTTP_STATUS.NOT_FOUND)
      }

      // Verify student exists and belongs to the school (for school admins)
      const studentConditions = [
        eq(users.id, validatedData.studentId),
        eq(users.role, "STUDENT"),
      ]
      if (context.userRole === ("SCHOOL_ADMIN" as UserRole) && context.schoolId) {
        studentConditions.push(eq(users.schoolId, context.schoolId))
      }
      const studentQuery = db
        .select({ id: users.id, schoolId: users.schoolId })
        .from(users)
        .where(and(...studentConditions))
        .limit(1)

      const [student] = await studentQuery

      if (!student) {
        return createErrorResponse("Student not found or not accessible", HTTP_STATUS.NOT_FOUND)
      }

      // Fetch existing ACTIVE assignments for the site
      const existingForSite = await db
        .select()
        .from(siteAssignments)
        .where(
          and(
            eq(siteAssignments.clinicalSiteId, validatedData.clinicalSiteId),
            eq(siteAssignments.status, "ACTIVE")
          )
        )

      // Overlap helper
      const overlaps = (
        aStart: Date | null,
        aEnd: Date | null | undefined,
        bStart: Date | undefined,
        bEnd: Date | undefined
      ) => {
        if (!aStart || !bStart) return false
        const aE = aEnd ?? new Date(8640000000000000)
        const bE = bEnd ?? new Date(8640000000000000)
        return aStart <= bE && bStart <= aE
      }

      const overlappingAssignments = existingForSite.filter((a) =>
        overlaps(a.startDate, a.endDate, validatedData.startDate, validatedData.endDate)
      )

      // Reject if student already has overlapping assignment at this site
      if (overlappingAssignments.some((a) => a.studentId === validatedData.studentId)) {
        return createErrorResponse(
          "Student already has an overlapping assignment at this site",
          HTTP_STATUS.BAD_REQUEST
        )
      }

      // Capacity enforcement
      const [siteDetails] = await db
        .select({ capacity: clinicalSites.capacity })
        .from(clinicalSites)
        .where(eq(clinicalSites.id, validatedData.clinicalSiteId))
        .limit(1)

      const capacity = siteDetails?.capacity ?? 0
      const currentOverlapDistinct = new Set(overlappingAssignments.map((a) => a.studentId)).size
      const projected = currentOverlapDistinct + 1
      if (capacity > 0 && projected > capacity) {
        return createErrorResponse(
          `Capacity exceeded: ${projected}/${capacity} overlapping assignments for selected period`,
          HTTP_STATUS.BAD_REQUEST
        )
      }

      // Create site assignment
      const [newAssignment] = await db
        .insert(siteAssignments)
        .values({
          id: crypto.randomUUID(),
          studentId: validatedData.studentId,
          clinicalSiteId: validatedData.clinicalSiteId,
          rotationId: validatedData.rotationId,
          schoolId: student.schoolId ?? "",
          status: "ACTIVE",
          startDate: validatedData.startDate ?? null,
          endDate: validatedData.endDate ?? null,
          assignedBy: context.userId,
          notes: validatedData.notes,
        })
        .returning()

      return createSuccessResponse(newAssignment, "Site assignment created successfully")
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createValidationErrorResponse("Validation failed", error.issues as any)
    }
    return createErrorResponse(
      "Failed to create site assignment",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    )
  }
})

// PUT /api/site-assignments - Update an assignment
export const PUT = withErrorHandling(async (request: NextRequest) => {
  const authResult = await apiAuthMiddleware(request)

  if (!authResult.success) {
    return createErrorResponse(
      authResult.error || "Unauthorized",
      authResult.status || HTTP_STATUS.UNAUTHORIZED
    )
  }

  const body = await request.json()

  if (!body.id) {
    return createErrorResponse("Assignment ID is required", HTTP_STATUS.BAD_REQUEST)
  }

  const [updated] = await db
    .update(siteAssignments)
    .set({
      status: body.status,
      notes: body.notes,
      updatedAt: new Date(),
    })
    .where(eq(siteAssignments.id, body.id))
    .returning()

  if (!updated) {
    return createErrorResponse("Assignment not found", HTTP_STATUS.NOT_FOUND)
  }

  return createSuccessResponse(updated, "Site assignment updated successfully")
})

// DELETE /api/site-assignments - Remove an assignment
export const DELETE = withErrorHandling(async (request: NextRequest) => {
  const authResult = await apiAuthMiddleware(request)

  if (!authResult.success) {
    return createErrorResponse(
      authResult.error || "Unauthorized",
      authResult.status || HTTP_STATUS.UNAUTHORIZED
    )
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")

  if (!id) {
    return createErrorResponse("Assignment ID is required", HTTP_STATUS.BAD_REQUEST)
  }

  const [removed] = await db.delete(siteAssignments).where(eq(siteAssignments.id, id)).returning()

  if (!removed) {
    return createErrorResponse("Assignment not found", HTTP_STATUS.NOT_FOUND)
  }

  return createSuccessResponse({ id }, "Site assignment deleted successfully")
})

