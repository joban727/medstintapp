import { type NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "../../../../lib/auth-clerk"
import { completeOnboardingAtomic } from "../../../../lib/onboarding-verification"
import { cacheIntegrationService } from '@/lib/cache-integration'


export async function POST(_request: NextRequest) {
  try {
    // Get current user information
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Use atomic completion function to prevent race conditions
    const updatedUser = await completeOnboardingAtomic(currentUser.id, currentUser.role, {})

    return NextResponse.json({
      success: true,
      message: "Onboarding completed successfully",
      user: updatedUser,
      role: updatedUser.role,
    })
  } catch (error) {
    console.error("Error completing onboarding:", error)

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes("Unauthorized")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
      if (error.message.includes("not found")) {
        return NextResponse.json({ error: "User not found" }, { status: 404 })
      }
      if (error.message.includes("requirements")) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      if (error.message.includes("already completed")) {
        return NextResponse.json({ error: error.message }, { status: 409 })
      }
    }

    
    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateUserCache()
    } catch (cacheError) {
      console.warn('Cache invalidation error in user/onboarding-complete/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Failed to complete onboarding" }, { status: 500 })
  }
}
