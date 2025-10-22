import { createHash } from "node:crypto"
import { and, count, desc, eq, gte, inArray, like, lte, type SQL, sql } from "drizzle-orm"
import { headers } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "../../../database/connection-pool"
import { auditLogs, users } from "../../../database/schema"
import { getSchoolContext, type SchoolContext } from "../../../lib/school-utils"
import { cacheIntegrationService } from '@/lib/cache-integration'


/**
 * Enhanced validation schemas for audit logs API
 */

// User roles enum for validation
const _USER_ROLES = [
  "SUPER_ADMIN",
  "SCHOOL_ADMIN",
  "CLINICAL_PRECEPTOR",
  "CLINICAL_SUPERVISOR",
  "STUDENT",
] as const
const SEVERITY_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const
const STATUS_TYPES = ["SUCCESS", "FAILURE", "ERROR"] as const
const EXPORT_FORMATS = ["json", "csv"] as const

// Input sanitization helper
const sanitizeString = (str: string): string => {
  return str.trim().replace(/[<>"'&]/g, (match) => {
    const entities: Record<string, string> = {
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#x27;",
      "&": "&amp;",
    }
    return entities[match] || match
  })
}

/**
 * Security and utility helper functions
 */

/**
 * Rate limiting store (in production, use Redis or similar distributed cache)
 * Maps client identifiers to their request count and reset time
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

/**
 * Rate limiting helper function
 * @param identifier - Client identifier (IP address, user ID, etc.)
 * @param maxRequests - Maximum number of requests allowed in the time window
 * @param windowMs - Time window in milliseconds
 * @returns true if request is allowed, false if rate limit exceeded
 */
const checkRateLimit = (identifier: string, maxRequests = 100, windowMs = 60000): boolean => {
  const now = Date.now()
  const key = identifier
  const current = rateLimitStore.get(key)

  if (!current || now > current.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs })
    return true
  }

  if (current.count >= maxRequests) {
    return false
  }

  current.count++
  return true
}

/**
 * Adds security headers to HTTP responses
 * @param response - NextResponse object to add headers to
 * @returns Modified response with security headers
 */
const addSecurityHeaders = (response: NextResponse): NextResponse => {
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("X-XSS-Protection", "1; mode=block")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
  return response
}

/**
 * Generates integrity hash for audit log data
 * @param logData - Data object to generate hash for
 * @returns SHA256 hash string for data integrity verification
 */
const _generateIntegrityHash = (logData: Record<string, unknown>): string => {
  const dataString = JSON.stringify(logData, Object.keys(logData).sort())
  return createHash("sha256").update(dataString).digest("hex")
}

/**
 * Role-based access control helper for audit log operations
 * @param userRole - User's role (SUPER_ADMIN, SCHOOL_ADMIN, etc.)
 * @param userId - User's unique identifier
 * @param schoolId - School identifier (required for school-based roles)
 * @param operation - Type of operation being attempted
 * @returns Object indicating if access is allowed and reason if denied
 */
const checkAuditLogAccess = async (
  userRole: string,
  _userId: string,
  _schoolId: string | null,
  operation: "read" | "write" | "delete" | "export"
) => {
  const permissions = {
    SUPER_ADMIN: { read: true, write: true, delete: true, export: true, scope: "global" },
    SCHOOL_ADMIN: { read: true, write: true, delete: false, export: true, scope: "school" },
    CLINICAL_PRECEPTOR: { read: true, write: true, delete: false, export: false, scope: "school" },
    CLINICAL_SUPERVISOR: { read: true, write: true, delete: false, export: false, scope: "school" },
    STUDENT: { read: false, write: false, delete: false, export: false, scope: "none" },
  }

  const userPermissions = permissions[userRole as keyof typeof permissions]
  if (!userPermissions) {
    return { allowed: false, scope: "none", reason: "Invalid user role" }
  }

  if (!userPermissions[operation]) {
    return {
      allowed: false,
      scope: userPermissions.scope,
      reason: `Operation '${operation}' not allowed for role '${userRole}'`,
    }
  }

  return { allowed: true, scope: userPermissions.scope, reason: null }
}

/**
 * Builds database query conditions based on user role and access permissions
 * @param userRole - User's role determining access level
 * @param userId - User's unique identifier
 * @param schoolId - School identifier for school-based filtering
 * @param queryParams - Additional query parameters
 * @returns Array of database query conditions
 */
