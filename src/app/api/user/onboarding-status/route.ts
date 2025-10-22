import { NextResponse } from "next/server"
import { cacheIntegrationService } from '@/lib/cache-integration'

import {
  getCurrentUser,
  getRoleDashboardRoute,
  hasCompletedOnboarding,
} from "../../../../lib/auth-clerk"

export async function GET() {
  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      'api:user/onboarding-status/route.ts',
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
    console.warn('Cache error in user/onboarding-status/route.ts:', cacheError)
    // Continue with original logic if cache fails
  }
  
  async function executeOriginalLogic() {

  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const onboardingCompleted = await hasCompletedOnboarding()
    const dashboardRoute = getRoleDashboardRoute(user.role)

    return NextResponse.json({
      onboardingCompleted,
      role: user.role,
      dashboardRoute,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        schoolId: "schoolId" in user ? user.schoolId : null,
        programId: "programId" in user ? user.programId : null,
        studentId: "studentId" in user ? user.studentId : null,
      },
    })
  } catch (error) {
    console.error("Error checking onboarding status:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }

  }
}
