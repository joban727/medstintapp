import { auth } from "@clerk/nextjs/server"
import { and, desc, eq, gte, isNotNull, isNull, lte, sql } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/database/db"
import { 
  users, 
  timeRecords, 
  rotations, 
  clinicalSites, 
  siteAssignments, 
  programs,
  schools 
} from "@/database/schema"
import { cacheIntegrationService } from '@/lib/cache-integration'

export async function GET(request: NextRequest) {
  async function executeOriginalLogic() {
    try {
      const { userId } = await auth()

      if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      // Get student data with school and program information
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
          schoolAccreditation: schools.accreditation,
        })
        .from(users)
        .leftJoin(programs, eq(users.programId, programs.id))
        .leftJoin(schools, eq(users.schoolId, schools.id))
        .where(eq(users.id, userId))
        .limit(1)

      if (!studentData.length) {
        return NextResponse.json({ error: "Student not found" }, { status: 404 })
      }

      const student = studentData[0]

      // Check if user is a student
      if (student.id !== userId) {
        return NextResponse.json({ error: "Access denied. Students only." }, { status: 403 })
      }

      // Calculate date ranges
      const now = new Date()
      const startOfWeek = new Date(now)
      startOfWeek.setDate(now.getDate() - now.getDay())
      startOfWeek.setHours(0, 0, 0, 0)

      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      startOfMonth.setHours(0, 0, 0, 0)

      // Get current rotation (active rotation for today)
      const currentRotation = await db
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
        .limit(1)

      // Get assigned clinical sites
      const assignedSites = await db
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
            lte(siteAssignments.startDate, now),
            gte(siteAssignments.endDate, now)
          )
        )

      // Get recent time records (last 10)
      const recentTimeRecords = await db
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
        .limit(10)

      // Get clock status (check if currently clocked in)
      const [clockStatus] = await db
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
        .where(
          and(
            eq(timeRecords.studentId, userId),
            isNull(timeRecords.clockOut)
          )
        )
        .limit(1)

      // Calculate weekly and monthly statistics
      const weeklyStats = await db
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
        )

      const monthlyStats = await db
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
        )

      // Calculate current streak
      const streakRecords = await db
        .select({
          clockInDate: sql<string>`DATE(${timeRecords.date})`,
        })
        .from(timeRecords)
        .where(eq(timeRecords.studentId, userId))
        .groupBy(sql`DATE(${timeRecords.date})`)
        .orderBy(desc(sql`DATE(${timeRecords.date})`))
        .limit(30)

      let currentStreak = 0
      const today = new Date().toISOString().split("T")[0]
      const uniqueDates = [...new Set(streakRecords.map((r) => r.clockInDate))]

      if (uniqueDates.includes(today) || uniqueDates.includes(new Date(Date.now() - 86400000).toISOString().split("T")[0])) {
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

      // Calculate total required hours based on program duration
      const totalRequiredHours = student.programDuration ? student.programDuration * 40 * 4 : 640 // Default to 640 hours (16 months * 40 hours/week * 4 weeks/month)
      const totalRotations = student.programDuration ? Math.ceil(student.programDuration / 2) : 8 // Default to 8 rotations (2 months each)

      const response = {
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
            accreditation: student.schoolAccreditation,
          },
        },
        currentRotation: currentRotation.length > 0 ? currentRotation[0] : null,
        assignedSites: assignedSites,
        recentTimeRecords: recentTimeRecords,
        clockStatus: clockStatus || null,
        statistics: {
          weeklyHours: Number(weeklyStats[0]?.totalHours) || 0,
          weeklyCount: weeklyStats[0]?.count || 0,
          monthlyHours: Number(monthlyStats[0]?.totalHours) || 0,
          monthlyCount: monthlyStats[0]?.count || 0,
          currentStreak: currentStreak,
          totalRequiredHours,
          totalRotations,
          progressPercentage: student.totalClinicalHours ? Math.min((student.totalClinicalHours / totalRequiredHours) * 100, 100) : 0,
          rotationProgress: student.completedRotations ? Math.min((student.completedRotations / totalRotations) * 100, 100) : 0,
        },
      }

      return NextResponse.json(response)
    } catch (error) {
      console.error("Error fetching student dashboard data:", error)
      return NextResponse.json({ 
        success: false,
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error occurred"
      }, { status: 500 })
    }
  }

  // Execute the logic directly
  return await executeOriginalLogic()
}