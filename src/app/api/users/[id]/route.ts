import { currentUser } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { db } from "../../../../database/connection-pool"
import { users, schools } from "../../../../database/schema"
import { cacheIntegrationService } from '@/lib/cache-integration'


export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Only super admins can delete users
    if (!currentDbUser || currentDbUser.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const userIdToDelete = params.id

    if (!userIdToDelete) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    // Check if user exists and get their details
    const [userToDelete] = await db
      .select({
        id: users.id,
        role: users.role,
        schoolId: users.schoolId,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.id, userIdToDelete))
      .limit(1)

    if (!userToDelete) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (!userToDelete.isActive) {
      return NextResponse.json({ error: "User is already deleted" }, { status: 400 })
    }

    // Prevent super admin from deleting themselves
    if (userIdToDelete === clerkUser.id) {
      return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 })
    }

    // Start transaction for cascade deletion
    await db.transaction(async (tx) => {
      // If the user is a school admin, soft delete all associated schools
      if (userToDelete.role === "SCHOOL_ADMIN" && userToDelete.schoolId) {
        await tx
          .update(schools)
          .set({ isActive: false })
          .where(eq(schools.id, userToDelete.schoolId))
      }

      // Also soft delete any schools where this user is the primary contact
      await tx
        .update(schools)
        .set({ isActive: false })
        .where(eq(schools.primaryContactId, userIdToDelete))

      // Soft delete the user
      await tx
        .update(users)
        .set({ isActive: false })
        .where(eq(users.id, userIdToDelete))
    })

    return NextResponse.json({
      success: true,
      message: "User and associated schools have been successfully deleted",
    })
  } catch (error) {
    console.error("Error deleting user:", error)
    
    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateUserCache()
    } catch (cacheError) {
      console.warn('Cache invalidation error in users/[id]/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}