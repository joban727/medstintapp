"use server"

import { NextRequest } from "next/server"
import { z } from "zod"
import { eq, and, desc } from "drizzle-orm"
import { db } from "@/database/connection-pool"
import { rotationTemplates, programs, clinicalSites, users } from "@/database/schema"
import { getSchoolContext } from "@/lib/school-utils"
import {
    createSuccessResponse,
    createErrorResponse,
    HTTP_STATUS,
    withErrorHandling,
} from "@/lib/api-response"
import type { UserRole } from "@/types"

// Validation schemas
const createRotationTemplateSchema = z.object({
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
    specialty: z.string().min(1, "Specialty is required"),
    defaultDurationWeeks: z.number().min(1, "Duration must be at least 1 week"),
    defaultRequiredHours: z.number().min(1, "Required hours must be at least 1"),
    defaultClinicalSiteId: z.string().optional().nullable(),
    objectives: z.array(z.string()).optional(),
    programId: z.string().min(1, "Program ID is required"),
    sortOrder: z.number().optional(),
})

const updateRotationTemplateSchema = z.object({
    id: z.string().min(1, "Template ID is required"),
    name: z.string().optional(),
    description: z.string().optional().nullable(),
    specialty: z.string().optional(),
    defaultDurationWeeks: z.number().min(1).optional(),
    defaultRequiredHours: z.number().min(1).optional(),
    defaultClinicalSiteId: z.string().optional().nullable(),
    objectives: z.array(z.string()).optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().optional(),
})

