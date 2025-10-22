import { auth } from "@clerk/nextjs/server"
import { and, desc, eq, gte, lte } from "drizzle-orm"
import { nanoid } from "nanoid"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { db } from "../../../database/connection-pool"
import {
  competencies,
  competencySubmissions,
  learningAnalytics,
  progressSnapshots,
  users,
} from "../../../database/schema"
import { cache, invalidateRelatedCaches } from "../../../lib/redis-cache"
import { cacheIntegrationService } from '@/lib/cache-integration'


// Validation schemas
const analyticsQuerySchema = z.object({
  userId: z.string().nullable().optional(),
  competencyId: z.string().nullable().optional(),
  schoolId: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  analyticsType: z
    .enum([
      "PROGRESS_OVERVIEW",
      "COMPETENCY_PERFORMANCE",
      "LEARNING_TRENDS",
      "ASSESSMENT_STATISTICS",
      "COMPARATIVE_ANALYSIS",
    ])
    .optional(),
  groupBy: z.enum(["USER", "COMPETENCY", "SCHOOL", "DATE", "CATEGORY"]).optional(),
  limit: z.string().transform(Number).optional().default(100),
})

const analyticsCreateSchema = z.object({
  userId: z.string(),
  competencyId: z.string().optional(),
  programId: z.string().optional(),
  schoolId: z.string(),
  metricType: z.string(),
  metricValue: z.string(),
  timePeriod: z.string(),
  aggregationLevel: z.string(),
  metadata: z.string().optional(),
})

// Helper function to check permissions
async function checkPermissions(userId: string, targetUserId?: string) {
  const { userId: clerkUserId } = await auth()
  if (!clerkUserId) {
    throw new Error("Unauthorized")
  }

  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1)

  if (!user.length) {
    throw new Error("User not found")
  }

  const userRole = user[0].role
  const isAdmin = ["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(userRole)
  const isSupervisor = ["CLINICAL_SUPERVISOR", "CLINICAL_PRECEPTOR"].includes(userRole)
  const isStudent = userRole === "STUDENT"
  const isOwnData = userId === targetUserId

  return {
    canView: isAdmin || isSupervisor || (isStudent && isOwnData),
    canViewAll: isAdmin || isSupervisor,
    canGenerate: isAdmin || isSupervisor,
    userRole,
    schoolId: user[0].schoolId,
  }
}

