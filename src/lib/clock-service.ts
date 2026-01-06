/**
 * Clock Service - Enhanced Clock Operations with Atomic Transactions and Time Synchronization
 *
 * Provides atomic clock-in/out operations with comprehensive error handling,
 * data validation, business rule enforcement, and time synchronization validation.
 */

import { db } from "@/database/connection-pool"
import { timeRecords, rotations, clinicalSites } from "@/database/schema"
import { and, eq, isNull, sql } from "drizzle-orm"
import {
  ClockError,
  ClockErrorType,
  createValidationError,
  createBusinessLogicError,
  createDatabaseError,
  RetryManager,
  CircuitBreaker,
} from "./enhanced-error-handling"
import {
  clockInSchema,
  clockOutSchema,
  locationSchema,
  ClockValidationRules as ValidationRules,
} from "./clock-validation"
import { z } from "zod"
import { logger } from "./logger"
import crypto from "crypto"
import {
  validateLocationWithGeofence,
  saveLocationVerification,
  type LocationValidationResult,
} from "@/services/location-validation"

// Clock operation interfaces
export interface ClockInRequest {
  studentId: string
  rotationId: string
  timestamp?: string
  clientTimestamp?: string // Client-side timestamp for drift detection
  location?: {
    latitude: number
    longitude: number
    accuracy: number
    timestamp?: string
  }
  notes?: string
  ipAddress?: string
  userAgent?: string
  locationSource?: "gps" | "network" | "manual"
}

export interface ClockOutRequest {
  studentId: string
  rotationId: string
  timestamp?: string
  clientTimestamp?: string // Client-side timestamp for drift detection
  location?: {
    latitude: number
    longitude: number
    accuracy: number
    timestamp?: string
  }
  notes?: string
  activities?: string[]
  ipAddress?: string
  userAgent?: string
  locationSource?: "gps" | "network" | "manual"
}

export interface ClockStatus {
  isClocked: boolean
  clockedIn: boolean
  currentSite?: {
    id: string
    name: string
    address: string
  }
  clockInTime?: Date
  clockOutTime?: Date
  totalHours?: string
  recordId?: string
  currentDuration?: number
}

// Circuit breaker for database operations
const dbCircuitBreaker = new CircuitBreaker(5, 60000, 2)

// Time validation configuration
interface TimeValidationConfig {
  maxDriftMs: number // Maximum allowed drift between client and server
  maxFutureMs: number // Maximum allowed future timestamp
  maxPastMs: number // Maximum allowed past timestamp
  requireSync: boolean // Whether to require time synchronization
}

const DEFAULT_TIME_VALIDATION: TimeValidationConfig = {
  maxDriftMs: 5000, // 5 seconds
  maxFutureMs: 60000, // 1 minute
  maxPastMs: 300000, // 5 minutes
  requireSync: true,
}

export class ClockService {
  /**
   * Validate timestamp against server time with drift detection
   */
  private static async validateTimestamp(
    clientTimestamp?: string,
    providedTimestamp?: string,
    config: TimeValidationConfig = DEFAULT_TIME_VALIDATION
  ): Promise<{
    validatedTime: Date
    drift: number
    accuracy: "high" | "medium" | "low"
    warnings: string[]
  }> {
    const serverTime = new Date()
    const warnings: string[] = []

    // Use provided timestamp or current server time
    let targetTime = providedTimestamp ? new Date(providedTimestamp) : serverTime
    let drift = 0
    let accuracy: "high" | "medium" | "low" = "high"

    // If client timestamp is provided, calculate drift
    if (clientTimestamp) {
      const clientTime = new Date(clientTimestamp)
      drift = Math.abs(serverTime.getTime() - clientTime.getTime())

      // Determine accuracy based on drift
      if (drift > config.maxDriftMs) {
        accuracy = "low"
        warnings.push(`High time drift detected: ${drift}ms`)

        if (config.requireSync) {
          throw createValidationError(
            `Time synchronization required. Drift: ${drift}ms exceeds maximum: ${config.maxDriftMs}ms`,
            "timestamp",
            clientTimestamp
          )
        }
      } else if (drift > config.maxDriftMs / 2) {
        accuracy = "medium"
        warnings.push(`Moderate time drift detected: ${drift}ms`)
      }
    }

    // Validate timestamp bounds
    const timeDiff = targetTime.getTime() - serverTime.getTime()

    if (timeDiff > config.maxFutureMs) {
      throw createValidationError(
        `Timestamp too far in the future: ${Math.abs(timeDiff)}ms`,
        "timestamp",
        targetTime.toISOString()
      )
    }

    if (timeDiff < -config.maxPastMs) {
      throw createValidationError(
        `Timestamp too far in the past: ${Math.abs(timeDiff)}ms`,
        "timestamp",
        targetTime.toISOString()
      )
    }

    // If drift is significant, use server time instead
    if (drift > config.maxDriftMs && !providedTimestamp) {
      targetTime = serverTime
      warnings.push("Using server time due to client drift")
    }

    return {
      validatedTime: targetTime,
      drift,
      accuracy,
      warnings,
    }
  }

