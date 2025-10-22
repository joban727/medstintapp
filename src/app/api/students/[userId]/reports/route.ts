import { auth } from "@clerk/nextjs/server"
import { and, desc, eq, gte, lte } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { db } from "../../../../../database/connection-pool"
import {
  competencyAssignments,
  evaluations,
  rotations,
  timeRecords,
  users,
} from "../../../../../database/schema"

type ReportData = {
  type: string
  period: { startDate: Date; endDate: Date }
  summary: Record<string, unknown>
} & (
  | { assignments: unknown[] }
  | { evaluations: unknown[] }
  | { rotations: unknown[] }
  | Record<string, unknown>
)

// GET /api/students/[userId]/reports - Get comprehensive reports for a student
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
    const reportType = searchParams.get("type") || "summary"
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    // Check if current user can access this student's data
    const [currentUser] = await db.select().from(users).where(eq(users.id, currentUserId)).limit(1)

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Students can only access their own data, others need appropriate permissions
    if (currentUser.role === "STUDENT" && currentUser.id !== studentId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Set default date range if not provided (last 90 days)
    const defaultEndDate = new Date()
    const defaultStartDate = new Date()
    defaultStartDate.setDate(defaultEndDate.getDate() - 90)

    const queryStartDate = startDate ? new Date(startDate) : defaultStartDate
    const queryEndDate = endDate ? new Date(endDate) : defaultEndDate

    let reportData: ReportData

    switch (reportType) {
      case "competency": {
        // Detailed competency report
        const competencyReport = await db
          .select({
            assignmentId: competencyAssignments.id,
            competencyName: competencies.name,
            competencyCategory: competencies.category,
            competencyDescription: competencies.description,
            status: competencyAssignments.status,
            assignedDate: competencyAssignments.createdAt,
            dueDate: competencyAssignments.dueDate,
            completedDate: competencyAssignments.updatedAt,
            notes: competencyAssignments.notes,
          })
          .from(competencyAssignments)
          .leftJoin(competencies, eq(competencyAssignments.competencyId, competencies.id))
          .where(
            and(
              eq(competencyAssignments.userId, studentId),
              gte(competencyAssignments.createdAt, queryStartDate),
              lte(competencyAssignments.createdAt, queryEndDate)
            )
          )
          .orderBy(desc(competencyAssignments.createdAt))

        reportData = {
          type: "competency",
          period: { startDate: queryStartDate, endDate: queryEndDate },
          assignments: competencyReport,
          summary: {
            total: competencyReport.length,
            completed: competencyReport.filter((a) => a.status === "COMPLETED").length,
            inProgress: competencyReport.filter((a) => a.status === "IN_PROGRESS").length,
            assigned: competencyReport.filter((a) => a.status === "ASSIGNED").length,
          },
        }
        break
      }

      case "evaluation": {
        // Detailed evaluation report
        const evaluationReport = await db
          .select({
            id: evaluations.id,
            type: evaluations.type,
            rotationId: evaluations.rotationId,
            evaluatorId: evaluations.evaluatorId,
            createdAt: evaluations.createdAt,
            updatedAt: evaluations.updatedAt,
            studentSignature: evaluations.studentSignature,
            evaluatorSignature: evaluations.evaluatorSignature,
            overallRating: evaluations.overallRating,
            comments: evaluations.comments,
          })
          .from(evaluations)
          .where(
            and(
              eq(evaluations.studentId, studentId),
              gte(evaluations.createdAt, queryStartDate),
              lte(evaluations.createdAt, queryEndDate)
            )
          )
          .orderBy(desc(evaluations.createdAt))

        reportData = {
          type: "evaluation",
          period: { startDate: queryStartDate, endDate: queryEndDate },
          evaluations: evaluationReport.map((evaluation) => ({
            ...evaluation,
            status:
              evaluation.studentSignature && evaluation.evaluatorSignature
                ? "COMPLETED"
                : evaluation.studentSignature || evaluation.evaluatorSignature
                  ? "PARTIAL"
                  : "PENDING",
          })),
          summary: {
            total: evaluationReport.length,
            completed: evaluationReport.filter((e) => e.studentSignature && e.evaluatorSignature)
              .length,
            partial: evaluationReport.filter(
              (e) =>
                (e.studentSignature || e.evaluatorSignature) &&
                !(e.studentSignature && e.evaluatorSignature)
            ).length,
            pending: evaluationReport.filter((e) => !e.studentSignature && !e.evaluatorSignature)
              .length,
            averageRating:
              evaluationReport.length > 0
                ? evaluationReport.reduce((sum, e) => sum + (Number(e.overallRating) || 0), 0) /
                  evaluationReport.length
                : 0,
          },
        }
        break
      }

      case "rotation": {
        // Detailed rotation report
        const rotationReport = await db
          .select({
            id: rotations.id,
            specialty: rotations.specialty,
            supervisorId: rotations.supervisorId,
            startDate: rotations.startDate,
            endDate: rotations.endDate,
            status: rotations.status,
            objectives: rotations.objectives,
            createdAt: rotations.createdAt,
          })
          .from(rotations)
          .where(
            and(
              eq(rotations.studentId, studentId),
              gte(rotations.startDate, queryStartDate),
              lte(rotations.endDate, queryEndDate)
            )
          )
          .orderBy(desc(rotations.startDate))

        reportData = {
          type: "rotation",
          period: { startDate: queryStartDate, endDate: queryEndDate },
          rotations: rotationReport as unknown[],
          summary: {
            total: rotationReport.length,
            completed: rotationReport.filter((r) => r.status === "COMPLETED").length,
            active: rotationReport.filter((r) => r.status === "ACTIVE").length,
            upcoming: rotationReport.filter((r) => r.status === "SCHEDULED").length,
            specialties: [...new Set(rotationReport.map((r) => r.specialty))],
          },
        }
        break
      }

      default: {
        // Summary report with all data types
        const [competencySummary, evaluationSummary, rotationSummary] = await Promise.all([
          db
            .select({ count: count() })
            .from(competencyAssignments)
            .where(
              and(
                eq(competencyAssignments.userId, studentId),
                gte(competencyAssignments.createdAt, queryStartDate),
                lte(competencyAssignments.createdAt, queryEndDate)
              )
            ),
          db
            .select({ count: count() })
            .from(evaluations)
            .where(
              and(
                eq(evaluations.studentId, studentId),
                gte(evaluations.createdAt, queryStartDate),
                lte(evaluations.createdAt, queryEndDate)
              )
            ),
          db
            .select({ count: count() })
            .from(rotations)
            .where(
              and(
                eq(rotations.studentId, studentId),
                gte(rotations.startDate, queryStartDate),
                lte(rotations.endDate, queryEndDate)
              )
            ),
        ])

        reportData = {
          type: "summary",
          period: { startDate: queryStartDate, endDate: queryEndDate },
          summary: {
            competencyAssignments: competencySummary[0]?.count || 0,
            evaluations: evaluationSummary[0]?.count || 0,
            rotations: rotationSummary[0]?.count || 0,
          },
        }
        break
      }
    }

    return NextResponse.json({
      success: true,
      report: reportData,
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error generating student report:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
