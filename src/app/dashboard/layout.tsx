import { redirect } from "next/navigation"
import { currentUser } from "@clerk/nextjs/server"
import { DashboardLayoutClient } from "@/components/layout/dashboard-layout-client"
import { getCurrentUser } from "@/lib/auth-clerk"
import { logger } from "@/lib/logger"
import { UserRole } from "@/database/schema"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  try {
    const user = await getCurrentUser()
    const clerkUser = await currentUser()

    if (!user || !clerkUser) {
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

    return <DashboardLayoutClient user={userWithClerkData}>{children}</DashboardLayoutClient>
  } catch (error) {
    logger.error({ error }, "[DashboardLayout] Failed to fetch user")
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
}
