/**
 * Automated validation utilities for time tracking system
 * Prevents incorrect time entries and ensures data integrity
 */

import { calculateDistance } from "@/lib/geo-utils"

export interface ValidationRule<T = any> {
  name: string
  validate: (value: T, context?: any) => boolean
  message: string
  severity: "error" | "warning" | "info"
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  info: string[]
}

export interface TimeEntry {
  clockInTime: Date
  clockOutTime?: Date

  siteId: string
  userId: string
  notes?: string
}

/**
 * Core validation engine
 */
export class ValidationEngine {
  private rules: Map<string, ValidationRule[]> = new Map()

  /**
   * Register validation rules for a specific entity type
   */
  registerRules(entityType: string, rules: ValidationRule[]): void {
    this.rules.set(entityType, [...(this.rules.get(entityType) || []), ...rules])
  }

  /**
   * Validate an entity against registered rules
   */
  validate(entityType: string, data: any, context?: any): ValidationResult {
    const rules = this.rules.get(entityType) || []
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      info: [],
    }

    for (const rule of rules) {
      try {
        const isValid = rule.validate(data, context)
        if (!isValid) {
          result[
            rule.severity === "error" ? "errors" : rule.severity === "warning" ? "warnings" : "info"
          ].push(rule.message)
          if (rule.severity === "error") {
            result.isValid = false
          }
        }
      } catch (error) {
        result.errors.push(`Validation rule '${rule.name}' failed: ${error}`)
        result.isValid = false
      }
    }

    return result
  }

  /**
   * Clear all rules for an entity type
   */
  clearRules(entityType: string): void {
    this.rules.delete(entityType)
  }
}

/**
 * Time-specific validation rules
 */
export const TIME_VALIDATION_RULES: ValidationRule<TimeEntry>[] = [
  {
    name: "future_clock_in",
    validate: (entry) => {
      const now = new Date()
      return entry.clockInTime <= now
    },
    message: "Clock-in time cannot be in the future",
    severity: "error",
  },
  {
    name: "reasonable_clock_in_time",
    validate: (entry) => {
      const now = new Date()
      const maxPastTime = new Date(now.getTime() - 24 * 60 * 60 * 1000) // 24 hours ago
      return entry.clockInTime >= maxPastTime
    },
    message: "Clock-in time cannot be more than 24 hours in the past",
    severity: "error",
  },
  {
    name: "clock_out_after_clock_in",
    validate: (entry) => {
      if (!entry.clockOutTime) return true
      return entry.clockOutTime > entry.clockInTime
    },
    message: "Clock-out time must be after clock-in time",
    severity: "error",
  },
  {
    name: "reasonable_shift_duration",
    validate: (entry) => {
      if (!entry.clockOutTime) return true
      const duration = entry.clockOutTime.getTime() - entry.clockInTime.getTime()
      const maxDuration = 16 * 60 * 60 * 1000 // 16 hours
      return duration <= maxDuration
    },
    message: "Shift duration cannot exceed 16 hours",
    severity: "warning",
  },
  {
    name: "minimum_shift_duration",
    validate: (entry) => {
      if (!entry.clockOutTime) return true
      const duration = entry.clockOutTime.getTime() - entry.clockInTime.getTime()
      const minDuration = 15 * 60 * 1000 // 15 minutes
      return duration >= minDuration
    },
    message: "Shift duration is less than 15 minutes",
    severity: "warning",
  },
  {
    name: "weekend_shift_warning",
    validate: (entry) => {
      const day = entry.clockInTime.getDay()
      return day !== 0 && day !== 6 // Not Sunday (0) or Saturday (6)
    },
    message: "Weekend shift detected - please confirm this is correct",
    severity: "info",
  },
  {
    name: "late_night_shift_warning",
    validate: (entry) => {
      const hour = entry.clockInTime.getHours()
      return hour >= 6 && hour <= 22 // Between 6 AM and 10 PM
    },
    message: "Late night or early morning shift detected",
    severity: "info",
  },
]

/**
 * Business logic validation rules
 */
