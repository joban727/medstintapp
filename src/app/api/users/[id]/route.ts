import { currentUser } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { db } from "../../../../database/connection-pool"
import { users, schools } from "../../../../database/schema"
import { cacheIntegrationService } from "@/lib/cache-integration"
import type { UserRole } from "@/types"
import {
  createSuccessResponse,
  createErrorResponse,
  HTTP_STATUS,
  ERROR_MESSAGES,
  withErrorHandling,
} from "../../../../lib/api-response"

export const DELETE = withErrorHandling(
  async (_request: NextRequest, { params }: { params: { id: string } }) => {
    const clerkUser = await currentUser()

    if (!clerkUser) {
      return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
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
    if (!currentDbUser || currentDbUser.role !== ("SUPER_ADMIN" as UserRole as UserRole)) {
      return createErrorResponse("Insufficient permissions", HTTP_STATUS.FORBIDDEN)
    }

    const userIdToDelete = params.id

    if (!userIdToDelete) {
      return createErrorResponse("User ID is required", HTTP_STATUS.BAD_REQUEST)
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
      return createErrorResponse("User not found", HTTP_STATUS.NOT_FOUND)
    }

    if (!userToDelete.isActive) {
      return createErrorResponse("User is already deleted", HTTP_STATUS.BAD_REQUEST)
    }

    // Prevent super admin from deleting themselves
    if (userIdToDelete === clerkUser.id) {
      return createErrorResponse("Cannot delete your own account", HTTP_STATUS.BAD_REQUEST)
    }

    // Start transaction for cascade deletion
    await db.transaction(async (tx) => {
      // If the user is a school admin, soft delete all associated schools
      if (userToDelete.role === ("SCHOOL_ADMIN" as UserRole as UserRole) && userToDelete.schoolId) {
        await tx
          .update(schools)
          .set({ isActive: false })
          .where(eq(schools.id, userToDelete.schoolId))
      }

      // Also soft delete any schools where this user is the admin
      await tx
        .update(schools)
        .set({ isActive: false })
        .where(eq(schools.adminId, userIdToDelete))

      // Soft delete the user
      await tx.update(users).set({ isActive: false }).where(eq(users.id, userIdToDelete))
    })

    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateByTags(['user'])
    } catch (cacheError) {
      console.warn("Cache invalidation error in users/[id]/route.ts:", cacheError)
    }

    return createSuccessResponse(
      { userId: userIdToDelete },
      "User and associated schools have been successfully deleted"
    )
  }
)
