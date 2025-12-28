import { eq, and } from "drizzle-orm"
import { db } from "@/database/connection-pool"
import { competencyAssignments, competencies, users } from "@/database/schema"
import { requireAnyRole } from "@/lib/auth-clerk"
import { SkillsClient, type SkillValidation, type SkillLibraryItem } from "./skills-client"

export default async function SkillsPage() {
  const user = await requireAnyRole(["CLINICAL_SUPERVISOR"], "/dashboard")

  // Fetch skill validations (competency assignments) for students under this supervisor
  // We join competencyAssignments with competencies and users to get full data
  const assignments = await db
    .select({
      id: competencyAssignments.id,
      status: competencyAssignments.status,
      notes: competencyAssignments.notes,
      dueDate: competencyAssignments.dueDate,
      completionDate: competencyAssignments.completionDate,
      createdAt: competencyAssignments.createdAt,
      progressPercentage: competencyAssignments.progressPercentage,
      competencyId: competencies.id,
      competencyName: competencies.name,
      competencyCategory: competencies.category,
      competencyDescription: competencies.description,
      studentId: users.id,
      studentName: users.name,
    })
    .from(competencyAssignments)
    .innerJoin(competencies, eq(competencyAssignments.competencyId, competencies.id))
    .innerJoin(users, eq(competencyAssignments.userId, users.id))
    .where(eq(users.role, "STUDENT"))
    .limit(100)

  // Map database results to SkillValidation interface
  const skillsValidations: SkillValidation[] = assignments.map((a) => {
    // Map database status to UI status
    const statusMap: Record<string, "validated" | "pending" | "in_progress" | "requires_improvement"> = {
      COMPLETED: "validated",
      ASSIGNED: "pending",
      IN_PROGRESS: "in_progress",
      OVERDUE: "requires_improvement",
    }

    return {
      id: a.id,
      skill: a.competencyName || "Unknown Skill",
      student: {
        id: a.studentId || "",
        name: a.studentName || "Unknown Student",
      },
      status: statusMap[a.status] || "pending",
      category: a.competencyCategory || "General",
      level: "Intermediate" as const, // Default level
      date: a.createdAt?.toISOString().split("T")[0] || new Date().toISOString().split("T")[0],
      score: a.progressPercentage ? parseFloat(a.progressPercentage) : undefined,
      attempts: 1,
      maxAttempts: 3,
      validatedAt: a.completionDate?.toISOString().split("T")[0],
      validatedBy: a.status === "COMPLETED" ? "Supervisor" : undefined,
      evidence: [],
      notes: a.notes || undefined,
    }
  })

  // Fetch skills library (competencies available for the school)
  const schoolId = "schoolId" in user && user.schoolId ? user.schoolId : null

  const competencyList = schoolId
    ? await db
      .select({
        id: competencies.id,
        name: competencies.name,
        category: competencies.category,
        description: competencies.description,
        isRequired: competencies.isRequired,
      })
      .from(competencies)
      .where(eq(competencies.schoolId, schoolId))
      .limit(50)
    : []

  // Map to SkillLibraryItem interface
  const skillsLibrary: SkillLibraryItem[] = competencyList.map((c) => ({
    id: c.id,
    name: c.name || "Unnamed Competency",
    category: c.category || "General",
    level: c.isRequired ? "Advanced" as const : "Intermediate" as const,
    description: c.description || "No description available",
    requirements: [],
    validationMethod: "Direct observation",
    requiredAttempts: 2,
    revalidationPeriod: "6 months",
    criteria: [],
  }))

  return <SkillsClient skillsValidations={skillsValidations} skillsLibrary={skillsLibrary} />
}
