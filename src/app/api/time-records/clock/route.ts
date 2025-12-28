import { and, eq, isNull } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/database/connection-pool"
import { rotations, timeRecords } from "@/database/schema"
import { getSchoolContext, type SchoolContext } from "@/lib/school-utils"
import { cacheIntegrationService } from "@/lib/cache-integration"
import type { UserRole } from "@/types"
import { clockOperationLimiter } from "@/lib/rate-limiter"
import { logger } from "@/lib/logger"
import {
  createSuccessResponse,
  createErrorResponse,
  createValidationErrorResponse,
  withErrorHandling,
  withErrorHandlingAsync,
  HTTP_STATUS,
  ERROR_MESSAGES,
} from "@/lib/api-response"
import { TimingPerformanceMonitor } from "@/lib/high-precision-timing"
import crypto from "crypto"
import { ClockService } from "@/lib/clock-service"

// Helper function to extract client information
function getClientInfo(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")
  const realIp = request.headers.get("x-real-ip")
  const ipAddress = forwarded?.split(",")[0] || realIp || "unknown"
  const userAgent = request.headers.get("user-agent") || "unknown"

  return { ipAddress, userAgent }
}

// Enhanced validation schemas with comprehensive input sanitization
const clockInSchema = z.object({
  action: z.literal("clock-in"),
  rotationId: z.string().uuid("Invalid rotation ID format").min(1, "Rotation ID is required"),
  activities: z
    .array(z.string().max(200, "Activity name too long").trim())
    .max(20, "Too many activities")
    .optional(),
  notes: z.string().max(1000, "Notes too long").trim().optional(),
  // Location data (optional but recommended)
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  accuracy: z.number().min(0).optional(),
  locationSource: z.enum(["gps", "network", "manual"]).optional(),
  timestamp: z.string().optional(), // Allow client timestamp
})

const clockOutSchema = z.object({
  action: z.literal("clock-out"),
  timeRecordId: z
    .string()
    .uuid("Invalid time record ID format")
    .min(1, "Time record ID is required"),
  activities: z
    .array(z.string().max(200, "Activity name too long").trim())
    .max(20, "Too many activities")
    .optional(),
  notes: z.string().max(1000, "Notes too long").trim().optional(),
  // Location data (optional but recommended)
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  accuracy: z.number().min(0).optional(),
  locationSource: z.enum(["gps", "network", "manual"]).optional(),
  timestamp: z.string().optional(), // Allow client timestamp
})

const clockActionSchema = z.discriminatedUnion("action", [clockInSchema, clockOutSchema])

// POST /api/time-records/clock - Handle clock in/out operations
/**
 * Enhanced response helper with compression and optimized caching headers
 */
function createOptimizedResponse(
  data: unknown,
  options: {
    status?: number
    cacheTTL?: number
    enableCompression?: boolean
    isClockOperation?: boolean
  } = {}
) {
  const { status = 200, cacheTTL = 0, enableCompression = true, isClockOperation = false } = options

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }

  // Optimize caching headers based on operation type
  if (isClockOperation) {
    // Clock operations should not be cached
    headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    headers["Pragma"] = "no-cache"
    headers["Expires"] = "0"
  } else if (cacheTTL > 0) {
    // Status checks can be cached briefly
    headers["Cache-Control"] = `public, max-age=${cacheTTL}, s-maxage=${cacheTTL}`
    headers["ETag"] = `"${crypto.createHash("md5").update(JSON.stringify(data)).digest("hex")}"`
  }

  // Add performance headers
  headers["X-Response-Time"] = Date.now().toString()
  headers["X-Content-Type-Options"] = "nosniff"

  return NextResponse.json(data, { status, headers })
}

