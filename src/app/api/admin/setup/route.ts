import { eq } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { db } from "../../../../database/connection-pool"
import { users } from "../../../../database/schema"
import { getCurrentUser } from "../../../../lib/auth-clerk"
import { cacheIntegrationService } from '@/lib/cache-integration'


async function promoteToSuperAdmin(userId: string) {
  await db.update(users).set({ role: "SUPER_ADMIN" }).where(eq(users.id, userId))
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json()

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    // Check if any super admin already exists
    const existingSuperAdmin = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "SUPER_ADMIN"))
      .limit(1)

    if (existingSuperAdmin.length > 0) {
      return NextResponse.json({ error: "Super admin already exists" }, { status: 403 })
    }

    // Get current user to verify they exist
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.id !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Promote user to super admin
    await promoteToSuperAdmin(userId)

    return NextResponse.json(
      { message: "Super admin setup completed successfully" },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error setting up super admin:", error)
    
    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateAllCache()
    } catch (cacheError) {
      console.warn('Cache invalidation error in admin/setup/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
