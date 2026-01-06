import { redirect } from "next/navigation"
import { eq, and, asc, desc } from "drizzle-orm"
import { db } from "@/database/connection-pool"
import {
  rotations,
  rotationTemplates,
  clinicalSites,
  cohortRotationAssignments,
  programs,
} from "@/database/schema"
import { requireAnyRole } from "@/lib/auth-clerk"
import { StudentRotationsClient } from "@/components/dashboard/student-rotations-client"

export default async function StudentRotationsPage() {
  const user = await requireAnyRole(["STUDENT"], "/dashboard")

  // Fetch all rotations for the student
  const studentRotations = await db
    .select({
      id: rotations.id,
      status: rotations.status,
      startDate: rotations.startDate,
      endDate: rotations.endDate,
      completedHours: rotations.completedHours,
      targetHours: rotations.requiredHours,
      clinicalSiteId: rotations.clinicalSiteId,
      clinicalSiteName: clinicalSites.name,
      clinicalSiteAddress: clinicalSites.address,
      templateName: rotationTemplates.name,
      specialty: rotationTemplates.specialty,
      programName: programs.name,
      assignmentStatus: cohortRotationAssignments.status,
    })
    .from(rotations)
    .leftJoin(clinicalSites, eq(rotations.clinicalSiteId, clinicalSites.id))
    .leftJoin(rotationTemplates, eq(rotations.rotationTemplateId, rotationTemplates.id))
    .leftJoin(
      cohortRotationAssignments,
      eq(rotations.cohortRotationAssignmentId, cohortRotationAssignments.id)
    )
    .leftJoin(programs, eq(rotations.programId, programs.id))
    .where(eq(rotations.studentId, user.id))
    .orderBy(asc(rotations.startDate))

  return <StudentRotationsClient rotations={studentRotations} />
}
