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

// GET /api/students/[userId]/upcoming-rotations - Get upcoming rotations for a student
export const GET = withErrorHandling(
  async (request: NextRequest, { params }: { params: Promise<{ userId: string }> }) => {
    const { userId: currentUserId } = await auth()
    const { userId: studentId } = await params

    if (!currentUserId) {
      return createErrorResponse("Unauthorized", HTTP_STATUS.UNAUTHORIZED)
    }

    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "5")
    const days = Number.parseInt(searchParams.get("days") || "90") // Next 90 days by default

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

    const now = new Date()
    const futureDate = new Date()
    futureDate.setDate(now.getDate() + days)

    // Get upcoming rotations for the student
    const upcomingRotations = await db
      .select({
        id: rotations.id,
        specialty: rotations.specialty,
        startDate: rotations.startDate,
        endDate: rotations.endDate,
        requiredHours: rotations.requiredHours,
        completedHours: rotations.completedHours,
        status: rotations.status,
        objectives: rotations.objectives,
      })
      .from(rotations)
      .where(gte(rotations.startDate, now))
      .orderBy(rotations.startDate)
      .limit(limit)

    // Helper function to calculate rotation duration
    const calculateDuration = (startDate: Date, endDate: Date): number => {
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime())
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) // Convert to days
    }

    // Format the rotations data
    const formattedRotations = upcomingRotations.map((rotation) => ({
      id: rotation.id,
      name: rotation.specialty,
      description: rotation.objectives || "",
      startDate: rotation.startDate,
      endDate: rotation.endDate,
      specialty: rotation.specialty,
      requiredHours: rotation.requiredHours,
      completedHours: rotation.completedHours,
      duration:
        rotation.startDate && rotation.endDate
          ? calculateDuration(rotation.startDate, rotation.endDate)
          : 0,
      status: rotation.status,
    }))

    return createSuccessResponse({
      upcomingRotations: formattedRotations,
      total: formattedRotations.length,
    })
  }
)
