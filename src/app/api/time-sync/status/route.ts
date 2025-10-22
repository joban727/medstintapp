import type { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/database/db'
import { timeSyncSessions, syncEvents } from '@/database/schema'
import { eq, desc, and, gte } from 'drizzle-orm'

// Time authority service endpoint
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return new Response('Unauthorized', { status: 401 })
    }

    const url = new URL(request.url)
    const clientId = url.searchParams.get('clientId')

    // High precision server time
    const serverTime = new Date()
    const timestamp = Date.now()
    const performanceNow = performance.now()

    // Basic time authority response
    const timeAuthority = {
      serverTime: serverTime.toISOString(),
      timestamp,
      performanceNow,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      utcOffset: serverTime.getTimezoneOffset(),
    }

    // If clientId provided, get session info and sync stats
    if (clientId) {
      try {
        // Get session info
        const session = await db.select()
          .from(timeSyncSessions)
          .where(eq(timeSyncSessions.clientId, clientId))
          .limit(1)

        // Get recent sync events for drift analysis
        const recentEvents = await db.select()
          .from(syncEvents)
          .where(
            and(
              eq(syncEvents.sessionId, clientId),
              gte(syncEvents.createdAt, new Date(Date.now() - 300000)) // Last 5 minutes
            )
          )
          .orderBy(desc(syncEvents.createdAt))
          .limit(10)

        // Calculate sync statistics
        const syncStats = {
          sessionActive: session.length > 0 && session[0].status === 'active',
          lastSync: session.length > 0 ? session[0].lastSync : null,
          protocol: session.length > 0 ? session[0].protocol : null,
          recentEventCount: recentEvents.length,
          averageDrift: recentEvents.length > 0 
            ? recentEvents.reduce((sum, event) => sum + Math.abs(event.driftMs), 0) / recentEvents.length
            : 0,
          maxDrift: recentEvents.length > 0 
            ? Math.max(...recentEvents.map(event => Math.abs(event.driftMs)))
            : 0,
        }

        return Response.json({
          ...timeAuthority,
          clientId,
          syncStats,
        })

      } catch (sessionError) {
        console.error('Session lookup error:', sessionError)
        // Return basic time authority even if session lookup fails
      }
    }

    return Response.json(timeAuthority)

  } catch (error) {
    console.error('Time authority endpoint error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

// POST endpoint for reporting client time and calculating drift
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return new Response('Unauthorized', { status: 401 })
    }

    const body = await request.json()
    const { clientId, clientTime, clientTimestamp } = body

    if (!clientId || !clientTime || !clientTimestamp) {
      return new Response('Missing required fields', { status: 400 })
    }

    const serverTime = new Date()
    const serverTimestamp = Date.now()
    
    // Calculate drift (server time - client time)
    const driftMs = serverTimestamp - clientTimestamp
    
    // Log the sync event with drift calculation
    await db.insert(syncEvents).values({
      sessionId: clientId,
      eventType: 'drift_measurement',
      serverTime,
      clientTime: new Date(clientTime),
      driftMs,
      metadata: {
        clientTimestamp,
        serverTimestamp,
        roundTripTime: Date.now() - serverTimestamp,
      }
    })

    // Update session with latest drift
    await db.update(timeSyncSessions)
      .set({
        driftMs,
        lastSync: serverTime,
        updatedAt: serverTime,
      })
      .where(eq(timeSyncSessions.clientId, clientId))

    return Response.json({
      serverTime: serverTime.toISOString(),
      serverTimestamp,
      clientTime,
      clientTimestamp,
      driftMs,
      accuracy: Math.abs(driftMs) < 100 ? 'high' : Math.abs(driftMs) < 500 ? 'medium' : 'low',
    })

  } catch (error) {
    console.error('Drift measurement error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

// Handle preflight requests for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}