import { auth } from "@clerk/nextjs/server"
import { and, eq } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/database/connection-pool"
import { onboardingSessions } from "@/database/schema"
import { cacheIntegrationService } from '@/lib/cache-integration'


export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { sessionId } = await request.json()

    if (!sessionId) {
      return NextResponse.json({ success: false, error: "Session ID is required" }, { status: 400 })
    }

    // Find the session
    const existingSession = await db
      .select()
      .from(onboardingSessions)
      .where(
        and(
          eq(onboardingSessions.id, sessionId),
          eq(onboardingSessions.userId, userId),
          eq(onboardingSessions.status, "active")
        )
      )
      .limit(1)

    if (existingSession.length === 0) {
      return NextResponse.json(
        { success: false, error: "Session not found or already completed" },
        { status: 404 }
      )
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

    return NextResponse.json({
      success: true,
      message: "Session extended successfully",
      expiresAt: newExpiresAt.toISOString(),
    })
  } catch (error) {
    console.error("Session extend error:", error)
    
    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateAllCache()
    } catch (cacheError) {
      console.warn('Cache invalidation error in onboarding/session/extend/route.ts:', cacheError)
    }
    
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