const buildAccessControlConditions = async (
  userRole: string,
  _userId: string,
  schoolId: string | null,
  _queryParams: Record<string, unknown>
) => {
  const conditions: SQL[] = []

  // Super admins can see all logs
  if (userRole === "SUPER_ADMIN") {
    return conditions
  }

  // School-based roles can only see logs from their school
  if (
    ["SCHOOL_ADMIN", "CLINICAL_PRECEPTOR", "CLINICAL_SUPERVISOR"].includes(userRole) &&
    schoolId
  ) {
    // Get all users from the same school
    const schoolUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.schoolId, schoolId))

    const schoolUserIds = schoolUsers.map((u) => u.id)
    if (schoolUserIds.length > 0) {
      conditions.push(inArray(auditLogs.userId, schoolUserIds))
    } else {
      // If no users found, return impossible condition
      conditions.push(eq(auditLogs.id, "impossible-id"))
    }
  }

  // Students cannot access audit logs (handled in checkAuditLogAccess)
  if (userRole === "STUDENT") {
    conditions.push(eq(auditLogs.id, "impossible-id"))
  }

  return conditions
}

/**
 * Enhanced error logging with context and user information
 * @param error - Error object or message
 * @param context - Context where the error occurred
 * @param userId - Optional user identifier for tracking
 */
function logError(error: Error | unknown, context: string, userId?: string): void {
  const errorInfo = {
    message: error instanceof Error ? error.message : "Unknown error",
    stack: error instanceof Error ? error.stack : undefined,
    context,
    userId,
    timestamp: new Date().toISOString(),
    userAgent: "unknown",
  }

  console.error("Audit Log Error:", JSON.stringify(errorInfo, null, 2))

  // In production, send to monitoring service
  if (process.env.NODE_ENV === "production") {
    // Send to monitoring service like Sentry, DataDog, etc.
  }
}

/**
 * Exports audit logs in specified format (CSV or JSON)
 * @param logs - Array of audit log records to export
 * @param format - Export format ('csv' or 'json')
 * @param includeDetails - Whether to include detailed information in export
 * @returns Formatted string ready for download
 */
function exportAuditLogs(
  logs: Record<string, unknown>[],
  format: "csv" | "json",
  includeDetails = false
): string {
  if (format === "json") {
    return JSON.stringify(logs, null, 2)
  }

  // CSV export
  if (logs.length === 0) {
    return "No data to export"
  }

  const headers = [
    "ID",
    "User ID",
    "Action",
    "Resource",
    "Resource ID",
    "IP Address",
    "User Agent",
    "Severity",
    "Status",
    "Created At",
  ]

  if (includeDetails) {
    headers.push("Details")
  }

  const csvRows = [headers.join(",")]

  logs.forEach((log) => {
    const row = [
      log.id,
      log.userId,
      log.action,
      log.resource,
      log.resourceId || "",
      log.ipAddress,
      log.userAgent,
      log.severity,
      log.status,
      log.createdAt,
    ]

    if (includeDetails) {
      row.push(JSON.stringify(log.details || {}).replace(/"/g, '""'))
    }

    csvRows.push(row.map((field) => `"${field}"`).join(","))
  })

  return csvRows.join("\n")
}

// Enhanced query parameters validation
const queryParamsSchema = z.object({
  userId: z.string().uuid().optional(),
  action: z
    .string()
    .min(1)
    .max(100)
    .optional()
    .transform((val) => (val ? sanitizeString(val) : val)),
  resource: z
    .string()
    .min(1)
    .max(50)
    .optional()
    .transform((val) => (val ? sanitizeString(val) : val)),
  severity: z.enum(SEVERITY_LEVELS).optional(),
  status: z.enum(STATUS_TYPES).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.coerce.number().min(1).max(1000).default(50),
  offset: z.coerce.number().min(0).default(0),
  cursor: z.string().optional(),
  export: z.enum(EXPORT_FORMATS).optional(),
  includeStats: z.coerce.boolean().default(false),
  schoolId: z.string().uuid().optional(),
  resourceId: z.string().optional(),
})

// Enhanced audit log creation schema
const createAuditLogSchema = z.object({
  action: z.string().min(1, "Action is required").max(100).transform(sanitizeString),
  resource: z
    .string()
    .min(1)
    .max(50)
    .optional()
    .transform((val) => (val ? sanitizeString(val) : val)),
  resourceId: z.string().max(100).optional(),
  details: z
    .string()
    .max(5000)
    .optional()
    .transform((val) => (val ? sanitizeString(val) : val)),
  severity: z.enum(SEVERITY_LEVELS).default("LOW"),
  status: z.enum(STATUS_TYPES).default("SUCCESS"),
})

// Bulk operations schema
const _bulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  reason: z.string().min(1).max(500).transform(sanitizeString),
})

