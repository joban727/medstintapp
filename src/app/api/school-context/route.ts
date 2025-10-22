import { NextResponse } from "next/server"
import { getSchoolContext } from "../../../lib/school-utils"
import { cacheIntegrationService } from '@/lib/cache-integration'


export async function GET() {
  async function executeOriginalLogic() {
    try {
      const schoolContext = await getSchoolContext()
      return NextResponse.json(schoolContext)
    } catch (error) {
      console.error("Error fetching school context:", error)
      return NextResponse.json({ error: "Failed to fetch school context" }, { status: 500 })
    }
  }

  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      'api:school-context/route.ts',
      executeOriginalLogic,
      300 // 5 minutes TTL
    )
    
    if (cached) {
      return cached
    }
  } catch (cacheError) {
    console.warn('Cache error in school-context/route.ts:', cacheError)
    // Continue with original logic if cache fails
  }
  
  // If cache fails or returns null, execute original logic
  return await executeOriginalLogic()
}