export async function POST(request: NextRequest) {
  return withErrorHandlingAsync(async () => {
    return TimingPerformanceMonitor.measure("clock-operation-total", async () => {
      // Enhanced rate limiting with connection pool awareness
      const rateLimitResult = await clockOperationLimiter.checkLimit(request)
      if (!rateLimitResult.allowed) {
        return createErrorResponse(
          "Too many requests. Please try again later.",
          HTTP_STATUS.TOO_MANY_REQUESTS
        )
      }

      // Optimized request body parsing with size limits
      let body: unknown
      try {
        const text = await request.text()
        if (text.length > 10240) {
          // 10KB limit
          return createErrorResponse("Request body too large", HTTP_STATUS.PAYLOAD_TOO_LARGE)
        }
        body = JSON.parse(text)
      } catch (error) {
        return createErrorResponse("Invalid JSON in request body", HTTP_STATUS.BAD_REQUEST)
      }

      // Enhanced validation with performance monitoring
      const validationResult = await TimingPerformanceMonitor.measure(
        "request-validation",
        async () => {
          return clockActionSchema.safeParse(body)
        }
      )

      if (!validationResult.success) {
        const details = validationResult.error.issues.map((issue) => ({
          field: issue.path.join("."),
          code: issue.code,
          details: issue.message,
        }))
        return createValidationErrorResponse(ERROR_MESSAGES.VALIDATION_ERROR, details)
      }

      const validatedData = validationResult.data

      // Route to optimized handlers
      if (validatedData.action === "clock-in") {
        const result = await handleClockIn(request, validatedData)
        return result
      } else {
        const result = await handleClockOut(request, validatedData)
        return result
      }
    })
  })
}

export async function GET(request: NextRequest) {
  return withErrorHandlingAsync(async () => {
    return TimingPerformanceMonitor.measure("clock-status-check", async () => {
      const { searchParams } = new URL(request.url)
      const studentId = searchParams.get("studentId")

      // Enhanced context retrieval with caching
      const context = await TimingPerformanceMonitor.measure("context-retrieval", async () => {
        return getSchoolContext()
      })

      // Optimized permission validation
      if (context.userRole === ("STUDENT" as UserRole)) {
        if (studentId && studentId !== context.userId) {
          return createErrorResponse(ERROR_MESSAGES.ACCESS_DENIED, HTTP_STATUS.FORBIDDEN)
        }
      } else if (!studentId) {
        return createErrorResponse(
          "Student ID is required for non-student users",
          HTTP_STATUS.BAD_REQUEST
        )
      }

      const targetStudentId = studentId || context.userId

      // Check cache first for status requests
      const cacheKey = `clock-status:${targetStudentId}`
      const cachedStatus = await cacheIntegrationService.get(cacheKey)

      if (cachedStatus) {
        return createOptimizedResponse(cachedStatus, { cacheTTL: 30 })
      }

      // Use ClockService to get status
      const clockStatus = await ClockService.getClockStatus(targetStudentId)

      // Cache the result for 30 seconds
      await cacheIntegrationService.set(cacheKey, clockStatus, { ttl: 30 })

      return createOptimizedResponse(clockStatus, { cacheTTL: 30 })
    })
  })
}

async function handleClockIn(request: NextRequest, validatedData: z.infer<typeof clockInSchema>) {
  return TimingPerformanceMonitor.measure("clock-in-operation", async () => {
    const context = await getSchoolContext()
    const { ipAddress, userAgent } = getClientInfo(request)
    const { rotationId, notes, latitude, longitude, accuracy, timestamp } = validatedData

    // Fetch rotation to identify student and validate access
    const [rotation] = await db
      .select({
        id: rotations.id,
        studentId: rotations.studentId,
      })
      .from(rotations)
      .where(eq(rotations.id, rotationId))
      .limit(1)

    if (!rotation) {
      return createErrorResponse(ERROR_MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND)
    }

    // Permission check
    if (context.userRole === "STUDENT" && rotation.studentId !== context.userId) {
      return createErrorResponse(ERROR_MESSAGES.ACCESS_DENIED, HTTP_STATUS.FORBIDDEN)
    }

    try {
      // Delegate to ClockService
      const result = await ClockService.clockIn({
        studentId: rotation.studentId,
        rotationId: rotationId,
        notes: notes,
        location:
          latitude && longitude
            ? {
              latitude,
              longitude,
              accuracy: accuracy || 0,
            }
            : undefined,
        clientTimestamp: timestamp,
        ipAddress,
        userAgent,
      })

      // Fetch the created record to return full details
      // We use the recordId returned by ClockService
      if (!result.recordId) {
        throw new Error("Clock-in succeeded but no record ID returned")
      }

      const [newRecord] = await db
        .select()
        .from(timeRecords)
        .where(eq(timeRecords.id, result.recordId))
        .limit(1)

      if (!newRecord) {
        throw new Error("Failed to retrieve created time record")
      }

      // Invalidate caches
      await cacheIntegrationService.invalidateByTags([
        `user:${context.userId}:clock-status`,
        `user:${context.userId}:time-records`,
        `rotation:${rotationId}:records`,
      ])

      const responseData = {
        success: true,
        data: {
          ...newRecord,
          activities: [], // Clock-in usually doesn't have activities yet
          highPrecisionClockIn: newRecord.clockIn?.toISOString(),
          // Include validation warnings if any
          validationWarnings: result.timeValidation?.warnings,
        },
        message: "Successfully clocked in",
      }

      return createOptimizedResponse(responseData, { isClockOperation: true })
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, "Clock-in failed")
      if (error instanceof Error) {
        // Map ClockService errors to API responses
        if (error.message.includes("already clocked in")) {
          return createErrorResponse("Student is already clocked in", HTTP_STATUS.CONFLICT)
        }
        return createErrorResponse(error.message, HTTP_STATUS.BAD_REQUEST)
      }
      return createErrorResponse("Clock-in failed", HTTP_STATUS.INTERNAL_SERVER_ERROR)
    }
  })
}

