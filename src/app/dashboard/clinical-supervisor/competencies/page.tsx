import { Suspense } from "react"
import { redirect } from "next/navigation"
import { PageContainer } from "@/components/ui/page-container"
import { requireAnyRole } from "@/lib/auth-clerk"
import { db } from "@/database/connection-pool"
import {
  competencies,
  competencySubmissions,
  rotations,
  users,
  students,
} from "@/database/schema"
import { eq, and, desc } from "drizzle-orm"
import { SupervisorCompetenciesClient } from "@/components/dashboard/supervisor-competencies-client"

export default async function ClinicalSupervisorCompetenciesPage() {
  const user = await requireAnyRole(["CLINICAL_SUPERVISOR"], "/dashboard")

  if (!user) {
    redirect("/auth/sign-in")
  }

  return (
    <PageContainer>
      <Suspense fallback={<CompetenciesLoadingSkeleton />}>
        <CompetenciesDataLoader userId={user.id} />
      </Suspense>
    </PageContainer>
  )
}

function CompetenciesLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-64 bg-muted animate-pulse rounded" />
      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
      <div className="h-96 bg-muted animate-pulse rounded-lg" />
    </div>
  )
}

async function CompetenciesDataLoader({ userId }: { userId: string }) {
  // Fetch students assigned to this supervisor via rotations
  const assignedStudentsData = await db
    .select({
      studentId: users.id,
      studentName: users.name,
      studentEmail: users.email,
      programId: students.programId,
      rotationId: rotations.id,
      specialty: rotations.specialty,
      status: rotations.status,
    })
    .from(rotations)
    .innerJoin(users, eq(rotations.studentId, users.id))
    .leftJoin(students, eq(students.userId, users.id))
    .where(eq(rotations.supervisorId, userId))

  // Get unique students with their program IDs
  const studentMap = new Map<string, {
    studentId: string
    name: string
    programId: string | null
  }>()

  for (const s of assignedStudentsData) {
    if (!studentMap.has(s.studentId)) {
      studentMap.set(s.studentId, {
        studentId: s.studentId,
        name: s.studentName || "Unknown Student",
        programId: s.programId,
      })
    }
  }

  const uniqueStudents = Array.from(studentMap.values())

  // For each student, get their program's competencies and their submission status
  const studentsWithData = await Promise.all(
    uniqueStudents.map(async (student) => {
      // Get program competencies
      let programCompetencies: Array<{
        id: string
        name: string
        description: string
        category: string
        level: string
        isRequired: boolean
      }> = []

      if (student.programId) {
        programCompetencies = await db
          .select({
            id: competencies.id,
            name: competencies.name,
            description: competencies.description,
            category: competencies.category,
            level: competencies.level,
            isRequired: competencies.isRequired,
          })
          .from(competencies)
          .where(eq(competencies.programId, student.programId))
          .orderBy(competencies.category, competencies.name)
      }

      // Get student's completed submissions
      const completedSubmissions = await db
        .select({
          competencyId: competencySubmissions.competencyId,
          status: competencySubmissions.status,
          submittedAt: competencySubmissions.submittedAt,
        })
        .from(competencySubmissions)
        .where(and(
          eq(competencySubmissions.studentId, student.studentId),
          eq(competencySubmissions.status, "APPROVED")
        ))

      const completedIds = new Set(completedSubmissions.map(s => s.competencyId))

      // Filter out already completed competencies for the modal
      const availableCompetencies = programCompetencies.filter(
        c => !completedIds.has(c.id)
      )

      // Build competency display data
      const competencyData = programCompetencies.map(comp => ({
        assignmentId: `${student.studentId}-${comp.id}`,
        studentId: student.studentId,
        studentName: student.name,
        competencyId: comp.id,
        competencyName: comp.name,
        competencyCategory: comp.category,
        competencyLevel: comp.level,
        status: completedIds.has(comp.id) ? "COMPLETED" : "ASSIGNED",
        progressPercentage: completedIds.has(comp.id) ? "100" : "0",
        dueDate: null,
      }))

      return {
        studentId: student.studentId,
        name: student.name,
        programId: student.programId,
        competencies: competencyData,
        completedCount: completedSubmissions.length,
        totalCount: programCompetencies.length,
        availableCompetencies,
      }
    })
  )

  // Calculate stats
  const totalAssignments = studentsWithData.reduce((sum, s) => sum + s.totalCount, 0)
  const completedAssignments = studentsWithData.reduce((sum, s) => sum + s.completedCount, 0)
  const inProgressAssignments = totalAssignments - completedAssignments

  return (
    <SupervisorCompetenciesClient
      students={studentsWithData}
      totalAssignments={totalAssignments}
      completedAssignments={completedAssignments}
      inProgressAssignments={inProgressAssignments}
    />
  )
}
