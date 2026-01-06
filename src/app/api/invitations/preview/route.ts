import { NextRequest } from "next/server"
import { db } from "@/database/db"
import { invitations, schools, programs, cohorts } from "@/database/schema"
import { eq, and } from "drizzle-orm"
import {
  createErrorResponse,
  createSuccessResponse,
  HTTP_STATUS,
  withErrorHandling,
} from "@/lib/api-response"

export const dynamic = "force-dynamic"

/**
 * GET /api/invitations/preview?token=xxx
 * Preview invitation details without accepting (no auth required)
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get("token")

  if (!token) {
    return createErrorResponse("Token is required", HTTP_STATUS.BAD_REQUEST)
  }

  // Find invitation by token
  const [invitation] = await db
    .select()
    .from(invitations)
    .where(and(eq(invitations.token, token), eq(invitations.status, "PENDING")))
    .limit(1)

  if (!invitation) {
    return createErrorResponse("Invalid or expired invitation", HTTP_STATUS.NOT_FOUND)
  }

  // Check if expired
  if (new Date() > invitation.expiresAt) {
    await db
      .update(invitations)
      .set({ status: "EXPIRED", updatedAt: new Date() })
      .where(eq(invitations.id, invitation.id))
    return createErrorResponse("This invitation has expired", HTTP_STATUS.BAD_REQUEST)
  }

  // Get related data
  const [school] = await db
    .select({ name: schools.name })
    .from(schools)
    .where(eq(schools.id, invitation.schoolId))
    .limit(1)

  const [program] = await db
    .select({ name: programs.name })
    .from(programs)
    .where(eq(programs.id, invitation.programId))
    .limit(1)

  const [cohort] = await db
    .select({ name: cohorts.name })
    .from(cohorts)
    .where(eq(cohorts.id, invitation.cohortId))
    .limit(1)

  return createSuccessResponse(
    {
      email: invitation.email,
      schoolName: school?.name,
      programName: program?.name,
      cohortName: cohort?.name,
      role: invitation.role,
      expiresAt: invitation.expiresAt.toISOString(),
    },
    "Invitation details retrieved"
  )
})
