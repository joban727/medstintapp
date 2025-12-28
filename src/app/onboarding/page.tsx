import { currentUser } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { redirect } from "next/navigation"
import { db } from "@/database/connection-pool"
import { users } from "../../database/schema"
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
export default async function OnboardingPage() {
  const clerkUser = await currentUser()

  if (!clerkUser) {
    redirect("/auth/sign-in")
  }

  // Get user from database
  let user = null
  try {
    const [dbUser] = await db
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
      .where(eq(users.id, clerkUser.id))
      .limit(1)
    user = dbUser
  } catch (error) {
    console.error("Database error:", error)
  }

  // If onboarding is already completed, redirect to dashboard
  if (user?.onboardingCompleted) {
    redirect("/dashboard")
  }

  // Check if user has a role assigned
  if (!user?.role) {
    // Redirect to user type selection if no role is assigned
    redirect("/onboarding/user-type")
  }

  // Route based on user role
  switch (user.role) {
    case "SCHOOL_ADMIN":
      return redirect("/onboarding/welcome")
    case "STUDENT":
      return redirect("/onboarding/student")
    case "SUPER_ADMIN":
      return redirect("/onboarding/super-admin")
    default:
      return redirect("/onboarding/user-type")
  }
}
