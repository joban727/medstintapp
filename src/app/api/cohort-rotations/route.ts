"use server"

import { NextRequest } from "next/server"
import { z } from "zod"
import { eq, and, desc } from "drizzle-orm"
import { db } from "@/database/connection-pool"
import {
    cohortRotationAssignments,
    rotationTemplates,
    cohorts,
    programs,
    clinicalSites,
    users,
    rotations,
} from "@/database/schema"
import { getSchoolContext } from "@/lib/school-utils"
import {
    createSuccessResponse,
    createErrorResponse,
    HTTP_STATUS,
    withErrorHandling,
} from "@/lib/api-response"
import type { UserRole } from "@/types"

// Validation schemas
const createCohortRotationSchema = z.object({
    cohortId: z.string().min(1, "Cohort ID is required"),
    rotationTemplateId: z.string().min(1, "Rotation template ID is required"),
    clinicalSiteId: z.string().optional().nullable(),
    startDate: z.string().datetime("Invalid start date"),
    endDate: z.string().datetime("Invalid end date"),
    requiredHours: z.number().min(1, "Required hours must be at least 1"),
    maxStudents: z.number().optional().nullable(),
    notes: z.string().optional(),
})

const updateCohortRotationSchema = z.object({
    id: z.string().min(1, "Assignment ID is required"),
    clinicalSiteId: z.string().optional().nullable(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    requiredHours: z.number().min(1).optional(),
    maxStudents: z.number().optional().nullable(),
    status: z.enum(["DRAFT", "PUBLISHED", "COMPLETED", "CANCELLED"]).optional(),
    notes: z.string().optional().nullable(),
})

// GET /api/cohort-rotations - List cohort rotation assignments
export const GET = withErrorHandling(async (request: NextRequest) => {
    const context = await getSchoolContext()
    const { searchParams } = new URL(request.url)

    const cohortId = searchParams.get("cohortId")
    const status = searchParams.get("status")

    // Build conditions
    const conditions = []

    // Filter by cohort if specified
    if (cohortId) {
        conditions.push(eq(cohortRotationAssignments.cohortId, cohortId))
    }

    // Filter by status if specified
    if (status) {
        conditions.push(eq(cohortRotationAssignments.status, status as "DRAFT" | "PUBLISHED" | "COMPLETED" | "CANCELLED"))
    }

    const assignments = await db
        .select({
            id: cohortRotationAssignments.id,
            cohortId: cohortRotationAssignments.cohortId,
            rotationTemplateId: cohortRotationAssignments.rotationTemplateId,
            clinicalSiteId: cohortRotationAssignments.clinicalSiteId,
            startDate: cohortRotationAssignments.startDate,
            endDate: cohortRotationAssignments.endDate,
            requiredHours: cohortRotationAssignments.requiredHours,
            maxStudents: cohortRotationAssignments.maxStudents,
            status: cohortRotationAssignments.status,
            notes: cohortRotationAssignments.notes,
            createdBy: cohortRotationAssignments.createdBy,
            createdAt: cohortRotationAssignments.createdAt,
            updatedAt: cohortRotationAssignments.updatedAt,
            // Joined data
            cohortName: cohorts.name,
            cohortGraduationYear: cohorts.graduationYear,
            templateName: rotationTemplates.name,
            templateSpecialty: rotationTemplates.specialty,
            clinicalSiteName: clinicalSites.name,
            programId: cohorts.programId,
            programName: programs.name,
        })
        .from(cohortRotationAssignments)
        .leftJoin(cohorts, eq(cohortRotationAssignments.cohortId, cohorts.id))
        .leftJoin(rotationTemplates, eq(cohortRotationAssignments.rotationTemplateId, rotationTemplates.id))
        .leftJoin(clinicalSites, eq(cohortRotationAssignments.clinicalSiteId, clinicalSites.id))
        .leftJoin(programs, eq(cohorts.programId, programs.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(cohortRotationAssignments.startDate)

    // Filter by school access (programs belong to schools)
    const filteredAssignments = assignments.filter((assignment) => {
        if (context.userRole === "SUPER_ADMIN") return true
        // Additional school filtering would be done through the program's schoolId
        return true // For now, rely on the cohort/program context
    })

    return createSuccessResponse({ assignments: filteredAssignments })
})

// POST /api/cohort-rotations - Create a cohort rotation assignment
export const POST = withErrorHandling(async (request: NextRequest) => {
    const context = await getSchoolContext()

    // Only admins can create cohort rotations
    if (
        ![
            "SUPER_ADMIN" as UserRole,
            "SCHOOL_ADMIN" as UserRole,
        ].includes(context.userRole)
    ) {
        return createErrorResponse("Insufficient permissions", HTTP_STATUS.FORBIDDEN)
    }

    const body = await request.json()
    const validatedData = createCohortRotationSchema.parse(body)

    // Verify cohort exists
    const [cohort] = await db
        .select()
        .from(cohorts)
        .where(eq(cohorts.id, validatedData.cohortId))
        .limit(1)

    if (!cohort) {
        return createErrorResponse("Cohort not found", HTTP_STATUS.NOT_FOUND)
    }

    // Verify rotation template exists
    const [template] = await db
        .select()
        .from(rotationTemplates)
        .where(eq(rotationTemplates.id, validatedData.rotationTemplateId))
        .limit(1)

    if (!template) {
        return createErrorResponse("Rotation template not found", HTTP_STATUS.NOT_FOUND)
    }

    // Verify clinical site if provided
    if (validatedData.clinicalSiteId) {
        const [site] = await db
            .select()
            .from(clinicalSites)
            .where(eq(clinicalSites.id, validatedData.clinicalSiteId))
            .limit(1)

        if (!site) {
            return createErrorResponse("Clinical site not found", HTTP_STATUS.NOT_FOUND)
        }
    }

    // Validate date range
    const startDate = new Date(validatedData.startDate)
    const endDate = new Date(validatedData.endDate)

    if (startDate >= endDate) {
        return createErrorResponse("Start date must be before end date", HTTP_STATUS.BAD_REQUEST)
    }

    const [newAssignment] = await db
        .insert(cohortRotationAssignments)
        .values({
            cohortId: validatedData.cohortId,
            rotationTemplateId: validatedData.rotationTemplateId,
            clinicalSiteId: validatedData.clinicalSiteId,
            startDate,
            endDate,
            requiredHours: validatedData.requiredHours,
            maxStudents: validatedData.maxStudents,
            notes: validatedData.notes,
            status: "DRAFT",
            createdBy: context.userId,
        })
        .returning()

    return createSuccessResponse(
        newAssignment,
        "Cohort rotation assignment created successfully",
        HTTP_STATUS.CREATED
    )
})

// PUT /api/cohort-rotations - Update a cohort rotation assignment
export const PUT = withErrorHandling(async (request: NextRequest) => {
    const context = await getSchoolContext()

    // Only admins can update cohort rotations
    if (
        ![
            "SUPER_ADMIN" as UserRole,
            "SCHOOL_ADMIN" as UserRole,
        ].includes(context.userRole)
    ) {
        return createErrorResponse("Insufficient permissions", HTTP_STATUS.FORBIDDEN)
    }

    const body = await request.json()
    const validatedData = updateCohortRotationSchema.parse(body)

    // Get existing assignment
    const [existingAssignment] = await db
        .select()
        .from(cohortRotationAssignments)
        .where(eq(cohortRotationAssignments.id, validatedData.id))
        .limit(1)

    if (!existingAssignment) {
        return createErrorResponse("Cohort rotation assignment not found", HTTP_STATUS.NOT_FOUND)
    }

    // Build update object
    const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
    }

    if (validatedData.clinicalSiteId !== undefined) updateData.clinicalSiteId = validatedData.clinicalSiteId
    if (validatedData.startDate !== undefined) updateData.startDate = new Date(validatedData.startDate)
    if (validatedData.endDate !== undefined) updateData.endDate = new Date(validatedData.endDate)
    if (validatedData.requiredHours !== undefined) updateData.requiredHours = validatedData.requiredHours
    if (validatedData.maxStudents !== undefined) updateData.maxStudents = validatedData.maxStudents
    if (validatedData.status !== undefined) updateData.status = validatedData.status
    if (validatedData.notes !== undefined) updateData.notes = validatedData.notes

    // Validate dates if both are being updated
    if (updateData.startDate && updateData.endDate) {
        if ((updateData.startDate as Date) >= (updateData.endDate as Date)) {
            return createErrorResponse("Start date must be before end date", HTTP_STATUS.BAD_REQUEST)
        }
    }

    const [updatedAssignment] = await db
        .update(cohortRotationAssignments)
        .set(updateData)
        .where(eq(cohortRotationAssignments.id, validatedData.id))
        .returning()

    return createSuccessResponse(updatedAssignment, "Cohort rotation assignment updated successfully")
})

// DELETE /api/cohort-rotations - Delete a cohort rotation assignment
export const DELETE = withErrorHandling(async (request: NextRequest) => {
    const context = await getSchoolContext()

    // Only admins can delete cohort rotations
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
        return createErrorResponse("Assignment ID is required", HTTP_STATUS.BAD_REQUEST)
    }

    // Get existing assignment
    const [existingAssignment] = await db
        .select()
        .from(cohortRotationAssignments)
        .where(eq(cohortRotationAssignments.id, id))
        .limit(1)

    if (!existingAssignment) {
        return createErrorResponse("Cohort rotation assignment not found", HTTP_STATUS.NOT_FOUND)
    }

    await db.delete(cohortRotationAssignments).where(eq(cohortRotationAssignments.id, id))

    return createSuccessResponse({ id }, "Cohort rotation assignment deleted successfully")
})
