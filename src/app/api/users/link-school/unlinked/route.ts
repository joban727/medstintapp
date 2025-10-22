import { currentUser } from "@clerk/nextjs/server"
import { eq, isNull } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { db } from "../../../../../database/connection-pool"
import { users } from "../../../../../database/schema"
import { cacheIntegrationService } from '@/lib/cache-integration'


export async function GET(_request: NextRequest) {
  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      'api:users/link-school/unlinked/route.ts',
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
    console.warn('Cache error in users/link-school/unlinked/route.ts:', cacheError)
    // Continue with original logic if cache fails
  }
  
  async function executeOriginalLogic() {

  try {
    const clerkUser = await currentUser()

    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get current user to check permissions
    const [currentDbUser] = await db
      .select({
        role: users.role,
      })
      .from(users)
      .where(eq(users.id, clerkUser.id))
      .limit(1)

    // Only super admins can view unlinked users
    if (!currentDbUser || currentDbUser.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const unlinkedUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(isNull(users.schoolId))
      .orderBy(users.createdAt)

    return NextResponse.json({
      success: true,
      unlinkedUsers,
    })
  } catch (error) {
    console.error("Error fetching unlinked users:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }

  }
}
