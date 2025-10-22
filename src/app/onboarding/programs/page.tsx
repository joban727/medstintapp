import { currentUser } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { redirect } from "next/navigation"
import { ProgramsOnboarding } from "../../../components/onboarding/programs-onboarding"
import { db } from "../../../database/db"
import { users } from "../../../database/schema"

export default async function ProgramsOnboardingPage() {
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
  if (user?.role !== "SCHOOL_ADMIN") {
    redirect("/onboarding")
  }

  // If onboarding is already completed, redirect to dashboard
  if (user?.onboardingCompleted) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-4xl">
          <ProgramsOnboarding
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
