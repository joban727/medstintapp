import { auth } from "@clerk/nextjs/server"
import { and, count, desc, eq, isNull } from "drizzle-orm"
import { db } from "@/database/db"
import { auditLogs, evaluations, rotations, timeRecords, users } from "@/database/schema"

// Type definitions
interface PendingTask {
  id: string
  title: string
  description: string
  count: number
  priority: "high" | "medium" | "low"
  type: "approval" | "evaluation" | "setup" | "review"
}

interface RecentActivity {
  id: string
  action: string
  entityType: string | null
  entityId: string | null
  userId: string
  metadata: string
  timestamp: Date
  userEmail: string | null
  userName: string | null
}

/**
 * Get pending tasks for the current user based on their role
 */
export async function getPendingTasksData() {
  try {
    const { userId } = await auth()
    if (!userId) {
      throw new Error("Unauthorized")
    }

    // Get user info to determine role and school
    const user = await db
      .select({
        id: users.id,
        role: users.role,
        schoolId: users.schoolId,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    if (!user.length) {
      throw new Error("User not found")
    }

    const currentUser = user[0]
    let pendingTasks: PendingTask[] = []

    if (currentUser.role === "SCHOOL_ADMIN") {
      // For school admins: time record approvals, student evaluations, rotation planning
      const [timeRecordApprovals, pendingEvaluations, upcomingRotations] = await Promise.all([
        // Count pending time record approvals for the school
        db
          .select({ count: count() })
          .from(timeRecords)
          .innerJoin(users, eq(timeRecords.studentId, users.id))
          .where(
            and(eq(users.schoolId, currentUser.schoolId || ""), eq(timeRecords.status, "PENDING"))
          ),

        // Count overdue evaluations for students in the school
        db
          .select({ count: count() })
          .from(evaluations)
          .innerJoin(rotations, eq(evaluations.rotationId, rotations.id))
          .innerJoin(users, eq(rotations.studentId, users.id))
          .where(
            and(
              eq(users.schoolId, currentUser.schoolId || ""),
              isNull(evaluations.overallRating) // Not completed
            )
          ),

        // Count upcoming rotations needing setup
        db
          .select({ count: count() })
          .from(rotations)
          .innerJoin(users, eq(rotations.studentId, users.id))
          .where(
            and(eq(users.schoolId, currentUser.schoolId || ""), eq(rotations.status, "SCHEDULED"))
          ),
      ])

      pendingTasks = [
        {
          id: "time-approvals",
          title: "Time Record Approvals",
          description: `${timeRecordApprovals[0]?.count || 0} pending approvals`,
          count: timeRecordApprovals[0]?.count || 0,
          priority: "high",
          type: "approval",
        },
        {
          id: "pending-evaluations",
          title: "Pending Evaluations",
          description: `${pendingEvaluations[0]?.count || 0} overdue evaluations`,
          count: pendingEvaluations[0]?.count || 0,
          priority: "medium",
          type: "evaluation",
        },
        {
          id: "rotation-setup",
          title: "Rotation Setup",
          description: `${upcomingRotations[0]?.count || 0} rotations need setup`,
          count: upcomingRotations[0]?.count || 0,
          priority: "medium",
          type: "setup",
        },
      ]
    } else if (currentUser.role === "CLINICAL_PRECEPTOR") {
      // For clinical preceptors: student evaluations, time record reviews
      const [pendingEvaluations, timeRecordReviews] = await Promise.all([
        db
          .select({ count: count() })
          .from(evaluations)
          .where(and(eq(evaluations.evaluatorId, userId), isNull(evaluations.overallRating))),

        db
          .select({ count: count() })
          .from(timeRecords)
          .innerJoin(rotations, eq(timeRecords.rotationId, rotations.id))
          .where(and(eq(rotations.preceptorId, userId), eq(timeRecords.status, "PENDING"))),
      ])

      pendingTasks = [
        {
          id: "student-evaluations",
          title: "Student Evaluations",
          description: `${pendingEvaluations[0]?.count || 0} evaluations to complete`,
          count: pendingEvaluations[0]?.count || 0,
          priority: "high",
          type: "evaluation",
        },
        {
          id: "time-reviews",
          title: "Time Record Reviews",
          description: `${timeRecordReviews[0]?.count || 0} time records to review`,
          count: timeRecordReviews[0]?.count || 0,
          priority: "medium",
          type: "review",
        },
      ]
    }

    return pendingTasks
  } catch (error) {
    console.error("Error fetching pending tasks:", error)
    return []
  }
}

/**
 * Get recent activities from audit logs for the current user's school
 */
export async function getRecentActivitiesData(limit = 5): Promise<RecentActivity[]> {
  try {
    const { userId } = await auth()
    if (!userId) {
      throw new Error("Unauthorized")
    }

    // Get user info to determine school
    const user = await db
      .select({
        id: users.id,
        role: users.role,
        schoolId: users.schoolId,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    if (!user.length) {
      throw new Error("User not found")
    }

    const currentUser = user[0]

    // Only show audit logs for users with appropriate permissions
    if (!["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(currentUser.role)) {
      return []
    }

    const activities = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        entityType: auditLogs.resource,
        entityId: auditLogs.resourceId,
        userId: auditLogs.userId,
        metadata: auditLogs.details,
        timestamp: auditLogs.createdAt,
        userEmail: users.email,
        userName: users.name,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(
        currentUser.role === "SUPER_ADMIN"
          ? undefined // Super admin sees all
          : undefined // Remove school filter for now since auditLogs doesn't have schoolId
      )
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)

    // Filter out activities with null userId and ensure metadata is properly handled
    return activities
      .filter((activity) => activity.userId !== null)
      .map(
        (activity): RecentActivity => ({
          ...activity,
          userId: activity.userId!, // Safe to use ! since we filtered out nulls
          metadata: activity.metadata ?? "{}", // Provide empty JSON string if null
        })
      )
  } catch (error) {
    console.error("Error fetching recent activities:", error)
    return []
  }
}

/**
 * Get dashboard statistics for school admins
 */
export async function getSchoolStats() {
  try {
    const { userId } = await auth()
    if (!userId) {
      throw new Error("Unauthorized")
    }

    const user = await db
      .select({
        id: users.id,
        role: users.role,
        schoolId: users.schoolId,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    if (!user.length) {
      throw new Error("User not found")
    }

    const currentUser = user[0]

    // Get various counts for the school
    const [activeRotationsCount, pendingTimeRecordsCount, totalStudentsCount] = await Promise.all([
      db
        .select({ count: count() })
        .from(rotations)
        .innerJoin(users, eq(rotations.studentId, users.id))
        .where(and(eq(users.schoolId, currentUser.schoolId || ""), eq(rotations.status, "ACTIVE"))),

      db
        .select({ count: count() })
        .from(timeRecords)
        .innerJoin(users, eq(timeRecords.studentId, users.id))
        .where(
          and(eq(users.schoolId, currentUser.schoolId || ""), eq(timeRecords.status, "PENDING"))
        ),

      db
        .select({ count: count() })
        .from(users)
        .where(and(eq(users.schoolId, currentUser.schoolId || ""), eq(users.role, "STUDENT"))),
    ])

    return {
      activeRotations: activeRotationsCount[0]?.count || 0,
      pendingTimeRecords: pendingTimeRecordsCount[0]?.count || 0,
      totalStudents: totalStudentsCount[0]?.count || 0,
    }
  } catch (error) {
    console.error("Error fetching school stats:", error)
    return {
      activeRotations: 0,
      pendingTimeRecords: 0,
      totalStudents: 0,
    }
  }
}
