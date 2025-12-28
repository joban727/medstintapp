import { eq, inArray, count, aliasedTable } from "drizzle-orm"
import { SchoolRotationsClient } from "../../../../components/dashboard/school-rotations-client"
import { db } from "@/database/connection-pool"
import { rotations, users, clinicalSites, siteAssignments, cohorts } from "../../../../database/schema"
import { requireAnyRole } from "../../../../lib/auth-clerk"

export default async function SchoolRotationsPage() {
  const user = await requireAnyRole(["SCHOOL_ADMIN"], "/dashboard")

  // Fetch rotations for students from the same school
  const userSchoolId = "schoolId" in user ? user.schoolId : null

  const preceptors = aliasedTable(users, "preceptors")

  const schoolRotations = userSchoolId
    ? await db
      .select({
        id: rotations.id,
        title: rotations.specialty,
        startDate: rotations.startDate,
        endDate: rotations.endDate,
        status: rotations.status,
        studentId: rotations.studentId,
        preceptorId: rotations.preceptorId,
        clinicalSiteId: rotations.clinicalSiteId,
        studentName: users.name,
        studentEmail: users.email,
        cohortName: cohorts.name,
        siteName: clinicalSites.name,
        siteCapacity: clinicalSites.capacity,
        preceptorName: preceptors.name,
        completedHours: rotations.completedHours,
        requiredHours: rotations.requiredHours,
      })
      .from(rotations)
      .leftJoin(users, eq(rotations.studentId, users.id))
      .leftJoin(clinicalSites, eq(rotations.clinicalSiteId, clinicalSites.id))
      .leftJoin(preceptors, eq(rotations.preceptorId, preceptors.id))
      .leftJoin(cohorts, eq(users.cohortId, cohorts.id))
      .where(eq(users.schoolId, userSchoolId))
      .orderBy(rotations.startDate)
    : []

  // Build assignment counts per rotation using Drizzle aggregation
  const rotationIds = schoolRotations.map((r) => r.id).filter(Boolean)
  let assignmentCountByRotation: Record<string, number> = {}
  if (rotationIds.length > 0) {
    const assignmentCounts = await db
      .select({ rotationId: siteAssignments.rotationId, assignedCount: count(siteAssignments.id) })
      .from(siteAssignments)
      .where(inArray(siteAssignments.rotationId, rotationIds))
      .groupBy(siteAssignments.rotationId)

    assignmentCountByRotation = assignmentCounts.reduce(
      (acc, row) => {
        if (row.rotationId) acc[row.rotationId] = Number(row.assignedCount || 0)
        return acc
      },
      {} as Record<string, number>
    )
  }

  // Compose rotation details with real counts and clinical site info
  const rotationDetails = schoolRotations.map((rotation) => ({
    id: rotation.id,
    title: rotation.title,
    clinicalSiteId: rotation.clinicalSiteId,
    specialty: rotation.title,
    clinicalSite: rotation.siteName ?? "Unknown Site",
    preceptorName: rotation.preceptorName ?? "Unassigned",
    startDate: rotation.startDate ?? undefined,
    endDate: rotation.endDate ?? undefined,
    status: rotation.status as "SCHEDULED" | "ACTIVE" | "COMPLETED" | "CANCELLED",
    studentsAssigned: assignmentCountByRotation[rotation.id] ?? 0,
    maxStudents: rotation.siteCapacity ?? 0,
    attendanceRate:
      rotation.requiredHours && rotation.requiredHours > 0
        ? Math.round((rotation.completedHours / rotation.requiredHours) * 100)
        : 0,
    cohortName: rotation.cohortName ?? null,
  }))

  const statusCounts = {
    SCHEDULED: rotationDetails.filter((r) => r.status === "SCHEDULED").length,
    ACTIVE: rotationDetails.filter((r) => r.status === "ACTIVE").length,
    COMPLETED: rotationDetails.filter((r) => r.status === "COMPLETED").length,
    CANCELLED: rotationDetails.filter((r) => r.status === "CANCELLED").length,
  }

  return <SchoolRotationsClient rotationDetails={rotationDetails} statusCounts={statusCounts} />
}
