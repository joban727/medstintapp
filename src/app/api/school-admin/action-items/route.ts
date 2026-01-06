import { NextRequest } from "next/server"
import { db } from "@/database/connection-pool"
import { users, timeRecords, rotations, evaluations } from "@/database/schema"
import { eq, and, isNull, desc } from "drizzle-orm"
import { auth } from "@clerk/nextjs/server"
import {
  createErrorResponse,
  createSuccessResponse,
  HTTP_STATUS,
  ERROR_MESSAGES,
  withErrorHandling,
} from "@/lib/api-response"
import type { UserRole } from "@/types"

export const dynamic = "force-dynamic"

interface ActionItem {
  id: string
  title: string
  description: string
  type: "approval" | "time-approval" | "evaluation" | "system"
  priority: "high" | "medium" | "low"
  date: string
  entityId: string
  entityType: string
}

export const GET = withErrorHandling(async (request: NextRequest) => {
  const { userId } = await auth()

  if (!userId) {
    return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
  }

  const [currentUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1)

  if (!currentUser || (currentUser.role !== "SCHOOL_ADMIN" && currentUser.role !== "SUPER_ADMIN")) {
    return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
  }

  const actionItems: ActionItem[] = []

  // 1. Get pending user approvals
  let pendingUsers: any[]
  if (currentUser.role === "SUPER_ADMIN") {
    pendingUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.approvalStatus, "PENDING"))
      .orderBy(desc(users.createdAt))
      .limit(10)
  } else {
    if (currentUser.schoolId) {
      pendingUsers = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(and(eq(users.schoolId, currentUser.schoolId), eq(users.approvalStatus, "PENDING")))
        .orderBy(desc(users.createdAt))
        .limit(10)
    } else {
      pendingUsers = []
    }
  }

  // Add pending user approvals to action items
  for (const user of pendingUsers) {
    actionItems.push({
      id: `approval-${user.id}`,
      title: `Approve ${user.name || user.email}`,
      description: `New ${user.role?.toLowerCase().replace("_", " ")} account request`,
      type: "approval",
      priority: "high",
      date: formatDate(user.createdAt),
      entityId: user.id,
      entityType: "user",
    })
  }

  // 2. Get pending time record approvals
  if (currentUser.schoolId) {
    const pendingTimeRecords = await db
      .select({
        id: timeRecords.id,
        studentId: timeRecords.studentId,
        clockIn: timeRecords.clockIn,
        studentName: users.name,
        studentEmail: users.email,
      })
      .from(timeRecords)
      .innerJoin(users, eq(timeRecords.studentId, users.id))
      .where(and(eq(users.schoolId, currentUser.schoolId), eq(timeRecords.status, "PENDING")))
      .orderBy(desc(timeRecords.clockIn))
      .limit(10)

    for (const record of pendingTimeRecords) {
      actionItems.push({
        id: `time-${record.id}`,
        title: `Review time record for ${record.studentName || record.studentEmail}`,
        description: `Time entry from ${formatDate(record.clockIn)}`,
        type: "time-approval",
        priority: "medium",
        date: formatDate(record.clockIn),
        entityId: record.id,
        entityType: "timeRecord",
      })
    }
  }

  // 3. Get pending evaluations
  if (currentUser.schoolId) {
    const pendingEvaluations = await db
      .select({
        id: evaluations.id,
        rotationId: evaluations.rotationId,
        createdAt: evaluations.createdAt,
        studentId: rotations.studentId,
        studentName: users.name,
        studentEmail: users.email,
      })
      .from(evaluations)
      .innerJoin(rotations, eq(evaluations.rotationId, rotations.id))
      .innerJoin(users, eq(rotations.studentId, users.id))
      .where(and(eq(users.schoolId, currentUser.schoolId), isNull(evaluations.overallRating)))
      .orderBy(desc(evaluations.createdAt))
      .limit(10)

    for (const evaluation of pendingEvaluations) {
      actionItems.push({
        id: `eval-${evaluation.id}`,
        title: `Complete evaluation for ${evaluation.studentName || evaluation.studentEmail}`,
        description: `Pending rotation evaluation`,
        type: "evaluation",
        priority: "medium",
        date: formatDate(evaluation.createdAt),
        entityId: evaluation.id,
        entityType: "evaluation",
      })
    }
  }

  // Sort by priority (high first) then by date (newest first)
  actionItems.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    }
    return 0 // Keep original order within same priority
  })

  return createSuccessResponse(actionItems, "Action items fetched successfully")
})

function formatDate(date: Date | null): string {
  if (!date) return "Unknown"
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (hours < 1) return "Just now"
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}
