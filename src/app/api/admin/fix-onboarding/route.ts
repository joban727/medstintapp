import { NextRequest, NextResponse } from "next/server"
import { db } from "@/database/connection-pool"
import { users } from "@/database/schema"
import { eq } from "drizzle-orm"
import { getCurrentUser } from "@/lib/auth-clerk"
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

import { adminApiLimiter } from "@/lib/rate-limiter"

export const POST = withCSRF(
  withErrorHandling(async (request: NextRequest) => {
    // Rate limiting check
    const limitResult = await adminApiLimiter.checkLimit(request)
    if (!limitResult.allowed) {
      return createErrorResponse("Too many requests", HTTP_STATUS.TOO_MANY_REQUESTS)
    }

    // Verify authentication and SUPER_ADMIN role
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
    }

    if (currentUser.role !== "SUPER_ADMIN") {
      logger.warn(
        { userId: currentUser.id, role: currentUser.role },
        "Unauthorized access attempt to admin fix-onboarding"
      )
      return createErrorResponse(ERROR_MESSAGES.FORBIDDEN, HTTP_STATUS.FORBIDDEN)
    }

    logger.info({ adminId: currentUser.id }, "Admin fix-onboarding endpoint called")

    // Find all SCHOOL_ADMIN users with incomplete onboarding
    const incompleteSchoolAdmins = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        schoolId: users.schoolId,
        onboardingCompleted: users.onboardingCompleted,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.role, "SCHOOL_ADMIN"))

    logger.info({ count: incompleteSchoolAdmins.length }, "Found SCHOOL_ADMIN users")

    // Filter users who need onboarding completion
    const usersToFix = incompleteSchoolAdmins.filter(
      (user) => user.isActive && !user.onboardingCompleted
    )

    if (usersToFix.length === 0) {
      return createSuccessResponse({
        message: "No SCHOOL_ADMIN users need onboarding completion",
        totalSchoolAdmins: incompleteSchoolAdmins.length,
        usersFixed: 0,
        users: incompleteSchoolAdmins,
      })
    }

    // Update each user's onboarding status
    const fixedUsers = []
    for (const user of usersToFix) {
      logger.info({ userEmail: user.email }, "Updating onboarding status")

      const result = await db
        .update(users)
        .set({
          onboardingCompleted: true,
          onboardingCompletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id))
        .returning({
          id: users.id,
          email: users.email,
          onboardingCompleted: users.onboardingCompleted,
          onboardingCompletedAt: users.onboardingCompletedAt,
        })

      if (result.length > 0) {
        fixedUsers.push(result[0])
        logger.info({ userEmail: result[0].email }, "Successfully updated onboarding")
      }
    }

    return createSuccessResponse({
      message: "School admin onboarding fix completed",
      totalSchoolAdmins: incompleteSchoolAdmins.length,
      usersFixed: fixedUsers.length,
      fixedUsers,
      allSchoolAdmins: incompleteSchoolAdmins,
    })
  })
)