// Helper function to generate progress overview
async function generateProgressOverview(
  userId?: string,
  schoolId?: string,
  competencyId?: string,
  startDate?: string,
  endDate?: string
) {
  const conditions = []

  if (userId) {
    conditions.push(eq(progressSnapshots.userId, userId))
  }
  if (schoolId) {
    conditions.push(eq(users.schoolId, schoolId))
  }
  if (competencyId) {
    conditions.push(eq(progressSnapshots.competencyId, competencyId))
  }
  if (startDate) {
    conditions.push(gte(progressSnapshots.snapshotDate, new Date(startDate)))
  }
  if (endDate) {
    conditions.push(lte(progressSnapshots.snapshotDate, new Date(endDate)))
  }

  // Get basic statistics
  const snapshots = await db
    .select({
      id: progressSnapshots.id,
      status: progressSnapshots.status,
      progressPercentage: progressSnapshots.progressPercentage,
      snapshotDate: progressSnapshots.snapshotDate,
      category: competencies.category,
    })
    .from(progressSnapshots)
    .leftJoin(users, eq(progressSnapshots.userId, users.id))
    .leftJoin(competencies, eq(progressSnapshots.competencyId, competencies.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)

  // Calculate statistics in JavaScript
  const totalSnapshots = snapshots.length
  const avgProgress =
    snapshots.reduce((sum, s) => sum + (Number(s.progressPercentage) || 0), 0) / totalSnapshots || 0
  const completedCount = snapshots.filter((s) => s.status === "COMPLETED").length
  const activeCount = snapshots.filter((s) => s.status === "ACTIVE").length
  const overdueCount = snapshots.filter((s) => s.status === "OVERDUE").length

  // Group by category
  const categoryMap = new Map()
  snapshots.forEach((s) => {
    const category = s.category || "Unknown"
    if (!categoryMap.has(category)) {
      categoryMap.set(category, { total: 0, progress: 0, completed: 0 })
    }
    const stats = categoryMap.get(category)
    stats.total++
    stats.progress += Number(s.progressPercentage) || 0
    if (s.status === "COMPLETED") stats.completed++
  })

  const byCategory = Array.from(categoryMap.entries()).map(([category, stats]) => ({
    category,
    avgProgress: stats.progress / stats.total,
    totalAssignments: stats.total,
    completedCount: stats.completed,
  }))

  // Recent trends (last 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const recentSnapshots = snapshots.filter(
    (s) => s.snapshotDate && new Date(s.snapshotDate) >= thirtyDaysAgo
  )

  const trendMap = new Map()
  recentSnapshots.forEach((s) => {
    const dateKey = s.snapshotDate?.toISOString().split("T")[0]
    if (!dateKey) return
    if (!trendMap.has(dateKey)) {
      trendMap.set(dateKey, { progress: 0, count: 0 })
    }
    const trend = trendMap.get(dateKey)
    trend.progress += Number(s.progressPercentage) || 0
    trend.count++
  })

  const trends = Array.from(trendMap.entries()).map(([date, trend]) => ({
    date,
    avgProgress: trend.progress / trend.count,
    snapshotCount: trend.count,
  }))

  return {
    overall: {
      totalSnapshots,
      avgProgress,
      completedCount,
      activeCount,
      overdueCount,
    },
    byCategory,
    trends,
  }
}

