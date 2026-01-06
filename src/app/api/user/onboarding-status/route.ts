import { NextResponse } from "next/server"
import { cacheIntegrationService } from "@/lib/cache-integration"
import type { UserRole } from "@/types"

// Role validation utilities
const hasRole = (userRole: UserRole, allowedRoles: UserRole[]): boolean => {
  return allowedRoles.includes(userRole)
}

const isAdmin = (userRole: UserRole): boolean => {
  return hasRole(userRole, ["ADMIN" as UserRole, "SUPER_ADMIN" as UserRole])
}

const isSchoolAdmin = (userRole: UserRole): boolean => {
  return hasRole(userRole, [
    "SCHOOL_ADMIN" as UserRole,
    "ADMIN" as UserRole,
    "SUPER_ADMIN" as UserRole,
  ])
}
import {
  createSuccessResponse,
  createErrorResponse,
  HTTP_STATUS,
  ERROR_MESSAGES,
  withErrorHandling,
} from "../../../../lib/api-response"

import {
  getCurrentUser,
  getRoleDashboardRoute,
  hasCompletedOnboarding,
} from "../../../../lib/auth-clerk"

export const GET = withErrorHandling(async () => {
  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      "api:user/onboarding-status/route.ts",
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
    console.warn("Cache error in user/onboarding-status/route.ts:", cacheError)
    // Continue with original logic if cache fails
  }

  async function executeOriginalLogic() {
    const user = await getCurrentUser()

    if (!user) {
      return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
    }

    const onboardingCompleted = await hasCompletedOnboarding()
    const dashboardRoute = getRoleDashboardRoute(user.role)

    return createSuccessResponse({
      onboardingCompleted,
      role: user.role,
      dashboardRoute,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        schoolId: "schoolId" in user ? user.schoolId : null,
        programId: "programId" in user ? user.programId : null,
        studentId: "studentId" in user ? user.studentId : null,
      },
    })
  }

  return await executeOriginalLogic()
})
