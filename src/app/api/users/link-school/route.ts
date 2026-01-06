import { currentUser } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { db } from "../../../../database/connection-pool"
import { users } from "../../../../database/schema"
import { cacheIntegrationService } from "@/lib/cache-integration"
import type { UserRole } from "@/types"
import {
  createSuccessResponse,
  createErrorResponse,
  HTTP_STATUS,
  ERROR_MESSAGES,
  withErrorHandling,
} from "../../../../lib/api-response"

export const DELETE = withErrorHandling(async (request: NextRequest) => {
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

  // Only super admins can unlink users from schools
  if (!currentDbUser || currentDbUser.role !== ("SUPER_ADMIN" as UserRole as UserRole)) {
    return createErrorResponse("Insufficient permissions", HTTP_STATUS.FORBIDDEN)
  }

  const { searchParams } = new URL(request.url)
  const userId = searchParams.get("userId")

  if (!userId) {
    return createErrorResponse("User ID is required", HTTP_STATUS.BAD_REQUEST)
  }

  // Update user to unlink from school
  await db
    .update(users)
    .set({
      schoolId: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))

  // Invalidate related caches
  try {
    await cacheIntegrationService.invalidateByTags(["user"])
  } catch (cacheError) {
    console.warn("Cache invalidation error in users/link-school/route.ts:", cacheError)
  }

  return createSuccessResponse({ userId }, "User successfully unlinked from school")
})