// GET /api/rotation-templates - List rotation templates
export const GET = withErrorHandling(async (request: NextRequest) => {
    const context = await getSchoolContext()
    const { searchParams } = new URL(request.url)

    const programId = searchParams.get("programId")
    const activeOnly = searchParams.get("activeOnly") === "true"

    // Build conditions
    const conditions = []

    // Filter by school
    if (context.schoolId && context.userRole !== "SUPER_ADMIN") {
        conditions.push(eq(rotationTemplates.schoolId, context.schoolId))
    }

    // Filter by program if specified
    if (programId) {
        conditions.push(eq(rotationTemplates.programId, programId))
    }

    // Filter active only if specified
    if (activeOnly) {
        conditions.push(eq(rotationTemplates.isActive, true))
    }

    const templates = await db
        .select({
            id: rotationTemplates.id,
            name: rotationTemplates.name,
            description: rotationTemplates.description,
            specialty: rotationTemplates.specialty,
            defaultDurationWeeks: rotationTemplates.defaultDurationWeeks,
            defaultRequiredHours: rotationTemplates.defaultRequiredHours,
            defaultClinicalSiteId: rotationTemplates.defaultClinicalSiteId,
            objectives: rotationTemplates.objectives,
            isActive: rotationTemplates.isActive,
            sortOrder: rotationTemplates.sortOrder,
            schoolId: rotationTemplates.schoolId,
            programId: rotationTemplates.programId,
            programName: programs.name,
            clinicalSiteName: clinicalSites.name,
            createdBy: rotationTemplates.createdBy,
            createdAt: rotationTemplates.createdAt,
            updatedAt: rotationTemplates.updatedAt,
        })
        .from(rotationTemplates)
        .leftJoin(programs, eq(rotationTemplates.programId, programs.id))
        .leftJoin(clinicalSites, eq(rotationTemplates.defaultClinicalSiteId, clinicalSites.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(rotationTemplates.sortOrder, desc(rotationTemplates.createdAt))

    // Parse objectives from JSON
    const templatesWithParsedObjectives = templates.map((template) => ({
        ...template,
        objectives: template.objectives ? JSON.parse(template.objectives) : [],
    }))

    return createSuccessResponse({ templates: templatesWithParsedObjectives })
})

// POST /api/rotation-templates - Create a new rotation template
export const POST = withErrorHandling(async (request: NextRequest) => {
    const context = await getSchoolContext()

    // Only admins can create templates
    if (
        ![
            "SUPER_ADMIN" as UserRole,
            "SCHOOL_ADMIN" as UserRole,
        ].includes(context.userRole)
    ) {
        return createErrorResponse("Insufficient permissions", HTTP_STATUS.FORBIDDEN)
    }

    const body = await request.json()
    const validatedData = createRotationTemplateSchema.parse(body)

    // Verify program belongs to school
    const [program] = await db
        .select()
        .from(programs)
        .where(eq(programs.id, validatedData.programId))
        .limit(1)

    if (!program) {
        return createErrorResponse("Program not found", HTTP_STATUS.NOT_FOUND)
    }

    if (program.schoolId !== context.schoolId && context.userRole !== "SUPER_ADMIN") {
        return createErrorResponse("Access denied to this program", HTTP_STATUS.FORBIDDEN)
    }

    // Verify clinical site if provided
    if (validatedData.defaultClinicalSiteId) {
        const [site] = await db
            .select()
            .from(clinicalSites)
            .where(eq(clinicalSites.id, validatedData.defaultClinicalSiteId))
            .limit(1)

        if (!site) {
            return createErrorResponse("Clinical site not found", HTTP_STATUS.NOT_FOUND)
        }
    }

    const [newTemplate] = await db
        .insert(rotationTemplates)
        .values({
            schoolId: program.schoolId,
            programId: validatedData.programId,
            name: validatedData.name,
            description: validatedData.description,
            specialty: validatedData.specialty,
            defaultDurationWeeks: validatedData.defaultDurationWeeks,
            defaultRequiredHours: validatedData.defaultRequiredHours,
            defaultClinicalSiteId: validatedData.defaultClinicalSiteId,
            objectives: validatedData.objectives ? JSON.stringify(validatedData.objectives) : null,
            sortOrder: validatedData.sortOrder ?? 0,
            createdBy: context.userId,
        })
        .returning()

    return createSuccessResponse(
        {
            ...newTemplate,
            objectives: validatedData.objectives || [],
        },
        "Rotation template created successfully",
        HTTP_STATUS.CREATED
    )
})

// PUT /api/rotation-templates - Update an existing rotation template
export const PUT = withErrorHandling(async (request: NextRequest) => {
    const context = await getSchoolContext()

    // Only admins can update templates
    if (
        ![
            "SUPER_ADMIN" as UserRole,
            "SCHOOL_ADMIN" as UserRole,
        ].includes(context.userRole)
    ) {
        return createErrorResponse("Insufficient permissions", HTTP_STATUS.FORBIDDEN)
    }

    const body = await request.json()
    const validatedData = updateRotationTemplateSchema.parse(body)

    // Get existing template
    const [existingTemplate] = await db
        .select()
        .from(rotationTemplates)
        .where(eq(rotationTemplates.id, validatedData.id))
        .limit(1)

    if (!existingTemplate) {
        return createErrorResponse("Rotation template not found", HTTP_STATUS.NOT_FOUND)
    }

    // Verify ownership
    if (existingTemplate.schoolId !== context.schoolId && context.userRole !== "SUPER_ADMIN") {
        return createErrorResponse("Access denied to this template", HTTP_STATUS.FORBIDDEN)
    }

    // Build update object
    const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
    }

    if (validatedData.name !== undefined) updateData.name = validatedData.name
    if (validatedData.description !== undefined) updateData.description = validatedData.description
    if (validatedData.specialty !== undefined) updateData.specialty = validatedData.specialty
    if (validatedData.defaultDurationWeeks !== undefined) updateData.defaultDurationWeeks = validatedData.defaultDurationWeeks
    if (validatedData.defaultRequiredHours !== undefined) updateData.defaultRequiredHours = validatedData.defaultRequiredHours
    if (validatedData.defaultClinicalSiteId !== undefined) updateData.defaultClinicalSiteId = validatedData.defaultClinicalSiteId
    if (validatedData.objectives !== undefined) updateData.objectives = JSON.stringify(validatedData.objectives)
    if (validatedData.isActive !== undefined) updateData.isActive = validatedData.isActive
    if (validatedData.sortOrder !== undefined) updateData.sortOrder = validatedData.sortOrder

    const [updatedTemplate] = await db
        .update(rotationTemplates)
        .set(updateData)
        .where(eq(rotationTemplates.id, validatedData.id))
        .returning()

    return createSuccessResponse(
        {
            ...updatedTemplate,
            objectives: updatedTemplate.objectives ? JSON.parse(updatedTemplate.objectives) : [],
        },
        "Rotation template updated successfully"
    )
})

// DELETE /api/rotation-templates - Delete a rotation template
export const DELETE = withErrorHandling(async (request: NextRequest) => {
    const context = await getSchoolContext()

    // Only admins can delete templates
    if (
        ![
            "SUPER_ADMIN" as UserRole,
            "SCHOOL_ADMIN" as UserRole,
        ].includes(context.userRole)
    ) {
        return createErrorResponse("Insufficient permissions", HTTP_STATUS.FORBIDDEN)
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
        return createErrorResponse("Template ID is required", HTTP_STATUS.BAD_REQUEST)
    }

    // Get existing template
    const [existingTemplate] = await db
        .select()
        .from(rotationTemplates)
        .where(eq(rotationTemplates.id, id))
        .limit(1)

    if (!existingTemplate) {
        return createErrorResponse("Rotation template not found", HTTP_STATUS.NOT_FOUND)
    }

    // Verify ownership
    if (existingTemplate.schoolId !== context.schoolId && context.userRole !== "SUPER_ADMIN") {
        return createErrorResponse("Access denied to this template", HTTP_STATUS.FORBIDDEN)
    }

    await db.delete(rotationTemplates).where(eq(rotationTemplates.id, id))

    return createSuccessResponse({ id }, "Rotation template deleted successfully")
})
