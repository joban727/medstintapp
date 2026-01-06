import { and, count, desc, eq, like } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "../../../database/connection-pool"
import { cohorts, programs, schools, users } from "../../../database/schema"
import { getSchoolContext } from "../../../lib/school-utils"
import { cacheIntegrationService } from "@/lib/cache-integration"
import type { UserRole } from "@/types"
import {
  createSuccessResponse,
  createErrorResponse,
  HTTP_STATUS,
  ERROR_MESSAGES,
  withErrorHandling,
  createPaginatedResponse,
} from "@/lib/api-response"
import { createValidationMiddleware } from "@/lib/data-validation"
import { logger } from "@/lib/logger"

// Interface for requests with validated data from middleware
interface ValidatedRequest<T> extends Request {
  validatedData?: T
}

// Role type guards
const ADMIN_ROLES: UserRole[] = ["SUPER_ADMIN", "SCHOOL_ADMIN"]
const isAdmin = (role: string): boolean => ADMIN_ROLES.includes(role as UserRole)
const isSchoolAdmin = (role: string): boolean => role === "SCHOOL_ADMIN"

// Validation schemas
const createProgramSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  duration: z.number().min(1, "Duration must be at least 1 month"),
  schoolId: z.string().min(1, "School ID is required"),
  requirements: z.array(z.string()).optional(),
})

const updateProgramSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  duration: z.number().min(1).optional(),
  isActive: z.boolean().optional(),
  requirements: z.array(z.string()).optional(),
})