// Helper function to generate competency performance analytics
async function generateCompetencyPerformance(
  userId?: string,
  schoolId?: string,
  competencyId?: string,
  startDate?: string,
  endDate?: string
) {
  const conditions = []

  if (userId) {
    conditions.push(eq(competencySubmissions.studentId, userId))
  }
  if (schoolId) {
    conditions.push(eq(users.schoolId, schoolId))
  }
  if (competencyId) {
    conditions.push(eq(competencySubmissions.competencyId, competencyId))
  }
  if (startDate) {
    conditions.push(gte(competencySubmissions.submittedAt, new Date(startDate)))
  }
  if (endDate) {
    conditions.push(lte(competencySubmissions.submittedAt, new Date(endDate)))
  }

  // Get submissions with competency details
  const submissions = await db
    .select({
      competencyId: competencySubmissions.competencyId,
      competencyName: competencies.name,
      category: competencies.category,
      status: competencySubmissions.status,
      submittedAt: competencySubmissions.submittedAt,
    })
    .from(competencySubmissions)
    .leftJoin(users, eq(competencySubmissions.studentId, users.id))
    .leftJoin(competencies, eq(competencySubmissions.competencyId, competencies.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)

  // Calculate statistics in JavaScript
  const totalSubmissions = submissions.length
  const overallApprovedCount = submissions.filter((s) => s.status === "APPROVED").length
  const overallRejectedCount = submissions.filter((s) => s.status === "REJECTED").length
  const overallPendingCount = submissions.filter((s) => s.status === "SUBMITTED").length
  const overallUnderReviewCount = submissions.filter((s) => s.status === "UNDER_REVIEW").length

  // Group by competency
  const competencyMap = new Map()
  submissions.forEach((s) => {
    const key = s.competencyId
    if (!competencyMap.has(key)) {
      competencyMap.set(key, {
        competencyId: s.competencyId,
        competencyName: s.competencyName,
        category: s.category,
        submissions: [],

        approved: 0,
        rejected: 0,
        requiresRevision: 0,
      })
    }
    const stats = competencyMap.get(key)
    stats.submissions.push(s)

    if (s.status === "APPROVED") stats.approved++
    if (s.status === "REJECTED") stats.rejected++
    if (s.status === "REQUIRES_REVISION") stats.requiresRevision++
  })

  const competencyStats = Array.from(competencyMap.values()).map((stats) => ({
    competencyId: stats.competencyId,
    competencyName: stats.competencyName,
    category: stats.category,
    totalSubmissions: stats.submissions.length,

    approvedCount: stats.approved,
    rejectedCount: stats.rejected,
    requiresRevisionCount: stats.requiresRevision,
  }))

  // Status distribution instead of score distribution
  const statusDistribution = [
    { status: "APPROVED", count: overallApprovedCount },
    { status: "REJECTED", count: overallRejectedCount },
    { status: "SUBMITTED", count: overallPendingCount },
    { status: "UNDER_REVIEW", count: overallUnderReviewCount },
    {
      status: "REQUIRES_REVISION",
      count: submissions.filter((s) => s.status === "REQUIRES_REVISION").length,
    },
  ]

  return {
    competencyStats,
    statusDistribution,
    overall: {
      totalSubmissions,
      approvedCount: overallApprovedCount,
      rejectedCount: overallRejectedCount,
      submittedCount: overallPendingCount,
      underReviewCount: overallUnderReviewCount,
    },
  }
}

// GET /api/competency-analytics - Get analytics data
export async function GET(request: NextRequest) {
  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      'api:competency-analytics/route.ts',
      async () => {
        // Original function logic will be wrapped here
        return await executeOriginalLogic()
      },
      300 // 5 minutes TTL
    )
    
    if (cached) {
      return cached
    }
  } catch (cacheError) {
    console.warn('Cache error in competency-analytics/route.ts:', cacheError)
    // Continue with original logic if cache fails
  }
  
  async function executeOriginalLogic() {

  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const queryParams = {
      analyticsType: searchParams.get("analyticsType") || "PROGRESS_OVERVIEW",
      userId: searchParams.get("userId"),
      schoolId: searchParams.get("schoolId"),
      competencyId: searchParams.get("competencyId"),
      startDate: searchParams.get("startDate"),
      endDate: searchParams.get("endDate"),
    }

    const validatedParams = analyticsQuerySchema.parse(queryParams)
    const {
      analyticsType,
      userId: targetUserId,
      schoolId,
      competencyId,
      startDate,
      endDate,
    } = validatedParams

    // Check permissions
    const permissions = await checkPermissions(userId, targetUserId || undefined)
    if (!permissions.canView) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Enhanced cache key with version for cache busting
    const cacheVersion = "v2" // Increment when query structure changes
    const _cacheKey = `analytics:${cacheVersion}:${analyticsType}:${targetUserId || "all"}:${schoolId || "all"}:${competencyId || "all"}:${startDate || "all"}:${endDate || "all"}`

    // Try to get from cache first with different TTLs based on query type
    const cachedResult = await cache.getAnalytics({
      analyticsType: analyticsType || "DEFAULT",
      userId: targetUserId || undefined,
      schoolId: schoolId || undefined,
      competencyId: competencyId || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    })
    if (cachedResult) {
      return NextResponse.json({
        ...cachedResult,
        cached: true,
        cacheTimestamp: new Date().toISOString(),
      })
    }

    const startTime = Date.now()
    let result: unknown

    switch (analyticsType) {
      case "PROGRESS_OVERVIEW":
        result = await generateProgressOverview(
          targetUserId || undefined,
          schoolId || undefined,
          competencyId || undefined,
          startDate || undefined,
          endDate || undefined
        )
        break
      case "COMPETENCY_PERFORMANCE":
        result = await generateCompetencyPerformance(
          targetUserId || undefined,
          schoolId || undefined,
          competencyId || undefined,
          startDate || undefined,
          endDate || undefined
        )
        break
      default: {
        // Get stored analytics from database with optimized query
        const conditions = []
        if (targetUserId) conditions.push(eq(learningAnalytics.userId, targetUserId))
        if (schoolId) conditions.push(eq(learningAnalytics.schoolId, schoolId))
        if (competencyId) conditions.push(eq(learningAnalytics.competencyId, competencyId))
        if (startDate) conditions.push(gte(learningAnalytics.createdAt, new Date(startDate)))
        if (endDate) conditions.push(lte(learningAnalytics.createdAt, new Date(endDate)))

        result = await db
          .select({
            id: learningAnalytics.id,
            metricType: learningAnalytics.metricType,
            metricValue: learningAnalytics.metricValue,
            timePeriod: learningAnalytics.timePeriod,
            aggregationLevel: learningAnalytics.aggregationLevel,
            metadata: learningAnalytics.metadata,
            recordedAt: learningAnalytics.recordedAt,
            createdAt: learningAnalytics.createdAt,
            userId: learningAnalytics.userId,
            schoolId: learningAnalytics.schoolId,
            competencyId: learningAnalytics.competencyId,
          })
          .from(learningAnalytics)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(desc(learningAnalytics.createdAt))
          .limit(100)
      }
    }

    const executionTime = Date.now() - startTime

    // Log slow queries for monitoring
    if (executionTime > 1000) {
      console.warn(
        `Slow analytics query detected: ${analyticsType}, execution time: ${executionTime}ms, params:`,
        validatedParams
      )
    }

    // Dynamic cache TTL based on query complexity and data freshness requirements
    let _cacheTTL = 900 // Default 15 minutes
    if (analyticsType === "PROGRESS_OVERVIEW") {
      _cacheTTL = 300 // 5 minutes for more dynamic data
    } else if (analyticsType === "COMPETENCY_PERFORMANCE") {
      _cacheTTL = 1800 // 30 minutes for more stable performance data
    }

    // Cache the result with metadata
    const resultData = result as Record<string, unknown>
    await cache.setAnalytics(
      {
        analyticsType: analyticsType || "DEFAULT",
        userId: targetUserId || undefined,
        schoolId: schoolId || undefined,
        competencyId: competencyId || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      },
      {
        ...resultData,
        metadata: {
          generatedAt: new Date().toISOString(),
          executionTime,
          queryParams: validatedParams,
        },
      }
    )

    return NextResponse.json({
      ...resultData,
      metadata: {
        generatedAt: new Date().toISOString(),
        executionTime,
        cached: false,
      },
    })
  } catch (error) {
    console.error("Analytics API error:", error)
    return NextResponse.json({ error: "Failed to fetch analytics data" }, { status: 500 })
  }

  }
}

