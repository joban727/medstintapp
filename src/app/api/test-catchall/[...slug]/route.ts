import { type NextRequest, NextResponse } from "next/server"
import { cacheIntegrationService } from '@/lib/cache-integration'


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      'api:test-catchall/[...slug]/route.ts',
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
    console.warn('Cache error in test-catchall/[...slug]/route.ts:', cacheError)
    // Continue with original logic if cache fails
  }
  
  async function executeOriginalLogic() {

  const resolvedParams = await params
  return NextResponse.json({
    message: "Catch-all test route working",
    url: request.url,
    pathname: request.nextUrl.pathname,
    slug: resolvedParams.slug,
  })

  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const resolvedParams = await params
  
    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateAllCache()
    } catch (cacheError) {
      console.warn('Cache invalidation error in test-catchall/[...slug]/route.ts:', cacheError)
    }
    
    return NextResponse.json({
    message: "Catch-all POST test route working",
    url: request.url,
    pathname: request.nextUrl.pathname,
    slug: resolvedParams.slug,
  })
}
