/**
 * Clock System Validation Schemas
 *
 * Comprehensive validation schemas with business rule validation
 * for the enhanced clock tracking system.
 */

import { z } from "zod"

// Configuration for clock validation (env-driven)
const CLOCK_ALLOWED_START_HOUR = Number(process.env.CLOCK_ALLOWED_START_HOUR ?? "6")
const CLOCK_ALLOWED_END_HOUR = Number(process.env.CLOCK_ALLOWED_END_HOUR ?? "23")
const STUDENT_SUBMISSION_WINDOW_DAYS = Number(process.env.STUDENT_SUBMISSION_WINDOW_DAYS ?? "3")
const ADMIN_APPROVAL_WINDOW_DAYS = Number(process.env.ADMIN_APPROVAL_WINDOW_DAYS ?? "7")
// Allow bypassing business hours in dev/testing via env flags
const CLOCK_ALLOW_OFF_HOURS =
  (process.env.CLOCK_ALLOW_OFF_HOURS ?? "").toLowerCase() === "true" ||
  (process.env.ALLOW_CLOCK_OUTSIDE_HOURS ?? "").toLowerCase() === "true" ||
  (process.env.NODE_ENV ?? "") === "development"

function formatHour(h: number): string {
  const hour12 = h % 12 === 0 ? 12 : h % 12
  const ampm = h < 12 ? "AM" : "PM"
  return `${hour12}:00 ${ampm}`
}

// Location validation schema
export const locationSchema = z.object({
  latitude: z
    .number()
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90")
    .refine((val) => val >= -90 && val <= 90, "Latitude must be between -90 and 90"),
  longitude: z
    .number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180"),
  accuracy: z
    .number()
    .positive("Accuracy must be a positive number")
    .refine((val) => val <= 1000, {
      message: "Location accuracy too low",
      path: ["accuracy"],
    }),
  timestamp: z.string().datetime("Invalid timestamp format").optional(),
})

// Clock-in validation schema
export const clockInSchema = z
  .object({
    // Accept Clerk-style and other non-UUID string identifiers
    studentId: z.string().min(1, "Student ID is required"),
    rotationId: z.string().min(1, "Rotation ID is required"),
    timestamp: z.string().datetime("Invalid timestamp format").optional(),
    location: locationSchema.optional().nullable(),
    notes: z.string().max(500, "Notes cannot exceed 500 characters").optional(),
  })
  .refine(
    (data) => {
      // Business rule: If timestamp is provided, it shouldn't be in the future
      if (data.timestamp) {
        const providedTime = new Date(data.timestamp)
        const now = new Date()
        const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000)

        if (providedTime > fiveMinutesFromNow) {
          return false
        }
      }
      return true
    },
    {
      message: "Clock-in time cannot be more than 5 minutes in the future",
      path: ["timestamp"],
    }
  )

// Clock-out validation schema
export const clockOutSchema = z
  .object({
    studentId: z.string().min(1, "Student ID is required"),
    timestamp: z.string().datetime("Invalid timestamp format").optional(),
    location: locationSchema.optional().nullable(),
    notes: z.string().max(500, "Notes cannot exceed 500 characters").optional(),
    activities: z
      .array(z.string().max(100, "Activity description too long"))
      .max(10, "Too many activities listed")
      .optional(),
  })
  .refine(
    (data) => {
      // Business rule: If timestamp is provided, it shouldn't be in the future
      if (data.timestamp) {
        const providedTime = new Date(data.timestamp)
        const now = new Date()
        const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000)

        if (providedTime > fiveMinutesFromNow) {
          return false
        }
      }
      return true
    },
    {
      message: "Clock-out time cannot be more than 5 minutes in the future",
      path: ["timestamp"],
    }
  )

// Time record update schema
export const timeRecordUpdateSchema = z
  .object({
    clockIn: z.string().datetime("Invalid clock-in time format"),
    clockOut: z.string().datetime("Invalid clock-out time format"),
    notes: z.string().max(500, "Notes cannot exceed 500 characters").optional(),
    activities: z
      .array(z.string().max(100, "Activity description too long"))
      .max(10, "Too many activities listed")
      .optional(),
  })
  .refine(
    (data) => {
      // Business rule: Clock-out must be after clock-in
      const clockInTime = new Date(data.clockIn)
      const clockOutTime = new Date(data.clockOut)

      if (clockOutTime <= clockInTime) {
        return false
      }

      // Business rule: Session cannot be longer than 24 hours
      const durationMs = clockOutTime.getTime() - clockInTime.getTime()
      const maxDurationMs = 24 * 60 * 60 * 1000 // 24 hours

      if (durationMs > maxDurationMs) {
        return false
      }

      return true
    },
    {
      message:
        "Invalid time range: Clock-out must be after clock-in and session cannot exceed 24 hours",
    }
  )

