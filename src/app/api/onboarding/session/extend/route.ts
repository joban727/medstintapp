import { auth } from "@clerk/nextjs/server"
import { and, eq } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/database/connection-pool"
import { onboardingSessions } from "@/database/schema"
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

  const { sessionId } = await request.json()

  if (!sessionId) {
    return createErrorResponse("Session ID is required", HTTP_STATUS.BAD_REQUEST)
  }

  // Find the session
  const existingSession = await db
    .select()
    .from(onboardingSessions)
    .where(and(eq(onboardingSessions.id, sessionId), eq(onboardingSessions.userId, userId)))
    .limit(1)

  if (existingSession.length === 0) {
    return createErrorResponse("Session not found or already completed", HTTP_STATUS.NOT_FOUND)
  }

  // Extend session by 24 hours from now
  const newExpiresAt = new Date()
  newExpiresAt.setHours(newExpiresAt.getHours() + 24)

  await db
    .update(onboardingSessions)
    .set({
      expiresAt: newExpiresAt,
      updatedAt: new Date(),
    })
    .where(eq(onboardingSessions.id, sessionId))

  // Invalidate related caches on successful operation
  try {
    await cacheIntegrationService.clear()
  } catch (cacheError) {
    console.warn("Cache invalidation error in onboarding/session/extend/route.ts:", cacheError)
  }

  return createSuccessResponse({
    message: "Session extended successfully",
    expiresAt: newExpiresAt.toISOString(),
  })
})