// POST /api/competency-analytics - Generate and store analytics
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const data = analyticsCreateSchema.parse(body)

    // Check permissions
    const permissions = await checkPermissions(userId, data.userId)
    if (!permissions.canGenerate) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Create analytics record
    const analytics = {
      id: nanoid(),
      ...data,
      recordedAt: new Date(),
      createdAt: new Date(),
    }

    const result = await db.insert(learningAnalytics).values([analytics]).returning()

    // Invalidate related caches
    await invalidateRelatedCaches({
      userId: data.userId,
      competencyId: data.competencyId,
      schoolId: data.schoolId,
    })

    return NextResponse.json({
      message: "Analytics generated successfully",
      data: result[0],
    })
  } catch (error) {
    console.error("Error generating analytics:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      )
    }
    
    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateCompetencyCache()
    } catch (cacheError) {
      console.warn('Cache invalidation error in competency-analytics/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/competency-analytics - Clean up old analytics
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check permissions - only admins can clean up analytics
    const permissions = await checkPermissions(userId)
    if (!permissions.userRole.includes("ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const daysOld = Number.parseInt(searchParams.get("daysOld") || "30")
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000)

    // Delete old analytics records
    const result = await db
      .delete(learningAnalytics)
      .where(lte(learningAnalytics.recordedAt, cutoffDate))
      .returning({ id: learningAnalytics.id })

    return NextResponse.json({
      message: `Cleaned up ${result.length} old analytics records`,
      deletedCount: result.length,
    })
  } catch (error) {
    console.error("Error cleaning up analytics:", error)
    
    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateCompetencyCache()
    } catch (cacheError) {
      console.warn('Cache invalidation error in competency-analytics/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
