import { eq } from "drizzle-orm"
import { SchoolRotationsClient } from "../../../../components/dashboard/school-rotations-client"
import { db } from "../../../../database/db"
import { rotations, users } from "../../../../database/schema"
import { requireAnyRole } from "../../../../lib/auth-clerk"

export default async function SchoolRotationsPage() {
  const user = await requireAnyRole(["SCHOOL_ADMIN"], "/dashboard")

  // Fetch rotations for students from the same school
  const userSchoolId = "schoolId" in user ? user.schoolId : null

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
        })
        .from(rotations)
        .leftJoin(users, eq(rotations.studentId, users.id))
        .where(eq(users.schoolId, userSchoolId))
        .orderBy(rotations.startDate)
    : []

  // Mock additional data for comprehensive rotation management
  const rotationDetails = schoolRotations.map((rotation) => ({
    id: rotation.id,
    title: rotation.title,
    specialty: [
      "Internal Medicine",
      "Surgery",
      "Pediatrics",
      "Emergency Medicine",
      "Family Medicine",
      "Psychiatry",
    ][Math.floor(Math.random() * 6)],
    clinicalSite: [
      "General Hospital",
      "Medical Center",
      "Community Clinic",
      "Specialty Center",
      "Teaching Hospital",
    ][Math.floor(Math.random() * 5)],
    preceptorName: `Dr. ${["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia"][Math.floor(Math.random() * 6)]}`,
    startDate: rotation.startDate,
    endDate: rotation.endDate,
    status: rotation.status as "SCHEDULED" | "ACTIVE" | "COMPLETED" | "CANCELLED",
    studentsAssigned: Math.floor(Math.random() * 8) + 1, // 1-8 students
    maxStudents: Math.floor(Math.random() * 5) + 8, // 8-12 max students
    attendanceRate: Math.floor(Math.random() * 20) + 80, // 80-100%
  }))

  const statusCounts = {
    SCHEDULED: rotationDetails.filter((r) => r.status === "SCHEDULED").length,
    ACTIVE: rotationDetails.filter((r) => r.status === "ACTIVE").length,
    COMPLETED: rotationDetails.filter((r) => r.status === "COMPLETED").length,
    CANCELLED: rotationDetails.filter((r) => r.status === "CANCELLED").length,
  }

  return <SchoolRotationsClient rotationDetails={rotationDetails} statusCounts={statusCounts} />
}
