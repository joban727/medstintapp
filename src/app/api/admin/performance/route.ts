/**
 * Performance Monitoring API Endpoint
 * Provides comprehensive database and query performance metrics
 * for Neon PostgreSQL database optimization
 */

import { sql } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { db, dbUtils } from "@/database/connection-pool"
import type { UserRole } from "@/types"
import { queryPerformanceLogger } from "../../../../lib/query-performance-logger"
import { cacheIntegrationService } from "@/lib/cache-integration"
import { apiAuthMiddleware, logAuditEvent } from "@/lib/rbac-middleware"
import { adminApiLimiter } from "@/lib/rate-limiter"
import { z } from "zod"
import { createHash } from "node:crypto"
import { validateAdminSelectQuery } from "@/lib/admin-query-validation"

// Performance metrics interface
interface DatabaseHealth {
  status: string
  responseTime?: number
  pool?: {
    totalConnections: number
    idleConnections: number
    waitingClients: number
    utilization: number
  }
  timestamp: string
}

interface QuerySummary {
  totalQueries: number
  averageExecutionTime: number
  slowQueries: number
  slowQueryPercentage: number
  timeRange: string
}

interface SlowQuery {
  query_type: string
  table_name: string
  endpoint: string
  execution_time_ms: number
  rows_examined: number
  rows_returned: number
  created_at: string
  query_sample: string
}

interface EndpointPerformance {
  endpoint: string
  avgTime: number
  count: number
}

interface IndexUsage {
  schemaname: string
  tablename: string
  indexname: string
  idx_scan: number
  idx_tup_read: number
  idx_tup_fetch: number
  usage_category: string
}

interface IndexEffectiveness {
  tablename: string
  seq_scan: number
  seq_tup_read: number
  idx_scan: number
  idx_tup_fetch: number
  index_effectiveness: string
}

interface PerformanceMetrics {
  database: {
    health: DatabaseHealth
    connectionPool: {
      status: string
      responseTime?: number
      poolMetrics?: {
        totalConnections: number
        idleConnections: number
        waitingClients: number
        utilization: number
      }
    }
  }
  queries: {
    summary: QuerySummary
    slowQueries: SlowQuery[]
    endpointPerformance: EndpointPerformance[]
  }
  indexes: {
    usage: IndexUsage[]
    effectiveness: IndexEffectiveness[]
  }
  recommendations: string[]
}

