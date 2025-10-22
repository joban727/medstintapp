import { currentUser } from "@clerk/nextjs/server"
import { and, eq } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import type { OnboardingStep } from "@/types/onboarding"
import { db } from "../../../../database/db"
import { onboardingSessions } from "../../../../database/schema"
import { cacheIntegrationService } from '@/lib/cache-integration'


// POST /api/onboarding/session - Save or update session
export async function POST(request: NextRequest) {
  try {
    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { sessionId, currentStep, completedSteps, formData } = body

    // Validate required fields
    if (!currentStep) {
      return NextResponse.json(
        { success: false, error: "Current step is required" },
        { status: 400 }
      )
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
        return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 })
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

    return NextResponse.json({
      success: true,
      data: session,
      sessionId: session.id,
    })
  } catch (error) {
    console.error("Session save error:", error)
    
    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateAllCache()
    } catch (cacheError) {
      console.warn('Cache invalidation error in onboarding/session/route.ts:', cacheError)
    }
    
    return NextResponse.json({ success: false, error: "Failed to save session" }, { status: 500 })
  }
}

// GET /api/onboarding/session - Get active session for current user
export async function GET(_request: NextRequest) {
  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      'api:onboarding/session/route.ts',
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
    console.warn('Cache error in onboarding/session/route.ts:', cacheError)
    // Continue with original logic if cache fails
  }
  
  async function executeOriginalLogic() {

  try {
    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    // Get the most recent session
    const sessions = await db
      .select()
      .from(onboardingSessions)
      .where(eq(onboardingSessions.userId, user.id))
      .orderBy(onboardingSessions.updatedAt)
      .limit(1)

    if (sessions.length === 0) {
      return NextResponse.json(
        { success: false, error: "No active session found" },
        { status: 404 }
      )
    }

    const session = sessions[0]
    const now = new Date()

    // Check if session is expired
    if (session.expiresAt && new Date(session.expiresAt) < now) {
      return NextResponse.json({ success: false, error: "Session expired" }, { status: 410 })
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

    return NextResponse.json({
      success: true,
      data: sessionData,
    })
  } catch (error) {
    console.error("Session retrieval error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to retrieve session" },
      { status: 500 }
    )
  }

  }
}

// DELETE /api/onboarding/session - Delete/abandon current session
export async function DELETE(request: NextRequest) {
  try {
    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
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

    return NextResponse.json({
      success: true,
      message: "Session abandoned successfully",
    })
  } catch (error) {
    console.error("Session deletion error:", error)
    
    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateAllCache()
    } catch (cacheError) {
      console.warn('Cache invalidation error in onboarding/session/route.ts:', cacheError)
    }
    
    return NextResponse.json(
      { success: false, error: "Failed to abandon session" },
      { status: 500 }
    )
  }
}
