/**
 * Optimized Query Wrapper
 * Provides enhanced query patterns to eliminate N+1 queries and improve performance
 * Implements batch operations and optimized JOIN strategies
 */

import { and, desc, eq, inArray, sql } from "drizzle-orm"
import { db } from "@/database/connection-pool"
import {
  competencies,
  competencyAssignments,
  competencySubmissions,
  evaluations,
  rotations,
  timeRecords,
  users,
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
    const cacheKey = `competency_assignments_${JSON.stringify({ userIds, options })}`

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
    const cacheKey = `user_progress_${JSON.stringify({ userIds, options })}`

    if (this.config.enableCaching) {
      const cached = this.getFromCache(cacheKey)
      if (cached) return cached
    }

    return queryPerformanceUtils.executeQuery(
      async () => {
        // Use materialized view for better performance
        const progressData = await db.execute(sql`
          SELECT 
            ups.user_id,
            ups.total_assignments,
            ups.completed_assignments,
            ups.pending_assignments,
            ups.overdue_assignments,
            ups.completion_rate,
            ups.average_score,
            ups.last_activity,
            u.first_name,
            u.last_name,
            u.email,
            p.name as program_name,
            r.name as rotation_name
          FROM mv_user_progress_summary ups
          INNER JOIN users u ON ups.user_id = u.id
          LEFT JOIN programs p ON ups.program_id = p.id
          LEFT JOIN rotations r ON ups.rotation_id = r.id
          WHERE ups.user_id = ANY(${userIds})
            ${options.programId ? sql`AND ups.program_id = ${options.programId}` : sql``}
            ${options.rotationId ? sql`AND ups.rotation_id = ${options.rotationId}` : sql``}
        `)

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

        const result = (progressData.rows as Record<string, unknown>[]).map((row) => ({
          userId: row.user_id,
          user: {
            id: row.user_id,
            firstName: row.first_name,
            lastName: row.last_name,
            email: row.email,
          },
          program: row.program_name ? { name: row.program_name } : null,
          rotation: row.rotation_name ? { name: row.rotation_name } : null,
          progress: {
            totalAssignments: Number.parseInt(String(row.total_assignments)) || 0,
            completedAssignments: Number.parseInt(String(row.completed_assignments)) || 0,
            pendingAssignments: Number.parseInt(String(row.pending_assignments)) || 0,
            overdueAssignments: Number.parseInt(String(row.overdue_assignments)) || 0,
            completionRate: Number.parseFloat(String(row.completion_rate)) || 0,
            averageScore: Number.parseFloat(String(row.average_score)) || 0,
            lastActivity: row.last_activity,
          },
          timeRecords: timeRecordsMap.get(row.user_id) || [],
        }))

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
    const cacheKey = `competency_analytics_${JSON.stringify(options)}`

    if (this.config.enableCaching) {
      const cached = this.getFromCache(cacheKey)
      if (cached) return cached
    }

    return queryPerformanceUtils.executeQuery(
      async () => {
        // Use materialized view for complex analytics
        const analyticsData = await db.execute(sql`
          SELECT 
            ca.competency_id,
            ca.competency_name,
            ca.total_assignments,
            ca.completed_assignments,
            ca.average_score,
            ca.pass_rate,
            ca.completion_rate,
            ca.school_id,
            ca.program_id,
            s.name as school_name,
            p.name as program_name
          FROM mv_competency_analytics ca
          LEFT JOIN schools s ON ca.school_id = s.id
          LEFT JOIN programs p ON ca.program_id = p.id
          WHERE 1=1
            ${options.schoolId ? sql`AND ca.school_id = ${options.schoolId}` : sql``}
            ${options.programId ? sql`AND ca.program_id = ${options.programId}` : sql``}
            ${options.competencyIds?.length ? sql`AND ca.competency_id = ANY(${options.competencyIds})` : sql``}
            ${options.dateRange ? sql`AND ca.last_updated >= ${options.dateRange.start} AND ca.last_updated <= ${options.dateRange.end}` : sql``}
          ORDER BY ca.completion_rate DESC, ca.average_score DESC
        `)

        const result = (analyticsData.rows as Record<string, unknown>[]).map((row) => ({
          competencyId: row.competency_id,
          competencyName: row.competency_name,
          school: row.school_name ? { id: row.school_id, name: row.school_name } : null,
          program: row.program_name ? { id: row.program_id, name: row.program_name } : null,
          metrics: {
            totalAssignments: Number.parseInt(String(row.total_assignments)) || 0,
            completedAssignments: Number.parseInt(String(row.completed_assignments)) || 0,
            averageScore: Number.parseFloat(String(row.average_score)) || 0,
            passRate: Number.parseFloat(String(row.pass_rate)) || 0,
            completionRate: Number.parseFloat(String(row.completion_rate)) || 0,
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
  async batchProcess<T, R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    options: {
      batchSize?: number
      maxConcurrency?: number
      onProgress?: (completed: number, total: number) => void
    } = {}
  ): Promise<R[]> {
    const batchSize = options.batchSize || this.config.batchSize
    const maxConcurrency = options.maxConcurrency || this.config.maxConcurrency

    const batches: T[][] = []
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize))
    }

    const results: R[] = []
    let completed = 0

    // Process batches with concurrency control
    for (let i = 0; i < batches.length; i += maxConcurrency) {
      const concurrentBatches = batches.slice(i, i + maxConcurrency)

      const batchPromises = concurrentBatches.map(async (batch) => {
        const batchResults = await processor(batch)
        completed += batch.length

        if (options.onProgress) {
          options.onProgress(completed, items.length)
        }

        return batchResults
      })

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults.flat())
    }

    return results
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
      
      keysToDelete.forEach(key => this.cache.delete(key))
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
    const progressMap = new Map((progress as Record<string, unknown>[]).map((p: Record<string, unknown>) => [p.userId, p]))
    const assignmentsMap = new Map(
      (assignments as Record<string, unknown>[]).reduce((acc: Map<string, Record<string, unknown>[]>, a: Record<string, unknown>) => {
        const assignment = a.assignment as { userId: string }
        const userId = assignment.userId
        if (!acc.has(userId)) acc.set(userId, [])
        acc.get(userId)?.push(a)
        return acc
      }, new Map())
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
          db.execute(sql`
          SELECT * FROM mv_school_statistics
          ${options.schoolId ? sql`WHERE school_id = ${options.schoolId}` : sql``}
          ORDER BY total_students DESC
          LIMIT 10
        `),
        { name: "get_school_statistics", endpoint: options.endpoint }
      ),

      // Daily activity
      queryPerformanceUtils.executeQuery(
        () =>
          db.execute(sql`
          SELECT * FROM mv_daily_activity_summary
          WHERE activity_date >= CURRENT_DATE - INTERVAL '30 days'
          ${options.schoolId ? sql`AND school_id = ${options.schoolId}` : sql``}
          ORDER BY activity_date DESC
        `),
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
