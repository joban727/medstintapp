import type { UserRole } from "@/types"
import { currentUser } from "@clerk/nextjs/server"
import { and, desc, eq, gte, inArray, lte } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "../../../database/connection-pool"

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
  competencyAssignments,
  competencyTemplates,
  learningAnalytics,
  progressSnapshots,
  reportCache,
  users,
} from "../../../database/schema"
import {
  createSuccessResponse,
  createErrorResponse,
  withErrorHandlingAsync,
  HTTP_STATUS,
  ERROR_MESSAGES,
} from "../../../lib/api-response"

// Validation schemas
const reportQuerySchema = z.object({
  type: z.enum(["progress", "competency_analytics", "assessment_summary", "student_overview"]),
  format: z.enum(["json", "pdf", "excel"]).optional().default("json"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  studentIds: z.array(z.string()).optional(),
  competencyIds: z.array(z.string()).optional(),
  rotationIds: z.array(z.string()).optional(),
  includeDetails: z.boolean().optional().default(false),
  groupBy: z.enum(["student", "competency", "rotation", "date"]).optional(),
})

const scheduleReportSchema = z.object({
  type: z.enum(["progress", "competency_analytics", "assessment_summary"]),
  schedule: z.enum(["daily", "weekly", "monthly"]),
  recipients: z.array(z.string().email()),
  filters: reportQuerySchema.omit({ format: true }).optional(),
})

// Permission check helper
async function checkReportPermissions(
  user: { id: string; role: string; schoolId?: string },
  requestedStudentIds?: string[]
) {
  const userRole = user.role as string
  const userId = user.id

  switch (userRole) {
    case "SCHOOL_ADMIN":
      return { authorized: true, allowedStudentIds: requestedStudentIds }

    case "CLINICAL_SUPERVISOR": {
      // Get students assigned to this supervisor
      const supervisedStudents = await db
        .select({ userId: competencyAssignments.userId })
        .from(competencyAssignments)
        .where(eq(competencyAssignments.assignedBy, userId))

      const allowedIds = supervisedStudents.map((s) => s.userId)

      if (requestedStudentIds) {
        const filteredIds = requestedStudentIds.filter((id) => allowedIds.includes(id))
        return { authorized: filteredIds.length > 0, allowedStudentIds: filteredIds }
      }

      return { authorized: allowedIds.length > 0, allowedStudentIds: allowedIds }
    }

    case "STUDENT": {
      // Students can only view their own reports
      const studentIds = requestedStudentIds?.includes(userId) ? [userId] : []
      return { authorized: studentIds.length > 0, allowedStudentIds: studentIds }
    }

    default:
      return { authorized: false, allowedStudentIds: [] }
  }
}

// Report generation functions
async function generateProgressReport(
  filters: Record<string, unknown>,
  allowedStudentIds: string[]
) {
  const conditions = []

  if (allowedStudentIds.length > 0) {
    conditions.push(inArray(progressSnapshots.userId, allowedStudentIds))
  }

  if (filters.startDate) {
    conditions.push(gte(progressSnapshots.createdAt, new Date(filters.startDate as string)))
  }

  if (filters.endDate) {
    conditions.push(lte(progressSnapshots.createdAt, new Date(filters.endDate as string)))
  }

  if ((filters.competencyIds as string[])?.length > 0) {
    conditions.push(inArray(progressSnapshots.competencyId, filters.competencyIds as string[]))
  }

  const progressData = await db
    .select({
      id: progressSnapshots.id,
      studentId: progressSnapshots.userId,
      studentName: users.name,
      competencyId: progressSnapshots.competencyId,
      competencyTitle: competencies.name,
      progressPercentage: progressSnapshots.progressPercentage,
      status: progressSnapshots.status,
      snapshotDate: progressSnapshots.snapshotDate,
      createdAt: progressSnapshots.createdAt,
    })
    .from(progressSnapshots)
    .leftJoin(users, eq(progressSnapshots.userId, users.id))
    .leftJoin(competencies, eq(progressSnapshots.competencyId, competencies.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(progressSnapshots.createdAt))

  return {
    type: "progress_report",
    generatedAt: new Date().toISOString(),
    totalRecords: progressData.length,
    data: progressData,
    summary: {
      averageCompletion:
        progressData.reduce(
          (acc, item) => acc + Number.parseFloat(item.progressPercentage || "0"),
          0
        ) / progressData.length || 0,
      studentsCount: new Set(progressData.map((item) => item.studentId)).size,
      competenciesCount: new Set(progressData.map((item) => item.competencyId)).size,
    },
  }
}

async function generateCompetencyAnalyticsReport(
  filters: Record<string, unknown>,
  allowedStudentIds: string[]
) {
  const conditions = []

  if (allowedStudentIds.length > 0) {
    conditions.push(inArray(learningAnalytics.userId, allowedStudentIds))
  }

  if (filters.startDate) {
    conditions.push(gte(learningAnalytics.createdAt, new Date(filters.startDate as string)))
  }

  if (filters.endDate) {
    conditions.push(lte(learningAnalytics.createdAt, new Date(filters.endDate as string)))
  }

  const analyticsData = await db
    .select({
      id: learningAnalytics.id,
      studentId: learningAnalytics.userId,
      studentName: users.name,
      metricType: learningAnalytics.metricType,
      metricValue: learningAnalytics.metricValue,
      timePeriod: learningAnalytics.timePeriod,
      metadata: learningAnalytics.metadata,
      createdAt: learningAnalytics.createdAt,
    })
    .from(learningAnalytics)
    .leftJoin(users, eq(learningAnalytics.userId, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(learningAnalytics.createdAt))

  return {
    type: "competency_analytics_report",
    generatedAt: new Date().toISOString(),
    totalRecords: analyticsData.length,
    data: analyticsData,
    summary: {
      studentsCount: new Set(analyticsData.map((item) => item.studentId)).size,
      metricTypes: [...new Set(analyticsData.map((item) => item.metricType))],
    },
  }
}

async function generateAssessmentSummaryReport(
  filters: Record<string, unknown>,
  allowedStudentIds: string[]
) {
  const conditions = []

  if (allowedStudentIds.length > 0) {
    conditions.push(inArray(assessments.studentId, allowedStudentIds))
  }

  if (filters.startDate) {
    conditions.push(gte(assessments.date, new Date(filters.startDate as string)))
  }

  if (filters.endDate) {
    conditions.push(lte(assessments.date, new Date(filters.endDate as string)))
  }

  if ((filters.competencyIds as string[])?.length > 0) {
    conditions.push(inArray(assessments.competencyId, filters.competencyIds as string[]))
  }

  const assessmentData = await db
    .select({
      id: assessments.id,
      studentId: assessments.studentId,
      studentName: users.name,
      competencyId: assessments.competencyId,
      competencyTitle: competencyTemplates.name,
      rotationId: assessments.rotationId,
      score: assessments.score,
      maxScore: assessments.maxScore,
      passed: assessments.passed,
      type: assessments.type,
      date: assessments.date,
      feedback: assessments.feedback,
    })
    .from(assessments)
    .leftJoin(users, eq(assessments.studentId, users.id))
    .leftJoin(competencies, eq(assessments.competencyId, competencies.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(assessments.date))

  return {
    type: "assessment_summary_report",
    generatedAt: new Date().toISOString(),
    totalRecords: assessmentData.length,
    data: assessmentData,
    summary: {
      averageScore:
        assessmentData.reduce(
          (acc, item) => acc + ((Number(item.score) || 0) / (Number(item.maxScore) || 1)) * 100,
          0
        ) / assessmentData.length || 0,
      passedAssessments: assessmentData.filter((item) => item.passed === true).length,
      failedAssessments: assessmentData.filter((item) => item.passed === false).length,
      studentsCount: new Set(assessmentData.map((item) => item.studentId)).size,
    },
  }
}

// GET - Generate and retrieve reports
export async function GET(request: NextRequest) {
  return withErrorHandlingAsync(async () => {
    const user = await currentUser()
    if (!user) {
      return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
    }

    const { searchParams } = new URL(request.url)
    const queryParams: Record<string, string | string[]> = Object.fromEntries(
      searchParams.entries()
    )

    // Parse array parameters
    if (queryParams.studentIds) {
      queryParams.studentIds = (queryParams.studentIds as string).split(",")
    }
    if (queryParams.competencyIds) {
      queryParams.competencyIds = (queryParams.competencyIds as string).split(",")
    }
    if (queryParams.rotationIds) {
      queryParams.rotationIds = (queryParams.rotationIds as string).split(",")
    }

    const validatedQuery = reportQuerySchema.parse(queryParams)

    // Check permissions
    const userWithRole = {
      id: user.id,
      role: (user.publicMetadata?.role as string) || "STUDENT",
      schoolId: user.publicMetadata?.schoolId as string,
    }
    const { authorized, allowedStudentIds } = await checkReportPermissions(
      userWithRole,
      validatedQuery.studentIds
    )

    if (!authorized) {
      return createErrorResponse(ERROR_MESSAGES.ACCESS_DENIED, HTTP_STATUS.FORBIDDEN)
    }

    // Check cache first
    const cacheKey = JSON.stringify({ ...validatedQuery, allowedStudentIds })
    const cached = await db
      .select()
      .from(reportCache)
      .where(and(eq(reportCache.cacheKey, cacheKey), gte(reportCache.expiresAt, new Date())))
      .limit(1)

    if (cached.length > 0) {
      return createSuccessResponse(JSON.parse(cached[0].data))
    }

    // Generate report based on type
    let reportData: {
      type: string
      generatedAt: string
      totalRecords: number
      data: unknown[]
      summary: Record<string, unknown>
    }
    switch (validatedQuery.type) {
      case "progress":
        reportData = await generateProgressReport(validatedQuery, allowedStudentIds || [])
        break
      case "competency_analytics":
        reportData = await generateCompetencyAnalyticsReport(
          validatedQuery,
          allowedStudentIds || []
        )
        break
      case "assessment_summary":
        reportData = await generateAssessmentSummaryReport(validatedQuery, allowedStudentIds || [])
        break
      default:
        return createErrorResponse("Invalid report type", HTTP_STATUS.BAD_REQUEST)
    }

    // Cache the result
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
    await db.insert(reportCache).values({
      id: `cache_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      reportType: validatedQuery.type,
      cacheKey,
      data: JSON.stringify(reportData),
      expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    return createSuccessResponse(reportData)
  })
}

// POST - Schedule report generation
export async function POST(request: NextRequest) {
  return withErrorHandlingAsync(async () => {
    const user = await currentUser()
    if (!user) {
      return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
    }

    const userRole = user.publicMetadata?.role as string
    if (
      userRole !== ("SCHOOL_ADMIN" as UserRole) &&
      userRole !== ("CLINICAL_SUPERVISOR" as UserRole)
    ) {
      return createErrorResponse(ERROR_MESSAGES.ACCESS_DENIED, HTTP_STATUS.FORBIDDEN)
    }

    const body = await request.json()
    const validatedData = scheduleReportSchema.parse(body)

    // In a real implementation, this would integrate with a job scheduler
    // For now, we'll just return a success response
    const scheduleId = `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    return createSuccessResponse({
      scheduleId,
      message: "Report scheduled successfully",
      schedule: validatedData,
    })
  })
}

// DELETE - Clear report cache
export async function DELETE(_request: NextRequest) {
  return withErrorHandlingAsync(async () => {
    const user = await currentUser()
    if (!user) {
      return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
    }

    const userRole = user.publicMetadata?.role as string
    if (userRole !== ("SCHOOL_ADMIN" as UserRole)) {
      return createErrorResponse(ERROR_MESSAGES.ACCESS_DENIED, HTTP_STATUS.FORBIDDEN)
    }

    // Clear expired cache entries
    const _deleted = await db.delete(reportCache).where(lte(reportCache.expiresAt, new Date()))

    return createSuccessResponse({
      message: "Cache cleared successfully",
    })
  })
}

