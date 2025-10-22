import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { db } from "../../../../database/connection-pool"
import { users } from "../../../../database/schema"
import { getCurrentUser } from "../../../../lib/auth-clerk"
import { cacheIntegrationService } from '@/lib/cache-integration'


export async function GET() {
  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      'api:admin/setup-status/route.ts',
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
    console.warn('Cache error in admin/setup-status/route.ts:', cacheError)
    // Continue with original logic if cache fails
  }
  
  async function executeOriginalLogic() {

  try {
    const currentUser = await getCurrentUser()

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if any super admin already exists
    const existingSuperAdmin = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "SUPER_ADMIN"))
      .limit(1)

    const canSetupAdmin = existingSuperAdmin.length === 0

    return NextResponse.json({
      canSetupAdmin,
      currentUserRole: currentUser.role,
      hasSuperAdmin: !canSetupAdmin,
    })
  } catch (error) {
    console.error("Error checking admin setup status:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }

  }
}
