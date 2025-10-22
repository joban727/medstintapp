import { type NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "../../../lib/auth-clerk"
import { cacheIntegrationService } from '@/lib/cache-integration'


export async function GET(_request: NextRequest) {
  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      'api:auth-test/route.ts',
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
    console.warn('Cache error in auth-test/route.ts:', cacheError)
    // Continue with original logic if cache fails
  }
  
  async function executeOriginalLogic() {

  try {
    const user = await getCurrentUser()
    return NextResponse.json({
      message: "Clerk auth test route",
      userExists: !!user,
      userId: user?.id || null,
      userEmail: user?.email || null,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to get current user",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }

  }
}
