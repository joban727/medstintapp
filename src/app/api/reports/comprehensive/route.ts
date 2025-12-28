import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/database/db"
import { sql, eq, and, gte, lte, count, avg, sum, desc } from "drizzle-orm"
import {
  users,
  competencies,
  competencyAssignments,
  timeRecords,
  assessments,
  clinicalSites,
  rotations,
  programs
} from "@/database/schema"
import {
  createSuccessResponse,
  createErrorResponse,
  withErrorHandling,
  HTTP_STATUS,
} from "@/lib/api-response"

export const dynamic = "force-dynamic"

const generateReportData = async (params: URLSearchParams) => {
  const from = params.get("from")
  const to = params.get("to")
  const programId = params.get("program")
  const department = params.get("department")

  const fromDate = from ? new Date(from) : new Date(new Date().setMonth(new Date().getMonth() - 1))
  const toDate = to ? new Date(to) : new Date()

  // Base filters
  const dateFilter = and(
    gte(timeRecords.date, fromDate),
    lte(timeRecords.date, toDate)
  )

  // 1. Summary Statistics
  const [studentCount] = await db
    .select({ count: count() })
    .from(users)
    .where(eq(users.role, "STUDENT"))

  const [competencyCount] = await db
    .select({ count: count() })
    .from(competencies)

  const [assignmentStats] = await db
    .select({
      total: count(),
      completed: sql<number>`sum(case when ${competencyAssignments.status} = 'COMPLETED' then 1 else 0 end)`,
    })
    .from(competencyAssignments)

  const [hoursStats] = await db
    .select({ total: sum(timeRecords.totalHours) })
    .from(timeRecords)
    .where(dateFilter)

  const [scoreStats] = await db
    .select({ average: avg(assessments.score) })
    .from(assessments)

  const completionRate = assignmentStats?.total ? (Number(assignmentStats.completed) / Number(assignmentStats.total)) * 100 : 0

  // 2. Time Tracking Trends (Daily)
  const dailyHours = await db
    .select({
      date: timeRecords.date,
      hours: sum(timeRecords.totalHours),
    })
    .from(timeRecords)
    .where(dateFilter)
    .groupBy(timeRecords.date)
    .orderBy(timeRecords.date)

  // 3. Competency Progress by Category
  const competencyProgress = await db
    .select({
      category: competencies.category,
      count: count(competencyAssignments.id),
      completed: sql<number>`sum(case when ${competencyAssignments.status} = 'COMPLETED' then 1 else 0 end)`,
    })
    .from(competencyAssignments)
    .leftJoin(competencies, eq(competencyAssignments.competencyId, competencies.id))
    .groupBy(competencies.category)

  // 4. Clinical Site Utilization
  const siteUtilization = await db
    .select({
      name: clinicalSites.name,
      activeRotations: count(rotations.id),
    })
    .from(clinicalSites)
    .leftJoin(rotations, eq(clinicalSites.id, rotations.clinicalSiteId))
    .where(eq(rotations.status, "ACTIVE"))
    .groupBy(clinicalSites.id, clinicalSites.name)

  return {
    summary: {
      totalStudents: studentCount?.count || 0,
      totalCompetencies: competencyCount?.count || 0,
      totalAssignments: assignmentStats?.total || 0,
      completionRate: Math.round(completionRate * 100) / 100,
      averageScore: Number(scoreStats?.average || 0).toFixed(2),
      totalHours: Number(hoursStats?.total || 0).toFixed(2),
    },
    timeTracking: {
      dailyHours: dailyHours.map(d => ({ date: d.date.toISOString().split('T')[0], hours: Number(d.hours) })),
      weeklyTrends: [], // Placeholder for complex aggregation
      topActivities: [], // Placeholder
    },
    competencyProgress: {
      byCategory: competencyProgress.map(c => ({
        category: c.category || 'Uncategorized',
        total: c.count,
        completed: Number(c.completed),
        rate: c.count ? (Number(c.completed) / c.count) * 100 : 0
      })),
      byStudent: [],
      overallTrends: [],
    },
    studentPerformance: {
      topPerformers: [],
      needsAttention: [],
      averagesByProgram: [],
    },
    assessmentAnalytics: {
      completionRates: [],
      scoreDistribution: [],
      timeToCompletion: [],
    },
    clinicalSites: {
      utilizationRates: siteUtilization.map(s => ({ name: s.name, activeRotations: s.activeRotations })),
      performanceByLocation: [],
      capacityAnalysis: [],
    },
    recommendations: [],
  }
}

export const GET = withErrorHandling(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)

  // Validate required parameters
  const from = searchParams.get("from")
  const to = searchParams.get("to")

  if (!from || !to) {
    return createErrorResponse(
      "Date range (from and to) parameters are required",
      HTTP_STATUS.BAD_REQUEST
    )
  }

  // Generate report data based on parameters
  const reportData = await generateReportData(searchParams)

  return createSuccessResponse(reportData)
})

