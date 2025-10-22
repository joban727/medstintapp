/**
 * Performance Monitoring API Endpoint
 * Provides comprehensive database and query performance metrics
 * for Neon PostgreSQL database optimization
 */

import { sql } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { db, dbUtils } from "../../../../database/connection-pool"
import { queryPerformanceLogger } from "../../../../lib/query-performance-logger"
import { cacheIntegrationService } from '@/lib/cache-integration'


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
  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      'api:admin/performance/route.ts',
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
    console.warn('Cache error in admin/performance/route.ts:', cacheError)
    // Continue with original logic if cache fails
  }
  
  async function executeOriginalLogic() {

  try {
    const { searchParams } = new URL(request.url)
    const hours = Number.parseInt(searchParams.get("hours") || "24")
    const includeRecommendations = searchParams.get("recommendations") === "true"
    const includeIndexes = searchParams.get("indexes") === "true"

    // Get database health status
    const healthStatus = await dbUtils.getHealthStatus()

    // Get query performance summary
    const querySummary = await queryPerformanceLogger.getPerformanceSummary(hours)

    // Get slow queries from database
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
      WHERE created_at >= NOW() - INTERVAL '${sql.raw(hours.toString())} hours'
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
  try {
    const body = await request.json()
    const { action, params } = body

    switch (action) {
      case "analyze_query": {
        if (!params?.query) {
          return NextResponse.json({ error: "Query parameter is required" }, { status: 400 })
        }

        // Analyze query performance
        const startTime = Date.now()
        try {
          const result = await db.execute(
            sql`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql.raw(params.query)}`
          )
          const executionTime = Date.now() - startTime

          return NextResponse.json({
            executionTime,
            queryPlan: result.rows[0],
            analysis: {
              isOptimal: executionTime < 100,
              recommendations:
                executionTime > 500
                  ? [
                      "Query execution time is high. Consider adding indexes or optimizing query structure.",
                    ]
                  : ["Query performance is acceptable."],
            },
          })
        } catch (error) {
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
        // Refresh database statistics
        await db.execute(sql`ANALYZE`)
        return NextResponse.json({ message: "Database statistics refreshed successfully" })

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
  } catch (error) {
    console.error("Error processing performance action:", error)
    
    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateAllCache()
    } catch (cacheError) {
      console.warn('Cache invalidation error in admin/performance/route.ts:', cacheError)
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