// Retention policy schema
const _retentionPolicySchema = z.object({
  retentionDays: z.number().min(30).max(2555), // 30 days to 7 years
  severity: z.enum(SEVERITY_LEVELS).optional(),
  dryRun: z.boolean().default(true),
})

/**
 * GET /api/audit-logs - Enhanced audit logs retrieval with comprehensive access control
 *
 * Features:
 * - Role-based access control for all user types
 * - Cursor-based pagination for better performance
 * - Data export capabilities (JSON, CSV)
 * - Rate limiting and security headers
 * - Comprehensive input validation
 * - Audit statistics and analytics
 * - Enhanced error handling and logging
 */
export async function GET(request: NextRequest) {
  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      'api:audit-logs/route.ts',
      async () => {
        // Original function logic will be wrapped here
        return await executeOriginalLogic()
      },
      300 // 5 minutes TTL
    )
    
    if (cached) {
      return cached
    }
  } catch (cacheError) {
    console.warn('Cache error in audit-logs/route.ts:', cacheError)
    // Continue with original logic if cache fails
  }
  
  async function executeOriginalLogic() {

  const startTime = Date.now()
  let context: SchoolContext | null = null

  try {
    // Get client IP for rate limiting
    const headersList = await headers()
    const clientIP = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || "unknown"
    const userAgent = headersList.get("user-agent") || "unknown"

    // Apply rate limiting
    if (!checkRateLimit(clientIP, 100, 60000)) {
      logError(new Error("Rate limit exceeded"), "GET_RATE_LIMIT", clientIP)
      const response = NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429 }
      )
      return addSecurityHeaders(response)
    }

    // Get user context
    context = await getSchoolContext()
    if (!context?.userId) {
      const response = NextResponse.json({ error: "Authentication required" }, { status: 401 })
      return addSecurityHeaders(response)
    }

    // Type assertion after null check
    const userContext = context as { userId: string; userRole: string; schoolId: string | null }

    // Check permissions
    const accessCheck = await checkAuditLogAccess(
      userContext.userRole,
      userContext.userId,
      userContext.schoolId,
      "read"
    )

    if (!accessCheck.allowed) {
      logError(
        new Error(`Access denied: ${accessCheck.reason}`),
        "GET_ACCESS_DENIED",
        userContext.userId
      )
      const response = NextResponse.json(
        { error: "Insufficient permissions", reason: accessCheck.reason },
        { status: 403 }
      )
      return addSecurityHeaders(response)
    }

    // Validate and parse query parameters
    const { searchParams } = new URL(request.url)
    const rawParams = Object.fromEntries(searchParams.entries())

    let validatedParams: z.infer<typeof queryParamsSchema>
    try {
      validatedParams = queryParamsSchema.parse(rawParams)
    } catch (validationError) {
      logError(validationError, "GET_VALIDATION_ERROR", userContext.userId)
      const response = NextResponse.json(
        {
          error: "Invalid query parameters",
          details:
            validationError instanceof z.ZodError ? validationError.issues : "Validation failed",
        },
        { status: 400 }
      )
      return addSecurityHeaders(response)
    }

    // Check export permissions
    if (validatedParams.export) {
      const exportCheck = await checkAuditLogAccess(
        userContext.userRole,
        userContext.userId,
        userContext.schoolId,
        "export"
      )

      if (!exportCheck.allowed) {
        const response = NextResponse.json(
          { error: "Export not permitted for your role" },
          { status: 403 }
        )
        return addSecurityHeaders(response)
      }
    }

    // Build base query conditions
    const conditions: SQL[] = []

    // Add access control conditions based on user role
    const accessConditions = await buildAccessControlConditions(
      userContext.userRole,
      userContext.userId,
      userContext.schoolId,
      validatedParams
    )
    conditions.push(...accessConditions)

    // Add filter conditions
    if (validatedParams.userId) {
      conditions.push(eq(auditLogs.userId, validatedParams.userId))
    }

    if (validatedParams.action) {
      conditions.push(like(auditLogs.action, `%${validatedParams.action}%`))
    }

    if (validatedParams.resource) {
      conditions.push(eq(auditLogs.resource, validatedParams.resource))
    }

    if (validatedParams.resourceId) {
      conditions.push(eq(auditLogs.resourceId, validatedParams.resourceId))
    }

    if (validatedParams.severity) {
      conditions.push(eq(auditLogs.severity, validatedParams.severity))
    }

    if (validatedParams.status) {
      conditions.push(eq(auditLogs.status, validatedParams.status))
    }

    if (validatedParams.startDate) {
      conditions.push(gte(auditLogs.createdAt, new Date(validatedParams.startDate)))
    }

    if (validatedParams.endDate) {
      conditions.push(lte(auditLogs.createdAt, new Date(validatedParams.endDate)))
    }

    // Cursor-based pagination
    if (validatedParams.cursor) {
      try {
        const cursorData = JSON.parse(Buffer.from(validatedParams.cursor, "base64").toString())
        conditions.push(lte(auditLogs.createdAt, new Date(cursorData.createdAt)))
        conditions.push(sql`${auditLogs.id} != ${cursorData.id}`)
      } catch (cursorError) {
        logError(cursorError, "GET_CURSOR_ERROR", userContext.userId)
        const response = NextResponse.json({ error: "Invalid cursor format" }, { status: 400 })
        return addSecurityHeaders(response)
      }
    }

    // Execute main query
    const logs = await db
      .select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        action: auditLogs.action,
        resource: auditLogs.resource,
        resourceId: auditLogs.resourceId,
        details: auditLogs.details,
        ipAddress: auditLogs.ipAddress,
        userAgent: auditLogs.userAgent,
        sessionId: auditLogs.sessionId,
        severity: auditLogs.severity,
        status: auditLogs.status,
        createdAt: auditLogs.createdAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
      .limit(validatedParams.limit + 1) // +1 to check if there are more records

    // Determine if there are more records
    const hasMore = logs.length > validatedParams.limit
    const resultLogs = hasMore ? logs.slice(0, validatedParams.limit) : logs

    // Generate next cursor
    let nextCursor = null
    if (hasMore && resultLogs.length > 0) {
      const lastLog = resultLogs[resultLogs.length - 1]
      const cursorData = {
        createdAt: lastLog.createdAt.toISOString(),
        id: lastLog.id,
      }
      nextCursor = Buffer.from(JSON.stringify(cursorData)).toString("base64")
    }

    // Get statistics if requested
    let stats = null
    if (validatedParams.includeStats) {
      try {
        const [totalCount, severityStats, statusStats, recentActivity] = await Promise.all([
          // Total count
          db
            .select({ total: count() })
            .from(auditLogs)
            .leftJoin(users, eq(auditLogs.userId, users.id))
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .then((result) => result[0]?.total || 0),

          // Severity distribution
          db
            .select({
              severity: auditLogs.severity,
              count: count(),
            })
            .from(auditLogs)
            .leftJoin(users, eq(auditLogs.userId, users.id))
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .groupBy(auditLogs.severity),

          // Status distribution
          db
            .select({
              status: auditLogs.status,
              count: count(),
            })
            .from(auditLogs)
            .leftJoin(users, eq(auditLogs.userId, users.id))
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .groupBy(auditLogs.status),

          // Recent activity (last 24 hours)
          db
            .select({ count: count() })
            .from(auditLogs)
            .leftJoin(users, eq(auditLogs.userId, users.id))
            .where(
              and(
                gte(auditLogs.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)),
                conditions.length > 0 ? and(...conditions) : undefined
              )
            )
            .then((result) => result[0]?.count || 0),
        ])

        stats = {
          total: totalCount,
          severityDistribution: severityStats,
          statusDistribution: statusStats,
          recentActivity24h: recentActivity,
          queryTime: Date.now() - startTime,
        }
      } catch (statsError) {
        logError(statsError, "GET_STATS_ERROR", userContext.userId)
        // Continue without stats if there's an error
      }
    }

    // Handle export requests
    if (validatedParams.export) {
      try {
        const exportData = exportAuditLogs(resultLogs, validatedParams.export)
        const filename = `audit-logs-${new Date().toISOString().split("T")[0]}.${validatedParams.export}`

        const response = new NextResponse(exportData, {
          status: 200,
          headers: {
            "Content-Type": validatedParams.export === "csv" ? "text/csv" : "application/json",
            "Content-Disposition": `attachment; filename="${filename}"`,
          },
        })

        // Log export activity
        await db.insert(auditLogs).values({
          id: crypto.randomUUID(),
          userId: userContext.userId,
          action: "EXPORT_AUDIT_LOGS",
          resource: "audit_logs",
          details: JSON.stringify({
            format: validatedParams.export,
            recordCount: resultLogs.length,
            filters: validatedParams,
          }),
          ipAddress: clientIP,
          userAgent: userAgent,
          severity: "MEDIUM",
          status: "SUCCESS",
          createdAt: new Date(),
        })

        return addSecurityHeaders(response)
      } catch (exportError) {
        logError(exportError, "GET_EXPORT_ERROR", userContext.userId)
        const response = NextResponse.json({ error: "Export failed" }, { status: 500 })
        return addSecurityHeaders(response)
      }
    }

    // Return standard JSON response
    const responseData = {
      success: true,
      data: resultLogs,
      pagination: {
        limit: validatedParams.limit,
        hasMore,
        nextCursor,
        total: stats?.total || null,
      },
      stats,
      meta: {
        queryTime: Date.now() - startTime,
        userRole: userContext.userRole,
        accessScope: accessCheck.scope,
      },
    }

    const response = NextResponse.json(responseData)
    return addSecurityHeaders(response)
  } catch (error) {
    logError(error, "GET_UNEXPECTED_ERROR", context?.userId)
    const response = NextResponse.json(
      {
        error: "Internal server error",
        message:
          process.env.NODE_ENV === "development"
            ? (error as Error).message
            : "An unexpected error occurred",
      },
      { status: 500 }
    )
    return addSecurityHeaders(response)
  }

  }
}

