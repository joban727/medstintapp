import { eq } from "drizzle-orm"
import { CohortRotationsClient } from "@/components/dashboard/cohort-rotations-client"
import { db } from "@/database/connection-pool"
import {
  cohortRotationAssignments,
  rotationTemplates,
  cohorts,
  programs,
  clinicalSites,
  users,
} from "@/database/schema"
import { requireAnyRole } from "@/lib/auth-clerk"
import { count, and } from "drizzle-orm"

export default async function CohortRotationsPage() {
  const user = await requireAnyRole(["SCHOOL_ADMIN"], "/dashboard")

  const schoolId = "schoolId" in user ? user.schoolId : null

  // If no schoolId, show empty state instead of redirecting
  if (!schoolId) {
    return (
      <CohortRotationsClient
        assignments={[]}
        cohorts={[]}
        templates={[]}
        clinicalSites={[]}
        stats={{
          totalAssignments: 0,
          draftAssignments: 0,
          publishedAssignments: 0,
          completedAssignments: 0,
        }}
        schoolId=""
      />
    )
  }

  // Fetch cohort rotation assignments for this school
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
      createdAt: cohortRotationAssignments.createdAt,
      cohortName: cohorts.name,
      cohortGraduationYear: cohorts.graduationYear,
      templateName: rotationTemplates.name,
      templateSpecialty: rotationTemplates.specialty,
      clinicalSiteName: clinicalSites.name,
      programName: programs.name,
    })
    .from(cohortRotationAssignments)
    .leftJoin(cohorts, eq(cohortRotationAssignments.cohortId, cohorts.id))
    .leftJoin(
      rotationTemplates,
      eq(cohortRotationAssignments.rotationTemplateId, rotationTemplates.id)
    )
    .leftJoin(clinicalSites, eq(cohortRotationAssignments.clinicalSiteId, clinicalSites.id))
    .leftJoin(programs, eq(cohorts.programId, programs.id))
    .where(eq(rotationTemplates.schoolId, schoolId))
    .orderBy(cohortRotationAssignments.startDate)

  // Fetch cohorts for this school
  const schoolCohorts = await db
    .select({
      id: cohorts.id,
      name: cohorts.name,
      programId: cohorts.programId,
      graduationYear: cohorts.graduationYear,
      startDate: cohorts.startDate,
      endDate: cohorts.endDate,
      capacity: cohorts.capacity,
      programName: programs.name,
    })
    .from(cohorts)
    .leftJoin(programs, eq(cohorts.programId, programs.id))
    .where(eq(programs.schoolId, schoolId))
    .orderBy(cohorts.name)

  // Fetch active rotation templates for this school
  const templates = await db
    .select({
      id: rotationTemplates.id,
      name: rotationTemplates.name,
      specialty: rotationTemplates.specialty,
      defaultDurationWeeks: rotationTemplates.defaultDurationWeeks,
      defaultRequiredHours: rotationTemplates.defaultRequiredHours,
      defaultClinicalSiteId: rotationTemplates.defaultClinicalSiteId,
      programId: rotationTemplates.programId,
    })
    .from(rotationTemplates)
    .where(and(eq(rotationTemplates.schoolId, schoolId), eq(rotationTemplates.isActive, true)))
    .orderBy(rotationTemplates.name)

  // Fetch clinical sites for this school
  const sites = await db
    .select({
      id: clinicalSites.id,
      name: clinicalSites.name,
    })
    .from(clinicalSites)
    .where(eq(clinicalSites.schoolId, schoolId))
    .orderBy(clinicalSites.name)

  // Get student counts per cohort
  const studentCounts = await db
    .select({ cohortId: users.cohortId, count: count(users.id) })
    .from(users)
    .where(and(eq(users.role, "STUDENT"), eq(users.isActive, true)))
    .groupBy(users.cohortId)

  const studentCountMap = studentCounts.reduce(
    (acc, row) => {
      if (row.cohortId) acc[row.cohortId] = Number(row.count)
      return acc
    },
    {} as Record<string, number>
  )

  // Add student count to cohorts
  const cohortsWithCounts = schoolCohorts.map((cohort) => ({
    ...cohort,
    studentCount: studentCountMap[cohort.id] || 0,
  }))

  // Calculate stats
  const stats = {
    totalAssignments: assignments.length,
    draftAssignments: assignments.filter((a) => a.status === "DRAFT").length,
    publishedAssignments: assignments.filter((a) => a.status === "PUBLISHED").length,
    completedAssignments: assignments.filter((a) => a.status === "COMPLETED").length,
  }

  return (
    <CohortRotationsClient
      assignments={assignments}
      cohorts={cohortsWithCounts}
      templates={templates}
      clinicalSites={sites}
      stats={stats}
      schoolId={schoolId}
    />
  )
}
