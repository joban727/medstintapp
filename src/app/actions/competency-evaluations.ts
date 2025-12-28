"use server"

import { db } from "@/database/connection-pool"
import { competencies, competencySubmissions, competencyAssignments } from "@/database/schema"
import { eq, and, desc } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { v4 as uuidv4 } from "uuid"
import { getCurrentUser } from "@/lib/auth-clerk"

const evaluationSchema = z.object({
    studentId: z.string().min(1, "Student ID is required"),
    competencyId: z.string().min(1, "Competency ID is required"),
    notes: z.string().optional(),
    feedback: z.string().optional(),
    status: z.enum(["APPROVED", "SUBMITTED", "REQUIRES_REVISION"]).default("APPROVED"),
})

export async function submitCompetencyEvaluation(data: z.infer<typeof evaluationSchema>) {
    try {
        const user = await getCurrentUser()
        if (!user) {
            return { success: false, error: "Unauthorized" }
        }

        // Validate that user can submit (preceptor, supervisor, or admin)
        const allowedRoles = ["CLINICAL_PRECEPTOR", "CLINICAL_SUPERVISOR", "SUPER_ADMIN", "SCHOOL_ADMIN"]
        if (!allowedRoles.includes(user.role || "")) {
            return { success: false, error: "You don't have permission to submit competency evaluations" }
        }

        // Prevent self-submission for non-admins
        if (!["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(user.role || "") && user.id === data.studentId) {
            return { success: false, error: "You cannot evaluate yourself" }
        }

        const validated = evaluationSchema.parse(data)

        // Check if there's already a submission for this student and competency
        const existingSubmission = await db
            .select()
            .from(competencySubmissions)
            .where(and(
                eq(competencySubmissions.studentId, validated.studentId),
                eq(competencySubmissions.competencyId, validated.competencyId),
                eq(competencySubmissions.status, "APPROVED")
            ))
            .limit(1)

        if (existingSubmission.length > 0) {
            return {
                success: false,
                error: "This competency has already been approved for this student"
            }
        }

        // Create the submission record
        const [submission] = await db.insert(competencySubmissions).values({
            id: uuidv4(),
            studentId: validated.studentId,
            competencyId: validated.competencyId,
            submittedBy: user.id,
            status: validated.status,
            notes: validated.notes,
            feedback: validated.feedback,
            submissionType: "INDIVIDUAL",
            submittedAt: new Date(),
        }).returning()

        revalidatePath("/dashboard/clinical-preceptor/competencies")
        revalidatePath("/dashboard/clinical-supervisor/competencies")

        return {
            success: true,
            data: submission,
            message: "Competency evaluation submitted successfully"
        }
    } catch (error) {
        console.error("Failed to submit competency evaluation:", error)
        return { success: false, error: "Failed to submit evaluation" }
    }
}

export async function getStudentCompetencyStatus(studentId: string, programId: string) {
    try {
        // Get all competencies for the program
        const programCompetencies = await db
            .select({
                id: competencies.id,
                name: competencies.name,
                description: competencies.description,
                category: competencies.category,
                level: competencies.level,
                isRequired: competencies.isRequired,
            })
            .from(competencies)
            .where(eq(competencies.programId, programId))
            .orderBy(competencies.category, competencies.name)

        // Get all submissions for this student
        const submissions = await db
            .select({
                competencyId: competencySubmissions.competencyId,
                status: competencySubmissions.status,
                submittedAt: competencySubmissions.submittedAt,
                feedback: competencySubmissions.feedback,
            })
            .from(competencySubmissions)
            .where(eq(competencySubmissions.studentId, studentId))

        // Create a map of competency status
        const submissionMap = new Map(
            submissions.map(s => [s.competencyId, s])
        )

        // Combine competencies with their status
        const competenciesWithStatus = programCompetencies.map(comp => ({
            ...comp,
            submission: submissionMap.get(comp.id) || null,
            isCompleted: submissionMap.get(comp.id)?.status === "APPROVED",
        }))

        const totalRequired = competenciesWithStatus.filter(c => c.isRequired).length
        const completedRequired = competenciesWithStatus.filter(c => c.isRequired && c.isCompleted).length

        return {
            success: true,
            data: {
                competencies: competenciesWithStatus,
                totalRequired,
                completedRequired,
                completionPercentage: totalRequired > 0
                    ? Math.round((completedRequired / totalRequired) * 100)
                    : 0
            }
        }
    } catch (error) {
        console.error("Failed to get student competency status:", error)
        return { success: false, error: "Failed to fetch competency status" }
    }
}
