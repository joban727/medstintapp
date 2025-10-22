import { currentUser } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { redirect } from "next/navigation"
import { CompleteOnboarding } from "../../../components/onboarding/complete-onboarding"
import { db } from "../../../database/db"
import { users } from "../../../database/schema"

export default async function CompleteOnboardingPage() {
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

  // If user doesn't exist or onboarding is already completed, redirect appropriately
  if (!user) {
    redirect("/onboarding/user-type")
  }

  if (user.onboardingCompleted) {
    // User has already completed onboarding, redirect to dashboard
    redirect("/dashboard")
  }

  // Verify user has the minimum requirements to complete onboarding
  const canCompleteOnboarding = () => {
    if (!user.role) return false

    switch (user.role) {
      case "SUPER_ADMIN":
        return true // Super admin only needs role
      case "SCHOOL_ADMIN":
      case "CLINICAL_PRECEPTOR":
      case "CLINICAL_SUPERVISOR":
      case "STUDENT":
        return user.schoolId !== null // These roles need schoolId
      default:
        return false
    }
  }

  if (!canCompleteOnboarding()) {
    redirect("/onboarding/user-type")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-4xl">
          <CompleteOnboarding
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
        </div>
      </div>
    </div>
  )
}