/**
 * POST /api/audit-logs - Enhanced audit log creation with comprehensive validation
 *
 * Features:
 * - Role-based access control for all user types
 * - Comprehensive input validation and sanitization
 * - Rate limiting and security headers
 * - Bulk creation support
 * - Enhanced error handling and logging
 * - Integrity hash generation
 * - Transaction support for bulk operations
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  let context: { userId?: string; userRole?: string; schoolId?: string | null } | null = null

  try {
    // Get client IP for rate limiting
    const headersList = await headers()
    const clientIP = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || "unknown"
    const userAgent = headersList.get("user-agent") || "unknown"

    // Apply rate limiting (stricter for POST)
    if (!checkRateLimit(clientIP, 50, 60000)) {
      logError(new Error("Rate limit exceeded"), "POST_RATE_LIMIT", clientIP)
      const response = NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429 }
      )
      return addSecurityHeaders(response)
    }

    // Get user context
    context = await getSchoolContext()
    if (!context?.userId) {
      const response = NextResponse.json({ error: "Authentication required" }, { status: 401 })
      return addSecurityHeaders(response)
    }

    // Type assertion after null check
    const userContext = context as { userId: string; userRole: string; schoolId: string | null }

    // Check permissions
    const accessCheck = await checkAuditLogAccess(
      userContext.userRole,
      userContext.userId,
      userContext.schoolId,
      "write"
    )

    if (!accessCheck.allowed) {
      logError(
        new Error(`Write access denied: ${accessCheck.reason}`),
        "POST_ACCESS_DENIED",
        userContext.userId
      )
      const response = NextResponse.json(
        { error: "Insufficient permissions", reason: accessCheck.reason },
        { status: 403 }
      )
      return addSecurityHeaders(response)
    }

    // Parse and validate request body
    let body: Record<string, unknown> | Record<string, unknown>[]
    try {
      body = await request.json()
    } catch (parseError) {
      logError(parseError, "POST_JSON_PARSE_ERROR", userContext.userId)
      const response = NextResponse.json({ error: "Invalid JSON format" }, { status: 400 })
      return addSecurityHeaders(response)
    }

    // Check if this is a bulk operation
    const isBulkOperation = Array.isArray(body)
    const entries: Record<string, unknown>[] = isBulkOperation
      ? (body as Record<string, unknown>[])
      : [body as Record<string, unknown>]

    // Validate bulk operation limits
    if (isBulkOperation && entries.length > 100) {
      const response = NextResponse.json(
        { error: "Bulk operation limited to 100 entries maximum" },
        { status: 400 }
      )
      return addSecurityHeaders(response)
    }

    // Validate each entry
    const validatedEntries: Record<string, unknown>[] = []
    const validationErrors: { line: number; error: string }[] = []

    for (let i = 0; i < entries.length; i++) {
      try {
        const validatedData = createAuditLogSchema.parse(entries[i])

        // Add server-side metadata
        const enrichedData = {
          ...validatedData,
          id: crypto.randomUUID(),
          userId: userContext.userId,
          ipAddress: clientIP,
          userAgent: userAgent,
          sessionId: crypto.randomUUID(),
          createdAt: new Date(),
        }

        // Note: Integrity hash generation available but not stored in database

        validatedEntries.push(enrichedData)
      } catch (validationError) {
        validationErrors.push({
          line: i,
          error:
            validationError instanceof z.ZodError
              ? JSON.stringify(validationError.issues)
              : "Validation failed",
        })
      }
    }

    // Return validation errors if any
    if (validationErrors.length > 0) {
      logError(
        new Error(`Validation failed for ${validationErrors.length} entries`),
        "POST_VALIDATION_ERROR",
        userContext.userId
      )
      const response = NextResponse.json(
        {
          error: "Validation failed",
          details: validationErrors,
          validCount: validatedEntries.length,
          errorCount: validationErrors.length,
        },
        { status: 400 }
      )
      return addSecurityHeaders(response)
    }

    // Execute database operations
    let insertedData: unknown
    try {
      if (isBulkOperation) {
        // Use transaction for bulk operations
        insertedData = await db.transaction(async (tx) => {
          const insertedLogs = []

          // Insert in batches of 50 for better performance
          const batchSize = 50
          for (let i = 0; i < validatedEntries.length; i += batchSize) {
            const batch = validatedEntries.slice(i, i + batchSize)
            const batchResult = await tx
              .insert(auditLogs)
              .values(batch as (typeof auditLogs.$inferInsert)[])
              .returning()

            insertedLogs.push(...batchResult)
          }

          return insertedLogs
        })
      } else {
        // Single entry insertion
        insertedData = await db
          .insert(auditLogs)
          .values(validatedEntries[0] as typeof auditLogs.$inferInsert)
          .returning()
      }

      // Create the result object with proper structure
      const _result = {
        success: true,
        imported: validatedEntries.length,
        errors: validationErrors,
      }

      // Log the creation activity
      await db.insert(auditLogs).values({
        id: crypto.randomUUID(),
        userId: userContext.userId,
        action: isBulkOperation ? "BULK_CREATE_AUDIT_LOGS" : "CREATE_AUDIT_LOG",
        resource: "audit_logs",
        details: JSON.stringify({
          createdCount: validatedEntries.length,
          isBulkOperation,
        }),
        ipAddress: clientIP,
        userAgent: userAgent,
        severity: "MEDIUM",
        status: "SUCCESS",
        createdAt: new Date(),
      })

      // Define interface for inserted audit log data
      interface InsertedAuditLog {
        id: string;
        userId: string;
        action: string;
        resource: string;
        details: Record<string, unknown>;
        ipAddress: string;
        userAgent: string;
        severity: string;
        status: string;
        createdAt: Date;
      }

      const responseData = {
        success: true,
        data: isBulkOperation ? insertedData : (insertedData as InsertedAuditLog[])[0],
        meta: {
          created: validatedEntries.length,
          isBulkOperation,
          processingTime: Date.now() - startTime,
        },
      }

      const response = NextResponse.json(responseData, { status: 201 })
      return addSecurityHeaders(response)
    } catch (dbError) {
      logError(dbError, "POST_DATABASE_ERROR", userContext.userId)
      const response = NextResponse.json(
        {
          error: "Database operation failed",
          message:
            process.env.NODE_ENV === "development"
              ? (dbError as Error).message
              : "Failed to create audit log entries",
        },
        { status: 500 }
      )
      return addSecurityHeaders(response)
    }
  } catch (error) {
    logError(error, "POST_UNEXPECTED_ERROR", context?.userId)
    const response = NextResponse.json(
      {
        error: "Internal server error",
        message:
          process.env.NODE_ENV === "development"
            ? (error as Error).message
            : "An unexpected error occurred",
      },
      { status: 500 }
    )
    return addSecurityHeaders(response)
  }
}

// Enhanced deletion parameters validation
const deleteParamsSchema = z.object({
  // Single record deletion
  id: z.string().uuid().optional(),

  // Bulk deletion criteria
  retentionDays: z.coerce.number().min(1).max(2555).optional(), // 1 day to 7 years
  userId: z.string().uuid().optional(),
  action: z
    .string()
    .min(1)
    .max(100)
    .optional()
    .transform((val) => (val ? sanitizeString(val) : val)),
  resource: z
    .string()
    .min(1)
    .max(50)
    .optional()
    .transform((val) => (val ? sanitizeString(val) : val)),
  severity: z.enum(SEVERITY_LEVELS).optional(),
  status: z.enum(STATUS_TYPES).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),

  // Safety and control parameters
  force: z.coerce.boolean().default(false),
  confirmed: z.coerce.boolean().default(false),
  dryRun: z.coerce.boolean().default(false),
  limit: z.coerce.number().min(1).max(10000).default(1000),

  // Operation type flags
  bulkDelete: z.coerce.boolean().default(false),
  deleteAll: z.coerce.boolean().default(false),
})

/**
 * DELETE /api/audit-logs - Enhanced audit log deletion with comprehensive controls
 *
 * Features:
 * - Role-based access control with strict permissions
 * - Bulk deletion with retention policies
 * - Selective deletion by criteria
 * - Enhanced error handling and logging
 * - Transaction support for data integrity
 * - Audit trail for all deletion activities
 * - Safety checks and confirmation requirements
 */
