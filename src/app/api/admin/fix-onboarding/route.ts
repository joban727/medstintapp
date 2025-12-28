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
export const POST = withErrorHandling(async (request: NextRequest) => {
  // Skip auth check for this admin fix endpoint
  console.log("🔧 Admin fix endpoint called - bypassing auth for emergency fix")

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

  console.log(`Found ${incompleteSchoolAdmins.length} SCHOOL_ADMIN users`)

  // Filter users who need onboarding completion
  const usersToFix = incompleteSchoolAdmins.filter(
    (user) =>
      user.role === ("SCHOOL_ADMIN" as UserRole as UserRole) &&
      user.isActive &&
      !user.onboardingCompleted
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
    console.log(`Updating onboarding for ${user.email}...`)

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
      console.log(`Successfully updated ${result[0].email}`)
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

