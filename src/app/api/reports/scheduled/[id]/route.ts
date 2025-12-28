import { auth } from "@clerk/nextjs/server"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { cacheIntegrationService } from "@/lib/cache-integration"

import type { UserRole } from "@/types"
interface SessionMetadata {
  role?: string
  schoolId?: string
}

interface ScheduledReport {
  id: string
  name: string
  type: "progress" | "competency_analytics" | "assessment_summary"
  frequency: "daily" | "weekly" | "monthly" | "quarterly"
  recipients: string[]
  format: "pdf" | "excel"
  isActive: boolean
  nextRun: string
  lastRun: string
  filters: Record<string, unknown>
  createdBy: string
  createdAt: string
  updatedAt?: string
}

const updateScheduledReportSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(["progress", "competency_analytics", "assessment_summary"]).optional(),
  frequency: z.enum(["daily", "weekly", "monthly", "quarterly"]).optional(),
  recipients: z.array(z.string().email()).optional(),
  format: z.enum(["pdf", "excel"]).optional(),
  isActive: z.boolean().optional(),
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
      nextRun.setDate(nextRun.getDate() + 7)
  }

  return nextRun
}

// Mock database - in a real app, this would be stored in your database
// TODO: Replace with actual database implementation
const scheduledReports: ScheduledReport[] = [
  // Empty array - no mock data to prevent displaying fake information
]

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      "api:reports/scheduled/[id]/route.ts",
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
    console.warn("Cache error in reports/scheduled/[id]/route.ts:", cacheError)
    // Continue with original logic if cache fails
  }

  async function executeOriginalLogic() {
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
      const report = scheduledReports.find((r) => r.id === id)

      if (!report) {
        return NextResponse.json({ error: "Report not found" }, { status: 404 })
      }

      // Check if user can access this report
      if (userRole !== ("SCHOOL_ADMIN" as UserRole) && report.createdBy !== userId) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 })
      }

      return NextResponse.json({ report })
    } catch (error) {
      console.error("Error fetching scheduled report:", error)
      return NextResponse.json({ error: "Failed to fetch scheduled report" }, { status: 500 })
    }
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const reportIndex = scheduledReports.findIndex((r) => r.id === id)

    if (reportIndex === -1) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }

    const existingReport = scheduledReports[reportIndex]

    // Check if user can modify this report
    if (userRole !== ("SCHOOL_ADMIN" as UserRole) && existingReport.createdBy !== userId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = updateScheduledReportSchema.parse(body)

    // Update the report
    const updatedReport = {
      ...existingReport,
      ...validatedData,
      updatedAt: new Date().toISOString(),
    }

    // Recalculate next run if frequency changed
    if (validatedData.frequency && validatedData.frequency !== existingReport.frequency) {
      updatedReport.nextRun = calculateNextRun(validatedData.frequency).toISOString()
    }

    scheduledReports[reportIndex] = updatedReport

    return NextResponse.json({
      message: "Scheduled report updated successfully",
      report: updatedReport,
    })
  } catch (error) {
    console.error("Error updating scheduled report:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.issues }, { status: 400 })
    }

    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateByTags(["reports"])
    } catch (cacheError) {
      console.warn("Cache invalidation error in reports/scheduled/[id]/route.ts:", cacheError)
    }

    return NextResponse.json({ error: "Failed to update scheduled report" }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const reportIndex = scheduledReports.findIndex((r) => r.id === id)

    if (reportIndex === -1) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }

    const existingReport = scheduledReports[reportIndex]

    // Check if user can delete this report
    if (userRole !== ("SCHOOL_ADMIN" as UserRole) && existingReport.createdBy !== userId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Remove the report
    scheduledReports.splice(reportIndex, 1)

    return NextResponse.json({
      message: "Scheduled report deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting scheduled report:", error)

    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateByTags(["reports"])
    } catch (cacheError) {
      console.warn("Cache invalidation error in reports/scheduled/[id]/route.ts:", cacheError)
    }

    return NextResponse.json({ error: "Failed to delete scheduled report" }, { status: 500 })
  }
}
