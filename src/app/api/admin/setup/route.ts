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
import { withCSRF } from "@/lib/csrf-middleware"
import { logger } from "@/lib/logger"

async function promoteToSuperAdmin(userId: string) {
  await db
    .update(users)
    .set({ role: "SUPER_ADMIN" as UserRole })
    .where(eq(users.id, userId))
}

import { adminApiLimiter } from "@/lib/rate-limiter"

export const POST = withCSRF(
  withErrorHandling(async (req: NextRequest) => {
    // Rate limiting check
    const limitResult = await adminApiLimiter.checkLimit(req)
    if (!limitResult.allowed) {
      return createErrorResponse("Too many requests", HTTP_STATUS.TOO_MANY_REQUESTS)
    }

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
      logger.warn({ cacheError }, "Cache invalidation error in admin/setup/route.ts")
    }

    return createSuccessResponse({ message: "Super admin setup completed successfully" })
  })
)
