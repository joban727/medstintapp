import { currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { DashboardLayoutClient } from "../../components/layout/dashboard-layout-client"
import { getUserById } from "@/lib/rbac-middleware"
import type { UserRole } from "@/types"

export const dynamic = "force-dynamic"

/**
 * Dashboard Layout
 * 
 * This layout wraps all dashboard pages. The middleware guarantees:
 * - User is authenticated
 * - User has completed onboarding
 * - User has a valid role
 * 
 * We still fetch user data here to pass to child components.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const clerkUser = await currentUser()

  // Middleware should catch this, but handle as fallback
  if (!clerkUser) {
    redirect("/auth/sign-in")
  }

  // Fetch user with role information for downstream components
  let user = null
  try {
    user = await getUserById(clerkUser.id)
  } catch (error) {
    console.error("[Dashboard Layout] Failed to fetch user:", error)
    // Show error state instead of redirect loop
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="space-y-4 text-center">
          <h1 className="font-bold text-2xl text-red-600">Connection Error</h1>
          <p className="text-gray-600">Unable to load user data. Please refresh.</p>
          <a
            href="/dashboard"
            className="inline-block rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Refresh
          </a>
        </div>
      </div>
    )
  }

  // Middleware should catch this, but handle as fallback
  if (!user) {
    redirect("/onboarding/user-type")
  }

  // Prepare user data for child components
  const userWithClerkData = {
    id: user.id,
    email: clerkUser.emailAddresses[0]?.emailAddress || user.email,
    name: user.name || "User",
    role: user.role as UserRole,
    schoolId: user.schoolId || null,
    programId: null as string | null,
  }

  // Ensure role is present, otherwise redirect to onboarding
  if (!userWithClerkData.role) {
    redirect("/onboarding")
  }

  console.log("[DashboardLayout] User Data:", {
    id: userWithClerkData.id,
    email: userWithClerkData.email,
    role: userWithClerkData.role,
    originalRole: user.role,
    schoolId: userWithClerkData.schoolId
  })

  return <DashboardLayoutClient user={userWithClerkData}>{children}</DashboardLayoutClient>
}
