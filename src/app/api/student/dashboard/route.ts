import { auth } from "@clerk/nextjs/server"
import { and, desc, eq, gte, isNotNull, isNull, lte, sql, or } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/database/connection-pool"
import {
  users,
  timeRecords,
  rotations,
  clinicalSites,
  siteAssignments,
  programs,
  schools,
} from "@/database/schema"
import { withCache, CACHE_PREFIXES, CACHE_CONFIG } from "@/lib/neon-cache"
import {
  createSuccessResponse,
  createErrorResponse,
  withErrorHandling,
  withErrorHandlingAsync,
  HTTP_STATUS,
  ERROR_MESSAGES,
} from "@/lib/api-response"
import { apiAuthMiddleware } from "@/lib/rbac-middleware"

export async function GET(request: NextRequest) {
  return withErrorHandlingAsync(async () => {
    const authResult = await apiAuthMiddleware(request)

    if (!authResult.success) {
      return createErrorResponse(
        authResult.error || "Unauthorized",
        authResult.status || HTTP_STATUS.UNAUTHORIZED
      )
    }

    const { user } = authResult
    if (!user) {
      return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
    }

    const userId = user.id

    const debug = request.nextUrl.searchParams.get("debug") === "1"
    const routeStart = Date.now()

    // Use short TTL caching for student dashboard to reduce load and speed up responses
    const cacheKey = `${CACHE_PREFIXES.DASHBOARD}:${userId}:studentDashboard`
    const data = await withCache(
      cacheKey,
      async () => {
        const timings: Record<string, number> = {}

        // Get student data with school and program information
        const tStudentStart = Date.now()
        const studentData = await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            studentId: users.studentId,
            programId: users.programId,
            schoolId: users.schoolId,
            gpa: users.gpa,
            totalClinicalHours: users.totalClinicalHours,
            completedRotations: users.completedRotations,
            academicStatus: users.academicStatus,
            enrollmentDate: users.enrollmentDate,
            expectedGraduation: users.expectedGraduation,
            programName: programs.name,
            programDuration: programs.duration,
            programClassYear: programs.classYear,
            schoolName: schools.name,
          })
          .from(users)
          .leftJoin(programs, eq(users.programId, programs.id))
          .leftJoin(schools, eq(users.schoolId, schools.id))
          .where(eq(users.id, userId))
          .limit(1)
        timings.studentLookupMs = Date.now() - tStudentStart

        if (!studentData.length) {
          // Return a sentinel for the route handler to convert to 404
          return { __errorStatus: 404, error: "Student not found" }
        }

        const student = studentData[0]

        // Check if user is a student
        if (user.role !== "STUDENT") {
          return { __errorStatus: 403, error: "Access denied. Students only." }
        }

        // Calculate date ranges
        const now = new Date()
        const startOfWeek = new Date(now)
        startOfWeek.setDate(now.getDate() - now.getDay())
        startOfWeek.setHours(0, 0, 0, 0)

        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        startOfMonth.setHours(0, 0, 0, 0)

        // Run remaining queries in parallel to reduce latency
        const tParallelStart = Date.now()
        const [
          currentRotationRows,
          assignedSitesRows,
          recentTimeRecordsRows,
          clockStatusRows,
          weeklyStatsRows,
          monthlyStatsRows,
          streakRecordsRows,
        ] = await Promise.all([
          // Current rotation
          db
            .select({
              id: rotations.id,
              specialty: rotations.specialty,
              startDate: rotations.startDate,
              endDate: rotations.endDate,
              clinicalSiteId: rotations.clinicalSiteId,
              siteName: clinicalSites.name,
              siteType: clinicalSites.type,
              siteAddress: clinicalSites.address,
              preceptorId: rotations.preceptorId,
            })
            .from(rotations)
            .leftJoin(clinicalSites, eq(rotations.clinicalSiteId, clinicalSites.id))
            .where(
              and(
                eq(rotations.studentId, userId),
                lte(rotations.startDate, now),
                gte(rotations.endDate, now),
                eq(rotations.status, "ACTIVE")
              )
            )
            .limit(1),

          // Assigned sites
          db
            .select({
              id: clinicalSites.id,
              name: clinicalSites.name,
              type: clinicalSites.type,
              address: clinicalSites.address,
              specialties: clinicalSites.specialties,
              capacity: clinicalSites.capacity,
              contactPersonName: clinicalSites.contactPersonName,
              contactPersonEmail: clinicalSites.contactPersonEmail,
              contactPersonPhone: clinicalSites.contactPersonPhone,
            })
            .from(siteAssignments)
            .leftJoin(clinicalSites, eq(siteAssignments.clinicalSiteId, clinicalSites.id))
            .where(
              and(
                eq(siteAssignments.studentId, userId),
                eq(siteAssignments.status, "ACTIVE"),
                // Include current and upcoming assignments (exclude only already ended)
                or(
                  isNull(siteAssignments.startDate),
                  lte(siteAssignments.startDate, now),
                  gte(siteAssignments.startDate, now)
                ),
                or(isNull(siteAssignments.endDate), gte(siteAssignments.endDate, now))
              )
            ),

          // Recent time records
          db
            .select({
              id: timeRecords.id,
              date: timeRecords.date,
              clockIn: timeRecords.clockIn,
              clockOut: timeRecords.clockOut,
              totalHours: timeRecords.totalHours,
              activities: timeRecords.activities,
              notes: timeRecords.notes,
              status: timeRecords.status,
              clinicalSiteId: rotations.clinicalSiteId,
              siteName: clinicalSites.name,
              specialty: rotations.specialty,
            })
            .from(timeRecords)
            .leftJoin(rotations, eq(timeRecords.rotationId, rotations.id))
            .leftJoin(clinicalSites, eq(rotations.clinicalSiteId, clinicalSites.id))
            .where(eq(timeRecords.studentId, userId))
            .orderBy(desc(timeRecords.date), desc(timeRecords.clockIn))
            .limit(10),

          // Clock status
          db
            .select({
              id: timeRecords.id,
              clockIn: timeRecords.clockIn,
              rotationId: timeRecords.rotationId,
              siteName: clinicalSites.name,
              specialty: rotations.specialty,
            })
            .from(timeRecords)
            .leftJoin(rotations, eq(timeRecords.rotationId, rotations.id))
            .leftJoin(clinicalSites, eq(rotations.clinicalSiteId, clinicalSites.id))
            .where(and(eq(timeRecords.studentId, userId), isNull(timeRecords.clockOut)))
            .limit(1),

          // Weekly stats
          db
            .select({
              totalHours: sql<number>`COALESCE(SUM(CAST(${timeRecords.totalHours} AS DECIMAL)), 0)`,
              count: sql<number>`COUNT(*)`,
            })
            .from(timeRecords)
            .where(
              and(
                eq(timeRecords.studentId, userId),
                gte(timeRecords.date, startOfWeek),
                isNotNull(timeRecords.clockOut)
              )
            ),

          // Monthly stats
          db
            .select({
              totalHours: sql<number>`COALESCE(SUM(CAST(${timeRecords.totalHours} AS DECIMAL)), 0)`,
              count: sql<number>`COUNT(*)`,
            })
            .from(timeRecords)
            .where(
              and(
                eq(timeRecords.studentId, userId),
                gte(timeRecords.date, startOfMonth),
                isNotNull(timeRecords.clockOut)
              )
            ),

          // Streak records
          db
            .select({
              clockInDate: sql<string>`DATE(${timeRecords.date})`,
            })
            .from(timeRecords)
            .where(eq(timeRecords.studentId, userId))
            .groupBy(sql`DATE(${timeRecords.date})`)
            .orderBy(desc(sql`DATE(${timeRecords.date})`))
            .limit(30),
        ])
        timings.parallelQueriesMs = Date.now() - tParallelStart

        // Compute streak
        const tComputeStart = Date.now()
        let currentStreak = 0
        const todayStr = new Date().toISOString().split("T")[0]
        const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split("T")[0]
        const uniqueDates = [...new Set(streakRecordsRows.map((r) => r.clockInDate))]

        if (uniqueDates.includes(todayStr) || uniqueDates.includes(yesterdayStr)) {
          for (let i = 0; i < uniqueDates.length; i++) {
            const checkDate = new Date()
            checkDate.setDate(checkDate.getDate() - i)
            const checkDateStr = checkDate.toISOString().split("T")[0]
            if (uniqueDates.includes(checkDateStr)) {
              currentStreak++
            } else {
              break
            }
          }
        }

        // Calculate totals
        const totalRequiredHours = student.programDuration ? student.programDuration * 40 * 4 : 640
        const totalRotations = student.programDuration ? Math.ceil(student.programDuration / 2) : 8
        timings.computeMs = Date.now() - tComputeStart

        // Debug logging for site/rotation availability
        if (debug) {
          console.info(
            "[StudentDashboardAPI] userId=%s assignedSites=%d currentRotation=%s recentTimeRecords=%d",
            userId,
            assignedSitesRows.length,
            currentRotationRows.length > 0 ? String(currentRotationRows[0].id) : "none",
            recentTimeRecordsRows.length
          )
        }

        const baseResponse = {
          success: true,
          student: {
            id: student.id,
            name: student.name,
            email: student.email,
            studentId: student.studentId,
            gpa: student.gpa,
            totalClinicalHours: student.totalClinicalHours,
            completedRotations: student.completedRotations,
            academicStatus: student.academicStatus,
            enrollmentDate: student.enrollmentDate,
            expectedGraduation: student.expectedGraduation,
            program: {
              id: student.programId,
              name: student.programName,
              duration: student.programDuration,
              classYear: student.programClassYear,
            },
            school: {
              id: student.schoolId,
              name: student.schoolName,
            },
          },
          currentRotation: currentRotationRows.length > 0 ? currentRotationRows[0] : null,
          assignedSites: assignedSitesRows,
          recentTimeRecords: recentTimeRecordsRows,
          clockStatus: clockStatusRows[0] || null,
          statistics: {
            weeklyHours: Number(weeklyStatsRows[0]?.totalHours) || 0,
            weeklyCount: weeklyStatsRows[0]?.count || 0,
            monthlyHours: Number(monthlyStatsRows[0]?.totalHours) || 0,
            monthlyCount: monthlyStatsRows[0]?.count || 0,
            currentStreak,
            totalRequiredHours,
            totalRotations,
            progressPercentage: student.totalClinicalHours
              ? Math.min((student.totalClinicalHours / totalRequiredHours) * 100, 100)
              : 0,
            rotationProgress: student.completedRotations
              ? Math.min((student.completedRotations / totalRotations) * 100, 100)
              : 0,
          },
        }

        return debug ? { ...baseResponse, timings } : baseResponse
      },
      CACHE_CONFIG.shortTTL
    )

    // Handle sentinel errors from cached builder
    if ((data as any).__errorStatus) {
      const status = (data as any).__errorStatus as number
      if (status === 404) {
        return createErrorResponse(ERROR_MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND)
      }
      if (status === 403) {
        return createErrorResponse(ERROR_MESSAGES.ACCESS_DENIED, HTTP_STATUS.FORBIDDEN)
      }
      return createErrorResponse("An error occurred", status)
    }

    const totalMs = Date.now() - routeStart
    if (debug && typeof data === "object") {
      return createSuccessResponse({
        ...(data as any),
        timings: { ...((data as any).timings || {}), routeTotalMs: totalMs },
      })
    }

    return createSuccessResponse(data)
  })
}

