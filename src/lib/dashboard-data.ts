import { auth } from "@clerk/nextjs/server"
import { and, count, desc, eq, isNull, avg } from "drizzle-orm"
import { db } from "@/database/connection-pool"
import {
  auditLogs,
  evaluations,
  rotations,
  timeRecords,
  users,
  programs,
  competencyAssignments,
  clinicalSites,
  schools,
  competencies,
} from "@/database/schema"
import { withCache, CACHE_PREFIXES, CACHE_CONFIG } from "@/lib/neon-cache"
import { queryOptimizationUtils } from "@/lib/optimized-query-wrapper"
import type { UserRole } from "@/types"

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

    // Cache key per-user for pending tasks
    const cacheKey = `${CACHE_PREFIXES.DASHBOARD}:${userId}:pendingTasks`

    return await withCache<PendingTask[]>(
      cacheKey,
      async () => {
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

        if (currentUser.role === ("SCHOOL_ADMIN" as UserRole)) {
          // For school admins: time record approvals, student evaluations, rotation planning
          const [timeRecordApprovals, pendingEvaluations, upcomingRotations] = await Promise.all([
            // Count pending time record approvals for the school
            db
              .select({ count: count() })
              .from(timeRecords)
              .innerJoin(users, eq(timeRecords.studentId, users.id))
              .where(
                and(
                  eq(users.schoolId, currentUser.schoolId || ""),
                  eq(timeRecords.status, "PENDING")
                )
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
                and(
                  eq(users.schoolId, currentUser.schoolId || ""),
                  eq(rotations.status, "SCHEDULED")
                )
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

          // Check for initial setup (0 students)
          const studentCount = await db
            .select({ count: count() })
            .from(users)
            .where(and(eq(users.schoolId, currentUser.schoolId || ""), eq(users.role, "STUDENT")))

          if ((studentCount[0]?.count || 0) === 0) {
            pendingTasks.unshift({
              id: "initial-setup",
              title: "Complete Initial Setup",
              description: "Add your first student to get started",
              count: 1,
              priority: "high",
              type: "setup",
            })
          }
        } else if (currentUser.role === ("CLINICAL_PRECEPTOR" as UserRole)) {
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
      },
      CACHE_CONFIG.shortTTL
    )
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

    const cacheKey = `${CACHE_PREFIXES.DASHBOARD}:${userId}:recentActivities:${limit}`

    return await withCache<RecentActivity[]>(
      cacheKey,
      async () => {
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
        if (!["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(currentUser.role ?? "")) {
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
            currentUser.role === ("SUPER_ADMIN" as UserRole)
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
              userId: activity.userId as string, // Filtered above; cast to string
              metadata: activity.metadata ?? "{}", // Provide empty JSON string if null
            })
          )
      },
      CACHE_CONFIG.shortTTL
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

    const cacheKey = `${CACHE_PREFIXES.DASHBOARD}:${userId}:schoolStats`

    return await withCache(
      cacheKey,
      async () => {
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
        const schoolId = currentUser.schoolId || ""

        // Use the optimized query wrapper for main stats
        // This leverages materialized views where available
        const [dashboardData, pendingTimeRecordsCount, pendingEvaluationsCount, activeRotationsCount] = await Promise.all([
          queryOptimizationUtils.getDashboardData({ schoolId }),

          // These specific counts might not be in the general dashboard data yet, so we keep them optimized but separate
          // or we could add them to the wrapper. For now, we parallelize them.
          db
            .select({ count: count() })
            .from(timeRecords)
            .innerJoin(users, eq(timeRecords.studentId, users.id))
            .where(
              and(eq(users.schoolId, schoolId), eq(timeRecords.status, "PENDING"))
            ),

          db
            .select({ count: count() })
            .from(evaluations)
            .innerJoin(rotations, eq(evaluations.rotationId, rotations.id))
            .innerJoin(users, eq(rotations.studentId, users.id))
            .where(
              and(eq(users.schoolId, schoolId), isNull(evaluations.overallRating))
            ),

          db
            .select({ count: count() })
            .from(rotations)
            .innerJoin(users, eq(rotations.studentId, users.id))
            .where(
              and(eq(users.schoolId, schoolId), eq(rotations.status, "ACTIVE"))
            ),
        ])

        // Extract data from the optimized result
        // Note: getDashboardData returns { schoolStatistics, dailyActivity, competencyAnalytics }
        // We need to map this to SchoolStats
        const stats = dashboardData.schoolStatistics[0] || {}

        // Fallback or combine with fresh counts if needed
        const activeRotations = activeRotationsCount[0]?.count || 0
        const pendingTimeRecords = pendingTimeRecordsCount[0]?.count || 0
        const pendingEvaluations = pendingEvaluationsCount[0]?.count || 0

        // Use materialized view data if available, otherwise use 0 (or we could fetch if critical)
        const totalStudents = Number(stats.totalStudents) || 0
        const totalPrograms = Number(stats.totalPrograms) || 0
        const totalSites = Number(stats.activeSites) || 0 // Assuming activeSites is available in mvSchoolStatistics
        const placementRate = Number(stats.placementRate) || (totalStudents > 0 ? Math.round((activeRotations / totalStudents) * 100) : 0)
        const avgCompetencyProgress = Number(stats.avgCompetencyProgress) || 0

        return {
          activeRotations,
          pendingTimeRecords,
          totalStudents,
          totalPrograms,
          pendingEvaluations,
          avgCompetencyProgress,
          totalSites,
          placementRate,
          schoolName: stats.schoolName || "Medical Institute",
        }
      },
      CACHE_CONFIG.defaultTTL
    )
  } catch (error) {
    console.error("Error fetching school stats:", error)
    return {
      activeRotations: 0,
      pendingTimeRecords: 0,
      totalStudents: 0,
      totalPrograms: 0,
      pendingEvaluations: 0,
      avgCompetencyProgress: 0,
      totalSites: 0,
      placementRate: 0,
      schoolName: "Medical Institute",
    }
  }
}

/**
 * Get enrollment trend data for the last 6 months
 */
export async function getEnrollmentTrendData() {
  try {
    const { userId } = await auth()
    if (!userId) return []

    const cacheKey = `${CACHE_PREFIXES.DASHBOARD}:${userId}:enrollmentTrend`

    return await withCache(
      cacheKey,
      async () => {
        const user = await db
          .select({ schoolId: users.schoolId })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1)

        if (!user.length || !user[0].schoolId) return []

        const schoolId = user[0].schoolId

        const students = await db
          .select({
            enrollmentDate: users.enrollmentDate,
          })
          .from(users)
          .where(and(eq(users.schoolId, schoolId), eq(users.role, "STUDENT")))

        // Group by month
        const monthlyData = new Map<string, number>()
        const months = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ]

        // Initialize last 7 months
        for (let i = 6; i >= 0; i--) {
          const d = new Date()
          d.setMonth(d.getMonth() - i)
          const monthName = months[d.getMonth()]
          monthlyData.set(monthName, 0)
        }

        students.forEach((student) => {
          if (student.enrollmentDate) {
            const monthName = months[student.enrollmentDate.getMonth()]
            if (monthlyData.has(monthName)) {
              monthlyData.set(monthName, (monthlyData.get(monthName) || 0) + 1)
            }
          }
        })

        return Array.from(monthlyData.entries()).map(([month, students]) => ({
          month,
          students,
        }))
      },
      CACHE_CONFIG.defaultTTL
    )
  } catch (error) {
    console.error("Error fetching enrollment trend:", error)
    return []
  }
}

