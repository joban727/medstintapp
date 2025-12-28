import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/database/connection-pool"
import { timeRecords } from "@/database/schema"
import { eq, desc } from "drizzle-orm"
import {
  createSuccessResponse,
  createErrorResponse,
  withErrorHandling,
  withErrorHandlingAsync,
  HTTP_STATUS,
  ERROR_MESSAGES,
} from "../../../../lib/api-response"
import { apiAuthMiddleware } from "@/lib/rbac-middleware"

// GET /api/time-records/recent - Get recent time records
export async function GET(request: NextRequest) {
  return withErrorHandlingAsync(async () => {
    const authResult = await apiAuthMiddleware(request)

    if (!authResult.success) {
      return createErrorResponse(authResult.error || ERROR_MESSAGES.UNAUTHORIZED, authResult.status || HTTP_STATUS.UNAUTHORIZED)
    }

    const { user } = authResult
    if (!user) {
      return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
    }

    const userId = user.id

    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "10")

    // Get recent time records for this student
    const records = await db
      .select({
        id: timeRecords.id,
        clockIn: timeRecords.clockIn,
        clockOut: timeRecords.clockOut,
        totalHours: timeRecords.totalHours,
        activities: timeRecords.activities,
        notes: timeRecords.notes,
        status: timeRecords.status,
        studentId: timeRecords.studentId,
        rotationId: timeRecords.rotationId,
        date: timeRecords.date,
      })
      .from(timeRecords)
      .where(eq(timeRecords.studentId, userId))
      .orderBy(desc(timeRecords.clockIn))
      .limit(limit)

    return createSuccessResponse({
      records: records.map((record) => ({
        ...record,
        clockIn: record.clockIn?.toISOString() || null,
        clockOut: record.clockOut?.toISOString(),
      })),
    })
  })
}

