import { and, eq, isNull } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "../../../../database/connection-pool"
import { rotations, timeRecords } from "../../../../database/schema"
import { getSchoolContext, type SchoolContext } from "../../../../lib/school-utils"
import { cacheIntegrationService } from '@/lib/cache-integration'
import { clockOperationLimiter } from "@/lib/rate-limiter"

import { createHighPrecisionTimestamp, toDbTimestamp, TimingPerformanceMonitor } from "@/lib/high-precision-timing"
import crypto from "crypto"


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
  activities: z.array(z.string().max(200, "Activity name too long").trim()).max(20, "Too many activities").optional(),
  notes: z.string().max(1000, "Notes too long").trim().optional(),
  // Location data (optional but recommended)
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  accuracy: z.number().min(0).optional(),
  locationSource: z.enum(["gps", "network", "passive"]).optional(),
})

const clockOutSchema = z.object({
  action: z.literal("clock-out"),
  timeRecordId: z.string().uuid("Invalid time record ID format").min(1, "Time record ID is required"),
  activities: z.array(z.string().max(200, "Activity name too long").trim()).max(20, "Too many activities").optional(),
  notes: z.string().max(1000, "Notes too long").trim().optional(),
  // Location data (optional but recommended)
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  accuracy: z.number().min(0).optional(),
  locationSource: z.enum(["gps", "network", "passive"]).optional(),
})

const clockActionSchema = z.discriminatedUnion("action", [clockInSchema, clockOutSchema])

// POST /api/time-records/clock - Handle clock in/out operations
/**
 * Enhanced response helper with compression and optimized caching headers
 */
function createOptimizedResponse(data: any, options: {
  status?: number
  cacheTTL?: number
  enableCompression?: boolean
  isClockOperation?: boolean
} = {}) {
  const {
    status = 200,
    cacheTTL = 0,
    enableCompression = true,
    isClockOperation = false
  } = options

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  // Add compression headers for large responses
  if (enableCompression && JSON.stringify(data).length > 1024) {
    headers['Content-Encoding'] = 'gzip'
  }

  // Optimize caching headers based on operation type
  if (isClockOperation) {
    // Clock operations should not be cached
    headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    headers['Pragma'] = 'no-cache'
    headers['Expires'] = '0'
  } else if (cacheTTL > 0) {
    // Status checks can be cached briefly
    headers['Cache-Control'] = `public, max-age=${cacheTTL}, s-maxage=${cacheTTL}`
    headers['ETag'] = `"${crypto.createHash('md5').update(JSON.stringify(data)).digest('hex')}"`
  }

  // Add performance headers
  headers['X-Response-Time'] = Date.now().toString()
  headers['X-Content-Type-Options'] = 'nosniff'

  return NextResponse.json(data, { status, headers })
}

export async function POST(request: NextRequest) {
  return TimingPerformanceMonitor.measure('clock-operation-total', async () => {
    try {
      // Enhanced rate limiting with connection pool awareness
      const rateLimitResult = await clockOperationLimiter.check(request)
      if (!rateLimitResult.success) {
        return createOptimizedResponse(
          { error: "Too many requests. Please try again later." },
          { status: 429, isClockOperation: true }
        )
      }

      // Optimized request body parsing with size limits
      let body: unknown
      try {
        const text = await request.text()
        if (text.length > 10240) { // 10KB limit
          return createOptimizedResponse(
            { error: "Request body too large" },
            { status: 413, isClockOperation: true }
          )
        }
        body = JSON.parse(text)
      } catch (error) {
        return createOptimizedResponse(
          { error: "Invalid JSON in request body" },
          { status: 400, isClockOperation: true }
        )
      }

      // Enhanced validation with performance monitoring
      const validationResult = await TimingPerformanceMonitor.measure('request-validation', async () => {
        return clockActionSchema.safeParse(body)
      })

      if (!validationResult.success) {
        return createOptimizedResponse(
          { 
            error: "Invalid request data",
            details: validationResult.error.errors.map(err => ({
              field: err.path.join('.'),
              message: err.message
            }))
          },
          { status: 400, isClockOperation: true }
        )
      }

      const validatedData = validationResult.data

      // Route to optimized handlers
      if (validatedData.action === "clock-in") {
        const result = await handleClockIn(request, validatedData)
        return result
      }
        const result = await handleClockOut(request, validatedData)
        return result
    } catch (error) {
      console.error("Clock operation error:", error)
      return createOptimizedResponse(
        { error: "Internal server error" },
        { status: 500, isClockOperation: true }
      )
    }
  })
}

