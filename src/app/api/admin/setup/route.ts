import { eq } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { db } from "../../../../database/connection-pool"
import { users } from "../../../../database/schema"
import { getCurrentUser } from "../../../../lib/auth-clerk"
import { cacheIntegrationService } from "@/lib/cache-integration"
import type { UserRole } from "@/types"
import {
  createSuccessResponse,
  createErrorResponse,
  HTTP_STATUS,
  ERROR_MESSAGES,
  withErrorHandling,
} from "@/lib/api-response"

async function promoteToSuperAdmin(userId: string) {
  await db
    .update(users)
    .set({ role: "SUPER_ADMIN" as UserRole })
    .where(eq(users.id, userId))
}

export const POST = withErrorHandling(async (req: NextRequest) => {
  const { userId } = await req.json()

  if (!userId) {
    return createErrorResponse("User ID is required", HTTP_STATUS.BAD_REQUEST)
  }

  // Check if any super admin already exists
  const existingSuperAdmin = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "SUPER_ADMIN"))
    .limit(1)

  if (existingSuperAdmin.length > 0) {
    return createErrorResponse("Super admin already exists", HTTP_STATUS.FORBIDDEN)
  }

  // Get current user to verify they exist
  const currentUser = await getCurrentUser()
  if (!currentUser || currentUser.id !== userId) {
    return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
  }

  // Promote user to super admin
  await promoteToSuperAdmin(userId)

  // Invalidate related caches
  try {
    await cacheIntegrationService.clear()
  } catch (cacheError) {
    console.warn("Cache invalidation error in admin/setup/route.ts:", cacheError)
  }

  return createSuccessResponse({ message: "Super admin setup completed successfully" })
})

