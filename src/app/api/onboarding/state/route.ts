import { type NextRequest, NextResponse } from "next/server"
import { verifyOnboardingState } from "../../../../lib/onboarding-verification"
import { cacheIntegrationService } from '@/lib/cache-integration'


export async function GET(_request: NextRequest) {
  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      'api:onboarding/state/route.ts',
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
    console.warn('Cache error in onboarding/state/route.ts:', cacheError)
    // Continue with original logic if cache fails
  }
  
  async function executeOriginalLogic() {

  try {
    const state = await verifyOnboardingState()
    return NextResponse.json(state)
  } catch (error) {
    console.error("Error verifying onboarding state:", error)
    return NextResponse.json(
      {
        error: "Failed to verify onboarding state",
        isCompleted: false,
        needsRedirect: true,
        redirectPath: "/onboarding/user-type",
      },
      { status: 500 }
    )
  }

  }
}