export async function GET(request: NextRequest) {
  return TimingPerformanceMonitor.measure('clock-status-check', async () => {
    try {
      const { searchParams } = new URL(request.url)
      const studentId = searchParams.get("studentId")

      // Enhanced context retrieval with caching
      const context = await TimingPerformanceMonitor.measure('context-retrieval', async () => {
        return getSchoolContext()
      })

      // Optimized permission validation
      if (context.userRole === "STUDENT") {
        if (studentId && studentId !== context.userId) {
          return createOptimizedResponse(
            { error: "Access denied" },
            { status: 403, cacheTTL: 60 }
          )
        }
      } else if (!studentId) {
        return createOptimizedResponse(
          { error: "Student ID is required for non-student users" },
          { status: 400, cacheTTL: 60 }
        )
      }

      const targetStudentId = studentId || context.userId

      // Check cache first for status requests
      const cacheKey = `clock-status:${targetStudentId}`
      const cachedStatus = await cacheIntegrationService.get(cacheKey)
      
      if (cachedStatus) {
        return createOptimizedResponse(cachedStatus, { cacheTTL: 30 })
      }

      // Optimized database query with connection pool monitoring
      const clockStatus = await TimingPerformanceMonitor.measure('database-query', async () => {
        return db.transaction(async (tx) => {
          const [activeRecord] = await tx
            .select({
              id: timeRecords.id,
              rotationId: timeRecords.rotationId,
              clockIn: timeRecords.clockIn,
              activities: timeRecords.activities,
              notes: timeRecords.notes,

            })
            .from(timeRecords)
            .where(
              and(
                eq(timeRecords.studentId, targetStudentId),
                isNull(timeRecords.clockOut)
              )
            )
            .limit(1)

          if (!activeRecord) {
            return {
              isClocked: false,
              timeRecordId: null,
              rotationId: null,
              clockedInAt: null,
              currentDuration: null,
              activities: [],
              notes: null,
              location: null,
            }
          }

          // Calculate duration with high precision
          const clockInTime = new Date(activeRecord.clockIn)
          const currentTime = new Date()
          const durationMs = currentTime.getTime() - clockInTime.getTime()

          return {
            isClocked: true,
            timeRecordId: activeRecord.id,
            rotationId: activeRecord.rotationId,
            clockedInAt: activeRecord.clockIn,
            currentDuration: Math.floor(durationMs / 1000), // seconds
            activities: activeRecord.activities ? JSON.parse(activeRecord.activities) : [],
            notes: activeRecord.notes,
            location: null,
          }
        })
      })

      // Cache the result for 30 seconds
      await cacheIntegrationService.set(cacheKey, clockStatus, 30)

      return createOptimizedResponse(clockStatus, { cacheTTL: 30 })
    } catch (error) {
      console.error("Clock status check error:", error)
      
      // Return default state on error to prevent UI blocking
      const defaultStatus = {
        isClocked: false,
        timeRecordId: null,
        rotationId: null,
        clockedInAt: null,
        currentDuration: null,
        activities: [],
        notes: null,
        location: null,
      }

      return createOptimizedResponse(defaultStatus, { cacheTTL: 5 })
    }
  })
}

