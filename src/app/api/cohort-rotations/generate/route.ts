"use server"

import { NextRequest } from "next/server"
import { z } from "zod"
import { eq, and } from "drizzle-orm"
import { db } from "@/database/connection-pool"
import {
  cohortRotationAssignments,
  rotationTemplates,
  cohorts,
  users,
  rotations,
  clinicalSites,
} from "@/database/schema"
import { getSchoolContext } from "@/lib/school-utils"
import {
  createSuccessResponse,
  createErrorResponse,
  HTTP_STATUS,
  withErrorHandling,
} from "@/lib/api-response"
import type { UserRole } from "@/types"

// Validation schema
const generateRotationsSchema = z.object({
  cohortRotationAssignmentId: z.string().min(1, "Cohort rotation assignment ID is required"),
  clinicalSiteId: z.string().optional(), // Optional override for default site
})

// POST /api/cohort-rotations/generate - Generate individual rotations for all students in a cohort
export const POST = withErrorHandling(async (request: NextRequest) => {
  const context = await getSchoolContext()

  // Only admins can generate rotations
  if (!["SUPER_ADMIN" as UserRole, "SCHOOL_ADMIN" as UserRole].includes(context.userRole)) {
    return createErrorResponse("Insufficient permissions", HTTP_STATUS.FORBIDDEN)
  }

  const body = await request.json()
  const validatedData = generateRotationsSchema.parse(body)

  // Get the cohort rotation assignment
  const [assignment] = await db
    .select()
    .from(cohortRotationAssignments)
    .where(eq(cohortRotationAssignments.id, validatedData.cohortRotationAssignmentId))
    .limit(1)

  if (!assignment) {
    return createErrorResponse("Cohort rotation assignment not found", HTTP_STATUS.NOT_FOUND)
  }

  // Get the cohort
  const [cohort] = await db
    .select()
    .from(cohorts)
    .where(eq(cohorts.id, assignment.cohortId))
    .limit(1)

  if (!cohort) {
    return createErrorResponse("Cohort not found", HTTP_STATUS.NOT_FOUND)
  }

  // Get the rotation template
  const [template] = await db
    .select()
    .from(rotationTemplates)
    .where(eq(rotationTemplates.id, assignment.rotationTemplateId))
    .limit(1)

  if (!template) {
    return createErrorResponse("Rotation template not found", HTTP_STATUS.NOT_FOUND)
  }

  // Determine which clinical site to use
  const clinicalSiteId =
    validatedData.clinicalSiteId || assignment.clinicalSiteId || template.defaultClinicalSiteId

  if (!clinicalSiteId) {
    return createErrorResponse(
      "No clinical site specified for this rotation",
      HTTP_STATUS.BAD_REQUEST
    )
  }

  // Verify clinical site exists
  const [site] = await db
    .select()
    .from(clinicalSites)
    .where(eq(clinicalSites.id, clinicalSiteId))
    .limit(1)

  if (!site) {
    return createErrorResponse("Clinical site not found", HTTP_STATUS.NOT_FOUND)
  }

  // Get all students in the cohort
  const studentsInCohort = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
    })
    .from(users)
    .where(and(eq(users.cohortId, cohort.id), eq(users.role, "STUDENT"), eq(users.isActive, true)))

  if (studentsInCohort.length === 0) {
    return createErrorResponse("No students found in this cohort", HTTP_STATUS.BAD_REQUEST)
  }

  // Check if there are existing rotations for these students with this assignment
  const existingRotations = await db
    .select({ studentId: rotations.studentId })
    .from(rotations)
    .where(eq(rotations.cohortRotationAssignmentId, assignment.id))

  const existingStudentIds = new Set(existingRotations.map((r) => r.studentId))

  // Filter out students who already have rotations for this assignment
  const studentsToAssign = studentsInCohort.filter((student) => !existingStudentIds.has(student.id))

  if (studentsToAssign.length === 0) {
    return createSuccessResponse(
      { created: 0, skipped: studentsInCohort.length },
      "All students already have rotations for this assignment"
    )
  }

  // Check capacity if maxStudents is set
  if (
    assignment.maxStudents &&
    existingRotations.length + studentsToAssign.length > assignment.maxStudents
  ) {
    const availableSlots = assignment.maxStudents - existingRotations.length
    return createErrorResponse(
      `Only ${availableSlots} slots available (max: ${assignment.maxStudents}). ${studentsToAssign.length} students need assignments.`,
      HTTP_STATUS.BAD_REQUEST
    )
  }

  // Generate rotations for each student
  const rotationsToCreate = studentsToAssign.map((student) => ({
    id: crypto.randomUUID(),
    studentId: student.id,
    clinicalSiteId,
    programId: cohort.programId,
    cohortId: cohort.id,
    cohortRotationAssignmentId: assignment.id,
    rotationTemplateId: template.id,
    specialty: template.specialty,
    startDate: assignment.startDate,
    endDate: assignment.endDate,
    requiredHours: assignment.requiredHours,
    completedHours: 0,
    status: "SCHEDULED" as const,
    objectives: template.objectives,
  }))

  // Insert all rotations
  await db.insert(rotations).values(rotationsToCreate)

  // Update the cohort rotation assignment status to PUBLISHED
  if (assignment.status === "DRAFT") {
    await db
      .update(cohortRotationAssignments)
      .set({ status: "PUBLISHED", updatedAt: new Date() })
      .where(eq(cohortRotationAssignments.id, assignment.id))
  }

  return createSuccessResponse(
    {
      created: rotationsToCreate.length,
      skipped: studentsInCohort.length - studentsToAssign.length,
      totalStudents: studentsInCohort.length,
      rotationIds: rotationsToCreate.map((r) => r.id),
    },
    `Generated ${rotationsToCreate.length} rotations for cohort "${cohort.name}"`
  )
})
