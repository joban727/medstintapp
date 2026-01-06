import type { NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/database/connection-pool"
import { timeSyncSessions, syncEvents } from "@/database/schema"
import { eq, and, gte } from "drizzle-orm"
import { apiAuthMiddleware } from "@/lib/rbac-middleware"
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandling,
  withErrorHandlingAsync,
  HTTP_STATUS,
  ERROR_MESSAGES,
} from "@/lib/api-response"

// Long polling endpoint for time synchronization fallback
export async function GET(request: NextRequest) {
  return withErrorHandlingAsync(async () => {
    const authResult = await apiAuthMiddleware(request)

    if (!authResult.success) {
      return createErrorResponse(
        authResult.error || ERROR_MESSAGES.UNAUTHORIZED,
        authResult.status || HTTP_STATUS.UNAUTHORIZED
      )
    }

    const { user } = authResult
    if (!user) {
      return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
    }

    const userId = user.id

    const url = new URL(request.url)
    const clientId = url.searchParams.get("clientId") || crypto.randomUUID()
    const timeout = Number.parseInt(url.searchParams.get("timeout") || "30000") // 30 second default
    const lastEventTime = url.searchParams.get("lastEventTime")

    // Create or update sync session
    const sessionData = {
      clientId,
      userId,
      protocol: "longpoll" as const,
      status: "active" as const,
      lastSync: new Date(),
      updatedAt: new Date(),
    }

    await db
      .insert(timeSyncSessions)
      .values(sessionData)
      .onConflictDoUpdate({
        target: [timeSyncSessions.clientId],
        set: {
          lastSync: new Date(),
          status: "active",
          updatedAt: new Date(),
        },
      })

    // Set up timeout for long polling
    const startTime = Date.now()
    const maxWaitTime = Math.min(timeout, 60000) // Max 60 seconds

    // Function to check for new events
    const checkForEvents = async () => {
      const serverTime = new Date()
      const timestamp = Date.now()

      // If this is the first request or enough time has passed, return sync data
      const shouldSync = !lastEventTime || timestamp - Number.parseInt(lastEventTime) > 5000 // 5 second minimum interval

      if (shouldSync) {
        // Log sync event
        await db
          .insert(syncEvents)
          .values({
            sessionId: clientId,
            eventType: "long_poll_sync",
            serverTime,
            clientTime: serverTime, // Will be updated by client
            driftMs: 0, // Will be calculated by client
          })
          .catch(console.error)

        return {
          type: "time_sync",
          timestamp,
          serverTime: serverTime.toISOString(),
          clientId,
          pollInterval: 5000, // Suggest 5 second polling interval
        }
      }

      return null
    }

    // Implement long polling with timeout
    let attempt = 0
    const pollForData = async (): Promise<any> => {
      const event = await checkForEvents()
      if (event) {
        return event
      }

      // If we haven't exceeded timeout, wait with mild backoff and try again
      if (Date.now() - startTime < maxWaitTime) {
        attempt += 1
        const delay = Math.min(1000 + attempt * 200, 5000)
        await new Promise((resolve) => setTimeout(resolve, delay))
        return pollForData()
      }

      // Timeout reached, return heartbeat
      return {
        type: "heartbeat",
        timestamp: Date.now(),
        serverTime: new Date().toISOString(),
        clientId,
        pollInterval: 5000,
      }
    }

    const result = await pollForData()

    return createSuccessResponse(result, "Time sync data retrieved successfully", HTTP_STATUS.OK)
  })
}

// Handle preflight requests for CORS
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin") || "*"
  const allowed = (process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  const allowOrigin = allowed.length === 0 ? "*" : allowed.includes(origin) ? origin : allowed[0]
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": allowOrigin,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  })
}
