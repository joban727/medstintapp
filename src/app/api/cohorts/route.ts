import { NextRequest, NextResponse } from "next/server"
import { db } from "@/database/db"
import { cohorts, programs, users } from "@/database/schema"
import { eq, and, count } from "drizzle-orm"
import { getSchoolContext } from "@/lib/school-utils"
import {
  createSuccessResponse,
  createErrorResponse,
  HTTP_STATUS,
  withErrorHandling,
} from "@/lib/api-response"

export const GET = withErrorHandling(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const programId = searchParams.get("programId")

  const context = await getSchoolContext()

  // Build query conditions
  const conditions = []

  if (programId) {
    conditions.push(eq(cohorts.programId, programId))
  }

  // If filtered by program, we should ensure the program belongs to the user's school
  if (programId && context.schoolId) {
    const [program] = await db.select().from(programs).where(eq(programs.id, programId)).limit(1)
    if (program && program.schoolId !== context.schoolId && context.userRole !== "SUPER_ADMIN") {
      return createErrorResponse("Access denied to this program", HTTP_STATUS.FORBIDDEN)
    }
  }

  // If no programId is provided, we should filter by school indirectly?
  // Cohorts are linked to programs, programs are linked to schools.
  // It's expensive to join all.
  // For now, we expect programId to be provided or we list all for the school if possible.
  // Let's support listing all cohorts for the school if no programId is provided.

  let cohortList

  if (programId) {
    cohortList = await db
      .select()
      .from(cohorts)
      .where(and(...conditions))
  } else if (context.schoolId) {
    // Join with programs to filter by school
    cohortList = await db
      .select({
        id: cohorts.id,
        name: cohorts.name,
        programId: cohorts.programId,
        startDate: cohorts.startDate,
        endDate: cohorts.endDate,
        graduationYear: cohorts.graduationYear,
        capacity: cohorts.capacity,
        status: cohorts.status,
        programName: programs.name,
      })
      .from(cohorts)
      .innerJoin(programs, eq(cohorts.programId, programs.id))
      .where(eq(programs.schoolId, context.schoolId))
  } else {
    return createErrorResponse("Program ID or School Context required", HTTP_STATUS.BAD_REQUEST)
  }

  // Get enrolled student counts for each cohort
  const cohortIds = cohortList.map((c: { id: string }) => c.id)
  let enrolledCounts: Record<string, number> = {}

  if (cohortIds.length > 0) {
    const studentCounts = await db
      .select({ cohortId: users.cohortId, count: count(users.id) })
      .from(users)
      .where(and(
        eq(users.role, "STUDENT"),
        eq(users.isActive, true)
      ))
      .groupBy(users.cohortId)

    enrolledCounts = studentCounts.reduce((acc, row) => {
      if (row.cohortId) acc[row.cohortId] = Number(row.count)
      return acc
    }, {} as Record<string, number>)
  }

  // Add enrolled count to each cohort
  const cohortsWithEnrollment = cohortList.map((cohort: { id: string; capacity?: number }) => ({
    ...cohort,
    enrolledCount: enrolledCounts[cohort.id] || 0,
    availableSlots: (cohort.capacity || 0) - (enrolledCounts[cohort.id] || 0),
  }))

  return createSuccessResponse({ cohorts: cohortsWithEnrollment })
})

export const POST = withErrorHandling(async (request: NextRequest) => {
  const body = await request.json()
  const { programId, name, startDate, endDate, capacity, description, graduationYear } = body
  const context = await getSchoolContext()

  if (!context.schoolId) {
    return createErrorResponse("School context required", HTTP_STATUS.BAD_REQUEST)
  }

  if (!programId || !name || !startDate || !endDate || !capacity) {
    return createErrorResponse("Missing required fields", HTTP_STATUS.BAD_REQUEST)
  }

  // Verify program belongs to school
  const [program] = await db.select().from(programs).where(eq(programs.id, programId)).limit(1)
  if (!program) {
    return createErrorResponse("Program not found", HTTP_STATUS.NOT_FOUND)
  }

  if (program.schoolId !== context.schoolId && context.userRole !== "SUPER_ADMIN") {
    return createErrorResponse("Access denied to this program", HTTP_STATUS.FORBIDDEN)
  }

  const newCohortId = crypto.randomUUID()

  // Auto-calculate graduation year from end date if not provided
  const endDateObj = new Date(endDate)
  const calculatedGraduationYear = graduationYear || endDateObj.getFullYear()

  await db.insert(cohorts).values({
    id: newCohortId,
    programId,
    name,
    startDate: new Date(startDate),
    endDate: endDateObj,
    graduationYear: calculatedGraduationYear,
    capacity: Number(capacity),
    description,
    status: "ACTIVE",
  })

  return createSuccessResponse({ id: newCohortId, name, graduationYear: calculatedGraduationYear }, "Cohort created successfully", HTTP_STATUS.CREATED)
})