export async function GET(request: NextRequest) {
  // Authorization: restrict to SUPER_ADMIN
  const auth = await apiAuthMiddleware(request, { requiredRoles: ["SUPER_ADMIN"] })
  if (!auth.success) {
    return NextResponse.json(
      { error: auth.error || "Insufficient permissions" },
      { status: auth.status || 403 }
    )
  }

  // Rate limiting for admin endpoint
  const rate = await adminApiLimiter.checkLimit(request)
  if (!rate.allowed) {
    const retryAfter = Math.max(0, Math.ceil((rate.resetTime - Date.now()) / 1000))
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    )
  }

  try {
    const cached = await cacheIntegrationService.cachedApiResponse(
      "api:admin/performance/route.ts",
      async () => {
        return await executeOriginalLogic()
      },
      300
    )

    if (cached) {
      return cached
    }
  } catch (cacheError) {
    console.warn("Cache error in admin/performance/route.ts:", cacheError)
  }

  async function executeOriginalLogic() {
    try {
      const { searchParams } = new URL(request.url)
      const hoursRaw = Number.parseInt(searchParams.get("hours") || "24")
      const hours = Math.min(Math.max(1, Number.isNaN(hoursRaw) ? 24 : hoursRaw), 168)
      const includeRecommendations = searchParams.get("recommendations") === "true"
      const includeIndexes = searchParams.get("indexes") === "true"

      const healthStatus = await dbUtils.getHealthStatus()
      const querySummary = await queryPerformanceLogger.getPerformanceSummary(hours)

      // Parameterized time window to avoid SQL injection
      const slowQueries = await db.execute(sql`
      SELECT 
        query_type,
        table_name,
        endpoint,
        execution_time_ms,
        rows_examined,
        rows_returned,
        created_at,
        query_sample
      FROM query_performance_log 
      WHERE created_at >= NOW() - (INTERVAL '1 hour' * ${hours})
        AND execution_time_ms > 1000
      ORDER BY execution_time_ms DESC
      LIMIT 20
    `)

      const response: PerformanceMetrics = {
        database: {
          health: healthStatus,
          connectionPool: {
            status: healthStatus.status,
            responseTime: healthStatus.responseTime,
            poolMetrics: healthStatus.pool,
          },
        },
        queries: {
          summary: {
            totalQueries: querySummary.totalQueries,
            averageExecutionTime: Math.round(querySummary.averageExecutionTime),
            slowQueries: querySummary.slowQueries,
            slowQueryPercentage:
              querySummary.totalQueries > 0
                ? Math.round((querySummary.slowQueries / querySummary.totalQueries) * 100)
                : 0,
            timeRange: `${hours} hours`,
          },
          slowQueries: slowQueries.rows as unknown as SlowQuery[],
          endpointPerformance: querySummary.endpointPerformance,
        },
        indexes: {
          usage: [],
          effectiveness: [],
        },
        recommendations: [],
      }

      // Include index analysis if requested
      if (includeIndexes) {
        try {
          const indexUsage = await db.execute(sql`
          SELECT 
            schemaname,
            relname as tablename,
            indexrelname as indexname,
            idx_scan,
            idx_tup_read,
            idx_tup_fetch,
            CASE 
              WHEN idx_scan = 0 THEN 'UNUSED'
              WHEN idx_scan < 10 THEN 'LOW_USAGE'
              WHEN idx_scan < 100 THEN 'MODERATE_USAGE'
              ELSE 'HIGH_USAGE'
            END as usage_category
          FROM pg_stat_user_indexes
          WHERE schemaname = 'public'
          ORDER BY idx_scan DESC
          LIMIT 50
        `)

          const indexEffectiveness = await db.execute(sql`
          SELECT 
            t.relname as tablename,
            t.seq_scan,
            t.seq_tup_read,
            t.idx_scan,
            t.idx_tup_fetch,
            CASE 
              WHEN t.seq_scan > t.idx_scan THEN 'NEEDS_INDEX'
              WHEN t.idx_scan > (t.seq_scan * 10) THEN 'WELL_INDEXED'
              ELSE 'MODERATE'
            END as index_effectiveness
          FROM pg_stat_user_tables t
          WHERE t.schemaname = 'public'
          ORDER BY t.seq_scan DESC
          LIMIT 20
        `)

          response.indexes = {
            usage: indexUsage.rows as unknown as IndexUsage[],
            effectiveness: indexEffectiveness.rows as unknown as IndexEffectiveness[],
          }
        } catch (error) {
          console.error("Error fetching index statistics:", error)
        }
      }

      // Generate recommendations if requested
      if (includeRecommendations) {
        const recommendations: string[] = []

        // Query performance recommendations
        if (querySummary.averageExecutionTime > 500) {
          recommendations.push(
            "Average query execution time is high (>500ms). Consider optimizing slow queries."
          )
        }

        if (querySummary.slowQueries > querySummary.totalQueries * 0.1) {
          recommendations.push(
            "High percentage of slow queries detected. Review query patterns and indexing strategy."
          )
        }

        // Database health recommendations
        if (healthStatus.responseTime && healthStatus.responseTime > 100) {
          recommendations.push(
            "Database response time is elevated. Check connection pool configuration."
          )
        }

        // Connection pool recommendations
        if (healthStatus.pool?.utilization && healthStatus.pool.utilization > 80) {
          recommendations.push(
            "Connection pool utilization is high. Consider increasing pool size or optimizing connection usage."
          )
        }

        // Index recommendations based on usage
        if (response.indexes.usage.length > 0) {
          const unusedIndexes = response.indexes.usage.filter(
            (idx: IndexUsage) => idx.usage_category === "UNUSED"
          )
          if (unusedIndexes.length > 0) {
            recommendations.push(
              `Found ${unusedIndexes.length} unused indexes. Consider removing them to improve write performance.`
            )
          }
        }

        response.recommendations = recommendations
      }

      return NextResponse.json(response)
    } catch (error) {
      console.error("Error fetching performance metrics:", error)
      return NextResponse.json(
        {
          error: "Failed to fetch performance metrics",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 }
      )
    }
  }
}