// GET /api/programs - List programs with optional filtering
export const GET = withErrorHandling(async (request: NextRequest) => {
  const cacheKey = `programs:${request.url}`

  // Try to get from cache first
  try {
    const cached = await cacheIntegrationService.get(cacheKey)
    if (cached) {
      return createSuccessResponse(cached)
    }
  } catch (cacheError) {
    logger.warn({ err: cacheError }, "Cache retrieval error in programs/route.ts")
  }

  const context = await getSchoolContext()
  const { searchParams } = new URL(request.url)

  const schoolId = searchParams.get("schoolId")
  const search = searchParams.get("search")
  const isActive = searchParams.get("isActive")
  const limit = Number.parseInt(searchParams.get("limit") || "50")
  const offset = Number.parseInt(searchParams.get("offset") || "0")
  const includeStats = searchParams.get("includeStats") === "true"

  // Build query conditions
  const conditions = []

  // Role-based filtering
  if (isSchoolAdmin(context.userRole) && context.schoolId) {
    conditions.push(eq(programs.schoolId, context.schoolId))
  } else if (schoolId) {
    conditions.push(eq(programs.schoolId, schoolId))
  }

  if (search) {
    conditions.push(like(programs.name, `%${search}%`))
  }

  if (isActive !== null) {
    conditions.push(eq(programs.isActive, isActive === "true"))
  }

  // Execute main query with school information
  const programList = await db
    .select({
      id: programs.id,
      name: programs.name,
      description: programs.description,
      duration: programs.duration,
      schoolId: programs.schoolId,
      isActive: programs.isActive,
      requirements: programs.requirements,
      createdAt: programs.createdAt,
      updatedAt: programs.updatedAt,
      schoolName: schools.name,
    })
    .from(programs)
    .leftJoin(schools, eq(programs.schoolId, schools.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(programs.createdAt))
    .limit(limit)
    .offset(offset)

  // Include statistics if requested
  let programsWithStats = programList
  if (includeStats) {
    programsWithStats = await Promise.all(
      programList.map(async (program) => {
        const [studentCount] = await db
          .select({
            totalStudents: count(users.id),
          })
          .from(users)
          .where(and(eq(users.programId, program.id), eq(users.role, "STUDENT")))

        const [activeStudents] = await db
          .select({
            activeStudents: count(users.id),
          })
          .from(users)
          .where(
            and(
              eq(users.programId, program.id),
              eq(users.role, "STUDENT"),
              eq(users.academicStatus, "ACTIVE")
            )
          )

        return {
          ...program,
          requirements: program.requirements ? JSON.parse(program.requirements) : [],
          stats: {
            totalStudents: studentCount?.totalStudents || 0,
            activeStudents: activeStudents?.activeStudents || 0,
          },
        }
      })
    )
  } else {
    programsWithStats = programList.map((program) => ({
      ...program,
      requirements: program.requirements ? JSON.parse(program.requirements) : [],
    }))
  }

  const page = Math.floor(offset / limit) + 1
  const totalPages = Math.ceil(programList.length / limit)

  const responseData = {
    items: programsWithStats,
    pagination: {
      page,
      limit,
      total: programList.length,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  }

  // Cache the response data
  try {
    await cacheIntegrationService.set(cacheKey, responseData, { ttl: 300 }) // 5 minutes
  } catch (cacheError) {
    logger.warn({ err: cacheError }, "Cache storage error in programs/route.ts")
  }

  return createSuccessResponse(responseData)
})

// POST /api/programs - Create new program
export const POST = withErrorHandling(async (request: NextRequest) => {
  const context = await getSchoolContext()

  // Only admins can create programs
  if (!isAdmin(context.userRole)) {
    return createErrorResponse(ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS, HTTP_STATUS.FORBIDDEN)
  }

  // Validate and sanitize request body using shared middleware
  const validate = createValidationMiddleware(createProgramSchema)
  const validationResponse = await validate(request as unknown as Request)
  if (validationResponse) {
    return validationResponse as NextResponse
  }
  const validatedData = (
    request as unknown as ValidatedRequest<z.infer<typeof createProgramSchema>>
  ).validatedData
  if (!validatedData) {
    return createErrorResponse("Validation failed", HTTP_STATUS.BAD_REQUEST)
  }

  // Validate school access
  if (isSchoolAdmin(context.userRole)) {
    if (!context.schoolId || validatedData.schoolId !== context.schoolId) {
      return createErrorResponse("Access denied to this school", HTTP_STATUS.FORBIDDEN)
    }
  }

  // Verify school exists
  const [school] = await db
    .select()
    .from(schools)
    .where(eq(schools.id, validatedData.schoolId))
    .limit(1)

  if (!school) {
    return createErrorResponse("School not found", HTTP_STATUS.NOT_FOUND)
  }

  // Check if program with same name exists in the school
  const [existingProgram] = await db
    .select()
    .from(programs)
    .where(
      and(eq(programs.name, validatedData.name), eq(programs.schoolId, validatedData.schoolId))
    )
    .limit(1)

  if (existingProgram) {
    return createErrorResponse(
      "Program with this name already exists in this school",
      HTTP_STATUS.BAD_REQUEST
    )
  }

  // Create program
  const [newProgram] = await db
    .insert(programs)
    .values({
      id: crypto.randomUUID(),
      name: validatedData.name,
      description: validatedData.description,
      duration: validatedData.duration,
      classYear: new Date().getFullYear() + Math.ceil(validatedData.duration / 12),
      schoolId: validatedData.schoolId,
      requirements: JSON.stringify(validatedData.requirements || []),
    })
    .returning()

  // Create default cohort
  const startYear = new Date().getFullYear()
  const endYear = startYear + Math.ceil(validatedData.duration / 12)
  const cohortName = `Class of ${endYear}`

  await db.insert(cohorts).values({
    id: crypto.randomUUID(),
    programId: newProgram.id,
    name: cohortName,
    startDate: new Date(),
    endDate: new Date(new Date().setFullYear(endYear)),
    capacity: 50,
    status: "ACTIVE",
    description: `Default cohort for ${validatedData.name}`,
  })

  // Invalidate related caches
  try {
    await cacheIntegrationService.clear()
  } catch (cacheError) {
    logger.warn({ err: cacheError }, "Cache invalidation error in programs/route.ts")
  }

  return createSuccessResponse(
    {
      ...newProgram,
      requirements: validatedData.requirements || [],
    },
    "Program created successfully"
  )
})

// PUT /api/programs - Update program
export const PUT = withErrorHandling(async (request: NextRequest) => {
  const context = await getSchoolContext()
  const body = await request.json()
  const { id, ...updateData } = body

  if (!id) {
    return createErrorResponse("Program ID is required", HTTP_STATUS.BAD_REQUEST)
  }

  // Only admins can update programs
  if (!isAdmin(context.userRole)) {
    return createErrorResponse(ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS, HTTP_STATUS.FORBIDDEN)
  }

  // Validate and sanitize update payload using shared middleware
  const validateUpdate = createValidationMiddleware(updateProgramSchema)
  // Create a new Request containing only the update payload to avoid consuming the original body twice
  const updateRequest = new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: JSON.stringify(updateData),
  })
  const validationUpdateResponse = await validateUpdate(updateRequest)
  if (validationUpdateResponse) {
    return validationUpdateResponse as NextResponse
  }
  const validatedData = (
    updateRequest as unknown as ValidatedRequest<z.infer<typeof updateProgramSchema>>
  ).validatedData
  if (!validatedData) {
    return createErrorResponse("Validation failed", HTTP_STATUS.BAD_REQUEST)
  }

  // Get existing program
  const [existingProgram] = await db.select().from(programs).where(eq(programs.id, id)).limit(1)

  if (!existingProgram) {
    return createErrorResponse("Program not found", HTTP_STATUS.NOT_FOUND)
  }

  // Validate school access
  if (isSchoolAdmin(context.userRole)) {
    if (!context.schoolId || existingProgram.schoolId !== context.schoolId) {
      return createErrorResponse("Access denied to this program", HTTP_STATUS.FORBIDDEN)
    }
  }

  // Check if name is being changed and if it conflicts
  if (validatedData.name && validatedData.name !== existingProgram.name) {
    const [nameConflict] = await db
      .select()
      .from(programs)
      .where(
        and(
          eq(programs.name, validatedData.name),
          eq(programs.schoolId, existingProgram.schoolId)
          // Exclude current program
        )
      )
      .limit(1)

    if (nameConflict && nameConflict.id !== id) {
      return createErrorResponse(
        "Program with this name already exists in this school",
        HTTP_STATUS.BAD_REQUEST
      )
    }
  }

  // Prepare update values
  const updateValues: Record<string, unknown> = {
    updatedAt: new Date(),
  }

  // Set fields that are provided
  if (validatedData.name) updateValues.name = validatedData.name
  if (validatedData.description) updateValues.description = validatedData.description
  if (validatedData.duration) updateValues.duration = validatedData.duration
  if (validatedData.isActive !== undefined) updateValues.isActive = validatedData.isActive

  if (validatedData.requirements) {
    updateValues.requirements = JSON.stringify(validatedData.requirements)
  }

  const [updatedProgram] = await db
    .update(programs)
    .set(updateValues)
    .where(eq(programs.id, id))
    .returning()

  // Invalidate related caches
  try {
    await cacheIntegrationService.clear()
  } catch (cacheError) {
    logger.warn({ err: cacheError }, "Cache invalidation error in programs/route.ts")
  }

  return createSuccessResponse(
    {
      ...updatedProgram,
      requirements: updatedProgram.requirements ? JSON.parse(updatedProgram.requirements) : [],
    },
    "Program updated successfully"
  )
})

