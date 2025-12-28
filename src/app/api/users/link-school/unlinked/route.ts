import { currentUser } from "@clerk/nextjs/server"
import { eq, isNull } from "drizzle-orm"
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

export const GET = withErrorHandling(async (_request: NextRequest) => {
  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      "api:users/link-school/unlinked/route.ts",
      async () => {
        // Original function logic will be wrapped here
        return await executeOriginalLogic()
      },
      300 // 5 minutes TTL
    )

    if (cached) {
      return cached
    }
  } catch (cacheError) {
    console.warn("Cache error in users/link-school/unlinked/route.ts:", cacheError)
    // Continue with original logic if cache fails
  }

  async function executeOriginalLogic() {
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

    // Only super admins can view unlinked users
    if (!currentDbUser || currentDbUser.role !== ("SUPER_ADMIN" as UserRole as UserRole)) {
      return createErrorResponse("Insufficient permissions", HTTP_STATUS.FORBIDDEN)
    }

    const unlinkedUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(isNull(users.schoolId))
      .orderBy(users.createdAt)

    return createSuccessResponse({ unlinkedUsers })
  }

  return await executeOriginalLogic()
})

