import { auth } from "@clerk/nextjs/server"
import { and, eq, or } from "drizzle-orm"
import { nanoid } from "nanoid"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "../../../../database/db"
import { scheduledReports } from "../../../../database/schema"
import { cacheIntegrationService } from '@/lib/cache-integration'


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
      userRole !== "SCHOOL_ADMIN" && userId
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
    if (userRole !== "SCHOOL_ADMIN" && deleteCondition) {
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

export async function GET(_request: NextRequest) {
  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      'api:reports/scheduled/route.ts',
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
    console.warn('Cache error in reports/scheduled/route.ts:', cacheError)
    // Continue with original logic if cache fails
  }
  
  async function executeOriginalLogic() {

  try {
    const { userId, sessionClaims } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userRole = (sessionClaims?.metadata as UserMetadata)?.role

    if (!checkSchedulePermissions(userRole)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Fetch reports from database
    const userReports = await getScheduledReports(userId, userRole)

    return NextResponse.json({
      reports: userReports,
      total: userReports.length,
    })
  } catch (error) {
    console.error("Error fetching scheduled reports:", error)
    return NextResponse.json({ error: "Failed to fetch scheduled reports" }, { status: 500 })
  }

  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, sessionClaims } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userRole = (sessionClaims?.metadata as UserMetadata)?.role

    if (!checkSchedulePermissions(userRole)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
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
      return NextResponse.json({ error: "Failed to create scheduled report" }, { status: 500 })
    }

    return NextResponse.json(
      {
        message: "Scheduled report created successfully",
        report: newReport,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error creating scheduled report:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.issues }, { status: 400 })
    }

    
    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateReportCache()
    } catch (cacheError) {
      console.warn('Cache invalidation error in reports/scheduled/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Failed to create scheduled report" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId, sessionClaims } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userRole = (sessionClaims?.metadata as UserMetadata)?.role

    if (!checkSchedulePermissions(userRole)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const reportIds = searchParams.get("ids")?.split(",") || []

    if (reportIds.length === 0) {
      return NextResponse.json({ error: "No report IDs provided" }, { status: 400 })
    }

    // Delete reports from database (with permission check)
    const deletedCount = await deleteScheduledReports(reportIds, userId, userRole)

    return NextResponse.json({
      message: `${deletedCount} scheduled report(s) deleted successfully`,
      deletedCount,
    })
  } catch (error) {
    console.error("Error deleting scheduled reports:", error)
    
    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateReportCache()
    } catch (cacheError) {
      console.warn('Cache invalidation error in reports/scheduled/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Failed to delete scheduled reports" }, { status: 500 })
  }
}