// DELETE /api/programs - Delete program
export const DELETE = withErrorHandling(async (request: NextRequest) => {
  const context = await getSchoolContext()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")

  if (!id) {
    return createErrorResponse("Program ID is required", HTTP_STATUS.BAD_REQUEST)
  }

  // Only super admins and school admins can delete programs
  if (!isAdmin(context.userRole)) {
    return createErrorResponse(ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS, HTTP_STATUS.FORBIDDEN)
  }

  // Get existing program
  const [existingProgram] = await db.select().from(programs).where(eq(programs.id, id)).limit(1)

  if (!existingProgram) {
    return createErrorResponse("Program not found", HTTP_STATUS.NOT_FOUND)
  }

  // Validate school access
  if (isSchoolAdmin(context.userRole)) {
    if (!context.schoolId || existingProgram.schoolId !== context.schoolId) {
      return createErrorResponse("Access denied to this program", HTTP_STATUS.FORBIDDEN)
    }
  }

  // Check if program has enrolled students
  const [enrolledStudents] = await db
    .select({ count: count(users.id) })
    .from(users)
    .where(and(eq(users.programId, id), eq(users.role, "STUDENT")))

  if (enrolledStudents.count > 0) {
    return createErrorResponse(
      "Cannot delete program with enrolled students",
      HTTP_STATUS.BAD_REQUEST
    )
  }

  await db.delete(programs).where(eq(programs.id, id))

  // Invalidate related caches
  try {
    await cacheIntegrationService.clear()
  } catch (cacheError) {
    logger.warn({ err: cacheError }, "Cache invalidation error in programs/route.ts")
  }

  return createSuccessResponse(null, "Program deleted successfully")
})
