import { and, eq, sql } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "../../../../database/connection-pool"
import {
  complianceRequirements,
  programComplianceRequirements,
  schools,
} from "../../../../database/schema"
import { getSchoolContext } from "../../../../lib/school-utils"
import { cacheIntegrationService } from "@/lib/cache-integration"
import type { UserRole } from "@/types"
import {
  createSuccessResponse,
  createErrorResponse,
  HTTP_STATUS,
  ERROR_MESSAGES,
  withErrorHandling,
} from "@/lib/api-response"
import { createValidationMiddleware } from "@/lib/data-validation"
import { logger } from "@/lib/logger"

// Role type guards
const ADMIN_ROLES: UserRole[] = ["SUPER_ADMIN", "SCHOOL_ADMIN"]
const isAdmin = (role: string): boolean => ADMIN_ROLES.includes(role as UserRole)

// Validation schemas
const createRequirementSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  type: z.enum(["DOCUMENT", "DATE", "BOOLEAN"]),
  frequency: z.enum(["ONCE", "ANNUAL", "BIENNIAL"]).default("ONCE"),
  isRequired: z.boolean().default(true),
  schoolId: z.string().min(1, "School ID is required"),
  programIds: z.array(z.string()).optional(), // Optional programs to link to
})

const updateRequirementSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  type: z.enum(["DOCUMENT", "DATE", "BOOLEAN"]).optional(),
  frequency: z.enum(["ONCE", "ANNUAL", "BIENNIAL"]).optional(),
  isRequired: z.boolean().optional(),
  isActive: z.boolean().optional(),
  programIds: z.array(z.string()).optional(),
})

// GET /api/compliance/requirements - List requirements
export const GET = withErrorHandling(async (request: NextRequest) => {
  const context = await getSchoolContext()
  const { searchParams } = new URL(request.url)

  const schoolId = searchParams.get("schoolId") || context.schoolId
  const programId = searchParams.get("programId")

  if (!schoolId) {
    return createErrorResponse("School ID is required", HTTP_STATUS.BAD_REQUEST)
  }

  // Build query
  const query = db
    .select()
    .from(complianceRequirements)
    .where(eq(complianceRequirements.schoolId, schoolId))

  // If programId is provided, filter by program links
  if (programId) {
    const requirementsList = await db
      .select({
        requirement: complianceRequirements,
      })
      .from(complianceRequirements)
      .innerJoin(
        programComplianceRequirements,
        eq(complianceRequirements.id, programComplianceRequirements.requirementId)
      )
      .where(
        and(
          eq(complianceRequirements.schoolId, schoolId),
          eq(programComplianceRequirements.programId, programId),
          eq(complianceRequirements.isActive, true)
        )
      )

    return createSuccessResponse(requirementsList.map((r) => r.requirement))
  }

  const requirementsList = await query
  return createSuccessResponse(requirementsList)
})

// POST /api/compliance/requirements - Create requirement
export const POST = withErrorHandling(async (request: NextRequest) => {
  const context = await getSchoolContext()

  if (!isAdmin(context.userRole)) {
    return createErrorResponse(ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS, HTTP_STATUS.FORBIDDEN)
  }

  const body = await request.json()
  const validatedData = createRequirementSchema.parse(body)

  // Validate school access
  if (context.userRole === "SCHOOL_ADMIN" && validatedData.schoolId !== context.schoolId) {
    return createErrorResponse("Access denied to this school", HTTP_STATUS.FORBIDDEN)
  }

  // Create requirement
  const [newRequirement] = await db
    .insert(complianceRequirements)
    .values({
      id: crypto.randomUUID(),
      schoolId: validatedData.schoolId,
      name: validatedData.name,
      description: validatedData.description,
      type: validatedData.type,
      frequency: validatedData.frequency,
      isRequired: validatedData.isRequired,
    })
    .returning()

  // Link to programs if provided
  if (validatedData.programIds && validatedData.programIds.length > 0) {
    await db.insert(programComplianceRequirements).values(
      validatedData.programIds.map((programId) => ({
        id: crypto.randomUUID(),
        programId,
        requirementId: newRequirement.id,
      }))
    )
  }

  return createSuccessResponse(newRequirement, "Requirement created successfully")
})

// PUT /api/compliance/requirements - Update requirement
export const PUT = withErrorHandling(async (request: NextRequest) => {
  const context = await getSchoolContext()

  if (!isAdmin(context.userRole)) {
    return createErrorResponse(ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS, HTTP_STATUS.FORBIDDEN)
  }

  const body = await request.json()
  const { id, ...updateData } = body

  if (!id) {
    return createErrorResponse("Requirement ID is required", HTTP_STATUS.BAD_REQUEST)
  }

  const validatedData = updateRequirementSchema.parse(updateData)

  // Get existing
  const [existing] = await db
    .select()
    .from(complianceRequirements)
    .where(eq(complianceRequirements.id, id))
    .limit(1)

  if (!existing) {
    return createErrorResponse("Requirement not found", HTTP_STATUS.NOT_FOUND)
  }

  // Validate school access
  if (context.userRole === "SCHOOL_ADMIN" && existing.schoolId !== context.schoolId) {
    return createErrorResponse("Access denied", HTTP_STATUS.FORBIDDEN)
  }

  // Update
  const [updated] = await db
    .update(complianceRequirements)
    .set({
      ...validatedData,
      updatedAt: new Date(),
    })
    .where(eq(complianceRequirements.id, id))
    .returning()

  // Update program links if provided
  if (validatedData.programIds) {
    // Delete existing links
    await db
      .delete(programComplianceRequirements)
      .where(eq(programComplianceRequirements.requirementId, id))

    // Add new links
    if (validatedData.programIds.length > 0) {
      await db.insert(programComplianceRequirements).values(
        validatedData.programIds.map((programId) => ({
          id: crypto.randomUUID(),
          programId,
          requirementId: id,
        }))
      )
    }
  }

  return createSuccessResponse(updated, "Requirement updated successfully")
})
