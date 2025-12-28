import { NextRequest } from "next/server"
import { db } from "@/database/db"
import { invitations, users } from "@/database/schema"
import { eq, and } from "drizzle-orm"
import {
  createErrorResponse,
  createSuccessResponse,
  HTTP_STATUS,
  ERROR_MESSAGES,
  withErrorHandling,
} from "@/lib/api-response"
import { auth } from "@clerk/nextjs/server"
import { invalidateUserCache } from "@/lib/auth-utils"
import type { UserRole } from "@/types"

export const dynamic = "force-dynamic"

// Role hierarchy (higher index = more privileged)
const ROLE_HIERARCHY: UserRole[] = [
  "STUDENT",
  "CLINICAL_PRECEPTOR",
  "CLINICAL_SUPERVISOR",
  "SCHOOL_ADMIN",
  "SUPER_ADMIN",
]

export const POST = withErrorHandling(async (request: NextRequest) => {
  const { userId } = await auth()

  if (!userId) {
    return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)

  if (!user) {
    return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
  }

  const { token } = await request.json()

  if (!token) {
    return createErrorResponse(ERROR_MESSAGES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST)
  }

  // Find invitation
  const [invitation] = await db
    .select()
    .from(invitations)
    .where(and(eq(invitations.token, token), eq(invitations.status, "PENDING")))
    .limit(1)

  if (!invitation) {
    return createErrorResponse("Invalid or expired invitation", HTTP_STATUS.NOT_FOUND)
  }

  // Check expiration
  if (new Date() > invitation.expiresAt) {
    await db
      .update(invitations)
      .set({ status: "EXPIRED", updatedAt: new Date() })
      .where(eq(invitations.id, invitation.id))
    return createErrorResponse("Invitation has expired", HTTP_STATUS.BAD_REQUEST)
  }

  // SECURITY: Verify email matches the authenticated user
  if (invitation.email.toLowerCase() !== user.email?.toLowerCase()) {
    return createErrorResponse(
      "This invitation was sent to a different email address. Please sign in with the email address that received the invitation.",
      HTTP_STATUS.FORBIDDEN
    )
  }

  // SECURITY: Prevent role downgrades
  if (user.role) {
    const currentRoleLevel = ROLE_HIERARCHY.indexOf(user.role as UserRole)
    const invitationRoleLevel = ROLE_HIERARCHY.indexOf(invitation.role as UserRole)

    if (currentRoleLevel > invitationRoleLevel && currentRoleLevel !== -1) {
      return createErrorResponse(
        `Cannot accept invitation - your current role (${user.role}) has higher privileges than the invited role (${invitation.role})`,
        HTTP_STATUS.CONFLICT
      )
    }
  }

  // Update user with school, program, cohort, and role
  await db
    .update(users)
    .set({
      schoolId: invitation.schoolId,
      programId: invitation.programId,
      cohortId: invitation.cohortId,
      role: invitation.role as UserRole,
      approvalStatus: "APPROVED",
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id))

  // Mark invitation as accepted
  await db
    .update(invitations)
    .set({ status: "ACCEPTED", updatedAt: new Date() })
    .where(eq(invitations.id, invitation.id))

  // Invalidate user cache so middleware picks up the changes immediately
  invalidateUserCache(user.id)

  return createSuccessResponse(
    {
      schoolId: invitation.schoolId,
      programId: invitation.programId,
      cohortId: invitation.cohortId,
      role: invitation.role,
    },
    "Invitation accepted successfully"
  )
})