export const BUSINESS_VALIDATION_RULES: ValidationRule<TimeEntry>[] = [
  {
    name: "site_assignment_required",
    validate: (entry) => {
      return !!entry.siteId && entry.siteId.trim().length > 0
    },
    message: "Site assignment is required",
    severity: "error",
  },
  {
    name: "user_identification_required",
    validate: (entry) => {
      return !!entry.userId && entry.userId.trim().length > 0
    },
    message: "User identification is required",
    severity: "error",
  },
  {
    name: "notes_length_limit",
    validate: (entry) => {
      if (!entry.notes) return true
      return entry.notes.length <= 500
    },
    message: "Notes cannot exceed 500 characters",
    severity: "error",
  },
  {
    name: "notes_recommended",
    validate: (entry) => {
      if (!entry.clockOutTime) return true // Only check on clock-out
      return !!entry.notes && entry.notes.trim().length > 0
    },
    message: "Adding notes about your shift activities is recommended",
    severity: "info",
  },
]

/**
 * Pre-configured validation engine for time tracking
 */
export class TimeTrackingValidator extends ValidationEngine {
  constructor() {
    super()
    this.registerRules("time_entry", [
      ...TIME_VALIDATION_RULES,

      ...BUSINESS_VALIDATION_RULES,
    ])
  }

  /**
   * Validate a time entry with context
   */
  validateTimeEntry(entry: TimeEntry): ValidationResult {
    return this.validate("time_entry", entry)
  }

  /**
   * Quick validation for clock-in
   */
  validateClockIn(userId: string, siteId: string): ValidationResult {
    const entry: TimeEntry = {
      userId,
      siteId,
      clockInTime: new Date(),
    }
    return this.validateTimeEntry(entry)
  }

  /**
   * Quick validation for clock-out
   */
  validateClockOut(userId: string, siteId: string, clockInTime: Date): ValidationResult {
    const entry: TimeEntry = {
      userId,
      siteId,
      clockInTime,
      clockOutTime: new Date(),
    }
    return this.validateTimeEntry(entry)
  }
}

/**
 * Real-time validation for form inputs
 */
export class RealTimeValidator {
  private validators: Map<string, (value: any) => ValidationResult> = new Map()
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map()

  /**
   * Register a field validator
   */
  registerField(fieldName: string, validator: (value: any) => ValidationResult): void {
    this.validators.set(fieldName, validator)
  }

  /**
   * Validate a field with debouncing
   */
  validateField(
    fieldName: string,
    value: any,
    callback: (result: ValidationResult) => void,
    debounceMs = 300
  ): void {
    // Clear existing timer
    const existingTimer = this.debounceTimers.get(fieldName)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // Set new timer
    const timer = setTimeout(() => {
      const validator = this.validators.get(fieldName)
      if (validator) {
        const result = validator(value)
        callback(result)
      }
      this.debounceTimers.delete(fieldName)
    }, debounceMs)

    this.debounceTimers.set(fieldName, timer)
  }

  /**
   * Clear all debounce timers
   */
  cleanup(): void {
    this.debounceTimers.forEach((timer) => clearTimeout(timer))
    this.debounceTimers.clear()
  }
}

/**
 * Batch validation for multiple entries
 */
export class BatchValidator {
  private validator: TimeTrackingValidator

  constructor() {
    this.validator = new TimeTrackingValidator()
  }

  /**
   * Validate multiple time entries
   */
  validateBatch(entries: TimeEntry[]): {
    results: ValidationResult[]
    summary: {
      totalEntries: number
      validEntries: number
      entriesWithErrors: number
      entriesWithWarnings: number
    }
  } {
    const results = entries.map((entry) => this.validator.validateTimeEntry(entry))

    const summary = {
      totalEntries: entries.length,
      validEntries: results.filter((r) => r.isValid).length,
      entriesWithErrors: results.filter((r) => r.errors.length > 0).length,
      entriesWithWarnings: results.filter((r) => r.warnings.length > 0).length,
    }

    return { results, summary }
  }

  /**
   * Find potential duplicate entries
   */
  findDuplicates(entries: TimeEntry[]): Array<{
    indices: number[]
    reason: string
  }> {
    const duplicates: Array<{ indices: number[]; reason: string }> = []

    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const entry1 = entries[i]
        const entry2 = entries[j]

        // Check for same user, site, and overlapping times
        if (
          entry1.userId === entry2.userId &&
          entry1.siteId === entry2.siteId &&
          Math.abs(entry1.clockInTime.getTime() - entry2.clockInTime.getTime()) < 60000 // Within 1 minute
        ) {
          duplicates.push({
            indices: [i, j],
            reason: "Potential duplicate entries with same user, site, and similar times",
          })
        }
      }
    }

    return duplicates
  }
}

// Export singleton instances for convenience
export const timeTrackingValidator = new TimeTrackingValidator()
export const realTimeValidator = new RealTimeValidator()
export const batchValidator = new BatchValidator()
