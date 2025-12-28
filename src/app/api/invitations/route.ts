import { NextRequest } from "next/server"
import { db } from "@/database/db"
import { invitations, users, schools, programs, cohorts } from "@/database/schema"
import { eq, and, desc } from "drizzle-orm"
import { auth } from "@clerk/nextjs/server"
import {
  createErrorResponse,
  createSuccessResponse,
  HTTP_STATUS,
  ERROR_MESSAGES,
  withErrorHandling,
} from "@/lib/api-response"
import { sendInvitationEmail } from "@/lib/email-service"

export const dynamic = "force-dynamic"

/**
 * GET /api/invitations
 * List all invitations for the current user's school
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const { userId } = await auth()

  if (!userId) {
    return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
  }

  const [currentUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!currentUser || (currentUser.role !== "SCHOOL_ADMIN" && currentUser.role !== "SUPER_ADMIN")) {
    return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
  }

  if (!currentUser.schoolId && currentUser.role !== "SUPER_ADMIN") {
    return createErrorResponse("User is not associated with a school", HTTP_STATUS.BAD_REQUEST)
  }

  // Build query based on role
  const invitationsList = currentUser.role === "SUPER_ADMIN"
    ? await db
      .select({
        id: invitations.id,
        email: invitations.email,
        schoolId: invitations.schoolId,
        programId: invitations.programId,
        cohortId: invitations.cohortId,
        role: invitations.role,
        status: invitations.status,
        expiresAt: invitations.expiresAt,
        createdAt: invitations.createdAt,
      })
      .from(invitations)
      .orderBy(desc(invitations.createdAt))
      .limit(100)
    : await db
      .select({
        id: invitations.id,
        email: invitations.email,
        schoolId: invitations.schoolId,
        programId: invitations.programId,
        cohortId: invitations.cohortId,
        role: invitations.role,
        status: invitations.status,
        expiresAt: invitations.expiresAt,
        createdAt: invitations.createdAt,
      })
      .from(invitations)
      .where(eq(invitations.schoolId, currentUser.schoolId!))
      .orderBy(desc(invitations.createdAt))
      .limit(100)

  return createSuccessResponse(invitationsList, "Invitations fetched successfully")
})

/**
 * POST /api/invitations
 * Create new invitations and send emails
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const { userId } = await auth()

  if (!userId) {
    return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
  }

  const [currentUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!currentUser || (currentUser.role !== "SCHOOL_ADMIN" && currentUser.role !== "SUPER_ADMIN")) {
    return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
  }

  if (!currentUser.schoolId) {
    return createErrorResponse("User is not associated with a school", HTTP_STATUS.BAD_REQUEST)
  }

  const body = await request.json()
  const { emails, programId, cohortId, role = "STUDENT" } = body

  // Validate inputs
  if (!emails || !Array.isArray(emails) || emails.length === 0) {
    return createErrorResponse("At least one email is required", HTTP_STATUS.BAD_REQUEST)
  }

  if (!programId) {
    return createErrorResponse("Program ID is required", HTTP_STATUS.BAD_REQUEST)
  }

  if (!cohortId) {
    return createErrorResponse("Cohort ID is required", HTTP_STATUS.BAD_REQUEST)
  }

  // Validate role
  const validRoles = ["STUDENT", "CLINICAL_PRECEPTOR", "CLINICAL_SUPERVISOR"]
  if (!validRoles.includes(role)) {
    return createErrorResponse("Invalid role specified", HTTP_STATUS.BAD_REQUEST)
  }

  // Verify program belongs to the school
  const [program] = await db
    .select()
    .from(programs)
    .where(and(eq(programs.id, programId), eq(programs.schoolId, currentUser.schoolId)))
    .limit(1)

  if (!program) {
    return createErrorResponse("Program not found or does not belong to your school", HTTP_STATUS.BAD_REQUEST)
  }

  // Verify cohort belongs to the program
  const [cohort] = await db
    .select()
    .from(cohorts)
    .where(and(eq(cohorts.id, cohortId), eq(cohorts.programId, programId)))
    .limit(1)

  if (!cohort) {
    return createErrorResponse("Cohort not found or does not belong to the specified program", HTTP_STATUS.BAD_REQUEST)
  }

  // Get school for email
  const [school] = await db
    .select()
    .from(schools)
    .where(eq(schools.id, currentUser.schoolId))
    .limit(1)

  if (!school) {
    return createErrorResponse("School not found", HTTP_STATUS.BAD_REQUEST)
  }

  // Create invitations
  const createdInvitations: Array<{
    id: string
    email: string
    status: string
    emailSent: boolean
  }> = []
  const errors: Array<{ email: string; error: string }> = []

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7) // 7 days expiration

  for (const email of emails) {
    const normalizedEmail = email.trim().toLowerCase()

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(normalizedEmail)) {
      errors.push({ email: normalizedEmail, error: "Invalid email format" })
      continue
    }

    // Check if invitation already exists for this email in this school
    const [existingInvitation] = await db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.email, normalizedEmail),
          eq(invitations.schoolId, currentUser.schoolId),
          eq(invitations.status, "PENDING")
        )
      )
      .limit(1)

    if (existingInvitation) {
      errors.push({ email: normalizedEmail, error: "Pending invitation already exists" })
      continue
    }

    // Check if user already exists with this email and is part of this school
    const [existingUser] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, normalizedEmail), eq(users.schoolId, currentUser.schoolId)))
      .limit(1)

    if (existingUser) {
      errors.push({ email: normalizedEmail, error: "User already exists in this school" })
      continue
    }

    try {
      // Generate unique token
      const token = crypto.randomUUID()

      // Create invitation
      const [newInvitation] = await db
        .insert(invitations)
        .values({
          email: normalizedEmail,
          schoolId: currentUser.schoolId,
          programId,
          cohortId,
          role,
          token,
          status: "PENDING",
          expiresAt,
          invitedBy: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning({
          id: invitations.id,
          email: invitations.email,
          status: invitations.status,
        })

      // Send invitation email
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
      const inviteLink = `${appUrl}/invite/accept?token=${token}`

      const emailSent = await sendInvitationEmail({
        to: normalizedEmail,
        schoolName: school.name,
        programName: program.name,
        inviteLink,
      })

      createdInvitations.push({
        id: newInvitation.id,
        email: newInvitation.email,
        status: newInvitation.status,
        emailSent,
      })
    } catch (error) {
      console.error(`Error creating invitation for ${normalizedEmail}:`, error)
      errors.push({ email: normalizedEmail, error: "Failed to create invitation" })
    }
  }

  return createSuccessResponse(
    {
      created: createdInvitations,
      errors,
      summary: {
        total: emails.length,
        created: createdInvitations.length,
        failed: errors.length,
      },
    },
    `Created ${createdInvitations.length} invitation(s)${errors.length > 0 ? ` with ${errors.length} error(s)` : ""}`
  )
})
