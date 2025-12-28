import { avg, count, eq } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/database/connection-pool"
import type { UserRole } from "@/types"

// Role validation utilities
const hasRole = (userRole: UserRole, allowedRoles: UserRole[]): boolean => {
  return allowedRoles.includes(userRole)
}

const isAdmin = (userRole: UserRole): boolean => {
  return hasRole(userRole, ["ADMIN" as UserRole, "SUPER_ADMIN" as UserRole])
}

const isSchoolAdmin = (userRole: UserRole): boolean => {
  return hasRole(userRole, [
    "SCHOOL_ADMIN" as UserRole,
    "ADMIN" as UserRole,
    "SUPER_ADMIN" as UserRole,
  ])
}
import {
  assessments,
  competencies,
  scheduledReports,
  users,
} from "../../../../../../database/schema"
import { getCurrentUser } from "../../../../../../lib/auth-clerk"
import { cacheIntegrationService } from "@/lib/cache-integration"

function checkRunPermissions(userRole: string): boolean {
  const allowedRoles = ["SCHOOL_ADMIN", "CLINICAL_SUPERVISOR"]
  return allowedRoles.includes(userRole)
}

function calculateNextRun(frequency: string): Date {
  const now = new Date()
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

async function generateReportData(type: string, _filters: Record<string, unknown>) {
  try {
    switch (type) {
      case "progress": {
        // Query student progress data from database
        const [totalStudentsResult] = await db
          .select({ count: count() })
          .from(users)
          .where(eq(users.role, "STUDENT"))
        const totalStudents = totalStudentsResult?.count || 0

        const [competenciesResult] = await db.select({ count: count() }).from(competencies)
        const totalCompetencies = competenciesResult?.count || 0

        const [assessmentsResult] = await db.select({ count: count() }).from(assessments)
        const totalAssessments = assessmentsResult?.count || 0

        return {
          totalStudents,
          averageProgress: 75, // Placeholder calculation
          completedCompetencies: totalCompetencies,
          pendingAssessments: Math.max(0, totalAssessments - 50),
          students: [], // Would need more complex query for student details
        }
      }
      case "competency_analytics": {
        // Query competency analytics from database
        const [competenciesResult] = await db.select({ count: count() }).from(competencies)
        const totalCompetencies = competenciesResult?.count || 0

        const [avgScoreResult] = await db
          .select({ avgScore: avg(assessments.score) })
          .from(assessments)
        const averageScore = Number(avgScoreResult?.avgScore) || 0

        return {
          totalCompetencies,
          averageScore,
          topPerformingAreas: ["Clinical Skills", "Communication"],
          improvementAreas: ["Critical Thinking", "Documentation"],
          trends: [],
        }
      }
      case "assessment_summary": {
        // Query assessment summary from database
        const [totalAssessmentsResult] = await db.select({ count: count() }).from(assessments)
        const totalAssessments = totalAssessmentsResult?.count || 0

        const [completedAssessmentsResult] = await db
          .select({ count: count() })
          .from(assessments)
          .where(eq(assessments.passed, true))
        const completedAssessments = completedAssessmentsResult?.count || 0

        const [avgScoreResult] = await db
          .select({ avgScore: avg(assessments.score) })
          .from(assessments)
        const averageScore = Number(avgScoreResult?.avgScore) || 0

        return {
          totalAssessments,
          completedAssessments,
          pendingAssessments: totalAssessments - completedAssessments,
          averageScore,
          assessmentsByType: [],
        }
      }
      default:
        return {}
    }
  } catch (error) {
    console.error("Error generating report data:", error)
    return {}
  }
}

async function sendReportEmail(
  recipients: string[],
  reportData: Record<string, unknown>,
  format: string,
  reportType = "Scheduled Report",
  schoolName?: string
) {
  try {
    const { sendReportEmail: sendEmail } = await import("@/lib/email-service")

    const success = await sendEmail({
      recipients,
      reportData,
      format: format as "pdf" | "excel" | "csv",
      reportType,
      schoolName,
    })

    if (success) {
      console.log(`Successfully sent ${format} report to:`, recipients)
    } else {
      console.error(`Failed to send ${format} report to:`, recipients)
    }

    return success
  } catch (error) {
    console.error("Error sending report email:", error)
    return false
  }
}

// Database functions for scheduled reports
async function getScheduledReport(id: string) {
  try {
    const [report] = await db.select().from(scheduledReports).where(eq(scheduledReports.id, id))

    if (!report) {
      return null
    }

    return {
      ...report,
      recipients: JSON.parse(report.recipients),
      filters: report.filters ? JSON.parse(report.filters) : {},
    }
  } catch (error) {
    console.error("Error fetching scheduled report:", error)
    return null
  }
}

async function updateScheduledReport(id: string, updates: Record<string, unknown>) {
  try {
    const updateData: Record<string, unknown> = { ...updates }

    // Convert date strings to Date objects if needed
    if (updateData.lastRun && typeof updateData.lastRun === "string") {
      updateData.lastRun = new Date(updateData.lastRun)
    }
    if (updateData.nextRun && typeof updateData.nextRun === "string") {
      updateData.nextRun = new Date(updateData.nextRun)
    }

    updateData.updatedAt = new Date()

    const [updated] = await db
      .update(scheduledReports)
      .set(updateData)
      .where(eq(scheduledReports.id, id))
      .returning()

    return updated
  } catch (error) {
    console.error("Error updating scheduled report:", error)
    return null
  }
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    const { id } = await params

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!checkRunPermissions(user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const report = await getScheduledReport(id)

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }

    // Check if user can run this report
    if (
      user.role !== ("SCHOOL_ADMIN" as UserRole as UserRole as UserRole) &&
      report.createdBy !== user.id
    ) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    if (!report.isActive) {
      return NextResponse.json({ error: "Report is not active" }, { status: 400 })
    }

    // Generate the report
    const reportData = await generateReportData(report.type, report.filters)

    // Send the report via email
    const emailSent = await sendReportEmail(
      report.recipients,
      reportData,
      report.format,
      report.name || "Scheduled Report",
      user.schoolId ? `School ${user.schoolId}` : undefined
    )

    if (!emailSent) {
      return NextResponse.json({ error: "Failed to send report email" }, { status: 500 })
    }

    // Update the report's last run time and next run time
    const now = new Date()
    const nextRun = calculateNextRun(report.frequency)

    await updateScheduledReport(id, {
      lastRun: now.toISOString(),
      nextRun: nextRun.toISOString(),
      runCount: (report.runCount || 0) + 1,
    })

    return NextResponse.json({
      message: "Report executed successfully",
      executedAt: now.toISOString(),
      nextRun: nextRun.toISOString(),
      recipients: report.recipients,
    })
  } catch (error) {
    console.error("Error running scheduled report:", error)

    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateByTags(["reports"])
    } catch (cacheError) {
      console.warn("Cache invalidation error in reports/scheduled/[id]/run/route.ts:", cacheError)
    }

    return NextResponse.json({ error: "Failed to run scheduled report" }, { status: 500 })
  }
}
