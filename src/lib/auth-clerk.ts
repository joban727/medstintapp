import { currentUser } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { redirect } from "next/navigation"
import { db } from "@/database/connection-pool"
import { logger } from "./logger"
import { users } from "@/database/schema"
import type { UserRole } from "@/types"
import { invalidateUserCache } from "@/lib/auth-utils"

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
interface UserMetadata {
  role?: string
  schoolId?: string
}

/**
 * Get the current authenticated user from Clerk and database
 * @returns User object with role information or null if not authenticated
 */
export async function getCurrentUser() {
  try {
    // Check if we have valid Clerk keys
    const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
    const secretKey = process.env.CLERK_SECRET_KEY

    if (
      !publishableKey ||
      !secretKey ||
      publishableKey === "pk_test_placeholder" ||
      secretKey === "sk_test_placeholder" ||
      publishableKey.includes("placeholder") ||
      secretKey.includes("placeholder")
    ) {
      return null
    }

    const clerkUser = await currentUser()

    if (!clerkUser || !clerkUser.id) {
      return null
    }

    // In test environment, derive a safe user from Clerk and avoid DB calls
    if (process.env.NODE_ENV === "test") {
      if (!clerkUser || !clerkUser.id) {
        return null
      }

      const metadata = clerkUser.publicMetadata as UserMetadata
      const roleFromMeta = metadata?.role
      const schoolIdFromMeta = metadata?.schoolId
      const validRoles: UserRole[] = [
        "SUPER_ADMIN",
        "SCHOOL_ADMIN",
        "CLINICAL_SUPERVISOR",
        "CLINICAL_PRECEPTOR",
        "STUDENT",
      ]
      const normalizedRole = (roleFromMeta || "STUDENT").toUpperCase() as UserRole
      const safeRole = (
        validRoles.includes(normalizedRole) ? normalizedRole : "STUDENT"
      ) as UserRole

      return {
        id: clerkUser.id,
        email: clerkUser.emailAddresses?.[0]?.emailAddress || `user-${clerkUser.id}@example.com`,
        name: `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() || "User",
        role: safeRole,
        schoolId: schoolIdFromMeta || null,
        programId: null,
        studentId: null,
        onboardingCompleted: false,
        onboardingCompletedAt: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        emailVerified: true,
        image: clerkUser.imageUrl || null,
        avatar: null,
        avatarUrl: clerkUser.imageUrl || null,
        department: null,
        phone: null,
        address: null,
        enrollmentDate: null,
        expectedGraduation: null,
        academicStatus: null,
        gpa: null,
        totalClinicalHours: 0,
        completedRotations: 0,
        stripeCustomerId: null,
      }
    }

    // Get user details from database with comprehensive error handling
    let dbUser = null
    try {
      const userResult = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
          schoolId: users.schoolId,
          programId: users.programId,
          studentId: users.studentId,
          onboardingCompleted: users.onboardingCompleted,
          onboardingCompletedAt: users.onboardingCompletedAt,
          isActive: users.isActive,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
          emailVerified: users.emailVerified,
          image: users.image,
          avatar: users.avatar,
          avatarUrl: users.avatarUrl,
          department: users.department,
          phone: users.phone,
          address: users.address,
          enrollmentDate: users.enrollmentDate,
          expectedGraduation: users.expectedGraduation,
          academicStatus: users.academicStatus,
          gpa: users.gpa,
          totalClinicalHours: users.totalClinicalHours,
          completedRotations: users.completedRotations,
          stripeCustomerId: users.stripeCustomerId,
        })
        .from(users)
        .where(eq(users.id, clerkUser.id))
        .limit(1)

      dbUser = userResult?.[0] || null
    } catch (dbError) {
      logger.error({ error: dbError, userId: clerkUser.id }, "Error in getCurrentUser")
      dbUser = null
    }

    // If user doesn't exist in database, create them with safe defaults
    if (!dbUser) {
      try {
        const newUser = {
          id: clerkUser.id,
          email: clerkUser.emailAddresses?.[0]?.emailAddress || `user-${clerkUser.id}@example.com`,
          name: `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() || "User",
          image: clerkUser.imageUrl || null,
          emailVerified: true,
          role: "STUDENT" as UserRole as UserRole,
          isActive: true,
          onboardingCompleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          schoolId: null,
          programId: null,
          studentId: null,
          onboardingCompletedAt: null,
          avatar: null,
          avatarUrl: clerkUser.imageUrl || null,
          department: null,
          phone: null,
          address: null,
          enrollmentDate: null,
          expectedGraduation: null,
          academicStatus: null,
          gpa: null,
          totalClinicalHours: 0,
          completedRotations: 0,
          stripeCustomerId: null,
        }

        await db.insert(users).values(newUser)
        return newUser
      } catch (insertError) {
        console.error("Error creating new user:", insertError)
        // Return a safe user object even if database insert fails
        return {
          id: clerkUser.id,
          email: clerkUser.emailAddresses?.[0]?.emailAddress || `user-${clerkUser.id}@example.com`,
          name: `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() || "User",
          role: "STUDENT" as UserRole as UserRole,
          schoolId: null,
          programId: null,
          studentId: null,
          onboardingCompleted: false,
          onboardingCompletedAt: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          emailVerified: true,
          image: clerkUser.imageUrl || null,
          avatar: null,
          avatarUrl: clerkUser.imageUrl || null,
          department: null,
          phone: null,
          address: null,
          enrollmentDate: null,
          expectedGraduation: null,
          academicStatus: null,
          gpa: null,
          totalClinicalHours: 0,
          completedRotations: 0,
          stripeCustomerId: null,
        }
      }
    }

    // Validate role before returning user data
    const validRoles: UserRole[] = [
      "SUPER_ADMIN",
      "SCHOOL_ADMIN",
      "CLINICAL_SUPERVISOR",
      "CLINICAL_PRECEPTOR",
      "STUDENT",
    ]
    const userRole = dbUser.role || "STUDENT"

    if (!validRoles.includes(userRole as UserRole)) {
      logger.error({ userRole }, "getCurrentUser: Invalid role detected in database")
      console.error("❌ getCurrentUser: User ID:", dbUser.id)
      console.error("❌ getCurrentUser: Valid roles are:", validRoles)
      // Log this security issue for audit
      console.error(
        "🚨 SECURITY ALERT: User with invalid role detected. Forcing role to STUDENT for safety."
      )

      // Update the user's role in the database to STUDENT for safety
      try {
        await db
          .update(users)
          .set({
            role: "STUDENT" as UserRole,
            updatedAt: new Date(),
          })
          .where(eq(users.id, dbUser.id))
      } catch (updateError) {
        logger.error({ error: updateError }, "Failed to update invalid role")
      }
    }

    // Ensure all required fields are present with safe defaults
    return {
      id: dbUser.id,
      email: dbUser.email || `user-${dbUser.id}@example.com`,
      name: dbUser.name || "User",
      role: validRoles.includes(userRole as UserRole) ? (userRole as UserRole) : "STUDENT",
      schoolId: dbUser.schoolId || null,
      programId: dbUser.programId || null,
      studentId: dbUser.studentId || null,
      onboardingCompleted: dbUser.onboardingCompleted || false,
      onboardingCompletedAt: dbUser.onboardingCompletedAt || null,
      isActive: dbUser.isActive !== undefined ? dbUser.isActive : true,
      createdAt: dbUser.createdAt || new Date(),
      updatedAt: dbUser.updatedAt || new Date(),
      emailVerified: dbUser.emailVerified || false,
      image: dbUser.image || null,
      avatar: dbUser.avatar || null,
      avatarUrl: dbUser.avatarUrl || null,
      department: dbUser.department || null,
      phone: dbUser.phone || null,
      address: dbUser.address || null,
      enrollmentDate: dbUser.enrollmentDate || null,
      expectedGraduation: dbUser.expectedGraduation || null,
      academicStatus: dbUser.academicStatus || null,
      gpa: dbUser.gpa || null,
      totalClinicalHours: dbUser.totalClinicalHours || 0,
      completedRotations: dbUser.completedRotations || 0,
      stripeCustomerId: dbUser.stripeCustomerId || null,
    }
  } catch (error) {
    console.error("Critical error in getCurrentUser:", error)
    return null
  }
}

/**
 * Require authentication and redirect if not authenticated
 * @param redirectTo - Where to redirect if not authenticated (default: "/sign-in")
 * @returns User object with role information
 */
export async function requireAuth(redirectTo = "/sign-in") {
  const user = await getCurrentUser()

  if (!user) {
    redirect(redirectTo)
  }

  return user
}

/**
 * Require specific role, redirect if not authorized
 * NOTE: Middleware handles onboarding redirects - no need to check here
 * @param requiredRole - The role required to access the resource
 * @param redirectTo - Where to redirect if not authorized (default: "/dashboard")
 * @returns User object with role information
 */
export async function requireRole(requiredRole: UserRole, redirectTo = "/dashboard") {
  const user = await requireAuth()

  if (user.role !== requiredRole) {
    redirect(redirectTo)
  }

  return user
}

/**
 * Check if user has any of the specified roles
 * NOTE: Middleware handles onboarding redirects - no need to check here
 * @param allowedRoles - Array of roles that are allowed
 * @param redirectTo - Where to redirect if not authorized (default: "/dashboard")
 * @returns User object with role information
 */
export async function requireAnyRole(allowedRoles: UserRole[], redirectTo = "/dashboard") {
  const user = await requireAuth()

  if (!allowedRoles.includes(user.role)) {
    redirect(redirectTo)
  }

  return user
}

/**
 * Get user session information compatible with the old auth system
 * @returns Session-like object for backward compatibility
 */
export async function getSession() {
  const clerkUser = await currentUser()

  if (!clerkUser) {
    return null
  }

  const dbUser = await getCurrentUser()

  if (!dbUser) {
    return null
  }

  return {
    user: {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role,
      schoolId: dbUser.schoolId || null,
      programId: dbUser.programId || null,
      studentId: dbUser.studentId || null,
      onboardingCompleted: dbUser.onboardingCompleted,
    },
  }
}

/**
 * Check if user has completed onboarding
 * @returns boolean indicating onboarding status
 */
export async function hasCompletedOnboarding() {
  const user = await getCurrentUser()
  return user?.onboardingCompleted || false
}

/**
 * Mark user onboarding as completed
 * @param userId - User ID to update
 * @param role - User role to set
 */
export async function completeOnboarding(userId: string, role: UserRole) {
  await db
    .update(users)
    .set({
      onboardingCompleted: true,
      onboardingCompletedAt: new Date(),
      role: role,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))

  // Invalidate middleware cache so user gets redirected to dashboard immediately
  invalidateUserCache(userId)
}

/**
 * Get role-based dashboard route
 * @param role - User role
 * @returns Dashboard route for the role
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
 * Check if user is super admin
 * @returns boolean indicating super admin status
 */
export async function isSuperAdmin() {
  const user = await getCurrentUser()
  return user?.role === ("SUPER_ADMIN" as UserRole)
}

/**
 * Promote user to super admin (only for initial setup)
 * @param userId - User ID to promote
 */
export async function promoteToSuperAdmin(userId: string) {
  await db
    .update(users)
    .set({
      role: "SUPER_ADMIN" as UserRole,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
}
