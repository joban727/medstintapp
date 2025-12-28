import { auth } from "@clerk/nextjs/server"
import { and, eq, or } from "drizzle-orm"
import { nanoid } from "nanoid"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/database/connection-pool"
import type { UserRole } from "@/types"
import { scheduledReports } from "../../../../database/schema"
import { cacheIntegrationService } from "@/lib/cache-integration"
import {
  createSuccessResponse,
  createErrorResponse,
  createValidationErrorResponse,
  withErrorHandling,
  HTTP_STATUS,
  ERROR_MESSAGES,
} from "@/lib/api-response"
import { generalApiLimiter } from "@/lib/rate-limiter"

interface ScheduledReportData {
  name: string
  type: "progress" | "competency_analytics" | "assessment_summary"
  frequency: "daily" | "weekly" | "monthly" | "quarterly"
  recipients: string[]
  format: "pdf" | "excel"
  isActive: boolean
  filters?: Record<string, unknown>
  nextRun: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

interface UserMetadata {
  role: string
}

const scheduledReportSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["progress", "competency_analytics", "assessment_summary"]),
  frequency: z.enum(["daily", "weekly", "monthly", "quarterly"]),
  recipients: z.array(z.string().email()),
  format: z.enum(["pdf", "excel"]),
  isActive: z.boolean().default(true),
  filters: z.object({}).optional(),
})

function checkSchedulePermissions(userRole: string): boolean {
  const allowedRoles = ["SCHOOL_ADMIN", "CLINICAL_SUPERVISOR"]
  return allowedRoles.includes(userRole)
}

function calculateNextRun(frequency: string, lastRun?: Date): Date {
  const now = lastRun || new Date()
  const nextRun = new Date(now)

  switch (frequency) {
    case "daily":
      nextRun.setDate(nextRun.getDate() + 1)
      break
    case "weekly":
      nextRun.setDate(nextRun.getDate() + 7)
      break
    case "monthly":
      nextRun.setMonth(nextRun.getMonth() + 1)
      break
    case "quarterly":
      nextRun.setMonth(nextRun.getMonth() + 3)
      break
    default:
      nextRun.setDate(nextRun.getDate() + 7) // Default to weekly
  }

  return nextRun
}

// Database functions for scheduled reports
async function getScheduledReports(userId?: string, userRole?: string) {
  try {
    // If not school admin, only show reports created by the user
    const reports =
      userRole !== ("SCHOOL_ADMIN" as UserRole) && userId
        ? await db.select().from(scheduledReports).where(eq(scheduledReports.createdBy, userId))
        : await db.select().from(scheduledReports)
    return reports.map((report) => ({
      ...report,
      recipients: JSON.parse(report.recipients),
      filters: report.filters ? JSON.parse(report.filters) : undefined,
    }))
  } catch (error) {
    console.error("Error fetching scheduled reports:", error)
    return []
  }
}

async function createScheduledReport(
  reportData: ScheduledReportData
): Promise<ScheduledReportData | null> {
  try {
    const newReport = {
      id: nanoid(),
      name: reportData.name,
      type: reportData.type,
      frequency: reportData.frequency,
      recipients: JSON.stringify(reportData.recipients),
      format: reportData.format,
      isActive: reportData.isActive,
      filters: reportData.filters ? JSON.stringify(reportData.filters) : null,
      schoolId: "default-school", // TODO: Get from user context
      createdBy: reportData.createdBy,
      runCount: 0,
      lastRun: null,
      nextRun: new Date(reportData.nextRun),
      createdAt: new Date(reportData.createdAt),
      updatedAt: new Date(reportData.updatedAt),
    }

    const [inserted] = await db.insert(scheduledReports).values(newReport).returning()

    return {
      ...inserted,
      recipients: JSON.parse(inserted.recipients),
      filters: inserted.filters ? JSON.parse(inserted.filters) : undefined,
      nextRun: inserted.nextRun.toISOString(),
      createdAt: inserted.createdAt.toISOString(),
      updatedAt: inserted.updatedAt.toISOString(),
    }
  } catch (error) {
    console.error("Error creating scheduled report:", error)
    return null
  }
}

async function deleteScheduledReports(reportIds: string[], userId: string, userRole: string) {
  try {
    // Build condition for multiple IDs
    const idConditions = reportIds.map((id) => eq(scheduledReports.id, id))
    let deleteCondition = idConditions.length === 1 ? idConditions[0] : or(...idConditions)

    // If not school admin, only allow deleting own reports
    if (userRole !== ("SCHOOL_ADMIN" as UserRole) && deleteCondition) {
      deleteCondition = and(deleteCondition, eq(scheduledReports.createdBy, userId))
    }

    if (!deleteCondition) {
      return 0
    }

    const deleted = await db.delete(scheduledReports).where(deleteCondition).returning()
    return deleted.length
  } catch (error) {
    console.error("Error deleting scheduled reports:", error)
    return 0
  }
}

