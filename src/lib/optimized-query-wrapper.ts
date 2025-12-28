/**
 * Optimized Query Wrapper
 * Provides enhanced query patterns to eliminate N+1 queries and improve performance
 * Implements batch operations and optimized JOIN strategies
 */

import { and, desc, eq, inArray, sql } from "drizzle-orm"
import { db, dbUtils } from "@/database/connection-pool"
import {
  competencies,
  competencyAssignments,
  competencySubmissions,
  evaluations,
  rotations,
  timeRecords,
  users,
  programs,
  schools,
  mvUserProgressSummary,
  mvSchoolStatistics,
  mvDailyActivitySummary,
  mvCompetencyAnalytics,
} from "@/database/schema"
import { queryPerformanceUtils } from "@/lib/query-performance-logger"

/**
 * Batch Query Configuration
 */
interface BatchConfig {
  batchSize: number
  maxConcurrency: number
  enableCaching: boolean
  cacheTimeout: number // milliseconds
}

const DEFAULT_BATCH_CONFIG: BatchConfig = {
  batchSize: 100,
  maxConcurrency: 5,
  enableCaching: true,
  cacheTimeout: 300000, // 5 minutes
}

/**
 * Query Cache Interface
 */
interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

/**
 * Optimized Query Wrapper Class
 */
export class OptimizedQueryWrapper {
  private cache = new Map<string, CacheEntry<unknown>>()
  private config: BatchConfig

  constructor(config: Partial<BatchConfig> = {}) {
    this.config = { ...DEFAULT_BATCH_CONFIG, ...config }
    this.startCacheCleanup()
  }

  /**
   * Batch load competency assignments with all related data
   * Eliminates N+1 queries for competency assignment progress
   */
  async batchLoadCompetencyAssignments(
    userIds: string[],
    options: {
      includeSubmissions?: boolean
      includeEvaluations?: boolean
      includeCompetencyDetails?: boolean
      rotationId?: string
      endpoint?: string
    } = {}
  ) {
    const sortedUserIds = [...userIds].sort()
    const cacheKey = `competency_assignments_${JSON.stringify({ userIds: sortedUserIds, options })}`

    if (this.config.enableCaching) {
      const cached = this.getFromCache(cacheKey)
      if (cached) return cached
    }

    return queryPerformanceUtils.executeQuery(
      async () => {
        // Base query with optimized JOINs
        let assignments: any[]

        if (options.includeCompetencyDetails) {
          assignments = await db
            .select({
              assignment: competencyAssignments,
              competency: competencies,
              user: users,
            })
            .from(competencyAssignments)
            .innerJoin(users, eq(competencyAssignments.userId, users.id))
            .innerJoin(competencies, eq(competencyAssignments.competencyId, competencies.id))
            .where(and(inArray(competencyAssignments.userId, userIds)))
        } else {
          assignments = await db
            .select({
              assignment: competencyAssignments,
              user: users,
            })
            .from(competencyAssignments)
            .innerJoin(users, eq(competencyAssignments.userId, users.id))
            .where(and(inArray(competencyAssignments.userId, userIds)))
        }

        // Batch load submissions if requested
        let submissionsMap = new Map()
        if (options.includeSubmissions && assignments.length > 0) {
          const competencyIds = assignments.map((a: any) => a.assignment.competencyId)
          const submissions = await this.batchLoadSubmissions(competencyIds)
          submissionsMap = new Map(submissions.map((s: any) => [s.competencyId, s]))
        }

        // Batch load evaluations if requested
        let evaluationsMap = new Map()
        if (options.includeEvaluations && assignments.length > 0) {
          const assignmentIds = assignments.map((a: any) => a.assignment.id)
          const evaluationsList = await this.batchLoadEvaluations(assignmentIds)
          evaluationsMap = new Map(evaluationsList.map((e: any) => [e.evaluation.assignmentId, e]))
        }

        // Combine results
        const result = assignments.map((item: any) => ({
          ...item,
          submissions: submissionsMap.get(item.assignment.competencyId) || [],
          evaluations: evaluationsMap.get(item.assignment.id) || [],
        }))

        if (this.config.enableCaching) {
          this.setCache(cacheKey, result)
        }

        return result
      },
      {
        name: "batch_load_competency_assignments",
        endpoint: options.endpoint,
      }
    )
  }

  /**
   * Batch load submissions for multiple competencies
   */
  private async batchLoadSubmissions(competencyIds: string[]) {
    if (competencyIds.length === 0) return []

    return queryPerformanceUtils.executeQuery(
      async () => {
        return db
          .select()
          .from(competencySubmissions)
          .where(inArray(competencySubmissions.competencyId, competencyIds))
          .orderBy(desc(competencySubmissions.submittedAt))
      },
      { name: "batch_load_submissions" }
    )
  }

