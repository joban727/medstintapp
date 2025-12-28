import { currentUser } from "@clerk/nextjs/server"
import { and, eq } from "drizzle-orm"
import { type NextRequest } from "next/server"
import type { OnboardingStep } from "@/types/onboarding"
import { db } from "@/database/connection-pool"
import { onboardingSessions } from "../../../../database/schema"
import {
  createSuccessResponse,
  createErrorResponse,
  withErrorHandling,
  HTTP_STATUS,
  ERROR_MESSAGES,
} from "../../../../lib/api-response"

// POST /api/onboarding/session - Save or update session
export const POST = withErrorHandling(async (request: NextRequest) => {
  const user = await currentUser()
  if (!user) {
    return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
  }

  const body = await request.json()
  const { sessionId, currentStep, completedSteps, formData } = body

  // Validate required fields
  if (!currentStep) {
    return createErrorResponse("Current step is required", HTTP_STATUS.BAD_REQUEST)
  }

  const now = new Date()
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000) // 24 hours from now

  let session: {
    id: string
    userId: string
    currentStep: OnboardingStep
    completedSteps: OnboardingStep[]
    formData: Record<string, unknown>
    status: string
    startedAt?: Date
    updatedAt: Date
    expiresAt: Date
  }

  if (sessionId) {
    // Update existing session
    const existingSessions = await db
      .select()
      .from(onboardingSessions)
      .where(and(eq(onboardingSessions.id, sessionId), eq(onboardingSessions.userId, user.id)))
      .limit(1)

    if (existingSessions.length === 0) {
      return createErrorResponse("Session not found", HTTP_STATUS.NOT_FOUND)
    }

    // Update the session
    await db
      .update(onboardingSessions)
      .set({
        currentStep: currentStep as OnboardingStep,
        completedSteps: completedSteps || [],
        formData: formData || {},
        updatedAt: now,
        expiresAt,
      })
      .where(and(eq(onboardingSessions.id, sessionId), eq(onboardingSessions.userId, user.id)))

    session = {
      id: sessionId,
      userId: user.id,
      currentStep,
      completedSteps: completedSteps || [],
      formData: formData || {},
      status: "active",
      updatedAt: now,
      expiresAt,
    }
  } else {
    // Create new session
    const newSessionId = crypto.randomUUID()

    await db.insert(onboardingSessions).values({
      userId: user.id,
      currentStep: currentStep as OnboardingStep,
      completedSteps: completedSteps || [],
      formData: formData || {},
      expiresAt,
    })

    session = {
      id: newSessionId,
      userId: user.id,
      currentStep,
      completedSteps: completedSteps || [],
      formData: formData || {},
      status: "active",
      startedAt: now,
      updatedAt: now,
      expiresAt,
    }
  }

  return createSuccessResponse({
    data: session,
    sessionId: session.id,
  })
})

// GET /api/onboarding/session - Get active session for current user
export const GET = withErrorHandling(async (_request: NextRequest) => {
  const user = await currentUser()
  if (!user) {
    return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
  }

  // Get the most recent session
  const sessions = await db
    .select()
    .from(onboardingSessions)
    .where(eq(onboardingSessions.userId, user.id))
    .orderBy(onboardingSessions.updatedAt)
    .limit(1)

  if (sessions.length === 0) {
    return createErrorResponse("No active session found", HTTP_STATUS.NOT_FOUND)
  }

  const session = sessions[0]
  const now = new Date()

  // Check if session is expired
  if (session.expiresAt && new Date(session.expiresAt) < now) {
    return createErrorResponse("Session expired", 410)
  }

  // Format session data
  const sessionData = {
    id: session.id,
    userId: session.userId,
    currentStep: session.currentStep,
    completedSteps: session.completedSteps || [],
    formData: session.formData || {},
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    expiresAt: session.expiresAt,
  }

  return createSuccessResponse({
    data: sessionData,
  })
})

// DELETE /api/onboarding/session - Delete/abandon current session
export const DELETE = withErrorHandling(async (request: NextRequest) => {
  const user = await currentUser()
  if (!user) {
    return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
  }

  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get("sessionId")

  if (sessionId) {
    // Delete specific session
    await db
      .delete(onboardingSessions)
      .where(and(eq(onboardingSessions.id, sessionId), eq(onboardingSessions.userId, user.id)))
  } else {
    // Delete all sessions for user
    await db.delete(onboardingSessions).where(eq(onboardingSessions.userId, user.id))
  }

  return createSuccessResponse({
    message: "Session abandoned successfully",
  })
})

