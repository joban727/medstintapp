import { type NextRequest, NextResponse } from "next/server"
import { getSchoolContext } from "@/lib/school-utils"
import { ClockService } from "@/lib/clock-service"
import { ClockError, formatErrorResponse } from "@/lib/enhanced-error-handling"
import { logger } from "@/lib/logger"
import { db } from '@/database/db'
import { timeSyncSessions, synchronizedClockRecords, syncEvents } from '@/database/schema'
import { eq } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(2)
  
  try {
    logger.info('Synchronized clock-in API request started', { requestId })
    
    // Get the authenticated user context
    const context = await getSchoolContext()
    
    if (!context.userId) {
      logger.warn('Unauthenticated synchronized clock-in attempt', { requestId })
      return NextResponse.json(
        { error: "Authentication required", code: "AUTH_REQUIRED" },
        { status: 401 }
      )
    }

    // Only allow students to clock in
    if (context.userRole !== "STUDENT") {
      logger.warn('Non-student synchronized clock-in attempt', { 
        requestId, 
        role: context.userRole 
      })
      return NextResponse.json(
        { error: "Access denied. Students only.", code: "INSUFFICIENT_PERMISSIONS" },
        { status: 403 }
      )
    }

    // Parse request body with sync data
    const body = await request.json()
    
    const {
      rotationId,
      siteId, // Backward compatibility
      timestamp,
      location,
      notes,
      // Sync-specific fields
      clientId,
      clientTime,
      clientTimestamp,
      syncedTimestamp,
      driftMs = 0,
    } = body

    // Validate sync data
    if (!clientId) {
      return NextResponse.json(
        { error: "Client ID required for synchronized clock-in", code: "SYNC_DATA_MISSING" },
        { status: 400 }
      )
    }

    // Get sync session to validate client
    const syncSession = await db.select()
      .from(timeSyncSessions)
      .where(eq(timeSyncSessions.clientId, clientId))
      .limit(1)

    if (syncSession.length === 0) {
      return NextResponse.json(
        { error: "Invalid sync session", code: "INVALID_SYNC_SESSION" },
        { status: 400 }
      )
    }

    // Calculate server-corrected timestamp
    const serverTime = new Date()
    const correctedTimestamp = syncedTimestamp || (timestamp ? new Date(timestamp) : serverTime)
    
    // Prepare clock-in request with corrected time
    const clockInRequest = {
      studentId: context.userId,
      rotationId: rotationId || siteId, // Support both for backward compatibility
      timestamp: correctedTimestamp,
      location,
      notes
    }

    // Execute atomic clock-in operation
    const result = await ClockService.clockIn(clockInRequest)
    
    // Create synchronized clock record
    if (result.success && result.data?.timeRecord) {
      try {
        await db.insert(synchronizedClockRecords).values({
          timeRecordId: result.data.timeRecord.id,
          sessionId: clientId,
          syncedClockIn: correctedTimestamp,
          clockInDriftMs: Math.abs(driftMs),
          syncAccuracy: Math.abs(driftMs) < 100 ? 'high' : Math.abs(driftMs) < 500 ? 'medium' : 'low',
          verificationStatus: 'verified',
        })

        // Log sync event
        await db.insert(syncEvents).values({
          sessionId: clientId,
          eventType: 'synchronized_clock_in',
          serverTime,
          clientTime: clientTime ? new Date(clientTime) : serverTime,
          driftMs,
          metadata: {
            timeRecordId: result.data.timeRecord.id,
            rotationId: rotationId || siteId,
            location,
          }
        })

        logger.info('Synchronized clock-in completed successfully', { 
          requestId,
          timeRecordId: result.data.timeRecord.id,
          driftMs,
          syncAccuracy: Math.abs(driftMs) < 100 ? 'high' : Math.abs(driftMs) < 500 ? 'medium' : 'low'
        })

      } catch (syncError) {
        logger.error('Failed to create synchronized clock record', { 
          requestId, 
          error: syncError,
          timeRecordId: result.data.timeRecord.id
        })
        // Don't fail the clock-in, just log the sync error
      }
    }

    // Return enhanced response with sync data
    const response = {
      ...result,
      syncData: {
        clientId,
        serverTime: serverTime.toISOString(),
        correctedTimestamp: correctedTimestamp.toISOString(),
        driftMs,
        syncAccuracy: Math.abs(driftMs) < 100 ? 'high' : Math.abs(driftMs) < 500 ? 'medium' : 'low',
        sessionActive: syncSession[0].status === 'active',
      }
    }

    return NextResponse.json(response, { status: 200 })

  } catch (error) {
    logger.error('Synchronized clock-in API error', { 
      requestId, 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })

    if (error instanceof ClockError) {
      return NextResponse.json(
        formatErrorResponse(error, requestId),
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      { 
        error: "Internal server error", 
        code: "INTERNAL_ERROR",
        requestId 
      },
      { status: 500 }
    )
  }
}

// Handle preflight requests for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}