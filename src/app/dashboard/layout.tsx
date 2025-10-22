import { currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { DashboardLayoutClient } from "../../components/layout/dashboard-layout-client"
import { getUserById } from "../../lib/rbac-middleware"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let clerkUser = await currentUser()

  // Handle session establishment timing issues for new users
  if (!clerkUser) {
    // Wait a bit and try again for new users who might have session establishment delays
    await new Promise((resolve) => setTimeout(resolve, 1000))
    clerkUser = await currentUser()

    // If still no user after retry, redirect to sign-in
    if (!clerkUser) {
      redirect("/auth/sign-in")
    }
  }

  // Get user with role information with proper error handling
  let user = null
  try {
    user = await getUserById(clerkUser.id)
  } catch (error) {
    console.error("Dashboard layout: Failed to fetch user from database:", error)

    // Instead of redirecting immediately, show an error state
    // This prevents infinite redirect loops when database is temporarily unavailable
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="space-y-4 text-center">
          <h1 className="font-bold text-2xl text-red-600">Database Connection Error</h1>
          <p className="text-gray-600">Unable to load user data. Please try refreshing the page.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Refresh Page
          </button>
        </div>
      </div>
    )
  }

  // Only redirect to onboarding if user is definitively null (not found in database)
  // but database connection is working
  if (!user) {
    redirect("/onboarding/user-type")
  }

  // Add clerk user data to the user object with programId for components
  const userWithClerkData = {
    id: user.id,
    email: clerkUser.emailAddresses[0]?.emailAddress || user.email,
    name: user.name || "User",
    role: user.role,
    schoolId: user.schoolId || null,
    programId: null, // Add programId field expected by components
  }

  return <DashboardLayoutClient user={userWithClerkData}>{children}</DashboardLayoutClient>
}
