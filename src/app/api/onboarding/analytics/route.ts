import { type NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '@/database/db'
import { onboardingAnalytics } from '@/database/schema'
import type { OnboardingAnalyticsEvent, OnboardingStep } from '@/types/onboarding'
import { cacheIntegrationService } from '@/lib/cache-integration'


// POST /api/onboarding/analytics - Track analytics event
export async function POST(request: NextRequest) {
  try {
    const user = await currentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { 
      eventType, 
      step, 
      sessionId, 
      metadata = {}, 
      duration
    } = body

    // Validate required fields
    if (!eventType || !step) {
      return NextResponse.json(
        { success: false, error: 'Event type and step are required' },
        { status: 400 }
      )
    }

    // Validate event type
    const validEventTypes: OnboardingAnalyticsEvent[] = [
      'step_started',
      'step_completed', 
      'step_skipped',
      'form_validation_error',
      'api_error',
      'session_abandoned',
      'onboarding_completed'
    ]

    if (!validEventTypes.includes(eventType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid event type' },
        { status: 400 }
      )
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
      metadata: metadata || {}
    })

    return NextResponse.json({
      success: true,
      data: {
        id: analyticsId,
        eventType,
        step,
        timestamp: now
      }
    })
  } catch (error) {
    console.error('Analytics tracking error:', error)
    
    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateAnalyticsCache()
    } catch (cacheError) {
      console.warn('Cache invalidation error in onboarding/analytics/route.ts:', cacheError)
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to track analytics event' },
      { status: 500 }
    )
  }
}

// GET /api/onboarding/analytics - Get analytics data
export async function GET(request: NextRequest) {
  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      'api:onboarding/analytics/route.ts',
      async () => {
        // Original function logic will be wrapped here
        return await executeOriginalLogic()
      },
      300 // 5 minutes TTL
    )
    
    if (cached) {
      return cached
    }
  } catch (cacheError) {
    console.warn('Cache error in onboarding/analytics/route.ts:', cacheError)
    // Continue with original logic if cache fails
  }
  
  async function executeOriginalLogic() {

  try {
    const user = await currentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const eventType = searchParams.get('eventType')
    const step = searchParams.get('step')
    const limit = Number.parseInt(searchParams.get('limit') || '50')

    // Build where conditions
    const conditions = [eq(onboardingAnalytics.userId, user.id)]
    
    if (sessionId) {
      conditions.push(eq(onboardingAnalytics.sessionId, sessionId))
    }
    
    if (eventType) {
      conditions.push(eq(onboardingAnalytics.eventType, eventType as OnboardingAnalyticsEvent))
    }
    
    if (step) {
      conditions.push(eq(onboardingAnalytics.step, step as OnboardingStep))
    }

    const analytics = await db
      .select()
      .from(onboardingAnalytics)
      .where(and(...conditions))
      .orderBy(desc(onboardingAnalytics.createdAt))
      .limit(Math.min(limit, 100)) // Cap at 100 records

    // Return analytics data (metadata is already parsed as JSON)
    const parsedAnalytics = analytics.map(record => ({
      ...record,
      metadata: record.metadata || {}
    }))

    return NextResponse.json({
      success: true,
      data: parsedAnalytics,
      count: analytics.length
    })
  } catch (error) {
    console.error('Analytics retrieval error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve analytics' },
      { status: 500 }
    )
  }

  }
}