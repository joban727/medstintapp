import type { NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/database/connection-pool"
import { timeSyncSessions, syncEvents } from "@/database/schema"
import { eq } from "drizzle-orm"
import { logger } from "@/lib/logger"

// Interface for controller with cleanup capability
interface ControllerWithCleanup extends ReadableStreamDefaultController<string> {
  cleanup?: () => Promise<void>
}

// Server-Sent Events endpoint for real-time time synchronization
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return new Response("Unauthorized", { status: 401 })
    }

    // Get client ID from query params or generate one
    const url = new URL(request.url)
    const clientId = url.searchParams.get("clientId") || crypto.randomUUID()

    // Create or update sync session
    const sessionData = {
      clientId,
      userId,
      protocol: "sse" as const,
      status: "active" as const,
      lastSync: new Date(),
      updatedAt: new Date(),
    }

    // Insert or update session
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

    // Set up SSE headers
    const headers = new Headers({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Cache-Control",
    })

    // Store cleanup function reference for the cancel handler
    let cleanupFn: (() => Promise<void>) | undefined

    // Create readable stream for SSE
    const stream = new ReadableStream<string>({
      start(controller) {
        // Send initial connection event
        const initialEvent = {
          type: "connection",
          timestamp: Date.now(),
          serverTime: new Date().toISOString(),
          clientId,
        }

        controller.enqueue(`data: ${JSON.stringify(initialEvent)}\n\n`)

        // Set up time sync interval (every 5 seconds)
        const syncInterval = setInterval(async () => {
          try {
            const serverTime = new Date()
            const timestamp = Date.now()

            const syncEvent = {
              type: "time_sync",
              timestamp,
              serverTime: serverTime.toISOString(),
              clientId,
            }

            // Log sync event to database
            await db
              .insert(syncEvents)
              .values({
                sessionId: clientId, // Using clientId as sessionId for simplicity
                eventType: "time_sync",
                serverTime,
                clientTime: serverTime, // Will be updated by client
                driftMs: 0, // Will be calculated by client
              })
              .catch((err) => logger.error({ err }, "Failed to log sync event"))

            controller.enqueue(`data: ${JSON.stringify(syncEvent)}\n\n`)
          } catch (error) {
            logger.error({ err: error }, "SSE sync error")
          }
        }, 5000)

        // Heartbeat to keep connection alive (every 30 seconds)
        const heartbeatInterval = setInterval(() => {
          try {
            const heartbeat = {
              type: "heartbeat",
              timestamp: Date.now(),
              serverTime: new Date().toISOString(),
            }
            controller.enqueue(`data: ${JSON.stringify(heartbeat)}\n\n`)
          } catch (error) {
            logger.error({ err: error }, "SSE heartbeat error")
          }
        }, 30000)

        // Cleanup function
        const cleanup = async () => {
          clearInterval(syncInterval)
          clearInterval(heartbeatInterval)

          // Update session status to inactive
          try {
            await db
              .update(timeSyncSessions)
              .set({
                status: "inactive",
                updatedAt: new Date(),
              })
              .where(eq(timeSyncSessions.clientId, clientId))
          } catch (error) {
            logger.error({ err: error }, "Session cleanup error")
          }
        }

        // Store cleanup function for cancel handler
        cleanupFn = cleanup

        // Handle client disconnect
        request.signal.addEventListener("abort", cleanup)
      },

      cancel() {
        // Cleanup when stream is cancelled
        if (cleanupFn) {
          cleanupFn()
        }
      },
    })

    return new Response(stream, { headers })
  } catch (error) {
    logger.error({ err: error }, "SSE endpoint error")
    return new Response("Internal Server Error", { status: 500 })
  }
}

// Handle preflight requests for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  })
}