/**
 * Get clinical site capacity data
 */
export async function getSiteCapacityData() {
  try {
    const { userId } = await auth()
    if (!userId) return []

    const cacheKey = `${CACHE_PREFIXES.DASHBOARD}:${userId}:siteCapacity`

    return await withCache(
      cacheKey,
      async () => {
        const user = await db
          .select({ schoolId: users.schoolId })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1)

        if (!user.length || !user[0].schoolId) return []

        const schoolId = user[0].schoolId

        const sites = await db
          .select({
            id: clinicalSites.id,
            name: clinicalSites.name,
            capacity: clinicalSites.capacity,
          })
          .from(clinicalSites)
          .where(eq(clinicalSites.schoolId, schoolId))
          .limit(5) // Limit to top 5 sites

        const siteData = await Promise.all(
          sites.map(async (site) => {
            const activeRotations = await db
              .select({ count: count() })
              .from(rotations)
              .where(and(eq(rotations.clinicalSiteId, site.id), eq(rotations.status, "ACTIVE")))

            return {
              name: site.name,
              capacity: site.capacity,
              used: activeRotations[0]?.count || 0,
            }
          })
        )

        return siteData
      },
      CACHE_CONFIG.defaultTTL
    )
  } catch (error) {
    console.error("Error fetching site capacity:", error)
    return []
  }
}

/**
 * Get competency overview data based on evaluations
 */
export async function getCompetencyOverviewData() {
  try {
    const { userId } = await auth()
    if (!userId) return []

    const cacheKey = `${CACHE_PREFIXES.DASHBOARD}:${userId}:competencyOverview`

    return await withCache(
      cacheKey,
      async () => {
        const user = await db
          .select({ schoolId: users.schoolId })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1)

        if (!user.length || !user[0].schoolId) return []

        const schoolId = user[0].schoolId

        // Get average scores from evaluations
        const evalStats = await db
          .select({
            avgClinical: avg(evaluations.clinicalSkills),
            avgComm: avg(evaluations.communication),
            avgProf: avg(evaluations.professionalism),
            avgCritical: avg(evaluations.criticalThinking),
          })
          .from(evaluations)
          .innerJoin(rotations, eq(evaluations.rotationId, rotations.id))
          .innerJoin(users, eq(rotations.studentId, users.id))
          .where(eq(users.schoolId, schoolId))

        const stats = evalStats[0] || {}

        // Helper to convert decimal string to number and scale to 150 (mock scale was 150)
        // Assuming database ratings are 1-5
        const scaleScore = (val: string | number | null) => {
          if (!val) return 0
          const num = typeof val === "string" ? parseFloat(val) : val
          return Math.round((num / 5) * 150)
        }

        return [
          { subject: "Clinical Skills", A: scaleScore(stats.avgClinical), fullMark: 150 },
          { subject: "Communication", A: scaleScore(stats.avgComm), fullMark: 150 },
          { subject: "Professionalism", A: scaleScore(stats.avgProf), fullMark: 150 },
          { subject: "Critical Thinking", A: scaleScore(stats.avgCritical), fullMark: 150 },
        ]
      },
      CACHE_CONFIG.defaultTTL
    )
  } catch (error) {
    console.error("Error fetching competency overview:", error)
    return []
  }
}