async function handleClockIn(
  request: NextRequest,
  validatedData: z.infer<typeof clockInSchema>
) {
  return TimingPerformanceMonitor.measure('clock-in-operation', async () => {
    const context = await getSchoolContext()
    const { ipAddress, userAgent } = getClientInfo(request)
    const { rotationId, activities, notes, latitude, longitude, accuracy, locationSource } = validatedData

    try {
      // Use database transaction for optimized queries and data consistency
      const result = await db.transaction(async (tx) => {
        // Single optimized query to verify rotation exists, user has access, and check for existing records
        const [rotationData] = await tx
          .select({
            id: rotations.id,
            studentId: rotations.studentId,
            startDate: rotations.startDate,
            endDate: rotations.endDate,
            existingRecordId: timeRecords.id,
          })
          .from(rotations)
          .leftJoin(
            timeRecords,
            and(
              eq(timeRecords.rotationId, rotations.id),
              eq(timeRecords.studentId, rotations.studentId),
              isNull(timeRecords.clockOut)
            )
          )
          .where(eq(rotations.id, rotationId))
          .limit(1)

        if (!rotationData) {
          throw new Error("Rotation not found")
        }

        // Students can only clock in for their own rotations
        if (context.userRole === "STUDENT" && rotationData.studentId !== context.userId) {
          throw new Error("Access denied")
        }

        // Check if rotation is active
        const now = new Date()
        if (now < rotationData.startDate || now > rotationData.endDate) {
          throw new Error("Rotation is not currently active")
        }

        // Check if student is already clocked in
        if (rotationData.existingRecordId) {
          throw new Error("Student is already clocked in")
        }

        // Create high-precision timestamp for accurate clock-in time
        const clockInTimestamp = createHighPrecisionTimestamp()

        // Prepare location data for insertion
        const locationData: any = {}
        if (latitude !== undefined && longitude !== undefined) {
          locationData.clockInLatitude = latitude.toString()
          locationData.clockInLongitude = longitude.toString()
          
          if (accuracy !== undefined) {
            locationData.clockInAccuracy = accuracy
          }
          
          if (locationSource) {
            locationData.clockInSource = locationSource
          }
        }

        // Create new time record with location data within the same transaction
        const [newRecord] = await tx
          .insert(timeRecords)
          .values({
            id: crypto.randomUUID(),
            studentId: rotationData.studentId,
            rotationId: rotationId,
            date: toDbTimestamp(clockInTimestamp),
            clockIn: toDbTimestamp(clockInTimestamp),
            activities: JSON.stringify(activities || []),
            notes: notes,
            clockInIpAddress: ipAddress,
            clockInUserAgent: userAgent,
            status: "PENDING",
            totalHours: "0",
            ...locationData, // Include location data if provided
          })
          .returning()

        // Log clock-in event for monitoring with location data
        console.log("Clock-in event:", {
          type: "clock_in",
          userId: rotationData.studentId,
          timeRecordId: newRecord.id,
          activityId: rotationId,
          rotationId: rotationId,
          clockInTime: clockInTimestamp,
          location: latitude && longitude ? {
            latitude,
            longitude,
            accuracy,
            source: locationSource
          } : null,
          status: "ACTIVE"
        })

        return { newRecord, rotation: rotationData, clockInTimestamp }
      })

      // Invalidate specific cache tags for better performance
      await cacheIntegrationService.invalidateByTags([
        `user:${context.userId}:clock-status`,
        `user:${context.userId}:time-records`,
        `rotation:${rotationId}:records`
      ])

      const responseData = {
        success: true,
        data: {
          ...result.newRecord,
          activities: activities || [],
          highPrecisionClockIn: result.clockInTimestamp.isoString,
        },
        message: "Successfully clocked in",
      }

      return createOptimizedResponse(responseData, { isClockOperation: true })
    } catch (error) {
      if (error instanceof Error) {
        const statusCode = error.message === "Rotation not found" ? 404 :
                          error.message === "Access denied" ? 403 : 400
        return createOptimizedResponse(
          { error: error.message },
          { status: statusCode, isClockOperation: true }
        )
      }
      throw error
    }
  })
}

