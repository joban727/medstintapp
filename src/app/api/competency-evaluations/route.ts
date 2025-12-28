import { auth } from "@clerk/nextjs/server"
import { and, desc, eq } from "drizzle-orm"
import { nanoid } from "nanoid"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "../../../database/connection-pool"
import {
    competencyAssignments,
    evaluations,
    rotations,
    users,
} from "../../../database/schema"
import {
    canSubmitCompetencies,
    createAuditLog,
    updateAssignmentProgress,
    validateSubmissionTarget,
} from "../../../lib/competency-utils"

// Validation schema for the request body
const evaluationSubmissionSchema = z.object({
    assignmentId: z.string().min(1, "Assignment ID is required"),
    evaluatorId: z.string().min(1, "Evaluator ID is required"),
    criterionScores: z.record(z.string(), z.number().min(0).max(5)),
    overallScore: z.number().min(0).max(5),
    feedback: z.string().optional(),
    status: z.enum(["approved", "needs_revision", "incomplete"]),
    recommendations: z.string().optional(),
    evaluationDate: z.string().datetime().optional(),
})

export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth()
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Parse request body
        const body = await request.json()
        const validatedData = evaluationSubmissionSchema.parse(body)

        // Verify the evaluator matches the authenticated user (or is admin)
        // We'll trust the auth() userId for the actual operation, but check consistency
        if (userId !== validatedData.evaluatorId) {
            // Check if user is admin, otherwise forbid acting as another evaluator
            const [currentUser] = await db
                .select({ role: users.role })
                .from(users)
                .where(eq(users.id, userId))
                .limit(1)

            const isSuperAdmin = currentUser?.role === "SUPER_ADMIN"
            const isSchoolAdmin = currentUser?.role === "SCHOOL_ADMIN"

            if (!isSuperAdmin && !isSchoolAdmin) {
                return NextResponse.json({ error: "Forbidden: Cannot submit as another user" }, { status: 403 })
            }
        }

        // Get user details for permission check
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1)

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 })
        }

        if (!canSubmitCompetencies(user.role || "")) {
            return NextResponse.json(
                { error: "Insufficient permissions to submit evaluations" },
                { status: 403 }
            )
        }

        // Fetch the assignment to get student ID and other details
        const [assignment] = await db
            .select()
            .from(competencyAssignments)
            .where(eq(competencyAssignments.id, validatedData.assignmentId))
            .limit(1)

        if (!assignment) {
            return NextResponse.json({ error: "Assignment not found" }, { status: 404 })
        }

        // Validate submission target
        if (!validateSubmissionTarget(userId, assignment.userId, user.role || "")) {
            return NextResponse.json(
                { error: "Invalid submission target" },
                { status: 403 }
            )
        }

        // Fetch the latest active rotation for the student
        // We need a rotationId for the evaluations table constraint
        const [latestRotation] = await db
            .select()
            .from(rotations)
            .where(eq(rotations.studentId, assignment.userId))
            .orderBy(desc(rotations.startDate))
            .limit(1)

        if (!latestRotation) {
            return NextResponse.json(
                { error: "Student must be assigned to a rotation to receive evaluations" },
                { status: 400 }
            )
        }

        // Prepare evaluation data
        const evaluationId = nanoid()
        const now = new Date()
        const evaluationDate = validatedData.evaluationDate
            ? new Date(validatedData.evaluationDate)
            : now

        // Map status to something meaningful if needed, or just store it in metadata/comments
        // The evaluations table has 'type', 'overallRating', etc.

        // Insert the evaluation
        await db.insert(evaluations).values({
            id: evaluationId,
            assignmentId: validatedData.assignmentId,
            studentId: assignment.userId,
            rotationId: latestRotation.id,
            evaluatorId: userId,
            type: "FINAL", // Defaulting to FINAL for competency sign-off, or could be inferred
            observationDate: evaluationDate,
            feedback: validatedData.feedback,
            overallRating: validatedData.overallScore.toString(),
            criteria: JSON.stringify(validatedData.criterionScores),
            clinicalSkills: validatedData.overallScore.toString(), // Mapping overall to specific skills for now as fallback
            communication: validatedData.overallScore.toString(),
            professionalism: validatedData.overallScore.toString(),
            criticalThinking: validatedData.overallScore.toString(),
            strengths: validatedData.recommendations, // Mapping recommendations to strengths/areas if needed, or just storing
            comments: validatedData.recommendations,
            createdAt: now,
            updatedAt: now,
        })

        // Update assignment progress
        // We map the form status to the updateAssignmentProgress status
        let progressStatus: "submitted" | "completed" | "reviewed" = "submitted"
        if (validatedData.status === "approved") {
            progressStatus = "completed"
        }

        await updateAssignmentProgress(
            assignment.userId,
            assignment.competencyId,
            progressStatus
        )

        // Create audit log
        await createAuditLog({
            userId: userId,
            action: "SUBMIT_EVALUATION",
            resourceId: evaluationId,
            details: `Submitted evaluation for assignment ${validatedData.assignmentId}`,
            metadata: {
                studentId: assignment.userId,
                competencyId: assignment.competencyId,
                score: validatedData.overallScore,
                status: validatedData.status,
            },
        })

        return NextResponse.json({
            success: true,
            message: "Evaluation submitted successfully",
            evaluationId: evaluationId,
        })
    } catch (error) {
        console.error("Error submitting evaluation:", error)
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: "Validation error", details: (error as any).errors },
                { status: 400 }
            )
        }
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}
