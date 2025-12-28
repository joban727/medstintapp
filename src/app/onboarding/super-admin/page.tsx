import { currentUser } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { redirect } from "next/navigation"
import { db } from "@/database/connection-pool"
import { users } from "@/database/schema"
import { SuperAdminOnboarding } from "../../../components/onboarding/user-type-selection"
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
// verifyOnboardingState import removed - verification handled by dashboard router

export default async function SuperAdminOnboardingPage() {
  const clerkUser = await currentUser()

  if (!clerkUser) {
    redirect("/auth/sign-in")
  }

  // Note: Onboarding verification is handled by the dashboard router
  // No need to verify again here as users are routed here appropriately

  // Get user from database
  let user = null
  try {
    const [dbUser] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-2xl">
          <div className="mb-8 text-center">
            <h1 className="mb-2 font-bold text-3xl text-gray-900 dark:text-white">
              Super Administrator Setup
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Configure your super administrator account with full platform access
            </p>
          </div>

          <SuperAdminOnboarding
            user={
              user
                ? {
                  id: user.id,
                  email: user.email,
                  name: user.name || "",
                  role: user.role || "SUPER_ADMIN" as UserRole,
                  onboardingCompleted: user.onboardingCompleted,
                  schoolId: null,
                  programId: null,
                }
                : {
                  id: "",
                  email: "",
                  name: "",
                  role: "SUPER_ADMIN" as UserRole,
                  onboardingCompleted: false,
                  schoolId: null,
                  programId: null,
                }
            }
            clerkUser={{
              id: clerkUser.id,
              firstName: clerkUser.firstName,
              lastName: clerkUser.lastName,
              emailAddresses:
                clerkUser.emailAddresses?.map((email) => ({
                  id: email.id,
                  emailAddress: email.emailAddress,
                  verification: email.verification,
                  linkedTo: email.linkedTo.map((link) => link.id),
                })) || [],
            }}
          />
        </div>
      </div>
    </div>
  )
}
