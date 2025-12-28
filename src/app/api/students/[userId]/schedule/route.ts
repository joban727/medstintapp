import type { UserRole } from "@/types"
import { auth } from "@clerk/nextjs/server"
import { and, eq, gte, lte } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { db } from "../../../../../database/connection-pool"
import { clinicalSites, rotations, users } from "../../../../../database/schema"
import {
  createSuccessResponse,
  createErrorResponse,
  withErrorHandling,
  HTTP_STATUS,
} from "../../../../../lib/api-response"

interface WeeklyRotation {
  id: string
  startDate: Date | null
  endDate: Date | null
  status: string
  specialty: string
  objectives: string | null
  requiredHours: number | null
  completedHours: number
  siteName: string | null
  siteAddress: string | null
}

// GET /api/students/[userId]/schedule - Get weekly schedule for a student
export const GET = withErrorHandling(
  async (request: NextRequest, { params }: { params: Promise<{ userId: string }> }) => {
    const { userId: currentUserId } = await auth()
    const { userId: studentId } = await params

    if (!currentUserId) {
      return createErrorResponse("Unauthorized", HTTP_STATUS.UNAUTHORIZED)
    }

    const { searchParams } = new URL(request.url)
    const weekOffset = Number.parseInt(searchParams.get("week") || "0") // Current week by default

    // Check if current user can access this student's data
    const [currentUser] = await db
      .select({
        id: users.id,
        role: users.role,
        schoolId: users.schoolId,
      })
      .from(users)
      .where(eq(users.id, currentUserId))
      .limit(1)

    if (!currentUser) {
      return createErrorResponse("User not found", HTTP_STATUS.NOT_FOUND)
    }

    // Students can only access their own data, others need appropriate permissions
    if (currentUser.role === ("STUDENT" as UserRole as UserRole) && currentUser.id !== studentId) {
      return createErrorResponse("Forbidden", HTTP_STATUS.FORBIDDEN)
    }

    // Calculate week start and end dates
    const now = new Date()
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - now.getDay() + weekOffset * 7) // Start of week (Sunday)
    weekStart.setHours(0, 0, 0, 0)

    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6) // End of week (Saturday)
    weekEnd.setHours(23, 59, 59, 999)

    // Get rotations for the specified week
    let weeklyRotations: WeeklyRotation[]
    try {
      weeklyRotations = await db
        .select({
          id: rotations.id,
          startDate: rotations.startDate,
          endDate: rotations.endDate,
          status: rotations.status,
          specialty: rotations.specialty,
          objectives: rotations.objectives,
          requiredHours: rotations.requiredHours,
          completedHours: rotations.completedHours,
          siteName: clinicalSites.name,
          siteAddress: clinicalSites.address,
        })
        .from(rotations)
        .leftJoin(clinicalSites, eq(rotations.clinicalSiteId, clinicalSites.id))
        .where(
          and(
            eq(rotations.studentId, studentId),
            lte(rotations.startDate, weekEnd),
            gte(rotations.endDate, weekStart)
          )
        )
        .orderBy(rotations.startDate)
    } catch (dbError) {
      console.error("Database query error in schedule API:", dbError)
      return createErrorResponse("Failed to fetch schedule data", HTTP_STATUS.INTERNAL_SERVER_ERROR)
    }

    // Format the schedule data with safe fallbacks
    const schedule = (weeklyRotations || []).map((rotation) => ({
      id: rotation.id || "",
      title: `${rotation.specialty || "General"} Rotation`,
      description: rotation.objectives || "Clinical rotation",
      startDate: rotation.startDate,
      endDate: rotation.endDate,
      location: rotation.siteName || "TBD",
      department: rotation.specialty || "General",
      specialty: rotation.specialty || "General",
      status: rotation.status || "SCHEDULED",
      requiredHours: rotation.requiredHours || 0,
      completedHours: rotation.completedHours || 0,
      siteAddress: rotation.siteAddress || "",
    }))

    return createSuccessResponse({
      schedule,
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      total: schedule.length,
    })
  }
)
