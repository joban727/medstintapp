import { type NextRequest, NextResponse } from "next/server"
import {
  checkDatabaseConnection,
  dbUtils,
  getPoolMetrics,
} from "../../../../database/connection-pool"
import { connectionMonitor } from "../../../../lib/connection-monitor"
import { cacheIntegrationService } from "@/lib/cache-integration"
import {
  createSuccessResponse,
  createErrorResponse,
  HTTP_STATUS,
  ERROR_MESSAGES,
  withErrorHandling,
} from "@/lib/api-response"

/**
 * GET /api/admin/db-health
 * Returns comprehensive database health and performance metrics
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  async function executeOriginalLogic() {
    // Check if user has admin privileges (you may want to add proper auth here)
    const authHeader = request.headers.get("authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
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

    return createSuccessResponse(response)
  }

  // Try to get cached response
  const cached = await cacheIntegrationService.cachedApiResponse(
    "api:admin/db-health/route.ts",
    async () => {
      return await executeOriginalLogic()
    },
    300 // 5 minutes TTL
  )

  if (cached) {
    return cached
  }

  // If cache returned null/undefined, execute original logic
  return await executeOriginalLogic()
})

/**
 * POST /api/admin/db-health/refresh
 * Refreshes materialized views and clears connection pool metrics
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  // Check authorization
  const authHeader = request.headers.get("authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
  }

  const body = await request.json()
  const { action } = body

  switch (action) {
    case "refresh_views": {
      // Import the refresh function
      const { db } = await import("../../../../database/db")
      await db.execute("SELECT refresh_all_materialized_views()")

      return createSuccessResponse({
        success: true,
        message: "Materialized views refreshed successfully",
        timestamp: new Date().toISOString(),
      })
    }

    case "reset_metrics":
      connectionMonitor.resetMetrics()

      return createSuccessResponse({
        success: true,
        message: "Connection metrics reset successfully",
        timestamp: new Date().toISOString(),
      })

    case "pool_health_check": {
      const healthCheck = await checkDatabaseConnection()

      return createSuccessResponse({
        success: true,
        data: healthCheck,
        timestamp: new Date().toISOString(),
      })
    }

    default:
      return createErrorResponse(
        "Invalid action. Supported actions: refresh_views, reset_metrics, pool_health_check",
        HTTP_STATUS.BAD_REQUEST
      )
  }
})

