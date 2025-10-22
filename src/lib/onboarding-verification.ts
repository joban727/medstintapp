import { currentUser } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { db } from "@/database/connection-pool"
import { users } from "@/database/schema"
import type { UserRole } from "@/types"

/**
 * Enhanced onboarding verification with race condition handling
 * and comprehensive state validation
 */

interface DatabaseUser {
  id: string
  clerkId: string
  email: string
  firstName: string | null
  lastName: string | null
  role: string
  createdAt: Date
  updatedAt: Date
}

interface OnboardingState {
  isCompleted: boolean
  meetsRoleRequirements: boolean
  needsRedirect: boolean
  redirectPath: string
  user: DatabaseUser | null
}

/**
 * Check if user meets role-specific requirements for onboarding completion
 * Note: Since schoolId and programId are not in the users table,
 * we'll consider onboarding complete if user has a valid role
 */
function meetsRoleRequirements(user: DatabaseUser): boolean {
  if (!user || !user.role) return false

  const validRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_PRECEPTOR", "CLINICAL_SUPERVISOR", "STUDENT"]
  return validRoles.includes(user.role)
}

/**
 * Get the appropriate onboarding step based on user state
 */
export function getOnboardingStep(user: DatabaseUser): string {
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
 * Returns the appropriate role-specific dashboard route
 */
function getRoleDashboardRoute(role: UserRole): string {
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
 * Verify onboarding state with efficient single query approach
 */
export async function verifyOnboardingState(): Promise<OnboardingState> {
  const clerkUser = await currentUser()

  if (!clerkUser) {
    // No authenticated user found
    return {
      isCompleted: false,
      meetsRoleRequirements: false,
      needsRedirect: true,
      redirectPath: "/auth/sign-in",
      user: null,
    }
  }

  // Checking user authentication

  // Get user from database with single attempt (no retry to prevent loops)
  let user: DatabaseUser | null = null
  try {
    const [dbUser] = await db
      .select({
        id: users.id,
        clerkId: users.clerkId,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.clerkId, clerkUser.id))
      .limit(1)
    user = dbUser
  } catch (_error) {
    // Database error during verification
  }

  if (!user) {
    // User not found in database, redirecting
    return {
      isCompleted: false,
      meetsRoleRequirements: false,
      needsRedirect: true,
      redirectPath: "/onboarding/user-type",
      user: null,
    }
  }

  // User found in database

  const roleRequirementsMet = meetsRoleRequirements(user)
  const onboardingCompleted = roleRequirementsMet

  // If onboarding is not completed, determine next step
  if (!onboardingCompleted) {
    // Onboarding incomplete, redirecting
    return {
      isCompleted: false,
      meetsRoleRequirements: roleRequirementsMet,
      needsRedirect: true,
      redirectPath: getOnboardingStep(user),
      user,
    }
  }

  // Onboarding is completed
  // Onboarding completed successfully
  return {
    isCompleted: true,
    meetsRoleRequirements: true,
    needsRedirect: false,
    redirectPath: user.role ? getRoleDashboardRoute(user.role as UserRole) : "/dashboard",
    user,
  }
}

/**
 * Enhanced onboarding guard for pages that should redirect completed users
 * Use this in onboarding pages to prevent re-entry
 * Returns state without redirecting - let the calling page handle redirects
 */
export async function requireIncompleteOnboarding() {
  const state = await verifyOnboardingState()

  // Return state without redirecting - let the calling page handle redirects
  // This prevents NEXT_REDIRECT errors from nested redirect calls
  return state
}

/**
 * Enhanced function to require completed onboarding with proper error handling
 * Returns user data if onboarding is completed, throws error otherwise
 */
export async function requireCompletedOnboarding() {
  const state = await verifyOnboardingState()

  if (!state.user) {
    // No user found during verification
    throw new Error("User not authenticated")
  }

  if (!state.isCompleted) {
    // Onboarding incomplete, redirect required
    throw new Error(`Onboarding incomplete: ${state.redirectPath}`)
  }

  // Onboarding verification completed
  return state.user
}

/**
 * Check onboarding status with race condition handling
 * Returns updated status after a brief delay and re-check
 */
export async function checkOnboardingStatusWithRetry(userId: string): Promise<boolean> {
  try {
    // First check
    const [user] = await db
      .select({
        id: users.id,
        clerkId: users.clerkId,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.clerkId, userId))
      .limit(1)

    if (!user) return false

    const roleRequirementsMet = meetsRoleRequirements(user)

    if (roleRequirementsMet) {
      return true
    }

    // If not completed, wait and check again (handles race conditions)
    await new Promise((resolve) => setTimeout(resolve, 500))

    const [updatedUser] = await db
      .select({
        id: users.id,
        clerkId: users.clerkId,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.clerkId, userId))
      .limit(1)

    if (!updatedUser) return false

    const updatedRoleRequirementsMet = meetsRoleRequirements(updatedUser)
    return updatedRoleRequirementsMet
  } catch (error) {
    console.error("Error checking onboarding status:", error)
    return false
  }
}

export async function completeOnboardingAtomic(
  userId: string,
  updates: Partial<DatabaseUser>
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate that required fields are provided
    if (!updates.role) {
      return { success: false, error: "Role is required to complete onboarding" }
    }

    // Atomic update with validation
    const result = await db
      .update(users)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(users.clerkId, userId))
      .returning()

    if (result.length === 0) {
      return { success: false, error: "User not found or update failed" }
    }

    // Verify the update was successful
    const updatedUser = result[0]
    const roleRequirementsMet = meetsRoleRequirements(updatedUser)

    if (!roleRequirementsMet) {
      return {
        success: false,
        error: "Onboarding completion validation failed",
      }
    }

    return { success: true }
  } catch (error) {
    console.error("Error completing onboarding:", error)
    return {
      success: false,
      error: "Database error during onboarding completion",
    }
  }
}
