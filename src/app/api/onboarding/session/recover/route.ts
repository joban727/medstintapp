import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/database/connection-pool"
import { onboardingSessions } from "../../../../../database/schema"
import { eq, and, lt } from "drizzle-orm"
import { v4 as uuidv4 } from "uuid"
import { cacheIntegrationService } from "@/lib/cache-integration"
import {
  createSuccessResponse,
  createErrorResponse,
  withErrorHandling,
  HTTP_STATUS,
} from "@/lib/api-response"

export const POST = withErrorHandling(async (request: NextRequest) => {
  const { userId } = await auth()

  if (!userId) {
    return createErrorResponse("Unauthorized", HTTP_STATUS.UNAUTHORIZED)
  }

  // Find the most recent expired session for this user
  const expiredSessions = await db
    .select()
    .from(onboardingSessions)
    .where(and(eq(onboardingSessions.userId, userId), lt(onboardingSessions.expiresAt, new Date())))
    .orderBy(onboardingSessions.updatedAt)
    .limit(1)

  if (expiredSessions.length === 0) {
    return createErrorResponse("No expired session found to recover", HTTP_STATUS.NOT_FOUND)
  }

  const expiredSession = expiredSessions[0]

  // Create a new session with the same data but extended expiration
  const _newSessionId = uuidv4()
  const newExpiresAt = new Date()
  newExpiresAt.setHours(newExpiresAt.getHours() + 24)

  // Update the old session's expiration time
  await db
    .update(onboardingSessions)
    .set({
      updatedAt: new Date(),
    })
    .where(eq(onboardingSessions.id, expiredSession.id))

  // Create new session with recovered data
  const newSession = await db
    .insert(onboardingSessions)
    .values({
      userId,
      currentStep: expiredSession.currentStep,
      completedSteps: expiredSession.completedSteps,
      formData: expiredSession.formData,
      expiresAt: newExpiresAt,
    })
    .returning()

  if (newSession.length === 0) {
    throw new Error("Failed to create recovered session")
  }

  const recoveredSession = newSession[0]

  // Parse the form data for response
  let parsedFormData = {}
  try {
    parsedFormData =
      typeof recoveredSession.formData === "string"
        ? JSON.parse(recoveredSession.formData)
        : recoveredSession.formData || {}
  } catch (error) {
    console.warn("Failed to parse form data:", error)
  }

  let parsedCompletedSteps = []
  try {
    parsedCompletedSteps =
      typeof recoveredSession.completedSteps === "string"
        ? JSON.parse(recoveredSession.completedSteps)
        : recoveredSession.completedSteps || []
  } catch (error) {
    console.warn("Failed to parse completed steps:", error)
  }

  // Invalidate related caches on successful recovery
  try {
    await cacheIntegrationService.clear()
  } catch (cacheError) {
    console.warn("Cache invalidation error in onboarding/session/recover/route.ts:", cacheError)
  }

  return createSuccessResponse({
    message: "Session recovered successfully",
    data: {
      id: recoveredSession.id,
      currentStep: recoveredSession.currentStep,
      completedSteps: parsedCompletedSteps,
      formData: parsedFormData,
      expiresAt: recoveredSession.expiresAt.toISOString(),
      createdAt: recoveredSession.createdAt.toISOString(),
      updatedAt: recoveredSession.updatedAt.toISOString(),
    },
  })
})

