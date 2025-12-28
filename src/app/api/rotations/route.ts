import type { UserRole } from "@/types"
import { and, desc, eq, gte, lte } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "../../../database/connection-pool"
import { clinicalSites, rotations, users } from "../../../database/schema"
import { getSchoolContext } from "../../../lib/school-utils"
import {
  createSuccessResponse,
  createErrorResponse,
  createValidationErrorResponse,
  createPaginatedResponse,
  withErrorHandling,
  HTTP_STATUS,
  ERROR_MESSAGES,
} from "@/lib/api-response"

// Validation schemas
const createRotationSchema = z.object({
  studentId: z.string().min(1, "Student ID is required"),
  clinicalSiteId: z.string().min(1, "Clinical site ID is required"),
  preceptorId: z.string().optional(), // Made optional to simplify onboarding
  supervisorId: z.string().optional(),
  specialty: z.string().min(1, "Specialty is required"),
  startDate: z.string().datetime("Invalid start date").optional(),
  endDate: z.string().datetime("Invalid end date").optional(),
  requiredHours: z.number().min(1, "Required hours must be at least 1").optional(),
  objectives: z.array(z.string()).optional(),
})

const updateRotationSchema = z.object({
  clinicalSiteId: z.string().optional(),
  preceptorId: z.string().optional(),
  supervisorId: z.string().optional(),
  specialty: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  requiredHours: z.number().min(1).optional(),
  status: z.enum(["SCHEDULED", "ACTIVE", "COMPLETED", "CANCELLED"]).optional(),
  objectives: z.array(z.string()).optional(),
})

