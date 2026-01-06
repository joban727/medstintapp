import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth-clerk"
import { db } from "@/database/connection-pool"
import { programs, cohorts } from "@/database/schema"
import { eq } from "drizzle-orm"

/**
 * GET /api/setup-status
 * Returns whether the current user needs to complete quick setup
 */
export async function GET() {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Not authenticated",
        },
        { status: 401 }
      )
    }

    // Check if user has a schoolId
    const hasSchool = !!user.schoolId

    // If user has a school, check if they have programs
    let hasPrograms = false
    let hasCohorts = false

    if (user.schoolId) {
      const userPrograms = await db
        .select({ id: programs.id })
        .from(programs)
        .where(eq(programs.schoolId, user.schoolId))
        .limit(1)

      hasPrograms = userPrograms.length > 0

      if (hasPrograms) {
        const programIds = userPrograms.map((p) => p.id)
        const userCohorts = await db
          .select({ id: cohorts.id })
          .from(cohorts)
          .where(eq(cohorts.programId, programIds[0]))
          .limit(1)

        hasCohorts = userCohorts.length > 0
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        needsQuickSetup: !hasSchool || !hasPrograms,
        hasSchool,
        hasPrograms,
        hasCohorts,
        schoolId: user.schoolId,
        userRole: user.role,
      },
    })
  } catch (error) {
    console.error("Setup status error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to get setup status",
      },
      { status: 500 }
    )
  }
}
