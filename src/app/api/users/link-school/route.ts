import { currentUser } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { db } from "../../../../database/connection-pool"
import { users } from "../../../../database/schema"
import { cacheIntegrationService } from '@/lib/cache-integration'


export async function DELETE(request: NextRequest) {
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

    // Only super admins can unlink users from schools
    if (!currentDbUser || currentDbUser.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    // Update user to unlink from school
    await db
      .update(users)
      .set({
        schoolId: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))

    return NextResponse.json({
      success: true,
      message: "User successfully unlinked from school",
    })
  } catch (error) {
    console.error("Error unlinking user from school:", error)
    
    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateUserCache()
    } catch (cacheError) {
      console.warn('Cache invalidation error in users/link-school/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