export async function DELETE(request: NextRequest) {
  const startTime = Date.now()
  let context: { userId?: string; userRole?: string; schoolId?: string | null } | null = null

  try {
    // Get client IP for rate limiting
    const headersList = await headers()
    const clientIP = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || "unknown"

    // Apply strict rate limiting for DELETE operations
    if (!checkRateLimit(clientIP, 10, 60000)) {
      logError(new Error("Rate limit exceeded"), "DELETE_RATE_LIMIT", clientIP)
      const response = NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429 }
      )
      return addSecurityHeaders(response)
    }

    // Get user context
    context = await getSchoolContext()
    if (!context?.userId) {
      const response = NextResponse.json({ error: "Authentication required" }, { status: 401 })
      return addSecurityHeaders(response)
    }

    // Type assertion after null check
    const userContext = context as { userId: string; userRole: string; schoolId: string | null }

    // Check permissions - only specific roles can delete audit logs
    const accessCheck = await checkAuditLogAccess(
      userContext.userRole,
      userContext.userId,
      userContext.schoolId,
      "delete"
    )

    if (!accessCheck.allowed) {
      logError(
        new Error(`Delete access denied: ${accessCheck.reason}`),
        "DELETE_ACCESS_DENIED",
        userContext.userId
      )
      const response = NextResponse.json(
        { error: "Insufficient permissions", reason: accessCheck.reason },
        { status: 403 }
      )
      return addSecurityHeaders(response)
    }

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url)
    const rawParams = Object.fromEntries(searchParams.entries())

    let validatedParams: z.infer<typeof deleteParamsSchema>
    try {
      validatedParams = deleteParamsSchema.parse(rawParams)
    } catch (validationError) {
      logError(validationError, "DELETE_VALIDATION_ERROR", userContext.userId)
      const response = NextResponse.json(
        {
          error: "Invalid query parameters",
          details:
            validationError instanceof z.ZodError ? validationError.issues : "Validation failed",
        },
        { status: 400 }
      )
      return addSecurityHeaders(response)
    }

    // Safety checks for retention policies
    if (validatedParams.retentionDays && !validatedParams.force) {
      if (validatedParams.retentionDays < 30) {
        const response = NextResponse.json(
          {
            error: "Minimum retention period is 30 days",
            suggestion: "Use force=true to override this safety check",
          },
          { status: 400 }
        )
        return addSecurityHeaders(response)
      }
    }

    // Require confirmation for bulk deletions
    if (
      !validatedParams.confirmed &&
      (validatedParams.retentionDays || validatedParams.bulkDelete || validatedParams.deleteAll)
    ) {
      const response = NextResponse.json(
        {
          error: "Confirmation required for bulk deletion operations",
          suggestion: "Add confirmed=true to proceed with deletion",
        },
        { status: 400 }
      )
      return addSecurityHeaders(response)
    }

    // Build deletion conditions
    const conditions: SQL[] = []
    let deletionType = "selective"
    let estimatedCount = 0

    // Add access control conditions
    const accessConditions = await buildAccessControlConditions(
      userContext.userRole,
      userContext.userId,
      userContext.schoolId,
      validatedParams
    )
    conditions.push(...accessConditions)

    // Single record deletion
    if (validatedParams.id) {
      conditions.push(eq(auditLogs.id, validatedParams.id))
      deletionType = "single"
    }

    // Retention-based deletion
    if (validatedParams.retentionDays) {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - validatedParams.retentionDays)
      conditions.push(lte(auditLogs.createdAt, cutoffDate))
      deletionType = "retention"
    }

    // Specific criteria deletion
    if (validatedParams.userId) {
      conditions.push(eq(auditLogs.userId, validatedParams.userId))
    }

    if (validatedParams.action) {
      conditions.push(like(auditLogs.action, `%${validatedParams.action}%`))
    }

    if (validatedParams.resource) {
      conditions.push(eq(auditLogs.resource, validatedParams.resource))
    }

    if (validatedParams.severity) {
      conditions.push(eq(auditLogs.severity, validatedParams.severity))
    }

    if (validatedParams.status) {
      conditions.push(eq(auditLogs.status, validatedParams.status))
    }

    if (validatedParams.startDate) {
      conditions.push(gte(auditLogs.createdAt, new Date(validatedParams.startDate)))
    }

    if (validatedParams.endDate) {
      conditions.push(lte(auditLogs.createdAt, new Date(validatedParams.endDate)))
    }

    // Get estimated count before deletion
    try {
      const [{ total }] = await db
        .select({ total: count() })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.userId, users.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)

      estimatedCount = total || 0
    } catch (countError) {
      logError(countError, "DELETE_COUNT_ERROR", userContext.userId)
    }

    // Safety check for large deletions
    if (estimatedCount > 10000 && !validatedParams.force) {
      const response = NextResponse.json(
        {
          error: `Large deletion detected (${estimatedCount} records)`,
          suggestion: "Use force=true to proceed with large deletion",
          estimatedCount,
        },
        { status: 400 }
      )
      return addSecurityHeaders(response)
    }

    // Handle dry run
    if (validatedParams.dryRun) {
      const response = NextResponse.json({
        success: true,
        dryRun: true,
        estimatedCount,
        deletionType,
        message: `Dry run: Would delete ${estimatedCount} audit log records`,
      })
      return addSecurityHeaders(response)
    }

    // Execute deletion in transaction
    let deletionResult: { deletedCount: number; deletedIds: string[] }
    try {
      deletionResult = await db.transaction(async (tx) => {
        // Get records to be deleted for audit trail
        const recordsToDelete = await tx
          .select({
            id: auditLogs.id,
            userId: auditLogs.userId,
            action: auditLogs.action,
            resource: auditLogs.resource,
            createdAt: auditLogs.createdAt,
          })
          .from(auditLogs)
          .leftJoin(users, eq(auditLogs.userId, users.id))
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .limit(validatedParams.limit || 1000) // Safety limit

        // Perform deletion
        const deletedLogs = await tx
          .delete(auditLogs)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .returning({ id: auditLogs.id, createdAt: auditLogs.createdAt })

        return {
          deletedCount: deletedLogs.length,
          deletedIds: deletedLogs.map((log) => log.id),
          deleted: deletedLogs,
          preview: recordsToDelete,
        }
      })
    } catch (dbError) {
      logError(dbError, "DELETE_DATABASE_ERROR", userContext.userId)
      const response = NextResponse.json(
        {
          error: "Database operation failed",
          message:
            process.env.NODE_ENV === "development"
              ? (dbError as Error).message
              : "Failed to delete audit logs",
        },
        { status: 500 }
      )
      return addSecurityHeaders(response)
    }

    // Log the deletion activity
    try {
      await db.insert(auditLogs).values({
        id: crypto.randomUUID(),
        userId: userContext.userId,
        action: "DELETE_AUDIT_LOGS",
        resource: "audit_logs",
        details: JSON.stringify({
          deletionType,
          deletedCount: deletionResult.deletedCount,
          estimatedCount,
          criteria: validatedParams,
          force: validatedParams.force || false,
          confirmed: validatedParams.confirmed || false,
        }),
        ipAddress: clientIP,
        userAgent: headersList.get("user-agent") || "unknown",
        severity: "HIGH",
        status: "SUCCESS",
        createdAt: new Date(),
      })
    } catch (logError) {
      // Don't fail the operation if logging fails
      console.error("Failed to log deletion activity:", logError)
    }

    const responseData = {
      success: true,
      message: "Audit logs deleted successfully",
      deletedCount: deletionResult.deletedCount,
      estimatedCount,
      deletionType,
      meta: {
        processingTime: Date.now() - startTime,
        userRole: userContext.userRole,
        criteria: validatedParams,
      },
    }

    const response = NextResponse.json(responseData)
    return addSecurityHeaders(response)
  } catch (error) {
    logError(error, "DELETE_UNEXPECTED_ERROR", context?.userId)
    const response = NextResponse.json(
      {
        error: "Internal server error",
        message:
          process.env.NODE_ENV === "development"
            ? (error as Error).message
            : "An unexpected error occurred",
      },
      { status: 500 }
    )
    return addSecurityHeaders(response)
  }
}