async function handleClockOut(request: NextRequest, validatedData: z.infer<typeof clockOutSchema>) {
  return TimingPerformanceMonitor.measure("clock-out-operation", async () => {
    const context = await getSchoolContext()
    const { ipAddress, userAgent } = getClientInfo(request)
    const { timeRecordId, activities, notes, latitude, longitude, accuracy, timestamp } =
      validatedData

    // Fetch time record to identify student and rotation
    const [record] = await db
      .select({
        id: timeRecords.id,
        studentId: timeRecords.studentId,
        rotationId: timeRecords.rotationId,
      })
      .from(timeRecords)
      .where(eq(timeRecords.id, timeRecordId))
      .limit(1)

    if (!record) {
      return createErrorResponse(ERROR_MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND)
    }

    // Permission check
    if (context.userRole === "STUDENT" && record.studentId !== context.userId) {
      return createErrorResponse(ERROR_MESSAGES.ACCESS_DENIED, HTTP_STATUS.FORBIDDEN)
    }

    try {
      // Delegate to ClockService
      const result = await ClockService.clockOut({
        studentId: record.studentId,
        rotationId: record.rotationId,
        notes: notes,
        activities: activities,
        location:
          latitude && longitude
            ? {
              latitude,
              longitude,
              accuracy: accuracy || 0,
            }
            : undefined,
        clientTimestamp: timestamp,
        ipAddress,
        userAgent,
      })

      // Fetch the updated record
      const [updatedRecord] = await db
        .select()
        .from(timeRecords)
        .where(eq(timeRecords.id, record.id))
        .limit(1)

      if (!updatedRecord) {
        throw new Error("Failed to retrieve updated time record")
      }

      // Invalidate caches
      await cacheIntegrationService.invalidateByTags([
        `user:${context.userId}:clock-status`,
        `user:${context.userId}:time-records`,
        `record:${timeRecordId}:details`,
      ])

      const responseData = {
        success: true,
        data: {
          ...updatedRecord,
          activities: updatedRecord.activities ? JSON.parse(updatedRecord.activities) : [],
          highPrecisionClockOut: updatedRecord.clockOut?.toISOString(),
          // Include validation warnings
          validationWarnings: result.timeValidation?.warnings,
        },
        message: "Successfully clocked out",
      }

      return createOptimizedResponse(responseData, { isClockOperation: true })
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, "Clock-out failed")
      if (error instanceof Error) {
        if (error.message.includes("not currently clocked in")) {
          return createErrorResponse("Student is not clocked in", HTTP_STATUS.CONFLICT)
        }
        return createErrorResponse(error.message, HTTP_STATUS.BAD_REQUEST)
      }
      return createErrorResponse("Clock-out failed", HTTP_STATUS.INTERNAL_SERVER_ERROR)
    }
  })
}

