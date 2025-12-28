/**
 * Comprehensive Data Validation and Sanitization System
 * Provides robust input validation, sanitization, and security measures
 */

import { z } from "zod"
import crypto from "crypto"

// Enhanced validation schemas
export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().normalize().toLowerCase().trim(),
  name: z.string().min(1).max(100).trim(),
  role: z.enum(["student", "admin", "supervisor"]),
  schoolId: z.string().uuid(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const rotationSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).trim(),
  description: z.string().max(1000).trim().optional(),
  startDate: z.date(),
  endDate: z.date(),
  schoolId: z.string().uuid(),
  maxStudents: z.number().int().min(1).max(100),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const timeRecordSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  rotationId: z.string().uuid(),
  clockInTime: z.date(),
  clockOutTime: z.date().optional(),
  totalHours: z.number().min(0).max(24).optional(),
  notes: z.string().max(1000).trim().optional(),
  location: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      accuracy: z.number().min(0).max(1000).optional(),
      address: z.string().max(500).trim().optional(),
    })
    .optional(),
  deviceInfo: z
    .object({
      id: z.string().max(100).trim(),
      type: z.enum(["mobile", "desktop", "tablet", "web", "unknown"]),
      userAgent: z.string().max(500).trim().optional(),
      ipAddress: z
        .string()
        .regex(
          /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$|^([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}$/
        )
        .optional(),
    })
    .optional(),
  isManual: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const auditLogSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().optional(),
  action: z.string().min(1).max(100).trim(),
  resourceType: z.string().min(1).max(50).trim(),
  resourceId: z.string().max(100).trim().optional(),
  ipAddress: z
    .string()
    .regex(
      /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$|^([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}$/
    )
    .optional(),
  userAgent: z.string().max(500).trim().optional(),
  deviceId: z.string().max(100).trim().optional(),
  success: z.boolean(),
  errorMessage: z.string().max(1000).trim().optional(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  metadata: z.record(z.string(), z.any()).optional(),
  createdAt: z.date(),
})

// Input sanitization utilities
export class InputSanitizer {
  private static readonly XSS_PATTERNS = [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /data:text\/html/gi,
    /vbscript:/gi,
    /onload\s*=/gi,
    /onerror\s*=/gi,
    /onclick\s*=/gi,
  ]

  private static readonly SQL_INJECTION_PATTERNS = [
    /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute|script|declare|truncate)\b)/gi,
    /(--|\/\*|\*\/)/g,
    /(\b(or|and)\b.*=.*)/gi,
  ]

  private static readonly COMMAND_INJECTION_PATTERNS = [/[;&|`]/g, /\$\(/g, /\|\|/g, /&&/g]

  static sanitizeString(
    input: string,
    options: {
      maxLength?: number
      allowHtml?: boolean
      customPatterns?: RegExp[]
    } = {}
  ): string {
    if (typeof input !== "string") {
      return ""
    }

    let sanitized = input.trim()

    // Apply length limit
    if (options.maxLength && sanitized.length > options.maxLength) {
      sanitized = sanitized.substring(0, options.maxLength)
    }

    // Remove XSS patterns unless HTML is explicitly allowed
    if (!options.allowHtml) {
      for (const pattern of InputSanitizer.XSS_PATTERNS) {
        sanitized = sanitized.replace(pattern, "")
      }
    }

    // Remove SQL injection patterns
    for (const pattern of InputSanitizer.SQL_INJECTION_PATTERNS) {
      sanitized = sanitized.replace(pattern, "")
    }

    // Remove command injection patterns
    for (const pattern of InputSanitizer.COMMAND_INJECTION_PATTERNS) {
      sanitized = sanitized.replace(pattern, "")
    }

    // Apply custom patterns
    if (options.customPatterns) {
      for (const pattern of options.customPatterns) {
        sanitized = sanitized.replace(pattern, "")
      }
    }

    return sanitized
  }

  static sanitizeEmail(email: string): string {
    const sanitized = InputSanitizer.sanitizeString(email, { maxLength: 254 })
    return sanitized.toLowerCase().trim()
  }

  static sanitizeUrl(url: string): string {
    try {
      const parsed = new URL(url)
      // Only allow http and https protocols
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return ""
      }
      return parsed.toString()
    } catch {
      return ""
    }
  }

  static sanitizePhoneNumber(phone: string): string {
    return phone.replace(/[^\d+\-\s()]/g, "").substring(0, 20)
  }

  static sanitizeJson(input: any): any {
    if (typeof input === "string") {
      return InputSanitizer.sanitizeString(input)
    }
    if (Array.isArray(input)) {
      return input.map((item) => InputSanitizer.sanitizeJson(item))
    }
    if (typeof input === "object" && input !== null) {
      const sanitized: any = {}
      for (const [key, value] of Object.entries(input)) {
        // Prevent prototype pollution
        if (key === "__proto__" || key === "constructor" || key === "prototype") {
          continue
        }
        const sanitizedKey = InputSanitizer.sanitizeString(key, { maxLength: 100 })
        sanitized[sanitizedKey] = InputSanitizer.sanitizeJson(value)
      }
      return sanitized
    }
    return input
  }

  static validateAndSanitize<T>(
    input: any,
    schema: z.ZodSchema<T>,
    options: {
      stripUnknown?: boolean
      abortEarly?: boolean
      sanitizeStrings?: boolean
    } = {}
  ): { success: true; data: T } | { success: false; errors: string[] } {
    try {
      // Sanitize input if requested
      if (options.sanitizeStrings !== false) {
        input = InputSanitizer.sanitizeJson(input)
      }

      // Validate with schema
      const result = schema.parse(input)

      return { success: true, data: result }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          errors: error.issues.map((err) => `${err.path.join(".")}: ${err.message}`),
        }
      }
      return {
        success: false,
        errors: ["Validation failed"],
      }
    }
  }
}

// Data integrity validation
export class DataIntegrityValidator {
  static validateChecksum(data: any, expectedChecksum: string): boolean {
    const calculatedChecksum = DataIntegrityValidator.calculateChecksum(data)
    return calculatedChecksum === expectedChecksum
  }

  static calculateChecksum(data: any): string {
    const dataString = JSON.stringify(data, DataIntegrityValidator.sortObjectKeys)
    return crypto.createHash("sha256").update(dataString).digest("hex")
  }

  private static sortObjectKeys(_key: string, value: any): any {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return Object.keys(value)
        .sort()
        .reduce((sorted, key) => {
          sorted[key] = value[key]
          return sorted
        }, {} as any)
    }
    return value
  }

  static validateRequiredFields(data: any, requiredFields: string[]): string[] {
    const missingFields: string[] = []
    for (const field of requiredFields) {
      if (data[field] === undefined || data[field] === null || data[field] === "") {
        missingFields.push(field)
      }
    }
    return missingFields
  }

  static validateFieldTypes(data: any, fieldTypes: Record<string, string>): string[] {
    const typeErrors: string[] = []
    for (const [field, expectedType] of Object.entries(fieldTypes)) {
      if (data[field] !== undefined && data[field] !== null) {
        const actualType = Array.isArray(data[field]) ? "array" : typeof data[field]
        if (actualType !== expectedType) {
          typeErrors.push(`${field}: expected ${expectedType}, got ${actualType}`)
        }
      }
    }
    return typeErrors
  }

  static validateRangeConstraints(
    data: any,
    constraints: Record<string, { min?: number; max?: number }>
  ): string[] {
    const rangeErrors: string[] = []
    for (const [field, constraint] of Object.entries(constraints)) {
      // eslint-disable-next-line security/detect-object-injection
      if (data[field] !== undefined && data[field] !== null && typeof data[field] === "number") {
        if (constraint.min !== undefined && data[field] < constraint.min) {
          rangeErrors.push(`${field}: value ${data[field]} is below minimum ${constraint.min}`)
        }
        if (constraint.max !== undefined && data[field] > constraint.max) {
          rangeErrors.push(`${field}: value ${data[field]} is above maximum ${constraint.max}`)
        }
      }
    }
    return rangeErrors
  }
}

// Business rule validation
export class BusinessRuleValidator {
  static validateTimeRecordBusinessRules(record: any): string[] {
    const errors: string[] = []

    // Clock out must be after clock in
    if (record.clockInTime && record.clockOutTime) {
      if (new Date(record.clockOutTime) <= new Date(record.clockInTime)) {
        errors.push("Clock out time must be after clock in time")
      }

      // Maximum shift duration (24 hours)
      const durationMs =
        new Date(record.clockOutTime).getTime() - new Date(record.clockInTime).getTime()
      const durationHours = durationMs / (1000 * 60 * 60)
      if (durationHours > 24) {
        errors.push("Shift duration cannot exceed 24 hours")
      }

      // Minimum shift duration (5 minutes)
      if (durationHours < 0.083) {
        // 5 minutes
        errors.push("Shift duration must be at least 5 minutes")
      }
    }

    // Future time validation
    const now = new Date()
    if (record.clockInTime && new Date(record.clockInTime) > now) {
      errors.push("Clock in time cannot be in the future")
    }
    if (record.clockOutTime && new Date(record.clockOutTime) > now) {
      errors.push("Clock out time cannot be in the future")
    }

    return errors
  }

  static validateRotationBusinessRules(rotation: any): string[] {
    const errors: string[] = []

    // Start date must be before end date
    if (rotation.startDate && rotation.endDate) {
      if (new Date(rotation.startDate) >= new Date(rotation.endDate)) {
        errors.push("Start date must be before end date")
      }
    }

    // Reasonable date range (within 1 year)
    const now = new Date()
    const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
    if (rotation.startDate && new Date(rotation.startDate) > oneYearFromNow) {
      errors.push("Start date cannot be more than 1 year in the future")
    }

    return errors
  }

  static validateUserBusinessRules(user: any): string[] {
    const errors: string[] = []

    // Email domain validation for educational institutions
    if (user.email) {
      const validDomains = [".edu", ".edu.", ".ac.", ".edu."]
      const hasValidDomain = validDomains.some((domain) =>
        user.email.toLowerCase().includes(domain)
      )
      if (!hasValidDomain) {
        errors.push("Email must be from an educational institution")
      }
    }

    return errors
  }
}

// Security validation
export class SecurityValidator {
  static validatePasswordStrength(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    if (password.length < 8) {
      errors.push("Password must be at least 8 characters long")
    }

    if (!/[A-Z]/.test(password)) {
      errors.push("Password must contain at least one uppercase letter")
    }

    if (!/[a-z]/.test(password)) {
      errors.push("Password must contain at least one lowercase letter")
    }

    if (!/\d/.test(password)) {
      errors.push("Password must contain at least one number")
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push("Password must contain at least one special character")
    }

    // Check for common weak passwords
    const weakPasswords = ["password", "12345678", "qwerty", "admin", "letmein"]
    if (weakPasswords.some((weak) => password.toLowerCase().includes(weak))) {
      errors.push("Password is too common or weak")
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }

  static validateApiKey(apiKey: string): boolean {
    // Basic API key format validation
    const apiKeyPattern = /^[a-zA-Z0-9_-]{32,128}$/
    return apiKeyPattern.test(apiKey)
  }

  static validateJwtToken(token: string): boolean {
    // Basic JWT format validation
    const jwtPattern = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/
    return jwtPattern.test(token)
  }

  static validateIpAddress(ip: string): boolean {
    const ipv4Pattern =
      /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/
    const ipv6Pattern = /^([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}$/ // Simplified IPv6 for safety

    return ipv4Pattern.test(ip) || ipv6Pattern.test(ip)
  }
}

// Comprehensive validation service
export class ValidationService {
  static validateUserInput(data: any): { isValid: boolean; errors: string[]; sanitizedData?: any } {
    const errors: string[] = []

    // Sanitize input
    const sanitizedData = InputSanitizer.sanitizeJson(data)

    // Validate required fields
    const requiredFields = ["email", "name", "role", "schoolId"]
    const missingFields = DataIntegrityValidator.validateRequiredFields(
      sanitizedData,
      requiredFields
    )
    errors.push(...missingFields.map((field) => `${field} is required`))

    // Validate field types
    const fieldTypes = {
      email: "string",
      name: "string",
      role: "string",
      schoolId: "string",
      isActive: "boolean",
    }
    const typeErrors = DataIntegrityValidator.validateFieldTypes(sanitizedData, fieldTypes)
    errors.push(...typeErrors)

    // Validate email format
    if (sanitizedData.email && !z.string().email().safeParse(sanitizedData.email).success) {
      errors.push("Invalid email format")
    }

    // Validate role values
    if (sanitizedData.role && !["student", "admin", "supervisor"].includes(sanitizedData.role)) {
      errors.push("Invalid role value")
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: errors.length === 0 ? sanitizedData : undefined,
    }
  }

  static validateTimeRecordInput(data: any): {
    isValid: boolean
    errors: string[]
    sanitizedData?: any
  } {
    const errors: string[] = []

    // Sanitize input
    const sanitizedData = InputSanitizer.sanitizeJson(data)

    // Validate required fields
    const requiredFields = ["userId", "rotationId", "clockInTime"]
    const missingFields = DataIntegrityValidator.validateRequiredFields(
      sanitizedData,
      requiredFields
    )
    errors.push(...missingFields.map((field) => `${field} is required`))

    // Validate business rules
    const businessRuleErrors = BusinessRuleValidator.validateTimeRecordBusinessRules(sanitizedData)
    errors.push(...businessRuleErrors)

    // Validate location data if present
    if (sanitizedData.location) {
      const locationValidation = InputSanitizer.validateAndSanitize(
        sanitizedData.location,
        z.object({
          latitude: z.number().min(-90).max(90),
          longitude: z.number().min(-180).max(180),
          accuracy: z.number().min(0).max(1000).optional(),
          address: z.string().max(500).trim().optional(),
        })
      )

      if (!locationValidation.success) {
        errors.push(...locationValidation.errors)
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: errors.length === 0 ? sanitizedData : undefined,
    }
  }

  static validateApiRequest(
    data: any,
    schema: z.ZodSchema
  ): { isValid: boolean; errors: string[]; sanitizedData?: any } {
    const result = InputSanitizer.validateAndSanitize(data, schema, {
      sanitizeStrings: true,
      stripUnknown: true,
      abortEarly: false,
    })

    if (!result.success) {
      return {
        isValid: false,
        errors: result.errors,
      }
    }

    return {
      isValid: true,
      errors: [],
      sanitizedData: result.data,
    }
  }
}

// Data validator class for coordinate validation
export class DataValidator {
  static validateCoordinates(latitude: number, longitude: number): boolean {
    return (
      typeof latitude === "number" &&
      typeof longitude === "number" &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180 &&
      !isNaN(latitude) &&
      !isNaN(longitude) &&
      isFinite(latitude) &&
      isFinite(longitude)
    )
  }

  static validateLocationAccuracy(accuracy: number): boolean {
    return (
      typeof accuracy === "number" &&
      accuracy >= 0 &&
      accuracy <= 10000 && // 10km max
      !isNaN(accuracy) &&
      isFinite(accuracy)
    )
  }

  static validateTimestamp(timestamp: number | Date): boolean {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp)
    const now = new Date()
    const timeDiff = Math.abs(now.getTime() - date.getTime())

    // Allow timestamps within 24 hours of current time
    return timeDiff <= 24 * 60 * 60 * 1000
  }
}

// Export validation middleware for API routes
export function createValidationMiddleware(schema: z.ZodSchema) {
  return async (req: Request) => {
    try {
      const body = await req.json()
      const validation = ValidationService.validateApiRequest(body, schema)

      if (!validation.isValid) {
        return new Response(
          JSON.stringify({
            error: "Validation failed",
            details: validation.errors,
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        )
      }
      // Attach sanitized data to request for use in route handlers

      ; (req as any).validatedData = validation.sanitizedData
      return null // Continue to next middleware/handler
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: "Invalid request body",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      )
    }
  }
}
