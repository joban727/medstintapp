import { auth } from "@clerk/nextjs/server"
import { eq, gt, sql } from "drizzle-orm"
import { NextResponse } from "next/server"
import { db } from "../../../database/connection-pool"
import { users, sessions } from "../../../database/schema"
import { cacheIntegrationService } from "@/lib/cache-integration"
import type { UserRole } from "@/types"
import { cache } from "@/lib/neon-cache"
import { PRODUCTION_CONFIG, STAGING_CONFIG, DEVELOPMENT_CONFIG } from "@/lib/production-config"
import {
  withErrorHandling,
  createErrorResponse,
  HTTP_STATUS,
  ERROR_MESSAGES,
} from "@/lib/api-response"

// GET /api/health - Basic health check endpoint
export const GET = withErrorHandling(async () => {
  const { userId } = await auth()
  if (!userId) {
    return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
  }

  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (
    !user.length ||
    user[0].role === null ||
    !["SUPER_ADMIN" as UserRole, "SCHOOL_ADMIN" as UserRole].includes(user[0].role as UserRole)
  ) {
    return createErrorResponse(ERROR_MESSAGES.FORBIDDEN, HTTP_STATUS.FORBIDDEN)
  }

  const healthStatus: {
    status: "healthy" | "unhealthy"
    timestamp: string
    uptime: number
    environment: string
    version: string
    database: "connected" | "disconnected"
    memory: { used: number; total: number }
  } = {
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

  try {
    await db.select().from(users).limit(1)
  } catch (dbError) {
    healthStatus.status = "unhealthy"
    healthStatus.database = "disconnected"
    console.error("Database health check failed:", dbError)
  }

  const statusCode =
    healthStatus.status === "healthy" ? HTTP_STATUS.OK : HTTP_STATUS.INTERNAL_SERVER_ERROR
  return NextResponse.json(healthStatus, { status: statusCode })
})

// Add POST handler after GET (admin-only active session count)
export const POST = withErrorHandling(async (req: Request) => {
  const { userId } = await auth()
  if (!userId) {
    return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
  }

  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (
    !user.length ||
    user[0].role === null ||
    !["SUPER_ADMIN" as UserRole, "SCHOOL_ADMIN" as UserRole].includes(user[0].role as UserRole)
  ) {
    return createErrorResponse(ERROR_MESSAGES.FORBIDDEN, HTTP_STATUS.FORBIDDEN)
  }

  let includeSessionCount = false
  try {
    const body = await req.json()
    includeSessionCount = !!body?.includeSessionCount
  } catch {
    includeSessionCount = true
  }

  if (!includeSessionCount) {
    return NextResponse.json({ message: "No-op" }, { status: HTTP_STATUS.OK })
  }

  const env = process.env.NODE_ENV || "development"
  const _currentConfig = env === "production" ? PRODUCTION_CONFIG : DEVELOPMENT_CONFIG
  let activeSessions = 0

  // Try Redis cache if available, otherwise fall back to database
  const useRedis = await cache.isHealthy()
  if (useRedis) {
    activeSessions = await cache.getActiveSessionCount()
  } else {
    const now = new Date()
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(sessions)
      .where(gt(sessions.expiresAt, now))

    activeSessions = Number(count) || 0
  }

  return NextResponse.json({ activeSessions }, { status: HTTP_STATUS.OK })
})

