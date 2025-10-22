import type { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/database/db'
import { timeSyncSessions, syncEvents } from '@/database/schema'
import { eq, and, gte } from 'drizzle-orm'

// Long polling endpoint for time synchronization fallback
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return new Response('Unauthorized', { status: 401 })
    }

    const url = new URL(request.url)
    const clientId = url.searchParams.get('clientId') || crypto.randomUUID()
    const timeout = Number.parseInt(url.searchParams.get('timeout') || '30000') // 30 second default
    const lastEventTime = url.searchParams.get('lastEventTime')

    // Create or update sync session
    const sessionData = {
      clientId,
      userId,
      protocol: 'longpoll' as const,
      status: 'active' as const,
      lastSync: new Date(),
      updatedAt: new Date(),
    }

    await db.insert(timeSyncSessions)
      .values(sessionData)
      .onConflictDoUpdate({
        target: [timeSyncSessions.clientId],
        set: {
          lastSync: new Date(),
          status: 'active',
          updatedAt: new Date(),
        }
      })

    // Set up timeout for long polling
    const startTime = Date.now()
    const maxWaitTime = Math.min(timeout, 60000) // Max 60 seconds

    // Function to check for new events
    const checkForEvents = async () => {
      const serverTime = new Date()
      const timestamp = Date.now()

      // If this is the first request or enough time has passed, return sync data
      const shouldSync = !lastEventTime || 
        (timestamp - Number.parseInt(lastEventTime)) > 5000 // 5 second minimum interval

      if (shouldSync) {
        // Log sync event
        await db.insert(syncEvents).values({
          sessionId: clientId,
          eventType: 'long_poll_sync',
          serverTime,
          clientTime: serverTime, // Will be updated by client
          driftMs: 0, // Will be calculated by client
        }).catch(console.error)

        return {
          type: 'time_sync',
          timestamp,
          serverTime: serverTime.toISOString(),
          clientId,
          pollInterval: 5000, // Suggest 5 second polling interval
        }
      }

      return null
    }

    // Implement long polling with timeout
    const pollForData = async (): Promise<any> => {
      const event = await checkForEvents()
      if (event) {
        return event
      }

      // If we haven't exceeded timeout, wait and try again
      if (Date.now() - startTime < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1 second
        return pollForData()
      }

      // Timeout reached, return heartbeat
      return {
        type: 'heartbeat',
        timestamp: Date.now(),
        serverTime: new Date().toISOString(),
        clientId,
        pollInterval: 5000,
      }
    }

    const result = await pollForData()

    return Response.json(result, {
      headers: {
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      }
    })

  } catch (error) {
    console.error('Long polling endpoint error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

// Handle preflight requests for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}