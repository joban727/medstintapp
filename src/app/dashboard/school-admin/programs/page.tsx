import { redirect } from "next/navigation"
import { ProgramsClient } from "@/components/dashboard/programs-client"
import { getCurrentUser } from "@/lib/auth-clerk"
import { getSchoolPrograms } from "@/lib/programs"

export default async function ProgramsPage() {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/auth/login")
  }

  // Get school ID from user
  const schoolId = user.schoolId

  // Fetch programs for this school if schoolId exists
  const programs = schoolId ? await getSchoolPrograms(schoolId) : []

  // Transform programs to include student count
  const programsWithStats = programs.map((program) => ({
    ...program,
    studentCount: program.stats?.totalStudents || 0,
    cohortCount: program.stats?.totalCohorts || 0,
  }))

  // Calculate stats
  const stats = {
    totalPrograms: programs.length,
    activePrograms: programs.filter((p) => p.isActive).length,
    totalStudents: programs.reduce((sum, p) => sum + (p.stats?.totalStudents || 0), 0),
    totalCohorts: programs.reduce((sum, p) => sum + (p.stats?.totalCohorts || 0), 0),
    avgStudentsPerProgram:
      programs.length > 0
        ? Math.round(
            programs.reduce((sum, p) => sum + (p.stats?.totalStudents || 0), 0) / programs.length
          )
        : 0,
  }

  // Pass schoolId or empty string - client will handle showing setup prompt if needed
  return (
    <ProgramsClient
      initialPrograms={programsWithStats}
      initialStats={stats}
      schoolId={schoolId || ""}
    />
  )
}