  /**
   * Batch load evaluations for multiple assignments
   */
  private async batchLoadEvaluations(assignmentIds: string[]) {
    if (assignmentIds.length === 0) return []

    return queryPerformanceUtils.executeQuery(
      async () => {
        return db
          .select({
            evaluation: evaluations,
            evaluator: users,
          })
          .from(evaluations)
          .innerJoin(users, eq(evaluations.evaluatorId, users.id))
          .where(inArray(evaluations.assignmentId, assignmentIds))
          .orderBy(desc(evaluations.observationDate))
      },
      { name: "batch_load_evaluations" }
    )
  }

  /**
   * Optimized user progress calculation with batch operations
   */
  async calculateUserProgress(
    userIds: string[],
    options: {
      programId?: string
      rotationId?: string
      includeTimeRecords?: boolean
      endpoint?: string
    } = {}
  ) {
    const sortedUserIds = [...userIds].sort()
    const cacheKey = `user_progress_${JSON.stringify({ userIds: sortedUserIds, options })}`

    if (this.config.enableCaching) {
      const cached = this.getFromCache(cacheKey)
      if (cached) return cached
    }

    // Basic guard against empty inputs
    const safeUserIds = (userIds || []).filter((id) => typeof id === "string" && id.length > 0)
    if (safeUserIds.length === 0) {
      return []
    }

    return dbUtils.executeQuery(
      async () => {
        // Use materialized view for better performance
        const progressData = await db
          .select({
            userId: mvUserProgressSummary.userId,
            totalAssignments: mvUserProgressSummary.totalAssignments,
            completedAssignments: mvUserProgressSummary.completedAssignments,
            pendingAssignments: mvUserProgressSummary.pendingAssignments,
            overdueAssignments: mvUserProgressSummary.overdueAssignments,
            completionRate: mvUserProgressSummary.completionRate,
            averageScore: mvUserProgressSummary.averageScore,
            lastUpdated: mvUserProgressSummary.lastUpdated,
            userName: users.name,
            userEmail: users.email,
            programName: programs.name,
            rotationName: rotations.specialty,
          })
          .from(mvUserProgressSummary)
          .innerJoin(users, eq(mvUserProgressSummary.userId, users.id))
          .leftJoin(programs, eq(mvUserProgressSummary.programId, programs.id))
          .leftJoin(rotations, eq(mvUserProgressSummary.rotationId, rotations.id))
          .where(
            and(
              inArray(mvUserProgressSummary.userId, safeUserIds),
              options.programId
                ? eq(mvUserProgressSummary.programId, options.programId)
                : undefined,
              options.rotationId
                ? eq(mvUserProgressSummary.rotationId, options.rotationId)
                : undefined
            )
          )

        // Batch load time records if requested
        let timeRecordsMap = new Map()
        if (options.includeTimeRecords) {
          const timeRecordsList = await this.batchLoadTimeRecords(userIds, options)
          timeRecordsMap = new Map(
            timeRecordsList.map((tr) => [
              tr.timeRecord.studentId,
              timeRecordsList.filter((t) => t.timeRecord.studentId === tr.timeRecord.studentId),
            ])
          )
        }

        const result = progressData.map((row) => {
          const nameParts = (row.userName || "").split(" ")
          const firstName = nameParts[0] || ""
          const lastName = nameParts.slice(1).join(" ") || ""

          return {
            userId: row.userId,
            user: {
              id: row.userId,
              firstName: firstName,
              lastName: lastName,
              email: row.userEmail,
            },
            program: row.programName ? { name: row.programName } : null,
            rotation: row.rotationName ? { name: row.rotationName } : null,
            progress: {
              totalAssignments: row.totalAssignments || 0,
              completedAssignments: row.completedAssignments || 0,
              pendingAssignments: row.pendingAssignments || 0,
              overdueAssignments: row.overdueAssignments || 0,
              completionRate: Number(row.completionRate) || 0,
              averageScore: Number(row.averageScore) || 0,
              lastUpdated: row.lastUpdated,
            },
            timeRecords: timeRecordsMap.get(row.userId) || [],
          }
        })

        if (this.config.enableCaching) {
          this.setCache(cacheKey, result)
        }

        return result
      },
      {
        name: "calculate_user_progress_batch",
        endpoint: options.endpoint,
      }
    )
  }