export const GET = withErrorHandling(async (_request: NextRequest) => {
  // Check rate limiting first
  try {
    const rateLimitResult = await generalApiLimiter.checkLimit(_request)
    if (!rateLimitResult.allowed) {
      const retryAfter = Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
      return createErrorResponse("Too Many Requests", HTTP_STATUS.TOO_MANY_REQUESTS, {
        details: "Rate limit exceeded. Please try again later.",
        retryAfter: retryAfter,
      })
    }
  } catch (rateLimitError) {
    console.warn("Rate limiter error in reports/scheduled/route.ts:", rateLimitError)
    // Continue with request if rate limiter fails
  }

  // Try to get cached response
  try {
    const cached = await cacheIntegrationService.cachedApiResponse(
      "api:reports/scheduled/route.ts",
      async () => {
        return await executeOriginalLogic()
      },
      300 // 5 minutes TTL
    )

    if (cached) {
      return cached
    }
  } catch (cacheError) {
    console.warn("Cache error in reports/scheduled/route.ts:", cacheError)
    // Continue with original logic if cache fails
  }

  async function executeOriginalLogic() {
    const { userId, sessionClaims } = await auth()

    if (!userId) {
      return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
    }

    const userRole = (sessionClaims?.metadata as UserMetadata)?.role

    if (!checkSchedulePermissions(userRole)) {
      return createErrorResponse("Insufficient permissions", HTTP_STATUS.FORBIDDEN)
    }

    // Fetch reports from database
    const userReports = await getScheduledReports(userId, userRole)

    return createSuccessResponse({
      reports: userReports,
      total: userReports.length,
    })
  }

  return await executeOriginalLogic()
})

export const POST = withErrorHandling(async (request: NextRequest) => {
  // Check rate limiting first
  try {
    const rateLimitResult = await generalApiLimiter.checkLimit(request)
    if (!rateLimitResult.allowed) {
      const retryAfter = Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
      return createErrorResponse("Too Many Requests", HTTP_STATUS.TOO_MANY_REQUESTS, {
        details: "Rate limit exceeded. Please try again later.",
        retryAfter: retryAfter,
      })
    }
  } catch (rateLimitError) {
    console.warn("Rate limiter error in reports/scheduled/route.ts POST:", rateLimitError)
    // Continue with request if rate limiter fails
  }

  const { userId, sessionClaims } = await auth()

  if (!userId) {
    return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
  }

  const userRole = (sessionClaims?.metadata as UserMetadata)?.role

  if (!checkSchedulePermissions(userRole)) {
    return createErrorResponse("Insufficient permissions", HTTP_STATUS.FORBIDDEN)
  }

  const body = await request.json()

  try {
    const validatedData = scheduledReportSchema.parse(body)

    const reportData = {
      ...validatedData,
      nextRun: calculateNextRun(validatedData.frequency).toISOString(),
      createdBy: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const newReport = await createScheduledReport(reportData)

    if (!newReport) {
      return createErrorResponse(
        "Failed to create scheduled report",
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }

    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateByTags(["reports"])
    } catch (cacheError) {
      console.warn("Cache invalidation error in reports/scheduled/route.ts:", cacheError)
    }

    return createSuccessResponse(
      {
        message: "Scheduled report created successfully",
        report: newReport,
      },
      undefined,
      HTTP_STATUS.CREATED
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createValidationErrorResponse("Validation failed", error.issues.map((e) => ({ field: e.path.join("."), code: e.code, details: e.message })))
    }
    throw error
  }
})

export const DELETE = withErrorHandling(async (request: NextRequest) => {
  // Check rate limiting first
  try {
    const rateLimitResult = await generalApiLimiter.checkLimit(request)
    if (!rateLimitResult.allowed) {
      const retryAfter = Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
      return createErrorResponse("Too Many Requests", HTTP_STATUS.TOO_MANY_REQUESTS, {
        details: "Rate limit exceeded. Please try again later.",
        retryAfter: retryAfter,
      })
    }
  } catch (rateLimitError) {
    console.warn("Rate limiter error in reports/scheduled/route.ts DELETE:", rateLimitError)
    // Continue with request if rate limiter fails
  }

  const { userId, sessionClaims } = await auth()

  if (!userId) {
    return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
  }

  const userRole = (sessionClaims?.metadata as UserMetadata)?.role

  if (!checkSchedulePermissions(userRole)) {
    return createErrorResponse("Insufficient permissions", HTTP_STATUS.FORBIDDEN)
  }

  const { searchParams } = new URL(request.url)
  const reportIds = searchParams.get("ids")?.split(",") || []

  if (reportIds.length === 0) {
    return createErrorResponse("No report IDs provided", HTTP_STATUS.BAD_REQUEST)
  }

  // Delete reports from database (with permission check)
  const deletedCount = await deleteScheduledReports(reportIds, userId, userRole)

  // Invalidate related caches
  try {
    await cacheIntegrationService.invalidateByTags(["reports"])
  } catch (cacheError) {
    console.warn("Cache invalidation error in reports/scheduled/route.ts:", cacheError)
  }

  return createSuccessResponse({
    message: `${deletedCount} scheduled report(s) deleted successfully`,
    deletedCount,
  })
})

