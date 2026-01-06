import { auth } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { DashboardLoading } from "../../components/dashboard/dashboard-loading"
import { db } from "@/database/connection-pool"
import { users } from "../../database/schema"
import type { UserRole } from "../../types"

export const dynamic = "force-dynamic"

// Import dashboard components
import AdminDashboardPage from "./admin/page"
import ClinicalPreceptorDashboardPage from "./clinical-preceptor/page"
import ClinicalSupervisorDashboardPage from "./clinical-supervisor/page"
import SchoolAdminDashboardPage from "./school-admin/page"
import StudentDashboard from "./student/page"

/**
 * Valid user roles for dashboard access
 */
const VALID_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "SCHOOL_ADMIN",
  "CLINICAL_SUPERVISOR",
  "CLINICAL_PRECEPTOR",
  "STUDENT",
]

interface DashboardPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

/**
 * Dashboard Page
 *
 * Renders the appropriate role-specific dashboard.
 * Middleware guarantees user is authenticated with completed onboarding.
 */
export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardRouter searchParams={searchParams} />
    </Suspense>
  )
}

interface DashboardRouterProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

/**
 * Dashboard Router
 *
 * Fetches user role and renders the appropriate dashboard component.
 */
async function DashboardRouter(_: DashboardRouterProps) {
  // Get authenticated user ID (middleware guarantees authentication)
  const { userId } = await auth()

  if (!userId) {
    redirect("/auth/sign-in")
  }

  // Fetch user role from database
  const [user] = await db
    .select({
      role: users.role,
      name: users.name,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  // Fallback: redirect if user not found (should be caught by middleware)
  if (!user) {
    redirect("/auth/sign-in")
  }

  // Fallback: redirect inactive users
  if (!user.isActive) {
    redirect("/account-inactive")
  }

  // Fallback: redirect if no role (should be caught by middleware)
  if (!user.role || !VALID_ROLES.includes(user.role)) {
    redirect("/onboarding")
  }

  // Render the appropriate dashboard based on role
  switch (user.role) {
    case "SUPER_ADMIN":
      return <AdminDashboardPage />
    case "SCHOOL_ADMIN":
      return <SchoolAdminDashboardPage />
    case "CLINICAL_SUPERVISOR":
      return <ClinicalSupervisorDashboardPage />
    case "CLINICAL_PRECEPTOR":
      return <ClinicalPreceptorDashboardPage />
    case "STUDENT":
      return <StudentDashboard />
    default:
      throw new Error(`Invalid user role: ${user.role}`)
  }
}