// POST endpoint for manual performance analysis
export async function POST(request: NextRequest) {
  // Authorization: restrict to SUPER_ADMIN
  const auth = await apiAuthMiddleware(request, { requiredRoles: ["SUPER_ADMIN"] })
  if (!auth.success) {
    return NextResponse.json(
      { error: auth.error || "Insufficient permissions" },
      { status: auth.status || 403 }
    )
  }

  // Rate limiting for admin endpoint
  const rate = await adminApiLimiter.checkLimit(request)
  if (!rate.allowed) {
    const retryAfter = Math.max(0, Math.ceil((rate.resetTime - Date.now()) / 1000))
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    )
  }

  try {
    const body = await request.json()

    const adminPerformancePostSchema = z.object({
      action: z.enum(["analyze_query", "cleanup_logs", "refresh_stats"]),
      params: z.object({ query: z.string().min(1).max(2000) }).optional(),
    })

    const parsed = adminPerformancePostSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { action, params } = parsed.data

    switch (action) {
      case "analyze_query": {
        if (!params?.query) {
          return NextResponse.json({ error: "Query parameter is required" }, { status: 400 })
        }

        // Use reusable validation util
        const { valid, sanitized, reason } = validateAdminSelectQuery(params.query)
        if (!valid) {
          await logAuditEvent({
            userId: auth.user?.id,
            action: "ANALYZE_QUERY_DENIED",
            resource: "ADMIN_PERFORMANCE",
            resourceId: "analyze_query",
            details: { reason },
            ipAddress:
              request.headers.get("x-forwarded-for") ||
              request.headers.get("x-real-ip") ||
              undefined,
            userAgent: request.headers.get("user-agent") || undefined,
            severity: "MEDIUM",
            status: "FAILURE",
          })
          return NextResponse.json(
            { error: "Only single SELECT queries up to 2000 chars are allowed", details: reason },
            { status: 400 }
          )
        }

        const sanitizedQuery = sanitized!
        const queryHash = createHash("sha256").update(sanitizedQuery).digest("hex")

        const startTime = Date.now()
        try {
          const result = await db.execute(sql`EXPLAIN (FORMAT JSON) ${sql.raw(sanitizedQuery)}`)
          const executionTime = Date.now() - startTime

          await logAuditEvent({
            userId: auth.user?.id,
            action: "ANALYZE_QUERY",
            resource: "ADMIN_PERFORMANCE",
            resourceId: "analyze_query",
            details: { queryHash, length: sanitizedQuery.length },
            ipAddress:
              request.headers.get("x-forwarded-for") ||
              request.headers.get("x-real-ip") ||
              undefined,
            userAgent: request.headers.get("user-agent") || undefined,
            severity: "LOW",
            status: "SUCCESS",
          })

          return NextResponse.json({
            executionTime,
            queryPlan: result.rows[0],
            analysis: {
              isOptimal: executionTime < 100,
              recommendations:
                executionTime > 500
                  ? [
                      "Query planning time is high. Consider simplifying the query or ensuring indexes exist.",
                    ]
                  : ["Query plan appears acceptable."],
            },
          })
        } catch (error) {
          await logAuditEvent({
            userId: auth.user?.id,
            action: "ANALYZE_QUERY_ERROR",
            resource: "ADMIN_PERFORMANCE",
            resourceId: "analyze_query",
            details: { queryHash, error: error instanceof Error ? error.message : "Unknown error" },
            ipAddress:
              request.headers.get("x-forwarded-for") ||
              request.headers.get("x-real-ip") ||
              undefined,
            userAgent: request.headers.get("user-agent") || undefined,
            severity: "MEDIUM",
            status: "ERROR",
          })
          return NextResponse.json(
            {
              error: "Failed to analyze query",
              details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 400 }
          )
        }
      }

      case "cleanup_logs":
        await queryPerformanceLogger.cleanup()
        return NextResponse.json({ message: "Performance logs cleaned up successfully" })

      case "refresh_stats":
        await db.execute(sql`ANALYZE`)
        return NextResponse.json({ message: "Database statistics refreshed successfully" })

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
  } catch (error) {
    console.error("Error processing performance action:", error)

    try {
      await cacheIntegrationService.clear()
    } catch (cacheError) {
      console.warn("Cache invalidation error in admin/performance/route.ts:", cacheError)
    }

    return NextResponse.json(
      {
        error: "Failed to process performance action",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