  /**
   * Batch load time records for multiple users
   */
  private async batchLoadTimeRecords(
    userIds: string[],
    options: { programId?: string; rotationId?: string } = {}
  ) {
    if (userIds.length === 0) return []

    return queryPerformanceUtils.executeQuery(
      async () => {
        return db
          .select({
            timeRecord: timeRecords,
            rotation: rotations,
          })
          .from(timeRecords)
          .innerJoin(rotations, eq(timeRecords.rotationId, rotations.id))
          .where(
            and(
              inArray(timeRecords.studentId, userIds),
              options.rotationId ? eq(timeRecords.rotationId, options.rotationId) : undefined
            )
          )
          .orderBy(desc(timeRecords.date))
      },
      { name: "batch_load_time_records" }
    )
  }

  /**
   * Optimized competency analytics with materialized views
   */
  async getCompetencyAnalytics(
    options: {
      schoolId?: string
      programId?: string
      competencyIds?: string[]
      dateRange?: { start: Date; end: Date }
      endpoint?: string
    } = {}
  ) {
    // Sort competency IDs for consistent cache keys
    if (options.competencyIds) {
      options.competencyIds.sort()
    }
    const cacheKey = `competency_analytics_${JSON.stringify(options)}`

    if (this.config.enableCaching) {
      const cached = this.getFromCache(cacheKey)
      if (cached) return cached
    }

    // Normalize and validate inputs
    const safeCompetencyIds = (options.competencyIds || []).filter(
      (id) => typeof id === "string" && id.length > 0
    )
    let safeDateRange = options.dateRange
    if (safeDateRange && safeDateRange.start && safeDateRange.end) {
      const start = new Date(safeDateRange.start)
      const end = new Date(safeDateRange.end)
      if (start > end) {
        safeDateRange = { start: end, end: start }
      }
    }

    return dbUtils.executeQuery(
      async () => {
        // Use materialized view for complex analytics
        const analyticsData = await db
          .select({
            competencyId: mvCompetencyAnalytics.competencyId,
            competencyName: mvCompetencyAnalytics.competencyName,
            totalAssignments: mvCompetencyAnalytics.totalAssignments,
            completedAssignments: mvCompetencyAnalytics.completedAssignments,
            averageScore: mvCompetencyAnalytics.averageScore,
            passRate: mvCompetencyAnalytics.passRate,
            completionRate: mvCompetencyAnalytics.completionRate,
            schoolId: mvCompetencyAnalytics.schoolId,
            programId: mvCompetencyAnalytics.programId,
            schoolName: schools.name,
            programName: programs.name,
          })
          .from(mvCompetencyAnalytics)
          .leftJoin(schools, eq(mvCompetencyAnalytics.schoolId, schools.id))
          .leftJoin(programs, eq(mvCompetencyAnalytics.programId, programs.id))
          .where(
            and(
              options.schoolId ? eq(mvCompetencyAnalytics.schoolId, options.schoolId) : undefined,
              options.programId
                ? eq(mvCompetencyAnalytics.programId, options.programId)
                : undefined,
              safeCompetencyIds.length
                ? inArray(mvCompetencyAnalytics.competencyId, safeCompetencyIds)
                : undefined,
              safeDateRange
                ? and(
                    sql`${mvCompetencyAnalytics.lastUpdated} >= ${safeDateRange.start}`,
                    sql`${mvCompetencyAnalytics.lastUpdated} <= ${safeDateRange.end}`
                  )
                : undefined
            )
          )
          .orderBy(
            desc(mvCompetencyAnalytics.completionRate),
            desc(mvCompetencyAnalytics.averageScore)
          )

        const result = analyticsData.map((row) => ({
          competencyId: row.competencyId,
          competencyName: row.competencyName,
          school: row.schoolName ? { id: row.schoolId, name: row.schoolName } : null,
          program: row.programName ? { id: row.programId, name: row.programName } : null,
          metrics: {
            totalAssignments: row.totalAssignments || 0,
            completedAssignments: row.completedAssignments || 0,
            averageScore: Number(row.averageScore) || 0,
            passRate: Number(row.passRate) || 0,
            completionRate: Number(row.completionRate) || 0,
          },
        }))

        if (this.config.enableCaching) {
          this.setCache(cacheKey, result)
        }

        return result
      },
      {
        name: "get_competency_analytics",
        endpoint: options.endpoint,
      }
    )
  }

