import { and, count, desc, eq, ilike, or, type SQL } from "drizzle-orm"
import { type NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/database/connection-pool"
import { competencies, programs } from "@/database/schema"
import {
  createSuccessResponse,
  createErrorResponse,
  withErrorHandling,
  HTTP_STATUS,
  ERROR_MESSAGES,
} from "@/lib/api-response"
import { getSchoolContext } from "@/lib/school-utils"
import type { UserRole } from "@/types"

// Role check helpers
const ADMIN_ROLES: UserRole[] = ["SUPER_ADMIN", "SCHOOL_ADMIN"]
const isAdmin = (role: string): boolean => ADMIN_ROLES.includes(role as UserRole)
const isSchoolAdmin = (role: string): boolean => role === "SCHOOL_ADMIN"

// Ensure this route is always dynamic
export const dynamic = "force-dynamic"

const createCompetencySchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  category: z.string().min(1, "Category is required"),
  level: z.enum(["FUNDAMENTAL", "INTERMEDIATE", "ADVANCED", "EXPERT"]),
  isRequired: z.boolean().default(false),
  programId: z.string().optional(),
  criteria: z.array(z.string()).optional(),
  templateId: z.string().optional(),
  source: z.enum(["TEMPLATE", "CUSTOM"]).default("CUSTOM"),
  deploymentScope: z
    .enum(["SCHOOL_WIDE", "PROGRAM_SPECIFIC", "USER_SPECIFIC"])
    .default("PROGRAM_SPECIFIC"),
})

const updateCompetencySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  level: z.enum(["FUNDAMENTAL", "INTERMEDIATE", "ADVANCED", "EXPERT"]).optional(),
  isRequired: z.boolean().optional(),
  programId: z.string().optional(),
  criteria: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
})

// GET /api/competencies - Get competencies with filtering
export const GET = withErrorHandling(async (request: NextRequest) => {
  const context = await getSchoolContext()
  const { searchParams } = new URL(request.url)

  const search = searchParams.get("search")
  const category = searchParams.get("category")
  const level = searchParams.get("level")
  const programId = searchParams.get("programId")
  const limit = Number.parseInt(searchParams.get("limit") || "50")
  const offset = Number.parseInt(searchParams.get("offset") || "0")

  const conditions: SQL<unknown>[] = []

  // Filter by school if applicable
  if (context.schoolId) {
    conditions.push(eq(competencies.schoolId, context.schoolId))
  }

  if (search) conditions.push(ilike(competencies.name, `%${search}%`))
  if (category) conditions.push(eq(competencies.category, category))
  if (level)
    conditions.push(eq(competencies.level, level as (typeof competencies.level.enumValues)[number]))
  if (programId) conditions.push(eq(competencies.programId, programId))

  const data = await db
    .select({
      competency: competencies,
      programName: programs.name,
    })
    .from(competencies)
    .leftJoin(programs, eq(competencies.programId, programs.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(competencies.createdAt))
    .limit(limit)
    .offset(offset)

  // Get total count
  const [countResult] = await db
    .select({ count: count(competencies.id) })
    .from(competencies)
    .where(conditions.length > 0 ? and(...conditions) : undefined)

  const total = countResult?.count || data.length

  const parsedCompetencies = data.map(({ competency, programName }) => ({
    ...competency,
    programName,
    criteria: (() => {
      try {
        return JSON.parse(competency.criteria || "[]")
      } catch {
        return []
      }
    })(),
  }))

  return createSuccessResponse(
    {
      competencies: parsedCompetencies,
      pagination: { limit, offset, total },
    },
    "Competencies retrieved successfully"
  )
})

// POST /api/competencies - Create new competency
export const POST = withErrorHandling(async (request: NextRequest) => {
  const context = await getSchoolContext()
  if (!isAdmin(context.userRole)) {
    return createErrorResponse(ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS, HTTP_STATUS.FORBIDDEN)
  }

  const body = await request.json()
  const validatedData = createCompetencySchema.parse(body)

  const [newCompetency] = await db
    .insert(competencies)
    .values({
      id: crypto.randomUUID(),
      ...validatedData,
      schoolId: context.schoolId,
      criteria: JSON.stringify(validatedData.criteria || []),
      createdBy: context.userId, // Assuming userId is available in context or we need to fetch user
    })
    .returning()

  return createSuccessResponse(
    { competency: newCompetency },
    "Competency created successfully",
    HTTP_STATUS.CREATED
  )
})

// PUT /api/competencies - Update competency
export const PUT = withErrorHandling(async (request: NextRequest) => {
  const context = await getSchoolContext()
  if (!isAdmin(context.userRole)) {
    return createErrorResponse(ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS, HTTP_STATUS.FORBIDDEN)
  }

  const body = await request.json()
  const { id, ...updateData } = body

  if (!id) {
    return createErrorResponse("Competency ID is required", HTTP_STATUS.BAD_REQUEST)
  }

  const validatedData = updateCompetencySchema.parse(updateData)

  const [existingCompetency] = await db
    .select()
    .from(competencies)
    .where(eq(competencies.id, id))
    .limit(1)

  if (!existingCompetency) {
    return createErrorResponse("Competency not found", HTTP_STATUS.NOT_FOUND)
  }

  // Ensure school admin can only update their own school's competencies
  if (isSchoolAdmin(context.userRole) && existingCompetency.schoolId !== context.schoolId) {
    return createErrorResponse(ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS, HTTP_STATUS.FORBIDDEN)
  }

  const [updatedCompetency] = await db
    .update(competencies)
    .set({
      ...validatedData,
      criteria: validatedData.criteria ? JSON.stringify(validatedData.criteria) : undefined,
      updatedAt: new Date(),
    })
    .where(eq(competencies.id, id))
    .returning()

  return createSuccessResponse({ competency: updatedCompetency }, "Competency updated successfully")
})

// DELETE /api/competencies - Delete competency
export const DELETE = withErrorHandling(async (request: NextRequest) => {
  const context = await getSchoolContext()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")

  if (!id) {
    return createErrorResponse("Competency ID is required", HTTP_STATUS.BAD_REQUEST)
  }

  if (!isAdmin(context.userRole)) {
    return createErrorResponse(ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS, HTTP_STATUS.FORBIDDEN)
  }

  const [existingCompetency] = await db
    .select()
    .from(competencies)
    .where(eq(competencies.id, id))
    .limit(1)

  if (!existingCompetency) {
    return createErrorResponse(ERROR_MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND)
  }

  if (isSchoolAdmin(context.userRole) && existingCompetency.schoolId !== context.schoolId) {
    return createErrorResponse(ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS, HTTP_STATUS.FORBIDDEN)
  }

  await db.delete(competencies).where(eq(competencies.id, id))
  return createSuccessResponse(null, "Competency deleted successfully")
})
