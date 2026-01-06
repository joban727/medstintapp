import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { cacheIntegrationService } from "@/lib/cache-integration"
import { withCSRF } from "@/lib/csrf-middleware"
import { z } from "zod"
import { db } from "@/database/connection-pool"
import { scheduledReports } from "@/database/schema"
import { eq } from "drizzle-orm"
import { generalApiLimiter } from "@/lib/rate-limiter"

import type { UserRole } from "@/types"

interface SessionMetadata {
  role?: string
  schoolId?: string
}

const updateScheduledReportSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(["progress", "competency_analytics", "assessment_summary"]).optional(),
  frequency: z.enum(["daily", "weekly", "monthly", "quarterly"]).optional(),
  recipients: z.array(z.string().email()).optional(),
  format: z.enum(["pdf", "excel"]).optional(),
  isActive: z.boolean().optional(),
  filters: z.object({}).passthrough().optional(),
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
      nextRun.setDate(nextRun.getDate() + 7)
  }

  return nextRun
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Rate limiting check
  const limitResult = await generalApiLimiter.checkLimit(request)
  if (!limitResult.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  try {
    const { id } = await params

    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      `api:reports/scheduled/${id}`,
      async () => {
        return await executeOriginalLogic(id)
      },
      300 // 5 minutes TTL
    )

    if (cached) {
      return cached
    }

    // Fallback if cache returns null (shouldn't happen with cachedApiResponse but for safety)
    return await executeOriginalLogic(id)
  } catch (cacheError) {
    console.warn("Cache error in reports/scheduled/[id]/route.ts:", cacheError)
    // Continue with original logic if cache fails
    const { id } = await params
    return await executeOriginalLogic(id)
  }
}

async function executeOriginalLogic(id: string) {
  try {
    const { userId, sessionClaims } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userRole = (sessionClaims?.metadata as SessionMetadata)?.role as string

    if (!checkSchedulePermissions(userRole)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const reportData = await db
      .select()
      .from(scheduledReports)
      .where(eq(scheduledReports.id, id))
      .limit(1)

    if (!reportData.length) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }

    const report = reportData[0]

    // Check if user can access this report
    if (userRole !== ("SCHOOL_ADMIN" as UserRole) && report.createdBy !== userId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Parse JSON fields
    const formattedReport = {
      ...report,
      recipients: JSON.parse(report.recipients),
      filters: report.filters ? JSON.parse(report.filters) : {},
    }

    return NextResponse.json({ report: formattedReport })
  } catch (error) {
    console.error("Error fetching scheduled report:", error)
    return NextResponse.json({ error: "Failed to fetch scheduled report" }, { status: 500 })
  }
}

export const PUT = withCSRF(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    // Rate limiting check
    const limitResult = await generalApiLimiter.checkLimit(request)
    if (!limitResult.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    try {
      const { userId, sessionClaims } = await auth()

      if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      const userRole = (sessionClaims?.metadata as SessionMetadata)?.role as string

      if (!checkSchedulePermissions(userRole)) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
      }

      const { id } = await params

      const reportData = await db
        .select()
        .from(scheduledReports)
        .where(eq(scheduledReports.id, id))
        .limit(1)

      if (!reportData.length) {
        return NextResponse.json({ error: "Report not found" }, { status: 404 })
      }

      const existingReport = reportData[0]

      // Check if user can modify this report
      if (userRole !== ("SCHOOL_ADMIN" as UserRole) && existingReport.createdBy !== userId) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 })
      }

      const body = await request.json()
      const validatedData = updateScheduledReportSchema.parse(body)

      // Prepare update data
      const updateData: Partial<typeof scheduledReports.$inferInsert> = {
        updatedAt: new Date(),
      }

      if (validatedData.name) updateData.name = validatedData.name
      if (validatedData.type) updateData.type = validatedData.type
      if (validatedData.frequency) updateData.frequency = validatedData.frequency
      if (validatedData.recipients) updateData.recipients = JSON.stringify(validatedData.recipients)
      if (validatedData.format) updateData.format = validatedData.format
      if (validatedData.isActive !== undefined) updateData.isActive = validatedData.isActive
      if (validatedData.filters) updateData.filters = JSON.stringify(validatedData.filters)

      // Recalculate next run if frequency changed
      if (validatedData.frequency && validatedData.frequency !== existingReport.frequency) {
        updateData.nextRun = calculateNextRun(validatedData.frequency)
      }

      // Update the report
      const updatedReports = await db
        .update(scheduledReports)
        .set(updateData)
        .where(eq(scheduledReports.id, id))
        .returning()

      const updatedReport = updatedReports[0]

      // Invalidate related caches
      try {
        await cacheIntegrationService.invalidateByTags(["reports"])
        await cacheIntegrationService.delete(`api:reports/scheduled/${id}`)
      } catch (cacheError) {
        console.warn("Cache invalidation error in reports/scheduled/[id]/route.ts:", cacheError)
      }

      // Parse JSON fields for response
      const formattedReport = {
        ...updatedReport,
        recipients: JSON.parse(updatedReport.recipients),
        filters: updatedReport.filters ? JSON.parse(updatedReport.filters) : {},
      }

      return NextResponse.json({
        message: "Scheduled report updated successfully",
        report: formattedReport,
      })
    } catch (error) {
      console.error("Error updating scheduled report:", error)

      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: "Invalid data", details: error.issues }, { status: 400 })
      }

      return NextResponse.json({ error: "Failed to update scheduled report" }, { status: 500 })
    }
  }
)

export const DELETE = withCSRF(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    // Rate limiting check
    const limitResult = await generalApiLimiter.checkLimit(request)
    if (!limitResult.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    try {
      const { userId, sessionClaims } = await auth()

      if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      const userRole = (sessionClaims?.metadata as SessionMetadata)?.role as string

      if (!checkSchedulePermissions(userRole)) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
      }

      const { id } = await params

      const reportData = await db
        .select()
        .from(scheduledReports)
        .where(eq(scheduledReports.id, id))
        .limit(1)

      if (!reportData.length) {
        return NextResponse.json({ error: "Report not found" }, { status: 404 })
      }

      const existingReport = reportData[0]

      // Check if user can delete this report
      if (userRole !== ("SCHOOL_ADMIN" as UserRole) && existingReport.createdBy !== userId) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 })
      }

      // Remove the report
      await db.delete(scheduledReports).where(eq(scheduledReports.id, id))

      // Invalidate related caches
      try {
        await cacheIntegrationService.invalidateByTags(["reports"])
        await cacheIntegrationService.delete(`api:reports/scheduled/${id}`)
      } catch (cacheError) {
        console.warn("Cache invalidation error in reports/scheduled/[id]/route.ts:", cacheError)
      }

      return NextResponse.json({
        message: "Scheduled report deleted successfully",
      })
    } catch (error) {
      console.error("Error deleting scheduled report:", error)

      return NextResponse.json({ error: "Failed to delete scheduled report" }, { status: 500 })
    }
  }
)
