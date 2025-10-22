import { auth } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { db } from "../../../database/connection-pool"
import { users } from "../../../database/schema"
import { cacheIntegrationService } from '@/lib/cache-integration'


// GET /api/health - Basic health check endpoint
export async function GET() {
  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      'api:health/route.ts',
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
    console.warn('Cache error in health/route.ts:', cacheError)
    // Continue with original logic if cache fails
  }
  
  async function executeOriginalLogic() {

  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has admin permissions
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1)
    if (!user.length || !["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(user[0].role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Basic health checks
    const healthStatus = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || "development",
      version: process.env.npm_package_version || "unknown",
      database: "connected",
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
    }

    // Test database connection
    try {
      await db.select().from(users).limit(1)
    } catch (dbError) {
      healthStatus.status = "unhealthy"
      healthStatus.database = "disconnected"
      console.error("Database health check failed:", dbError)
    }

    const statusCode = healthStatus.status === "healthy" ? 200 : 503
    return NextResponse.json(healthStatus, { status: statusCode })
  } catch (error) {
    console.error("Health check error:", error)
    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: "Health check failed",
      },
      { status: 503 }
    )
  }

  }
}