  /**
   * Batch process multiple operations with concurrency control
   */
  /**
   * Batch process multiple operations with concurrency control
   * Uses the robust BatchProcessor for adaptive sizing and memory management
   */
  async batchProcess<T, R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    options: {
      batchSize?: number
      maxConcurrency?: number
      onProgress?: (completed: number, total: number) => void
    } = {}
  ): Promise<R[]> {
    const { BatchProcessor } = await import("./batch-processor")
    const batchProcessor = new BatchProcessor<T>({
      batchSize: options.batchSize || this.config.batchSize,
      maxConcurrency: options.maxConcurrency || this.config.maxConcurrency,
      dynamicSizing: true,
    })

    const result = await batchProcessor.processBatches(items, processor)

    if (options.onProgress) {
      options.onProgress(result.processedCount, items.length)
    }

    return result.results || []
  }

  /**
   * Cache management methods
   */
  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    const now = Date.now()
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  private setCache<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.config.cacheTimeout,
    })
  }

  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now()
      const keysToDelete: string[] = []

      this.cache.forEach((entry, key) => {
        if (now - entry.timestamp > entry.ttl) {
          keysToDelete.push(key)
        }
      })

      keysToDelete.forEach((key) => this.cache.delete(key))
    }, 60000) // Cleanup every minute
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    }
  }
}

// Export singleton instance
export const optimizedQuery = new OptimizedQueryWrapper()

// Export utility functions
export const queryOptimizationUtils = {
  /**
   * Batch load users with their assignments and progress
   */
  async loadUsersWithProgress(
    userIds: string[],
    options: {
      includeAssignments?: boolean
      includeTimeRecords?: boolean
      programId?: string
      rotationId?: string
      endpoint?: string
    } = {}
  ) {
    const [usersData, progress, assignments] = await Promise.all([
      // Load users
      queryPerformanceUtils.executeQuery(
        () =>
          db
            .select({
              id: users.id,
              name: users.name,
              email: users.email,
              role: users.role,
              schoolId: users.schoolId,
              department: users.department,
              isActive: users.isActive,
              studentId: users.studentId,
              programId: users.programId,
              gpa: users.gpa,
              totalClinicalHours: users.totalClinicalHours,
              completedRotations: users.completedRotations,
              avatar: users.avatar,
              avatarUrl: users.avatarUrl,
            })
            .from(users)
            .where(inArray(users.id, userIds)),
        { name: "load_users_batch", endpoint: options.endpoint }
      ),

      // Load progress data
      optimizedQuery.calculateUserProgress(userIds, options),

      // Load assignments if requested
      options.includeAssignments
        ? optimizedQuery.batchLoadCompetencyAssignments(userIds, {
            includeSubmissions: true,
            includeEvaluations: true,
            rotationId: options.rotationId,
            endpoint: options.endpoint,
          })
        : Promise.resolve([]),
    ])

    // Combine results
    const progressMap = new Map(
      (progress as Record<string, unknown>[]).map((p: Record<string, unknown>) => [p.userId, p])
    )
    const assignmentsMap = new Map(
      (assignments as Record<string, unknown>[]).reduce(
        (acc: Map<string, Record<string, unknown>[]>, a: Record<string, unknown>) => {
          const assignment = a.assignment as { userId: string }
          const userId = assignment.userId
          if (!acc.has(userId)) acc.set(userId, [])
          acc.get(userId)?.push(a)
          return acc
        },
        new Map()
      )
    )

    return usersData.map((user: any) => ({
      ...user,
      progress: progressMap.get(user.id),
      assignments: assignmentsMap.get(user.id) || [],
    }))
  },

  /**
   * Get dashboard data with optimized queries
   */
  async getDashboardData(
    options: { schoolId?: string; programId?: string; userId?: string; endpoint?: string } = {}
  ) {
    // Use materialized views for dashboard data
    const [schoolStats, dailyActivity, competencyAnalytics] = await Promise.all([
      // School statistics
      queryPerformanceUtils.executeQuery(
        () =>
          db
            .select()
            .from(mvSchoolStatistics)
            .where(options.schoolId ? eq(mvSchoolStatistics.schoolId, options.schoolId) : undefined)
            .orderBy(desc(mvSchoolStatistics.totalStudents))
            .limit(10),
        { name: "get_school_statistics", endpoint: options.endpoint }
      ),

      // Daily activity
      queryPerformanceUtils.executeQuery(
        () =>
          db
            .select()
            .from(mvDailyActivitySummary)
            .where(
              and(
                sql`${mvDailyActivitySummary.activityDate} >= CURRENT_DATE - INTERVAL '30 days'`,
                options.schoolId ? eq(mvDailyActivitySummary.schoolId, options.schoolId) : undefined
              )
            )
            .orderBy(desc(mvDailyActivitySummary.activityDate)),
        { name: "get_daily_activity", endpoint: options.endpoint }
      ),

      // Competency analytics
      optimizedQuery.getCompetencyAnalytics({
        schoolId: options.schoolId,
        programId: options.programId,
        endpoint: options.endpoint,
      }),
    ])

    return {
      schoolStatistics: schoolStats,
      dailyActivity: dailyActivity,
      competencyAnalytics: (competencyAnalytics as Record<string, unknown>[]).slice(0, 10), // Top 10
      timestamp: new Date().toISOString(),
    }
  },
}
