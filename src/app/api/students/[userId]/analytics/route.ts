import { auth } from "@clerk/nextjs/server"
import { and, count, desc, eq, gte, sql } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { db } from "../../../../../database/connection-pool"
import {
  competencies,
  competencyAssignments,
  evaluations,
  rotations,
  users,
} from "../../../../../database/schema"
import {
  createSuccessResponse,
  createErrorResponse,
  withErrorHandling,
  HTTP_STATUS,
} from "@/lib/api-response"

import type { UserRole } from "@/types"
// GET /api/students/[userId]/analytics - Get analytics data for a student
export const GET = withErrorHandling(
  async (request: NextRequest, { params }: { params: Promise<{ userId: string }> }) => {
    const { userId: currentUserId } = await auth()
    const { userId: studentId } = await params

    if (!currentUserId) {
      return createErrorResponse("Unauthorized", HTTP_STATUS.UNAUTHORIZED)
    }

    const { searchParams } = new URL(request.url)
    const timeframe = searchParams.get("timeframe") || "30" // days

    // Check if current user can access this student's data
    const [currentUser] = await db.select().from(users).where(eq(users.id, currentUserId)).limit(1)

    if (!currentUser) {
      return createErrorResponse("User not found", HTTP_STATUS.NOT_FOUND)
    }

    // Students can only access their own data, others need appropriate permissions
    if (currentUser.role === ("STUDENT" as UserRole as UserRole) && currentUser.id !== studentId) {
      return createErrorResponse("Forbidden", HTTP_STATUS.FORBIDDEN)
    }

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(endDate.getDate() - Number.parseInt(timeframe))

    // Get competency assignments statistics
    const competencyStats = await db
      .select({
        status: competencyAssignments.status,
        count: count(),
      })
      .from(competencyAssignments)
      .where(
        and(
          eq(competencyAssignments.userId, studentId),
          gte(competencyAssignments.createdAt, startDate)
        )
      )
      .groupBy(competencyAssignments.status)

    // Get evaluation statistics - use signature status to determine completion
    const evaluationStats = await db
      .select({
        status: sql<string>`CASE 
        WHEN ${evaluations.studentSignature} = true AND ${evaluations.evaluatorSignature} = true THEN 'COMPLETED'
        WHEN ${evaluations.studentSignature} = true OR ${evaluations.evaluatorSignature} = true THEN 'PARTIAL'
        ELSE 'PENDING'
      END`.as("status"),
        count: count(),
      })
      .from(evaluations)
      .where(and(eq(evaluations.studentId, studentId), gte(evaluations.createdAt, startDate)))
      .groupBy(sql`CASE 
      WHEN ${evaluations.studentSignature} = true AND ${evaluations.evaluatorSignature} = true THEN 'COMPLETED'
      WHEN ${evaluations.studentSignature} = true OR ${evaluations.evaluatorSignature} = true THEN 'PARTIAL'
      ELSE 'PENDING'
    END`)

    // Get rotation progress
    const rotationProgress = await db
      .select({
        id: rotations.id,
        specialty: rotations.specialty,
        status: rotations.status,
        startDate: rotations.startDate,
        endDate: rotations.endDate,
      })
      .from(rotations)
      .where(and(eq(rotations.studentId, studentId), gte(rotations.startDate, startDate)))
      .orderBy(desc(rotations.startDate))

    // Get recent competency assignments with details
    const recentAssignments = await db
      .select({
        id: competencyAssignments.id,
        status: competencyAssignments.status,
        dueDate: competencyAssignments.dueDate,
        updatedAt: competencyAssignments.updatedAt,
        competencyName: competencies.name,
        competencyCategory: competencies.category,
      })
      .from(competencyAssignments)
      .leftJoin(competencies, eq(competencyAssignments.competencyId, competencies.id))
      .where(
        and(
          eq(competencyAssignments.userId, studentId),
          gte(competencyAssignments.createdAt, startDate)
        )
      )
      .orderBy(desc(competencyAssignments.createdAt))
      .limit(10)

    // Calculate completion rates
    const totalAssignments = competencyStats.reduce((sum, stat) => sum + stat.count, 0)
    const completedAssignments =
      competencyStats.find((stat) => stat.status === "COMPLETED")?.count || 0
    const completionRate =
      totalAssignments > 0 ? (completedAssignments / totalAssignments) * 100 : 0

    const totalEvaluations = evaluationStats.reduce((sum, stat) => sum + stat.count, 0)
    const completedEvaluations =
      evaluationStats.find((stat) => stat.status === "COMPLETED")?.count || 0
    const evaluationCompletionRate =
      totalEvaluations > 0 ? (completedEvaluations / totalEvaluations) * 100 : 0

    // Calculate average rotation progress (based on time elapsed)
    const avgRotationProgress =
      rotationProgress.length > 0
        ? rotationProgress.reduce((sum, rotation) => {
          // Skip rotations without dates
          if (!rotation.startDate || !rotation.endDate) return sum
          const now = new Date()
          const start = new Date(rotation.startDate)
          const end = new Date(rotation.endDate)
          const totalDays = Math.max(
            1,
            Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
          )
          const elapsedDays = Math.max(
            0,
            Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
          )
          const progress = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100))
          return sum + progress
        }, 0) / rotationProgress.filter(r => r.startDate && r.endDate).length || 0
        : 0

    return createSuccessResponse({
      timeframe: Number.parseInt(timeframe),
      analytics: {
        overview: {
          totalAssignments,
          completedAssignments,
          completionRate: Math.round(completionRate * 100) / 100,
          totalEvaluations,
          completedEvaluations,
          evaluationCompletionRate: Math.round(evaluationCompletionRate * 100) / 100,
          activeRotations: rotationProgress.filter((r) => r.status === "ACTIVE").length,
          avgRotationProgress: Math.round(avgRotationProgress * 100) / 100,
        },
        competencyStats: competencyStats.map((stat) => ({
          status: stat.status,
          count: stat.count,
          percentage: totalAssignments > 0 ? Math.round((stat.count / totalAssignments) * 100) : 0,
        })),
        evaluationStats: evaluationStats.map((stat) => ({
          status: stat.status,
          count: stat.count,
          percentage: totalEvaluations > 0 ? Math.round((stat.count / totalEvaluations) * 100) : 0,
        })),
        rotationProgress: rotationProgress.map((rotation) => {
          const now = new Date()
          // Handle nullable dates with fallbacks
          const start = rotation.startDate ? new Date(rotation.startDate) : now
          const end = rotation.endDate ? new Date(rotation.endDate) : now
          const totalDays = Math.max(
            1,
            Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
          )
          const elapsedDays = Math.max(
            0,
            Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
          )
          const progress = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100))

          return {
            id: rotation.id,
            specialty: rotation.specialty,
            status: rotation.status,
            progress: Math.round(progress),
            startDate: rotation.startDate,
            endDate: rotation.endDate,
            isActive: rotation.status === "ACTIVE",
          }
        }),
        recentActivity: recentAssignments.map((assignment) => ({
          id: assignment.id,
          type: "competency_assignment",
          title: assignment.competencyName || "Competency Assignment",
          category: assignment.competencyCategory,
          status: assignment.status,
          dueDate: assignment.dueDate,
          updatedAt: assignment.updatedAt,
        })),
      },
    })
  }
)
