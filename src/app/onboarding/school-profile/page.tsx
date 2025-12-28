import { currentUser } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { redirect } from "next/navigation"
import { SchoolProfileOnboarding } from "../../../components/onboarding/school-profile-onboarding"
import { db } from "@/database/connection-pool"
import { users } from "../../../database/schema"
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
export default async function SchoolProfileOnboardingPage() {
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

  // Verify user is school admin
  if (user?.role !== ("SCHOOL_ADMIN" as UserRole)) {
    redirect("/onboarding")
  }

  // If onboarding is already completed, redirect to dashboard
  if (user?.onboardingCompleted) {
    redirect("/dashboard")
  }

  return (
    <SchoolProfileOnboarding
      user={{
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        schoolId: user.schoolId,
        onboardingCompleted: user.onboardingCompleted,
      }}
      clerkUser={{
        id: clerkUser.id,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        emailAddresses:
          clerkUser.emailAddresses?.map((email) => ({
            emailAddress: email.emailAddress,
          })) || [],
      }}
    />
  )
}