// Business rule validation functions
export class ClockValidationRules {
  // Location validation constants
  static readonly MAX_LOCATION_ACCURACY = 100 // Maximum acceptable GPS accuracy in meters
  static readonly MAX_DISTANCE_FROM_SITE = 500 // Maximum distance from clinical site in meters

  /**
   * Validate if a student can clock in at a specific rotation
   */
  static async validateClockInEligibility(
    studentId: string,
    rotationId: string,
    timestamp?: Date
  ): Promise<{ valid: boolean; reason?: string }> {
    const clockTime = timestamp || new Date()

    // In development/testing, allow off-hours clock-in if explicitly enabled
    if (CLOCK_ALLOW_OFF_HOURS) {
      return { valid: true }
    }

    // Check if it's within configured reasonable hours
    const hour = clockTime.getHours()
    const start = CLOCK_ALLOWED_START_HOUR
    const end = CLOCK_ALLOWED_END_HOUR
    if (hour < start || hour > end) {
      return {
        valid: false,
        reason: `Clock-in is only allowed between ${formatHour(start)} and ${formatHour(end)}`,
      }
    }

    // Additional business rules can be added here
    // - Check if student is assigned to this rotation
    // - Check if rotation is active
    // - Check if student has completed prerequisites

    return { valid: true }
  }

  /**
   * Validate if a clock-out time is reasonable given the clock-in time
   */
  static validateClockOutTime(
    clockInTime: Date,
    clockOutTime: Date
  ): { valid: boolean; reason?: string } {
    const durationMs = clockOutTime.getTime() - clockInTime.getTime()
    const durationHours = durationMs / (1000 * 60 * 60)

    // Minimum session duration (15 minutes)
    if (durationHours < 0.25) {
      return {
        valid: false,
        reason: "Minimum session duration is 15 minutes",
      }
    }

    // Maximum session duration (16 hours)
    if (durationHours > 16) {
      return {
        valid: false,
        reason: "Maximum session duration is 16 hours",
      }
    }

    return { valid: true }
  }

  static validateStudentSubmissionWindow(
    referenceTime: Date,
    now: Date = new Date()
  ): {
    valid: boolean
    reason?: string
  } {
    const diffMs = now.getTime() - referenceTime.getTime()
    const allowedMs = STUDENT_SUBMISSION_WINDOW_DAYS * 24 * 60 * 60 * 1000
    if (diffMs > allowedMs) {
      return {
        valid: false,
        reason: `Submissions must occur within ${STUDENT_SUBMISSION_WINDOW_DAYS} days of the shift`,
      }
    }
    return { valid: true }
  }

  static isBeyondAdminApprovalWindow(createdAt: Date, now: Date = new Date()): boolean {
    const diffMs = now.getTime() - createdAt.getTime()
    const allowedMs = ADMIN_APPROVAL_WINDOW_DAYS * 24 * 60 * 60 * 1000
    return diffMs > allowedMs
  }

  /**
   * Validate if location is within acceptable range of the clinical site
   */
  static validateLocationProximity(
    userLocation: { latitude: number; longitude: number },
    siteLocation: { latitude: number; longitude: number },
    maxDistanceKm = 1
  ): { valid: boolean; reason?: string; distance?: number } {
    const distance = ClockValidationRules.calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      siteLocation.latitude,
      siteLocation.longitude
    )

    if (distance > maxDistanceKm) {
      return {
        valid: false,
        reason: `You must be within ${maxDistanceKm}km of the clinical site to clock in`,
        distance,
      }
    }

    return { valid: true, distance }
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  private static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371 // Earth's radius in kilometers
    const dLat = ClockValidationRules.toRadians(lat2 - lat1)
    const dLon = ClockValidationRules.toRadians(lon2 - lon1)

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(ClockValidationRules.toRadians(lat1)) *
        Math.cos(ClockValidationRules.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2)

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180)
  }
}

// Export validation functions
export { ClockValidationRules as ValidationRules }
