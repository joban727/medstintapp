import { auth } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { DashboardLoading } from "../../components/dashboard/dashboard-loading"
import UnifiedErrorBoundary, { ErrorBoundaryConfigs } from "../../components/error-boundary/unified-error-boundary"
import { db } from "../../database/db"
import { users } from "../../database/schema"
import type { UserRole } from "../../types"

// Import dashboard components directly
import AdminDashboardPage from "./admin/page"
import ClinicalPreceptorDashboardPage from "./clinical-preceptor/page"
import ClinicalSupervisorDashboardPage from "./clinical-supervisor/page"
import SchoolAdminDashboardPage from "./school-admin/page"
import StudentDashboard from "./student/page"

/**
 * Get role-based dashboard component
 */
function getRoleDashboardComponent(role: UserRole) {
  console.log("🔍 DashboardPage: Getting dashboard component for role:", role)
  
  switch (role) {
    case "SUPER_ADMIN":
      console.log("✅ DashboardPage: Returning AdminDashboardPage for SUPER_ADMIN")
      return AdminDashboardPage
    case "SCHOOL_ADMIN":
      console.log("✅ DashboardPage: Returning SchoolAdminDashboardPage for SCHOOL_ADMIN")
      return SchoolAdminDashboardPage
    case "CLINICAL_SUPERVISOR":
      console.log("✅ DashboardPage: Returning ClinicalSupervisorDashboardPage for CLINICAL_SUPERVISOR")
      return ClinicalSupervisorDashboardPage
    case "CLINICAL_PRECEPTOR":
      console.log("✅ DashboardPage: Returning ClinicalPreceptorDashboardPage for CLINICAL_PRECEPTOR")
      return ClinicalPreceptorDashboardPage
    case "STUDENT":
      console.log("✅ DashboardPage: Returning StudentDashboard for STUDENT")
      return StudentDashboard
    default:
      console.log("⚠️ DashboardPage: Unknown role, defaulting to StudentDashboard for role:", role)
      return StudentDashboard
  }
}

interface DashboardPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

// This page serves as a smart router to redirect users to their role-specific dashboard
// with enhanced onboarding flow and first-time user experience
export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  console.log("🚀 DashboardPage: Starting dashboard page render")
  
  return (
    <UnifiedErrorBoundary config={ErrorBoundaryConfigs.fullscreen}>
      <Suspense fallback={
        <>
          {console.log("⏳ DashboardPage: Showing loading fallback")}
          <DashboardLoading />
        </>
      }>
        <DashboardRouter searchParams={searchParams} />
      </Suspense>
    </UnifiedErrorBoundary>
  )
}

interface DashboardRouterProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

// Simplified dashboard router - middleware handles authentication and onboarding
async function DashboardRouter(_: DashboardRouterProps) {
  console.log("🔄 DashboardRouter: Starting dashboard routing process")
  
  try {
    // Get user info for role-based dashboard rendering
    // Middleware has already ensured user is authenticated and onboarding is completed
    console.log("🔐 DashboardRouter: Getting authentication info")
    const { userId } = await auth()
    console.log("🔐 DashboardRouter: Auth result - userId:", userId ? "present" : "null")

    if (!userId) {
      console.log("❌ DashboardRouter: No userId found, redirecting to sign-in")
      redirect("/auth/sign-in")
    }

    // Get user from database to determine role
    console.log("🗄️ DashboardRouter: Querying database for user role")
    console.log("🗄️ DashboardRouter: Database query starting for userId:", userId)
    
    const startTime = Date.now()
    const userResult = await db
      .select({
        role: users.role,
        name: users.name,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    
    const queryTime = Date.now() - startTime
    console.log("🗄️ DashboardRouter: Database query completed in", queryTime, "ms")
    console.log("🗄️ DashboardRouter: Query result:", userResult)

    const user = userResult[0]
    console.log("👤 DashboardRouter: User data:", user)

    if (!user) {
      console.log("❌ DashboardRouter: No user found in database, redirecting to sign-in")
      redirect("/auth/sign-in")
    }

    console.log("👤 DashboardRouter: User role:", user.role)
    console.log("👤 DashboardRouter: User name:", user.name)

    // Render the appropriate dashboard component based on user role
    console.log("🎯 DashboardRouter: Getting dashboard component for role:", user.role)
    const DashboardComponent = getRoleDashboardComponent(user.role)
    console.log("🎯 DashboardRouter: Dashboard component selected:", DashboardComponent.name)

    console.log("✅ DashboardRouter: Rendering dashboard component")
    return <DashboardComponent />
  } catch (error) {
    console.error("❌ DashboardRouter: Error in dashboard routing:", error)
    console.error("❌ DashboardRouter: Error stack:", error instanceof Error ? error.stack : "No stack trace")

    // For any errors, redirect to sign-in to restart the flow
    console.log("🔄 DashboardRouter: Redirecting to sign-in due to error")
    redirect("/auth/sign-in")
  }
}
