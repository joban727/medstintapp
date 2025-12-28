import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
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

export const GET = withErrorHandling(async () => {
  async function executeOriginalLogic() {
    const currentUser = await getCurrentUser()

    if (!currentUser) {
      return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
    }

    // Check if any super admin already exists
    const existingSuperAdmin = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "SUPER_ADMIN"))
      .limit(1)

    const canSetupAdmin = existingSuperAdmin.length === 0

    return createSuccessResponse({
      canSetupAdmin,
      currentUserRole: currentUser.role,
      hasSuperAdmin: !canSetupAdmin,
    })
  }

  // Try to get cached response
  const cached = await cacheIntegrationService.cachedApiResponse(
    "api:admin/setup-status/route.ts",
    async () => {
      return await executeOriginalLogic()
    },
    300 // 5 minutes TTL
  )

  if (cached) {
    return cached
  }

  // Fallback to original logic if cache miss
  return await executeOriginalLogic()
})

