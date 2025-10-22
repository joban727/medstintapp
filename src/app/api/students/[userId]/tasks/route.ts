import { auth } from "@clerk/nextjs/server"
import { and, eq, gte, lte, or } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { db } from "../../../../../database/connection-pool"
import { competencyAssignments, evaluations, users } from "../../../../../database/schema"

// GET /api/students/[userId]/tasks - Get upcoming tasks for a student
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId: currentUserId } = await auth()
    const { userId: studentId } = await params

    if (!currentUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "10")
    const days = Number.parseInt(searchParams.get("days") || "30") // Next 30 days by default

    // Check if current user can access this student's data
    const [currentUser] = await db
      .select({
        id: users.id,
        role: users.role,
        schoolId: users.schoolId,
      })
      .from(users)
      .where(eq(users.id, currentUserId))
      .limit(1)

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Students can only access their own data, others need appropriate permissions
    if (currentUser.role === "STUDENT" && currentUser.id !== studentId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const now = new Date()
    const futureDate = new Date()
    futureDate.setDate(now.getDate() + days)

    // Get upcoming competency assignments
    const competencyTasks = await db
      .select({
        id: competencyAssignments.id,
        title: competencyAssignments.notes,
        dueDate: competencyAssignments.dueDate,
        assignmentType: competencyAssignments.assignmentType,
        status: competencyAssignments.status,
        progress: competencyAssignments.progressPercentage,
      })
      .from(competencyAssignments)
      .where(
        and(
          eq(competencyAssignments.userId, studentId),
          or(
            eq(competencyAssignments.status, "ASSIGNED"),
            eq(competencyAssignments.status, "IN_PROGRESS")
          ),
          gte(competencyAssignments.dueDate, now),
          lte(competencyAssignments.dueDate, futureDate)
        )
      )
      .orderBy(competencyAssignments.dueDate)
      .limit(limit)

    // Get upcoming evaluations (using createdAt as proxy for due date since no scheduledDate field exists)
    const evaluationTasks = await db
      .select({
        id: evaluations.id,
        evaluationType: evaluations.type,
        dueDate: evaluations.createdAt,
      })
      .from(evaluations)
      .where(
        and(
          eq(evaluations.studentId, studentId),
          gte(evaluations.createdAt, now),
          lte(evaluations.createdAt, futureDate)
        )
      )
      .orderBy(evaluations.createdAt)
      .limit(limit)

    // Combine and sort all tasks
    const competencyTasksFormatted = competencyTasks.map((task) => ({
      id: task.id,
      title: task.title || "Competency Assignment",
      type: "competency" as const,
      dueDate: task.dueDate,
      priority: task.assignmentType || "MEDIUM",
      status: task.status,
      progress: task.progress,
    }))

    const evaluationTasksFormatted = evaluationTasks.map((task) => ({
      id: task.id,
      title: task.evaluationType || "Evaluation",
      type: "evaluation" as const,
      dueDate: task.dueDate,
      priority: "MEDIUM" as const,
      status: "PENDING" as const,
      progress: null,
    }))

    const allTasks = [...competencyTasksFormatted, ...evaluationTasksFormatted]
      .sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      })
      .slice(0, limit)

    return NextResponse.json({
      success: true,
      upcomingTasks: allTasks,
      total: allTasks.length,
    })
  } catch (error) {
    console.error("Error fetching student tasks:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