// GET /api/rotations - Get rotations with filtering
export const GET = withErrorHandling(async (request: NextRequest) => {
  const context = await getSchoolContext()
  const { searchParams } = new URL(request.url)

  const studentId = searchParams.get("studentId")
  const clinicalSiteId = searchParams.get("clinicalSiteId")
  const preceptorId = searchParams.get("preceptorId")
  const status = searchParams.get("status")
  const specialty = searchParams.get("specialty")
  const startDate = searchParams.get("startDate")
  const endDate = searchParams.get("endDate")
  const limit = Number.parseInt(searchParams.get("limit") || "50")
  const offset = Number.parseInt(searchParams.get("offset") || "0")

  // Build query conditions
  const conditions = []

  // Role-based filtering
  if (context.userRole === ("STUDENT" as UserRole)) {
    conditions.push(eq(rotations.studentId, context.userId))
  } else if (context.userRole === ("CLINICAL_PRECEPTOR" as UserRole)) {
    conditions.push(eq(rotations.preceptorId, context.userId))
  } else if (context.userRole === ("CLINICAL_SUPERVISOR" as UserRole)) {
    conditions.push(eq(rotations.supervisorId, context.userId))
  }

  if (studentId) {
    conditions.push(eq(rotations.studentId, studentId))
  }

  if (clinicalSiteId) {
    conditions.push(eq(rotations.clinicalSiteId, clinicalSiteId))
  }

  if (preceptorId) {
    conditions.push(eq(rotations.preceptorId, preceptorId))
  }

  if (status) {
    conditions.push(
      eq(rotations.status, status as "SCHEDULED" | "ACTIVE" | "COMPLETED" | "CANCELLED")
    )
  }

  if (specialty) {
    conditions.push(eq(rotations.specialty, specialty))
  }

  if (startDate) {
    conditions.push(gte(rotations.startDate, new Date(startDate)))
  }

  if (endDate) {
    conditions.push(lte(rotations.endDate, new Date(endDate)))
  }

  // Execute query with joins
  const rotationList = await db
    .select({
      id: rotations.id,
      studentId: rotations.studentId,
      clinicalSiteId: rotations.clinicalSiteId,
      preceptorId: rotations.preceptorId,
      supervisorId: rotations.supervisorId,
      specialty: rotations.specialty,
      startDate: rotations.startDate,
      endDate: rotations.endDate,
      requiredHours: rotations.requiredHours,
      completedHours: rotations.completedHours,
      status: rotations.status,
      objectives: rotations.objectives,
      createdAt: rotations.createdAt,
      updatedAt: rotations.updatedAt,
      studentName: users.name,
      clinicalSiteName: clinicalSites.name,
    })
    .from(rotations)
    .leftJoin(users, eq(rotations.studentId, users.id))
    .leftJoin(clinicalSites, eq(rotations.clinicalSiteId, clinicalSites.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(rotations.startDate))
    .limit(limit)
    .offset(offset)

  const transformedData = rotationList.map((rotation) => ({
    ...rotation,
    objectives: rotation.objectives ? JSON.parse(rotation.objectives) : [],
    progressPercentage:
      rotation.requiredHours && rotation.requiredHours > 0
        ? Math.round((rotation.completedHours / rotation.requiredHours) * 100)
        : 0,
  }))

  const page = Math.floor(offset / limit) + 1
  return createPaginatedResponse(transformedData, page, limit, rotationList.length)
})

// POST /api/rotations - Create new rotation
export const POST = withErrorHandling(async (request: NextRequest) => {
  const context = await getSchoolContext()

  // Only admins and supervisors can create rotations
  if (
    ![
      "SUPER_ADMIN" as UserRole,
      "SCHOOL_ADMIN" as UserRole,
      "CLINICAL_SUPERVISOR" as UserRole,
    ].includes(context.userRole)
  ) {
    return createErrorResponse(ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS, HTTP_STATUS.FORBIDDEN)
  }

  const body = await request.json()

  try {
    const validatedData = createRotationSchema.parse(body)

    // Validate dates if both are provided
    const startDate = validatedData.startDate ? new Date(validatedData.startDate) : null
    const endDate = validatedData.endDate ? new Date(validatedData.endDate) : null

    if (startDate && endDate && endDate <= startDate) {
      return createErrorResponse("End date must be after start date", HTTP_STATUS.BAD_REQUEST)
    }

    // Verify student exists and belongs to school
    const [student] = await db
      .select({ id: users.id, schoolId: users.schoolId })
      .from(users)
      .where(and(eq(users.id, validatedData.studentId), eq(users.role, "STUDENT")))
      .limit(1)

    if (!student) {
      return createErrorResponse("Student not found", HTTP_STATUS.NOT_FOUND)
    }

    // School admins can only create rotations for students in their school
    if (context.userRole === ("SCHOOL_ADMIN" as UserRole) && context.schoolId) {
      if (student.schoolId !== context.schoolId) {
        return createErrorResponse(
          "Cannot create rotation for student from another school",
          HTTP_STATUS.FORBIDDEN
        )
      }
    }

    // Verify preceptor exists (only if provided)
    if (validatedData.preceptorId) {
      const [preceptor] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, validatedData.preceptorId), eq(users.role, "CLINICAL_PRECEPTOR")))
        .limit(1)

      if (!preceptor) {
        return createErrorResponse("Preceptor not found", HTTP_STATUS.NOT_FOUND)
      }
    }

    // Verify clinical site exists
    const [clinicalSite] = await db
      .select()
      .from(clinicalSites)
      .where(eq(clinicalSites.id, validatedData.clinicalSiteId))
      .limit(1)

    if (!clinicalSite) {
      return createErrorResponse("Clinical site not found", HTTP_STATUS.NOT_FOUND)
    }

    // Verify supervisor if provided
    if (validatedData.supervisorId) {
      const [supervisor] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, validatedData.supervisorId), eq(users.role, "CLINICAL_SUPERVISOR")))
        .limit(1)

      if (!supervisor) {
        return createErrorResponse("Supervisor not found", HTTP_STATUS.NOT_FOUND)
      }
    }

    // Create rotation
    const [newRotation] = await db
      .insert(rotations)
      .values({
        id: crypto.randomUUID(),
        studentId: validatedData.studentId,
        clinicalSiteId: validatedData.clinicalSiteId,
        preceptorId: validatedData.preceptorId || null,
        supervisorId: validatedData.supervisorId,
        specialty: validatedData.specialty,
        startDate: startDate || null,
        endDate: endDate || null,
        requiredHours: validatedData.requiredHours || null,
        completedHours: 0,
        status: "SCHEDULED",
        objectives: JSON.stringify(validatedData.objectives || []),
      })
      .returning()

    return createSuccessResponse(
      {
        ...newRotation,
        objectives: validatedData.objectives || [],
      },
      "Rotation created successfully"
    )
  } catch (error) {
    throw error
  }
})

