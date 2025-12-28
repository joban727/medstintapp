import { currentUser } from "@clerk/nextjs/server"
import { eq, inArray } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { db } from "../../../../../database/connection-pool"
import { users } from "../../../../../database/schema"
import { cacheIntegrationService } from "@/lib/cache-integration"
import type { UserRole } from "@/types"
import {
  createSuccessResponse,
  createErrorResponse,
  HTTP_STATUS,
  ERROR_MESSAGES,
  withErrorHandling,
} from "../../../../../lib/api-response"

export const PUT = withErrorHandling(async (request: NextRequest) => {
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

  // Only super admins can link users to schools
  if (!currentDbUser || currentDbUser.role !== ("SUPER_ADMIN" as UserRole as UserRole)) {
    return createErrorResponse("Insufficient permissions", HTTP_STATUS.FORBIDDEN)
  }

  const body = await request.json()
  const { userIds, schoolId } = body

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    return createErrorResponse("User IDs are required", HTTP_STATUS.BAD_REQUEST)
  }

  if (!schoolId) {
    return createErrorResponse("School ID is required", HTTP_STATUS.BAD_REQUEST)
  }

  // Update users to link them to the school
  await db
    .update(users)
    .set({
      schoolId,
      updatedAt: new Date(),
    })
    .where(inArray(users.id, userIds))

  // Invalidate related caches
  try {
    await cacheIntegrationService.invalidateByTags(['user'])
  } catch (cacheError) {
    console.warn("Cache invalidation error in users/link-school/bulk/route.ts:", cacheError)
  }

  return createSuccessResponse(
    { userIds, schoolId, count: userIds.length },
    `Successfully linked ${userIds.length} users to school`
  )
})

