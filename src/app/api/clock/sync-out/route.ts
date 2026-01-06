import { type NextRequest, NextResponse } from "next/server"
import { getSchoolContext } from "@/lib/school-utils"
import type { UserRole } from "@/types"
import { ClockService } from "@/lib/clock-service"
import { ClockError, formatErrorResponse } from "@/lib/enhanced-error-handling"
import { logger } from "@/lib/logger"
import { db } from "@/database/connection-pool"
import { timeSyncSessions, synchronizedClockRecords, syncEvents } from "@/database/schema"
import { eq } from "drizzle-orm"
import {
  createSuccessResponse,
  createErrorResponse,
  HTTP_STATUS,
  ERROR_MESSAGES,
  withErrorHandling,
} from "@/lib/api-response"

export const POST = withErrorHandling(async (request: NextRequest) => {
  const requestId = Math.random().toString(36).substring(2)

  logger.info({ requestId }, "Synchronized clock-out API request started")

  // Get the authenticated user context
  const context = await getSchoolContext()

  if (!context.userId) {
    logger.warn({ requestId }, "Unauthenticated synchronized clock-out attempt")
    return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED, {
      code: "AUTH_REQUIRED",
    })
  }

  // Only allow students to clock out
  if (context.userRole !== ("STUDENT" as UserRole)) {
    logger.warn(
      {
        requestId,
        role: context.userRole,
      },
      "Non-student synchronized clock-out attempt"
    )
    return createErrorResponse("Access denied. Students only.", HTTP_STATUS.FORBIDDEN, {
      code: "INSUFFICIENT_PERMISSIONS",
    })
  }

  // Parse request body with sync data
  const body = await request.json()

  const {
    rotationId,
    timestamp,
    location,
    notes,
    activities,
    // Sync-specific fields
    clientId,
    clientTime,
    clientTimestamp,
    syncedTimestamp,
    driftMs = 0,
  } = body

  // Validate sync data
  if (!clientId) {
    return createErrorResponse(
      "Client ID required for synchronized clock-out",
      HTTP_STATUS.BAD_REQUEST,
      { code: "SYNC_DATA_MISSING" }
    )
  }

  // Get sync session to validate client
  const syncSession = await db
    .select()
    .from(timeSyncSessions)
    .where(eq(timeSyncSessions.clientId, clientId))
    .limit(1)

  if (syncSession.length === 0) {
    return createErrorResponse("Invalid sync session", HTTP_STATUS.BAD_REQUEST, {
      code: "INVALID_SYNC_SESSION",
    })
  }

  // Calculate server-corrected timestamp
  const serverTime = new Date()
  const correctedTimestamp = syncedTimestamp || (timestamp ? new Date(timestamp) : serverTime)

  // Prepare clock-out request with corrected time
  const clockOutRequest = {
    studentId: context.userId,
    rotationId: rotationId || "",
    timestamp: correctedTimestamp,
    location,
    notes,
    activities,
  }

  // Execute atomic clock-out operation
  const result = await ClockService.clockOut(clockOutRequest)

  // Update synchronized clock record with clock-out data
  if (result.isClocked && result.recordId) {
    try {
      // Find existing synchronized record for this time record
      const existingRecord = await db
        .select()
        .from(synchronizedClockRecords)
        .where(eq(synchronizedClockRecords.timeRecordId, result.recordId))
        .limit(1)

      if (existingRecord.length > 0) {
        // Update existing record with clock-out data
        await db
          .update(synchronizedClockRecords)
          .set({
            syncedClockOut: correctedTimestamp,
            clockOutDriftMs: Math.abs(driftMs),
            syncAccuracy:
              Math.abs(driftMs) < 100 ? "high" : Math.abs(driftMs) < 500 ? "medium" : "low",
            verificationStatus: "verified",
            updatedAt: serverTime,
          })
          .where(eq(synchronizedClockRecords.timeRecordId, result.recordId))
      } else {
        // Create new record if none exists (shouldn't happen in normal flow)
        await db.insert(synchronizedClockRecords).values({
          timeRecordId: result.recordId,
          sessionId: clientId,
          syncedClockOut: correctedTimestamp,
          clockOutDriftMs: Math.abs(driftMs),
          syncAccuracy:
            Math.abs(driftMs) < 100 ? "high" : Math.abs(driftMs) < 500 ? "medium" : "low",
          verificationStatus: "verified",
        })
      }

      // Log sync event
      await db.insert(syncEvents).values({
        sessionId: clientId,
        eventType: "synchronized_clock_out",
        serverTime,
        clientTime: clientTime ? new Date(clientTime) : serverTime,
        driftMs,
        metadata: {
          timeRecordId: result.recordId,
          location,
          activities,
        },
      })

      logger.info(
        {
          requestId,
          timeRecordId: result.recordId,
          driftMs,
          syncAccuracy:
            Math.abs(driftMs) < 100 ? "high" : Math.abs(driftMs) < 500 ? "medium" : "low",
        },
        "Synchronized clock-out completed successfully"
      )
    } catch (syncError: unknown) {
      logger.error(
        {
          requestId,
          error: syncError instanceof Error ? syncError.message : String(syncError),
          timeRecordId: result.recordId,
        },
        "Failed to update synchronized clock record"
      )
      // Don't fail the clock-out, just log the sync error
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
      syncAccuracy: Math.abs(driftMs) < 100 ? "high" : Math.abs(driftMs) < 500 ? "medium" : "low",
      sessionActive: syncSession[0].status === "active",
    },
  }

  return createSuccessResponse(response)
})

// Handle preflight requests for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  })
}
