import { auth } from "@clerk/nextjs/server"
import { and, eq, gte, isNotNull, lte, sql } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/database/db"
import { siteAssignments, timeRecords, users } from "@/database/schema"
import { cacheIntegrationService } from '@/lib/cache-integration'


export async function GET(_request: NextRequest) {
  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      'api:student/dashboard-stats/route.ts',
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
    console.warn('Cache error in student/dashboard-stats/route.ts:', cacheError)
    // Continue with original logic if cache fails
  }
  
  async function executeOriginalLogic() {

  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user from database
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1)

    if (!user.length) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const currentUser = user[0]

    // Check if user is a student
    if (currentUser.role !== "STUDENT") {
      return NextResponse.json({ error: "Access denied. Students only." }, { status: 403 })
    }

    // Calculate date ranges
    const now = new Date()
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay())
    startOfWeek.setHours(0, 0, 0, 0)

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    startOfMonth.setHours(0, 0, 0, 0)

    // Get total hours this week
    const weeklyHours = await db
      .select({
        totalHours: sql<number>`COALESCE(SUM(${timeRecords.totalHours}), 0)`,
      })
      .from(timeRecords)
      .where(
        and(
          eq(timeRecords.studentId, currentUser.id),
          gte(timeRecords.clockIn, startOfWeek),
          isNotNull(timeRecords.clockOut)
        )
      )

    // Get total hours this month
    const monthlyHours = await db
      .select({
        totalHours: sql<number>`COALESCE(SUM(${timeRecords.totalHours}), 0)`,
      })
      .from(timeRecords)
      .where(
        and(
          eq(timeRecords.studentId, currentUser.id),
          gte(timeRecords.clockIn, startOfMonth),
          isNotNull(timeRecords.clockOut)
        )
      )

    // Calculate current streak (consecutive days with clock-ins)
    const recentRecords = await db
      .select({
        clockInDate: sql<string>`DATE(${timeRecords.clockIn})`,
      })
      .from(timeRecords)
      .where(eq(timeRecords.studentId, currentUser.id))
      .orderBy(sql`DATE(${timeRecords.clockIn}) DESC`)
      .limit(30) // Check last 30 days

    let currentStreak = 0
    const today = new Date().toISOString().split("T")[0]
    const recordDates = [...new Set(recentRecords.map((r) => r.clockInDate))]

    // Check if there's a record today or yesterday to start counting
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split("T")[0]

    const startDate = recordDates.includes(today)
      ? today
      : recordDates.includes(yesterdayStr)
        ? yesterdayStr
        : null

    if (startDate) {
      const startDateObj = new Date(startDate)
      for (let i = 0; i < recordDates.length; i++) {
        const checkDate = new Date(startDateObj)
        checkDate.setDate(startDateObj.getDate() - i)
        const checkDateStr = checkDate.toISOString().split("T")[0]

        if (recordDates.includes(checkDateStr)) {
          currentStreak++
        } else {
          break
        }
      }
    }

    // Get active sites count
    const activeSites = await db
      .select({
        count: sql<number>`COUNT(DISTINCT ${siteAssignments.clinicalSiteId})`,
      })
      .from(siteAssignments)
      .where(
        and(
          eq(siteAssignments.studentId, currentUser.id),
          eq(siteAssignments.status, "ACTIVE"),
          lte(siteAssignments.startDate, now),
          gte(siteAssignments.endDate, now)
        )
      )

    const stats = {
      totalHoursThisWeek: weeklyHours[0]?.totalHours || 0,
      totalHoursThisMonth: monthlyHours[0]?.totalHours || 0,
      currentStreak,
      activeSites: activeSites[0]?.count || 0,
    }

    return NextResponse.json({
      success: true,
      stats,
    })
  } catch (_error) {
    // Error fetching dashboard stats
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }

  }
}