async function handleClockOut(
  request: NextRequest,
  validatedData: z.infer<typeof clockOutSchema>
) {
  return TimingPerformanceMonitor.measure('clock-out-operation', async () => {
    const context = await getSchoolContext()
    const { ipAddress, userAgent } = getClientInfo(request)
    const { timeRecordId, activities, notes, latitude, longitude, accuracy, locationSource } = validatedData

    try {
      // Use database transaction for optimized queries and data consistency
      const result = await db.transaction(async (tx) => {
        // Single query to get time record and rotation data
        const [recordData] = await tx
          .select({
            id: timeRecords.id,
            studentId: timeRecords.studentId,
            rotationId: timeRecords.rotationId,
            clockIn: timeRecords.clockIn,
            clockOut: timeRecords.clockOut,
            activities: timeRecords.activities,
            notes: timeRecords.notes,
            rotationStartDate: rotations.startDate,
            rotationEndDate: rotations.endDate,
          })
          .from(timeRecords)
          .leftJoin(rotations, eq(timeRecords.rotationId, rotations.id))
          .where(eq(timeRecords.id, timeRecordId))
          .limit(1)

        if (!recordData) {
          throw new Error("Time record not found")
        }

        // Students can only clock out their own records
        if (context.userRole === "STUDENT" && recordData.studentId !== context.userId) {
          throw new Error("Access denied")
        }

        // Check if already clocked out
        if (recordData.clockOut) {
          throw new Error("Already clocked out")
        }

        // Create high-precision timestamp for accurate clock-out time
        const clockOutTimestamp = createHighPrecisionTimestamp()
        
        // Calculate high-precision total hours
        const clockInTime = recordData.clockIn.getTime()
        const clockOutTime = clockOutTimestamp.highPrecisionTimestamp
        const totalHoursHighPrecision = ((clockOutTime - clockInTime) / (1000 * 60 * 60))
        const totalHours = totalHoursHighPrecision.toFixed(4) // 4 decimal places for high precision

        // Merge activities
        const existingActivities = recordData.activities ? JSON.parse(recordData.activities) : []
        const newActivities = activities || []
        const mergedActivities = [...existingActivities, ...newActivities]

        // Merge notes
        const existingNotes = recordData.notes || ""
        const newNotes = notes || ""
        const mergedNotes = [existingNotes, newNotes].filter(Boolean).join(" | ")

        // Prepare location data for update
        const locationData: any = {}
        if (latitude !== undefined && longitude !== undefined) {
          locationData.clockOutLatitude = latitude.toString()
          locationData.clockOutLongitude = longitude.toString()
          
          if (accuracy !== undefined) {
            locationData.clockOutAccuracy = accuracy
          }
          
          if (locationSource) {
            locationData.clockOutSource = locationSource
          }
        }

        // Update the time record with clock-out data within the same transaction
        const [updatedRecord] = await tx
          .update(timeRecords)
          .set({
            clockOut: toDbTimestamp(clockOutTimestamp),
            totalHours: totalHours,
            activities: JSON.stringify(mergedActivities),
            notes: mergedNotes,
            clockOutIpAddress: ipAddress,
            clockOutUserAgent: userAgent,
            status: "COMPLETED",
            ...locationData, // Include location data if provided
          })
          .where(eq(timeRecords.id, timeRecordId))
          .returning()

        // Calculate duration components for broadcast
        const durationMs = clockOutTimestamp.highPrecisionTimestamp - clockInTime
        const duration = {
          hours: Math.floor(durationMs / (1000 * 60 * 60)),
          minutes: Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((durationMs % (1000 * 60)) / 1000),
          milliseconds: durationMs % 1000
        }

        // Log clock-out event for monitoring with location data
        console.log("Clock-out event:", {
          type: "clock_out",
          userId: recordData.studentId,
          timeRecordId: updatedRecord.id,
          clockOutTime: clockOutTimestamp,
          totalHours: totalHoursHighPrecision,
          duration: duration,
          location: latitude && longitude ? {
            latitude,
            longitude,
            accuracy,
            source: locationSource
          } : null,
          status: "COMPLETED"
        })

        return { 
          updatedRecord, 
          mergedActivities, 
          totalHours, 
          clockOutTimestamp,
          totalHoursHighPrecision 
        }
      })

      // Invalidate specific cache tags for better performance
      await cacheIntegrationService.invalidateByTags([
        `user:${context.userId}:clock-status`,
        `user:${context.userId}:time-records`,
        `record:${timeRecordId}:details`
      ])

      return NextResponse.json({
        success: true,
        data: {
          ...result.updatedRecord,
          activities: result.mergedActivities,
          totalHours: result.totalHours,
          highPrecisionClockOut: result.clockOutTimestamp.isoString,
          highPrecisionTotalHours: result.totalHoursHighPrecision,
        },
        message: "Successfully clocked out",
      })
    } catch (error) {
      if (error instanceof Error) {
        const statusCode = error.message === "Time record not found" ? 404 :
                          error.message === "Access denied" ? 403 : 400
        return NextResponse.json({ error: error.message }, { status: statusCode })
      }
      throw error
    }
  })
}
