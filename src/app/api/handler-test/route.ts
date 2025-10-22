import { type NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "../../../lib/auth-clerk"
import { cacheIntegrationService } from '@/lib/cache-integration'


export async function GET(_request: NextRequest) {
  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      'api:handler-test/route.ts',
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
    console.warn('Cache error in handler-test/route.ts:', cacheError)
    // Continue with original logic if cache fails
  }
  
  async function executeOriginalLogic() {

  try {
    const user = await getCurrentUser()

    return NextResponse.json({
      message: "Clerk handler test successful",
      userExists: !!user,
      userId: user?.id || null,
      userRole: user?.role || null,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Handler test error:", error)
    return NextResponse.json(
      {
        error: "Handler test failed",
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    )
  }

  }
}