// PUT /api/rotations - Update rotation
export const PUT = withErrorHandling(async (request: NextRequest) => {
  const context = await getSchoolContext()
  const body = await request.json()
  const { id, ...updateData } = body

  if (!id) {
    return createErrorResponse("Rotation ID is required", HTTP_STATUS.BAD_REQUEST)
  }

  // Only admins and supervisors can update rotations
  if (
    ![
      "SUPER_ADMIN" as UserRole,
      "SCHOOL_ADMIN" as UserRole,
      "CLINICAL_SUPERVISOR" as UserRole,
    ].includes(context.userRole)
  ) {
    return createErrorResponse(ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS, HTTP_STATUS.FORBIDDEN)
  }

  try {
    const validatedData = updateRotationSchema.parse(updateData)

    // Get existing rotation
    const [existingRotation] = await db
      .select()
      .from(rotations)
      .where(eq(rotations.id, id))
      .limit(1)

    if (!existingRotation) {
      return createErrorResponse("Rotation not found", HTTP_STATUS.NOT_FOUND)
    }

    // Prepare update values
    const updateValues: Partial<typeof rotations.$inferInsert> = {
      updatedAt: new Date(),
    }

    // Validate and set fields
    if (validatedData.startDate && validatedData.endDate) {
      const startDate = new Date(validatedData.startDate)
      const endDate = new Date(validatedData.endDate)

      if (endDate <= startDate) {
        return createErrorResponse("End date must be after start date", HTTP_STATUS.BAD_REQUEST)
      }

      updateValues.startDate = startDate
      updateValues.endDate = endDate
    } else if (validatedData.startDate) {
      const startDate = new Date(validatedData.startDate)
      if (existingRotation.endDate && startDate >= existingRotation.endDate) {
        return createErrorResponse("Start date must be before end date", HTTP_STATUS.BAD_REQUEST)
      }
      updateValues.startDate = startDate
    } else if (validatedData.endDate) {
      const endDate = new Date(validatedData.endDate)
      if (existingRotation.startDate && endDate <= existingRotation.startDate) {
        return createErrorResponse("End date must be after start date", HTTP_STATUS.BAD_REQUEST)
      }
      updateValues.endDate = endDate
    }

    if (validatedData.clinicalSiteId) {
      updateValues.clinicalSiteId = validatedData.clinicalSiteId
    }

    if (validatedData.preceptorId) {
      updateValues.preceptorId = validatedData.preceptorId
    }

    if (validatedData.supervisorId) {
      updateValues.supervisorId = validatedData.supervisorId
    }

    if (validatedData.specialty) {
      updateValues.specialty = validatedData.specialty
    }

    if (validatedData.requiredHours) {
      updateValues.requiredHours = validatedData.requiredHours
    }

    if (validatedData.status) {
      updateValues.status = validatedData.status
    }

    if (validatedData.objectives) {
      updateValues.objectives = JSON.stringify(validatedData.objectives)
    }

    const [updatedRotation] = await db
      .update(rotations)
      .set(updateValues)
      .where(eq(rotations.id, id))
      .returning()

    return createSuccessResponse(
      {
        ...updatedRotation,
        objectives: updatedRotation.objectives ? JSON.parse(updatedRotation.objectives) : [],
      },
      "Rotation updated successfully"
    )
  } catch (error) {
    throw error
  }
})

// DELETE /api/rotations - Delete rotation
export const DELETE = withErrorHandling(async (request: NextRequest) => {
  const context = await getSchoolContext()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")

  if (!id) {
    return createErrorResponse("Rotation ID is required", HTTP_STATUS.BAD_REQUEST)
  }

  // Only super admins and school admins can delete rotations
  if (!["SUPER_ADMIN" as UserRole, "SCHOOL_ADMIN" as UserRole].includes(context.userRole)) {
    return createErrorResponse(ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS, HTTP_STATUS.FORBIDDEN)
  }

  // Get existing rotation
  const [existingRotation] = await db.select().from(rotations).where(eq(rotations.id, id)).limit(1)

  if (!existingRotation) {
    return createErrorResponse("Rotation not found", HTTP_STATUS.NOT_FOUND)
  }

  // Check if rotation has started
  if (existingRotation.status === "ACTIVE" || existingRotation.status === "COMPLETED") {
    return createErrorResponse(
      "Cannot delete active or completed rotations",
      HTTP_STATUS.BAD_REQUEST
    )
  }

  await db.delete(rotations).where(eq(rotations.id, id))

  return createSuccessResponse(null, "Rotation deleted successfully")
})

