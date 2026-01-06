import { type NextRequest, NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import { eq, and, desc } from "drizzle-orm"
import { db } from "@/database/connection-pool"
import { onboardingAnalytics } from "@/database/schema"
import type { OnboardingAnalyticsEvent, OnboardingStep } from "@/types/onboarding"
import { cacheIntegrationService } from "@/lib/cache-integration"
import {
  createSuccessResponse,
  createErrorResponse,
  withErrorHandling,
  HTTP_STATUS,
} from "@/lib/api-response"

// POST /api/onboarding/analytics - Track analytics event
export const POST = withErrorHandling(async (request: NextRequest) => {
  const user = await currentUser()
  if (!user) {
    return createErrorResponse("Unauthorized", HTTP_STATUS.UNAUTHORIZED)
  }

  const body = await request.json()
  const { eventType, step, sessionId, metadata = {}, duration } = body

  // Validate required fields
  if (!eventType || !step) {
    return createErrorResponse("Event type and step are required", HTTP_STATUS.BAD_REQUEST)
  }

  // Validate event type
  const validEventTypes: OnboardingAnalyticsEvent[] = [
    "step_started",
    "step_completed",
    "step_skipped",
    "form_validation_error",
    "api_error",
    "session_abandoned",
    "onboarding_completed",
  ]

  if (!validEventTypes.includes(eventType)) {
    return createErrorResponse("Invalid event type", HTTP_STATUS.BAD_REQUEST)
  }

  const now = new Date()
  const analyticsId = crypto.randomUUID()

  // Insert analytics record
  await db.insert(onboardingAnalytics).values({
    userId: user.id,
    sessionId: sessionId || null,
    eventType,
    step,
    durationMs: duration || null,
    metadata: metadata || {},
  })

  // Invalidate related caches
  try {
    await cacheIntegrationService.invalidateByTags(["analytics"])
  } catch (cacheError) {
    console.warn("Cache invalidation error in onboarding/analytics/route.ts:", cacheError)
  }

  return createSuccessResponse({
    data: {
      id: analyticsId,
      eventType,
      step,
      timestamp: now,
    },
  })
})

// GET /api/onboarding/analytics - Get analytics data
export const GET = withErrorHandling(async (request: NextRequest) => {
  const user = await currentUser()
  if (!user) {
    return createErrorResponse("Unauthorized", HTTP_STATUS.UNAUTHORIZED)
  }

  const { searchParams } = new URL(request.url)
  const eventType = searchParams.get("eventType") as OnboardingAnalyticsEvent | null
  const step = searchParams.get("step") as OnboardingStep | null
  const sessionId = searchParams.get("sessionId")
  const startDate = searchParams.get("startDate")
  const endDate = searchParams.get("endDate")
  const limit = parseInt(searchParams.get("limit") || "50")
  const offset = parseInt(searchParams.get("offset") || "0")

  // Build where conditions
  const whereConditions = [eq(onboardingAnalytics.userId, user.id)]

  if (eventType) {
    whereConditions.push(eq(onboardingAnalytics.eventType, eventType))
  }

  if (step) {
    whereConditions.push(eq(onboardingAnalytics.step, step))
  }

  if (sessionId) {
    whereConditions.push(eq(onboardingAnalytics.sessionId, sessionId))
  }

  // Query analytics data
  const analyticsData = await db
    .select()
    .from(onboardingAnalytics)
    .where(and(...whereConditions))
    .orderBy(desc(onboardingAnalytics.createdAt))
    .limit(limit)
    .offset(offset)

  // Parse metadata for each record
  const parsedData = analyticsData.map((record) => ({
    ...record,
    metadata: typeof record.metadata === "string" ? JSON.parse(record.metadata) : record.metadata,
  }))

  return createSuccessResponse({
    data: parsedData,
    pagination: {
      limit,
      offset,
      total: parsedData.length,
    },
  })
})
