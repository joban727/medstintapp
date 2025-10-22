import { currentUser } from "@clerk/nextjs/server"
import { eq, inArray } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { db } from "../../../../../database/connection-pool"
import { users } from "../../../../../database/schema"
import { cacheIntegrationService } from '@/lib/cache-integration'


export async function PUT(request: NextRequest) {
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

    // Only super admins can link users to schools
    if (!currentDbUser || currentDbUser.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const { userIds, schoolId } = body

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: "User IDs are required" }, { status: 400 })
    }

    if (!schoolId) {
      return NextResponse.json({ error: "School ID is required" }, { status: 400 })
    }

    // Update users to link them to the school
    await db
      .update(users)
      .set({
        schoolId,
        updatedAt: new Date(),
      })
      .where(inArray(users.id, userIds))

    return NextResponse.json({
      success: true,
      message: `Successfully linked ${userIds.length} users to school`,
    })
  } catch (error) {
    console.error("Error linking users to school:", error)
    
    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateUserCache()
    } catch (cacheError) {
      console.warn('Cache invalidation error in users/link-school/bulk/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