  /**
   * Get server time for synchronization
   */
  static async getServerTime(): Promise<{
    timestamp: string
    unixTimestamp: number
    timezone: string
    accuracy: "high" | "medium" | "low"
    source: string
  }> {
    const serverTime = new Date()
    return {
      timestamp: serverTime.toISOString(),
      unixTimestamp: serverTime.getTime(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      accuracy: "high",
      source: "server",
    }
  }

  /**
   * Helper to validate clock-in data and generate system flags
   */
  private static async validateClockIn(request: ClockInRequest): Promise<{
    validatedData: any
    validatedTime: Date
    systemFlags: string[]
    locationValidationResult?: LocationValidationResult
  }> {
    const systemFlags: string[] = []

    // Validate required fields first - these are still critical
    if (!request.studentId || request.studentId.trim() === "") {
      throw createValidationError("Student ID is required", "studentId", "REQUIRED_FIELD")
    }

    if (!request.rotationId || request.rotationId.trim() === "") {
      throw createValidationError("Rotation ID is required", "rotationId", "REQUIRED_FIELD")
    }

    // Validate location - SOFT VALIDATION
    if (request.location) {
      try {
        locationSchema.parse(request.location)
      } catch (zodError) {
        if (zodError instanceof z.ZodError) {
          if (zodError.issues && Array.isArray(zodError.issues)) {
            for (const error of zodError.issues) {
              systemFlags.push(`[SYSTEM FLAG]: Location validation failed - ${error.message}`)
            }
          } else {
            systemFlags.push(`[SYSTEM FLAG]: Location validation failed`)
          }
        } else {
          systemFlags.push(
            `[SYSTEM FLAG]: Location validation error - ${(zodError as Error).message}`
          )
        }
      }
    }

    // Validate and synchronize timestamp - SOFT VALIDATION
    let validatedTime = new Date()
    try {
      const timeValidation = await ClockService.validateTimestamp(
        request.clientTimestamp,
        request.timestamp
      )
      validatedTime = timeValidation.validatedTime

      if (timeValidation.warnings && timeValidation.warnings.length > 0) {
        timeValidation.warnings.forEach((w) =>
          systemFlags.push(`[SYSTEM FLAG]: Time warning - ${w}`)
        )
      }
    } catch (error) {
      systemFlags.push(`[SYSTEM FLAG]: Time validation failed - ${(error as Error).message}`)
      validatedTime = new Date() // Fallback to server time
    }

    // Validate input data
    let validatedData
    try {
      validatedData = clockInSchema.parse({
        studentId: request.studentId,
        rotationId: request.rotationId,
        timestamp: validatedTime.toISOString(),
        location: request.location,
        notes: request.notes,
      })
    } catch (zodError) {
      if (zodError instanceof z.ZodError) {
        const firstError = zodError.issues[0]
        throw createValidationError(firstError.message, firstError.path.join("."), firstError.code)
      }
      throw zodError
    }

    // Validate location with geofence if location data is present
    let locationValidationResult: LocationValidationResult | undefined

    if (request.location && request.location.latitude && request.location.longitude) {
      try {
        // We need clinicalSiteId for geofence validation
        // Fetch it from rotation
        const [rotation] = await db
          .select({ clinicalSiteId: rotations.clinicalSiteId })
          .from(rotations)
          .where(eq(rotations.id, request.rotationId))
          .limit(1)

        if (rotation && rotation.clinicalSiteId) {
          const strictMode = process.env.STRICT_LOCATION_MODE === "true"

          locationValidationResult = await validateLocationWithGeofence({
            userId: request.studentId,
            latitude: request.location.latitude,
            longitude: request.location.longitude,
            accuracy: request.location.accuracy || 0,
            clinicalSiteId: rotation.clinicalSiteId,
            strictMode: strictMode,
          })

          if (!locationValidationResult.isValid) {
            const reasons = [
              ...locationValidationResult.errors,
              ...locationValidationResult.warnings,
            ].join("; ")

            if (strictMode) {
              throw createValidationError(
                `Geofence validation failed: ${reasons}`,
                "location",
                "GEOFENCE_ERROR"
              )
            }

            systemFlags.push(`[SYSTEM FLAG]: Geofence validation failed - ${reasons}`)
          }
        }
      } catch (error) {
        logger.warn(
          { error: error instanceof Error ? error.message : String(error) },
          "Geofence validation error"
        )
        systemFlags.push(`[SYSTEM FLAG]: Geofence validation error - ${(error as Error).message}`)
      }
    }

    // Business rule validation - SOFT VALIDATION for eligibility/proximity
    try {
      const eligibilityCheck = await ValidationRules.validateClockInEligibility(
        request.studentId,
        validatedData.rotationId,
        validatedTime
      )

      if (!eligibilityCheck.valid) {
        systemFlags.push(`[SYSTEM FLAG]: Eligibility check failed - ${eligibilityCheck.reason}`)
      }
    } catch (error) {
      systemFlags.push(`[SYSTEM FLAG]: Eligibility check error - ${(error as Error).message}`)
    }

    // Append flags to notes
    if (systemFlags.length > 0) {
      const flagsText = systemFlags.join("\n")
      validatedData.notes = validatedData.notes
        ? `${validatedData.notes}\n\n${flagsText}`
        : flagsText
    }

    return { validatedData, validatedTime, systemFlags, locationValidationResult }
  }

  /**
   * Helper to validate clock-out data and generate system flags
   */
  private static async validateClockOut(request: ClockOutRequest): Promise<{
    validatedData: any
    validatedTime: Date
    systemFlags: string[]
    locationValidationResult?: LocationValidationResult
  }> {
    const systemFlags: string[] = []

    // Validate required fields
    if (!request.studentId || request.studentId.trim() === "") {
      throw createValidationError("Student ID is required", "studentId", "REQUIRED_FIELD")
    }

    if (!request.rotationId || request.rotationId.trim() === "") {
      throw createValidationError("Rotation ID is required", "rotationId", "REQUIRED_FIELD")
    }

    // Validate location - SOFT VALIDATION
    if (request.location) {
      try {
        locationSchema.parse(request.location)
      } catch (zodError) {
        if (zodError instanceof z.ZodError) {
          if (zodError.issues && Array.isArray(zodError.issues)) {
            for (const error of zodError.issues) {
              systemFlags.push(`[SYSTEM FLAG]: Location validation failed - ${error.message}`)
            }
          } else {
            systemFlags.push(`[SYSTEM FLAG]: Location validation failed`)
          }
        } else {
          systemFlags.push(
            `[SYSTEM FLAG]: Location validation error - ${(zodError as Error).message}`
          )
        }
      }
    }

    // Validate and synchronize timestamp - SOFT VALIDATION
    let validatedTime = new Date()
    try {
      const timeValidation = await ClockService.validateTimestamp(
        request.clientTimestamp,
        request.timestamp
      )
      validatedTime = timeValidation.validatedTime

      if (timeValidation.warnings && timeValidation.warnings.length > 0) {
        timeValidation.warnings.forEach((w) =>
          systemFlags.push(`[SYSTEM FLAG]: Time warning - ${w}`)
        )
      }
    } catch (error) {
      systemFlags.push(`[SYSTEM FLAG]: Time validation failed - ${(error as Error).message}`)
      validatedTime = new Date()
    }

    // Validate input data
    let validatedData
    try {
      validatedData = clockOutSchema.parse({
        studentId: request.studentId,
        rotationId: request.rotationId,
        timestamp: validatedTime.toISOString(),
        location: request.location,
        notes: request.notes,
        activities: request.activities,
        locationSource: request.locationSource,
      })
    } catch (zodError) {
      if (zodError instanceof z.ZodError) {
        const firstError = zodError.issues[0]
        throw createValidationError(firstError.message, firstError.path.join("."), firstError.code)
      }
      throw zodError
    }

    // Validate location with geofence if location data is present
    let locationValidationResult: LocationValidationResult | undefined

    if (request.location && request.location.latitude && request.location.longitude) {
      try {
        // We need clinicalSiteId for geofence validation
        // Fetch it from rotation
        const [rotation] = await db
          .select({ clinicalSiteId: rotations.clinicalSiteId })
          .from(rotations)
          .where(eq(rotations.id, request.rotationId))
          .limit(1)

        if (rotation && rotation.clinicalSiteId) {
          const strictMode = process.env.STRICT_LOCATION_MODE === "true"

          locationValidationResult = await validateLocationWithGeofence({
            userId: request.studentId,
            latitude: request.location.latitude,
            longitude: request.location.longitude,
            accuracy: request.location.accuracy || 0,
            clinicalSiteId: rotation.clinicalSiteId,
            strictMode: strictMode,
          })

          if (!locationValidationResult.isValid) {
            const reasons = [
              ...locationValidationResult.errors,
              ...locationValidationResult.warnings,
            ].join("; ")

            if (strictMode) {
              throw createValidationError(
                `Geofence validation failed: ${reasons}`,
                "location",
                "GEOFENCE_ERROR"
              )
            }

            systemFlags.push(`[SYSTEM FLAG]: Geofence validation failed - ${reasons}`)
          }
        }
      } catch (error) {
        logger.warn(
          { error: error instanceof Error ? error.message : String(error) },
          "Geofence validation error"
        )
        systemFlags.push(`[SYSTEM FLAG]: Geofence validation error - ${(error as Error).message}`)
      }
    }

    // Business rule validation - SOFT VALIDATION for short sessions
    try {
      const [activeRecord] = await db
        .select({
          clockIn: timeRecords.clockIn,
        })
        .from(timeRecords)
        .where(and(eq(timeRecords.studentId, request.studentId), isNull(timeRecords.clockOut)))
        .limit(1)

      if (activeRecord && activeRecord.clockIn) {
        const clockInTime = new Date(activeRecord.clockIn)
        const sessionDuration = validatedTime.getTime() - clockInTime.getTime()
        const minMinutesEnv = process.env.MIN_SESSION_MINUTES
        const minMinutes = minMinutesEnv ? Number(minMinutesEnv) : 15
        const minDuration = Math.max(1, minMinutes) * 60 * 1000

        if (sessionDuration < minDuration) {
          const shortSessionMsg = `[SYSTEM FLAG]: Session duration too short: ${Math.round(sessionDuration / 60000)} minutes (minimum: 15 minutes)`
          systemFlags.push(shortSessionMsg)
        }
      }
    } catch (error) {
      // Ignore DB errors during soft validation, will be caught in atomic operation
      logger.warn(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        "Failed to validate session duration"
      )
    }

    // Append flags to notes
    if (systemFlags.length > 0) {
      const flagsText = systemFlags.join("\n")
      validatedData.notes = validatedData.notes
        ? `${validatedData.notes}\n\n${flagsText}`
        : flagsText
    }

    return { validatedData, validatedTime, systemFlags }
  }

  /**
   * Atomic clock-in operation with comprehensive validation and time sync
   */
  static async clockIn(request: ClockInRequest): Promise<
    ClockStatus & {
      timeValidation: {
        drift: number
        accuracy: "high" | "medium" | "low"
        warnings: string[]
      }
    }
  > {
    const operationId = `clock-in-${request.studentId}-${Date.now()}`

    console.error("DEBUG: ClockService.clockIn called with:", { request, operationId })

    try {
      logger.info({ operationId, studentId: request.studentId }, "Clock-in operation started")

      const { validatedData, validatedTime, systemFlags, locationValidationResult } =
        await ClockService.validateClockIn(request)

      // Execute atomic clock-in operation with retry
      const result = await RetryManager.executeWithRetry(
        () =>
          ClockService.executeAtomicClockIn(
            request.studentId,
            validatedData,
            validatedTime,
            request.ipAddress,
            request.userAgent,
            request.locationSource,
            locationValidationResult
          ),
        3,
        1000,
        (error) => error instanceof ClockError && error.retryable
      )

      logger.info(
        {
          operationId,
          recordId: result.recordId,
          flags: JSON.stringify(systemFlags),
        },
        "Clock-in operation completed successfully (with potential flags)"
      )

      return {
        ...result,
        timeValidation: {
          drift: 0, // Simplified for response
          accuracy: "medium",
          warnings: systemFlags,
        },
      }
    } catch (error) {
      logger.error(
        {
          operationId,
          error: error instanceof Error ? error.message : "Unknown error",
          errorType: error?.constructor?.name,
          isClockError: error instanceof ClockError,
        },
        "Clock-in operation failed"
      )

      // Debug logging for error analysis
      console.log("DEBUG: Caught error in clockIn:", {
        error,
        message: error instanceof Error ? error.message : "Unknown error",
        constructor: error?.constructor?.name,
        isClockError: error instanceof ClockError,
        errorCode: error instanceof ClockError ? error.code : "N/A",
        errorType: error instanceof ClockError ? error.type : "N/A",
      })

      // Always re-throw ClockError instances without modification
      if (error instanceof ClockError) {
        console.log("DEBUG: Re-throwing ClockError with code:", error.code)
        throw error
      }

      // Check if the error message contains business logic error patterns
      const errorMessage = error instanceof Error ? error.message : String(error)

      if (
        errorMessage.includes("already clocked in") ||
        errorMessage.includes("Student is already clocked in")
      ) {
        throw createBusinessLogicError("Student is already clocked in", "ALREADY_CLOCKED_IN", {
          studentId: request.studentId,
        })
      }

      // Note: Location too far is now soft-validated, so this check is likely redundant or unreachable for that specific error,
      // but kept for other potential business logic errors.

      throw createDatabaseError("Clock-in operation failed", "clock-in", true)
    }
  }

  /**
   * Atomic clock-out operation with comprehensive validation and time sync
   */
  static async clockOut(request: ClockOutRequest): Promise<
    ClockStatus & {
      timeValidation: {
        drift: number
        accuracy: "high" | "medium" | "low"
        warnings: string[]
      }
    }
  > {
    const operationId = `clock-out-${request.studentId}-${Date.now()}`

    try {
      logger.info({ operationId, studentId: request.studentId }, "Clock-out operation started")

      const { validatedData, validatedTime, systemFlags, locationValidationResult } =
        await ClockService.validateClockOut(request)

      // Execute atomic clock-out operation with retry
      const result = await RetryManager.executeWithRetry(
        () =>
          ClockService.executeAtomicClockOut(
            request.studentId,
            validatedData,
            validatedTime,
            request.ipAddress,
            request.userAgent,
            request.locationSource,
            locationValidationResult
          ),
        3,
        1000,
        (error) => error instanceof ClockError && error.retryable
      )

      logger.info(
        {
          operationId,
          recordId: result.recordId,
          flags: JSON.stringify(systemFlags),
        },
        "Clock-out operation completed successfully (with potential flags)"
      )

      return {
        ...result,
        timeValidation: {
          drift: 0,
          accuracy: "medium",
          warnings: systemFlags,
        },
      }
    } catch (error) {
      logger.error(
        {
          operationId,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "Clock-out operation failed"
      )

      if (error instanceof ClockError) {
        throw error
      }

      // Check if the error message contains business logic error patterns
      const errorMessage = error instanceof Error ? error.message : String(error)

      if (
        errorMessage.includes("No active clock-in record found") ||
        errorMessage.includes("not currently clocked in")
      ) {
        throw createBusinessLogicError("Student is not currently clocked in", "NO_ACTIVE_SESSION", {
          studentId: request.studentId,
        })
      }

      throw createDatabaseError("Clock-out operation failed", "clock-out", true)
    }
  }

  /**
   * Get current clock status for a student
   */
  static async getClockStatus(studentId: string): Promise<ClockStatus> {
    try {
      const activeRecord = await dbCircuitBreaker.execute(async () => {
        const [record] = await db
          .select({
            id: timeRecords.id,
            clockIn: timeRecords.clockIn,
            clockOut: timeRecords.clockOut,
            rotationId: timeRecords.rotationId,
            notes: timeRecords.notes,
          })
          .from(timeRecords)
          .where(and(eq(timeRecords.studentId, studentId), isNull(timeRecords.clockOut)))
          .limit(1)

        return record
      })

      if (!activeRecord) {
        return {
          isClocked: false,
          clockedIn: false,
          currentDuration: 0,
        }
      }

      // Get rotation to get the clinical site ID
      const [rotation] = await db
        .select({
          clinicalSiteId: rotations.clinicalSiteId,
        })
        .from(rotations)
        .where(eq(rotations.id, activeRecord.rotationId))
        .limit(1)

      // Get site information
      const siteInfo = rotation
        ? await ClockService.getSiteInfoById(rotation.clinicalSiteId)
        : undefined

      // Calculate current duration
      const clockInTime = activeRecord.clockIn ? new Date(activeRecord.clockIn) : new Date()
      const now = new Date()
      const durationMs = now.getTime() - clockInTime.getTime()
      const currentDuration = Math.floor(durationMs / 1000) // in seconds

      return {
        isClocked: true,
        clockedIn: true,
        currentSite: siteInfo,
        clockInTime: clockInTime,
        recordId: activeRecord.id,
        currentDuration,
        // Make sure to return null-safe values
      }
    } catch (error) {
      logger.error(
        {
          studentId,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "Failed to get clock status"
      )

      throw createDatabaseError("Failed to get clock status", "get-status", true)
    }
  }

  /**
   * Execute atomic clock-in operation within a database transaction
   */

  private static async executeAtomicClockIn(
    studentId: string,
    validatedData: any,
    validatedTime: Date,
    ipAddress?: string,
    userAgent?: string,
    locationSource?: "gps" | "network" | "manual",
    locationValidationResult?: LocationValidationResult
  ): Promise<ClockStatus> {
    return await dbCircuitBreaker.execute(async () => {
      try {
        return await db.transaction(async (tx) => {
          // Check for existing active record
          const [existingRecord] = await tx
            .select({ id: timeRecords.id, clockOut: timeRecords.clockOut })
            .from(timeRecords)
            .where(and(eq(timeRecords.studentId, studentId), isNull(timeRecords.clockOut)))
            .for("update")

          console.log("DEBUG: Checking for existing record, found:", existingRecord)

          if (existingRecord) {
            console.log("DEBUG: Found existing record, throwing ALREADY_CLOCKED_IN error")
            throw createBusinessLogicError("Student is already clocked in", "ALREADY_CLOCKED_IN", {
              studentId,
              existingRecordId: existingRecord.id,
            })
          }

          const newId = crypto.randomUUID()

          const [newRecord] = await tx
            .insert(timeRecords)
            .values({
              id: newId,
              studentId: studentId,
              rotationId: validatedData.rotationId,
              date: validatedTime,
              clockIn: validatedTime,
              notes: validatedData.notes ?? null,
              status: "PENDING",
              createdAt: new Date(),
              updatedAt: new Date(),
              clockInLatitude: validatedData.location?.latitude?.toString() ?? null,
              clockInLongitude: validatedData.location?.longitude?.toString() ?? null,
              clockInAccuracy: validatedData.location?.accuracy?.toString() ?? null,
              clockInIpAddress: ipAddress ?? null,
              clockInUserAgent: userAgent ?? null,
              clockInSource: locationSource ?? "manual",
            })
            .returning({ id: timeRecords.id })

          const newRecordId = newRecord?.id ?? newId

          // Get site information for response
          const siteInfo = await ClockService.getSiteInfo(validatedData.rotationId)

          return {
            isClocked: true,
            clockedIn: true,
            currentSite: siteInfo,
            clockInTime: validatedTime,
            recordId: newRecordId,
            currentDuration: 0,
          }
        })

        // or we can do it here if we accept eventual consistency.
        // Given the structure, we'll need to do it after the transaction returns.
        // But we are inside executeAtomicClockIn which returns the result.
        // We will rely on the caller or do it here if we can get the ID.
        // Wait, we are inside the transaction callback here.
        // Let's do it inside the transaction to ensure it's recorded.
      } catch (error: any) {
        // Handle Postgres unique constraint violation for concurrent requests
        if (
          error.code === "23505" &&
          (error.constraint === "unique_active_clock_in" ||
            error.message?.includes("unique_active_clock_in"))
        ) {
          throw createBusinessLogicError("Student is already clocked in", "ALREADY_CLOCKED_IN", {
            studentId,
          })
        }
        throw error
      }
    })
  }

  /**
   * Execute atomic clock-out operation within a database transaction
   */
  private static async executeAtomicClockOut(
    studentId: string,
    validatedData: any,
    validatedTime: Date,
    ipAddress?: string,
    userAgent?: string,
    locationSource?: "gps" | "network" | "manual",
    locationValidationResult?: LocationValidationResult
  ): Promise<ClockStatus> {
    return await dbCircuitBreaker.execute(async () => {
      return await db.transaction(async (tx) => {
        // Find active record
        const [activeRecord] = await tx
          .select({
            id: timeRecords.id,
            clockIn: timeRecords.clockIn,
            notes: timeRecords.notes,
            rotationId: timeRecords.rotationId,
          })
          .from(timeRecords)
          .where(and(eq(timeRecords.studentId, studentId), isNull(timeRecords.clockOut)))
          .for("update")

        if (!activeRecord) {
          throw createBusinessLogicError("No active clock-in session found", "NO_ACTIVE_SESSION", {
            studentId,
          })
        }

        // Merge notes safely
        const mergedNotes = validatedData.notes
          ? `${activeRecord.notes || ""}\n${validatedData.notes}`.trim()
          : activeRecord.notes

        if (!activeRecord.clockIn) {
          throw createBusinessLogicError(
            "Invalid record state: missing clock-in time",
            "INVALID_STATE",
            {
              recordId: activeRecord.id,
            }
          )
        }

        // Use targeted SQL update to avoid referencing columns that may not exist in Neon
        const clockInTime = new Date(activeRecord.clockIn)
        const totalHoursValue = (
          (validatedTime.getTime() - clockInTime.getTime()) /
          (1000 * 60 * 60)
        ).toFixed(2)
        // Determine status based on flags
        const hasSystemFlags = mergedNotes && mergedNotes.includes("[SYSTEM FLAG]")
        const status = hasSystemFlags ? "PENDING" : "APPROVED"

        const [updatedRecord] = await tx
          .update(timeRecords)
          .set({
            clockOut: validatedTime,
            notes: mergedNotes,
            status: status,
            totalHours: totalHoursValue,
            updatedAt: new Date(),
            clockOutLatitude: validatedData.location?.latitude?.toString() ?? null,
            clockOutLongitude: validatedData.location?.longitude?.toString() ?? null,
            clockOutAccuracy: validatedData.location?.accuracy?.toString() ?? null,
            clockOutIpAddress: ipAddress ?? null,
            clockOutUserAgent: userAgent ?? null,
            clockOutSource: locationSource ?? "manual",
          })
          .where(eq(timeRecords.id, activeRecord.id))
          .returning({ id: timeRecords.id })

        // Calculate total hours
        const hours = Number(totalHoursValue)

        // Save location verification if result exists
        if (locationValidationResult && validatedData.location) {
          await saveLocationVerification(
            activeRecord.id,
            "clock_out",
            locationValidationResult,
            validatedData.location.latitude,
            validatedData.location.longitude,
            validatedData.location.accuracy,
            locationSource || "manual"
          )
        }

        // Get site information for response
        const siteInfo = await ClockService.getSiteInfo(activeRecord.rotationId)

        return {
          isClocked: false,
          clockedIn: false,
          currentSite: siteInfo,
          clockInTime: activeRecord.clockIn ? new Date(activeRecord.clockIn) : undefined,
          clockOutTime: validatedTime,
          totalHours: hours.toFixed(2),
          recordId: activeRecord.id,
          currentDuration: 0,
        }
      })
    })
  }

  /**
   * Get site information for a rotation
   */
  private static async getSiteInfo(rotationId: string): Promise<
    | {
        id: string
        name: string
        address: string
        latitude?: number
        longitude?: number
      }
    | undefined
  > {
    try {
      const [rotation] = await db
        .select({
          clinicalSiteId: rotations.clinicalSiteId,
        })
        .from(rotations)
        .where(eq(rotations.id, rotationId))
        .limit(1)

      if (!rotation) return undefined

      const [site] = await db
        .select()
        .from(clinicalSites)
        .where(eq(clinicalSites.id, rotation.clinicalSiteId))
        .limit(1)

      return site
        ? {
            id: site.id,
            name: site.name,
            address: site.address,
          }
        : undefined
    } catch (error) {
      logger.warn(
        {
          rotationId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Failed to get site info"
      )
      return undefined
    }
  }

  /**
   * Check if location is within proximity of clinical site
   */
  private static async isWithinProximity(
    userLocation: { latitude: number; longitude: number; accuracy: number },
    siteLocation: { latitude?: number; longitude?: number }
  ): Promise<boolean> {
    if (!siteLocation.latitude || !siteLocation.longitude) {
      return true // Allow if site coordinates not available
    }

    const distance = ClockService.calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      siteLocation.latitude,
      siteLocation.longitude
    )

    // Allow within 500 meters + GPS accuracy
    const allowedDistance = 500 + (userLocation.accuracy || 0)
    return distance <= allowedDistance
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  private static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3 // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180
    const φ2 = (lat2 * Math.PI) / 180
    const Δφ = ((lat2 - lat1) * Math.PI) / 180
    const Δλ = ((lon2 - lon1) * Math.PI) / 180

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c // Distance in meters
  }

  /**
   * Get site information for display
   */
  private static async getSiteInfoById(
    siteId: string
  ): Promise<{ id: string; name: string; address: string } | undefined> {
    try {
      // Use cached site data for better performance
      const { getCachedSiteData } = await import("@/lib/database-optimization")
      const site = await getCachedSiteData(siteId)

      if (site && site.id && site.name) {
        return {
          id: site.id,
          name: site.name,
          address: site.address || "Unknown Address",
        }
      }

      return {
        id: siteId,
        name: "Unknown Site",
        address: "Unknown Address",
      }
    } catch (error) {
      logger.warn(
        {
          siteId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Failed to get site information"
      )
      return {
        id: siteId,
        name: "Unknown Site",
        address: "Unknown Address",
      }
    }
  }

  /**
   * Instance method wrapper for validateTimestamp
   */
  async validateTimestamp(
    clientTimestamp?: string,
    providedTimestamp?: string,
    config?: TimeValidationConfig
  ) {
    return ClockService.validateTimestamp(clientTimestamp, providedTimestamp, config)
  }

  /**
   * Instance method wrapper for getClockStatus
   */
  async getClockStatus(studentId: string) {
    try {
      const status = await ClockService.getClockStatus(studentId)
      return {
        success: true,
        data: status,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }
}
