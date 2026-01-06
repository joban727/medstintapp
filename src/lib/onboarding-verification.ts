/**
 * Onboarding Verification Utilities
 *
 * NOTE: Most onboarding redirect logic is now handled by middleware.
 * This file contains utility functions still needed by onboarding pages.
 */

import { eq } from "drizzle-orm"
import { db } from "@/database/connection-pool"
import { users } from "@/database/schema"
import type { UserRole } from "@/types"
import { invalidateUserCache } from "@/lib/auth-utils"

/**
 * Get the appropriate onboarding step based on user role
 * Used by onboarding pages to determine the next step
 */
export function getOnboardingStep(user: { role?: string | null }): string {
  if (!user?.role) {
    return "/onboarding/user-type"
  }

  switch (user.role) {
    case "STUDENT":
      return "/onboarding/student"
    case "SCHOOL_ADMIN":
    case "CLINICAL_SUPERVISOR":
    case "CLINICAL_PRECEPTOR":
      return "/onboarding/school"
    case "SUPER_ADMIN":
      return "/onboarding/super-admin"
    default:
      return "/onboarding/user-type"
  }
}

/**
 * Get role-based dashboard route
 */
export function getRoleDashboardRoute(role: UserRole): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "/dashboard/admin"
    case "SCHOOL_ADMIN":
      return "/dashboard/school-admin"
    case "CLINICAL_SUPERVISOR":
      return "/dashboard/clinical-supervisor"
    case "CLINICAL_PRECEPTOR":
      return "/dashboard/clinical-preceptor"
    case "STUDENT":
      return "/dashboard/student"
    default:
      return "/dashboard"
  }
}

/**
 * Complete onboarding atomically with validation
 * Updates user role and marks onboarding as complete
 */
export async function completeOnboardingAtomic(
  clerkId: string,
  updates: { role?: string; name?: string | null }
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate that required fields are provided
    if (!updates.role) {
      return { success: false, error: "Role is required to complete onboarding" }
    }

    // Validate role
    const validRoles = [
      "SUPER_ADMIN",
      "SCHOOL_ADMIN",
      "CLINICAL_PRECEPTOR",
      "CLINICAL_SUPERVISOR",
      "STUDENT",
    ]
    if (!validRoles.includes(updates.role)) {
      return { success: false, error: `Invalid role: ${updates.role}` }
    }

    // Cast role to the expected type
    const roleValue = updates.role as
      | "SUPER_ADMIN"
      | "SCHOOL_ADMIN"
      | "CLINICAL_PRECEPTOR"
      | "CLINICAL_SUPERVISOR"
      | "STUDENT"
      | "SYSTEM"

    // Atomic update
    const result = await db
      .update(users)
      .set({
        role: roleValue,
        name: updates.name,
        onboardingCompleted: true,
        onboardingCompletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, clerkId))
      .returning()

    if (result.length === 0) {
      return { success: false, error: "User not found or update failed" }
    }

    // Invalidate middleware cache so user gets redirected to dashboard immediately
    invalidateUserCache(clerkId)

    return { success: true }
  } catch (error) {
    console.error("Error completing onboarding:", error)
    return {
      success: false,
      error: "Database error during onboarding completion",
    }
  }
}
