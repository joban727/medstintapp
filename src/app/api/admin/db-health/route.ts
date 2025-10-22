import { type NextRequest, NextResponse } from "next/server"
import {
  checkDatabaseConnection,
  dbUtils,
  getPoolMetrics,
} from "../../../../database/connection-pool"
import { connectionMonitor } from "../../../../lib/connection-monitor"
import { cacheIntegrationService } from '@/lib/cache-integration'


/**
 * GET /api/admin/db-health
 * Returns comprehensive database health and performance metrics
 */
export async function GET(request: NextRequest) {
  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      'api:admin/db-health/route.ts',
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
    console.warn('Cache error in admin/db-health/route.ts:', cacheError)
    // Continue with original logic if cache fails
  }
  
  async function executeOriginalLogic() {

  try {
    // Check if user has admin privileges (you may want to add proper auth here)
    const authHeader = request.headers.get("authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized - Admin access required" }, { status: 401 })
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const hours = Number.parseInt(searchParams.get("hours") || "1")
    const includeMetrics = searchParams.get("metrics") !== "false"
    const includeRecommendations = searchParams.get("recommendations") !== "false"

    // Gather comprehensive health data
    const [healthStatus, performanceMetrics] = await Promise.all([
      dbUtils.getHealthStatus(),
      includeMetrics ? dbUtils.getPerformanceMetrics(hours) : null,
    ])

    const poolMetrics = getPoolMetrics()

    // Get connection monitor summary
    const monitorSummary = connectionMonitor.getPerformanceSummary()

    const response = {
      timestamp: new Date().toISOString(),
      status: healthStatus.status === "healthy" ? "healthy" : "unhealthy",
      database: {
        connected: healthStatus.status === "healthy",
        responseTime: healthStatus.responseTime,
        pool: {
          totalConnections: poolMetrics.totalConnections,
          idleConnections: poolMetrics.idleConnections,
          waitingClients: poolMetrics.waitingClients,
          utilization: poolMetrics.utilization,
        },
      },
      ...(includeMetrics &&
        performanceMetrics && {
          performance: {
            queryMetrics: performanceMetrics,
            monitoring: {
              totalQueries: monitorSummary.totalQueries,
              averageUtilization: monitorSummary.averageUtilization,
              averageQueryTime: monitorSummary.averageQueryTime,
              errorRate: monitorSummary.errorRate,
              slowQueryCount: monitorSummary.slowQueryCount,
              peakUtilization: monitorSummary.peakUtilization,
              alertCount: monitorSummary.alertCount,
            },
          },
        }),
      ...(includeRecommendations && {
        healthReport: connectionMonitor.generateHealthReport(),
      }),
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Error fetching database health:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch database health metrics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }

  }
}

/**
 * POST /api/admin/db-health/refresh
 * Refreshes materialized views and clears connection pool metrics
 */
export async function POST(request: NextRequest) {
  try {
    // Check authorization
    const authHeader = request.headers.get("authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized - Admin access required" }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body

    switch (action) {
      case "refresh_views": {
        // Import the refresh function
        const { db } = await import("../../../../database/db")
        await db.execute("SELECT refresh_all_materialized_views()")

        return NextResponse.json({
          success: true,
          message: "Materialized views refreshed successfully",
          timestamp: new Date().toISOString(),
        })
      }

      case "reset_metrics":
        connectionMonitor.resetMetrics()

        return NextResponse.json({
          success: true,
          message: "Connection metrics reset successfully",
          timestamp: new Date().toISOString(),
        })

      case "pool_health_check": {
        const healthCheck = await checkDatabaseConnection()

        return NextResponse.json({
          success: true,
          data: healthCheck,
          timestamp: new Date().toISOString(),
        })
      }

      default:
        return NextResponse.json(
          {
            error:
              "Invalid action. Supported actions: refresh_views, reset_metrics, pool_health_check",
          },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error("Error executing database health action:", error)
    
    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateAllCache()
    } catch (cacheError) {
      console.warn('Cache invalidation error in admin/db-health/route.ts:', cacheError)
    }
    
    return NextResponse.json(
      {
        error: "Failed to execute database health action",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
