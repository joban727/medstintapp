import { auth } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { AlertCircle } from "lucide-react"
import { redirect } from "next/navigation"
import { Suspense } from "react"

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
import { DashboardLoading } from "@/components/dashboard/dashboard-loading"
import { SchoolAdminDashboardClient } from "@/components/dashboard/school-admin-dashboard-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { db } from "@/database/connection-pool"
import { users } from "@/database/schema"
import {
  getCompetencyOverviewData,
  getEnrollmentTrendData,
  getPendingTasksData,
  getRecentActivitiesData,
  getSchoolStats,
  getSiteCapacityData,
} from "@/lib/dashboard-data"
import { getRoleDashboardRoute } from "@/lib/auth-clerk"
import type { UserRole } from "@/types"

interface PendingTask {
  id: string
  title: string
  description: string
  count: number
  priority: "high" | "medium" | "low"
  type: "approval" | "evaluation" | "setup" | "review"
}

interface RecentActivity {
  id: string
  action: string
  entityType: string | null
  entityId: string | null
  userId: string
  metadata: string
  timestamp: Date
  userEmail: string | null
  userName: string | null
}

interface SchoolStats {
  activeRotations: number
  pendingTimeRecords: number
  totalStudents: number
  totalPrograms: number
  pendingEvaluations: number
  avgCompetencyProgress: number
  totalSites: number
  placementRate: number
  schoolName: string
}

export default async function SchoolAdminDashboard() {
  try {
    const { userId } = await auth()
    if (!userId) {
      redirect("/sign-in")
    }

    // Get current user data
    const currentUser = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        schoolId: users.schoolId,
        onboardingCompleted: users.onboardingCompleted,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (!currentUser.length) {
      redirect("/onboarding/user-type")
    }

    const user = currentUser[0]

    console.log("🔍 SchoolAdminDashboard: Debugging user data")
    console.log("🔍 User ID:", user.id)
    console.log("🔍 User Role:", user.role, "Type:", typeof user.role)
    console.log("🔍 School ID:", user.schoolId, "Type:", typeof user.schoolId)
    console.log("🔍 Expected Role:", "SCHOOL_ADMIN")
    console.log("🔍 Role Match:", user.role === "SCHOOL_ADMIN")
    console.log("🔍 School ID Check:", !!user.schoolId)

    // Enhanced role-based access control with proper logging and redirects
    // NOTE: We allow users with SCHOOL_ADMIN role but no schoolId to access the dashboard
    // This supports the "Skip Setup" flow where a user is created but not yet linked to a school
    if (user.role !== ("SCHOOL_ADMIN" as UserRole as UserRole)) {
      // Log unauthorized access attempt for security monitoring
      console.warn("🚨 SECURITY: Unauthorized access attempt to school admin dashboard")
      console.warn("🚨 SECURITY: User ID:", userId)
      console.warn("🚨 SECURITY: User role:", user.role)
      console.warn("🚨 SECURITY: User email:", user.email)
      console.warn("🚨 SECURITY: School ID:", user.schoolId)
      console.warn("🚨 SECURITY: Timestamp:", new Date().toISOString())

      // Redirect to appropriate dashboard based on user's actual role
      if (user.role && user.role !== ("SCHOOL_ADMIN" as UserRole as UserRole)) {
        const appropriateDashboard = getRoleDashboardRoute(user.role as UserRole)
        console.log("🔄 REDIRECT: Redirecting user to appropriate dashboard:", appropriateDashboard)
        redirect(appropriateDashboard)
      } else {
        // Fallback to generic dashboard for users without proper role
        console.log("🔄 REDIRECT: Redirecting to generic dashboard due to missing/invalid role")
        redirect("/dashboard")
      }
    }

    // Fetch dashboard data on the server side
    let pendingTasks: PendingTask[] = []
    let recentActivities: RecentActivity[] = []
    let schoolStats: SchoolStats | null = null
    let analytics: any = {
      enrollmentTrend: [],
      siteCapacity: [],
      competencyOverview: [],
    }

    try {
      const [tasksData, activitiesData, statsData, enrollmentData, siteData, competencyData] =
        await Promise.allSettled([
          getPendingTasksData(),
          getRecentActivitiesData(5),
          getSchoolStats(),
          getEnrollmentTrendData(),
          getSiteCapacityData(),
          getCompetencyOverviewData(),
        ])

      if (tasksData.status === "fulfilled") {
        pendingTasks = tasksData.value || []
      }
      if (activitiesData.status === "fulfilled") {
        recentActivities = activitiesData.value || []
      }
      if (statsData.status === "fulfilled") {
        schoolStats = statsData.value as SchoolStats
      }

      analytics = {
        enrollmentTrend: enrollmentData.status === "fulfilled" ? enrollmentData.value : [],
        siteCapacity: siteData.status === "fulfilled" ? siteData.value : [],
        competencyOverview: competencyData.status === "fulfilled" ? competencyData.value : [],
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error)
    }

    const dashboardData = {
      pendingTasks,
      recentActivities: recentActivities.map((activity) => ({
        action: activity.action,
        details: activity.metadata || "",
        timestamp: activity.timestamp.toISOString(),
      })),
      schoolStats: schoolStats || {
        activeRotations: 0,
        pendingTimeRecords: 0,
        totalStudents: 0,
        totalPrograms: 0,
        pendingEvaluations: 0,
        avgCompetencyProgress: 0,
        totalSites: 0,
        placementRate: 0,
        schoolName: "Medical Institute",
      },
      placementRate: 0,
      schoolName: "Medical Institute",
      analytics,
    }

    // Ensure user role is defined for the client component
    if (!user.role) {
      redirect("/onboarding")
    }

    return (
      <Suspense fallback={<DashboardLoading />}>
        <SchoolAdminDashboardClient
          user={{ ...user, role: user.role }}
          dashboardData={dashboardData}
        />
      </Suspense>
    )
  } catch (error) {
    // Re-throw NEXT_REDIRECT errors to allow Next.js to handle redirects
    if (
      error instanceof Error &&
      (error.message === "NEXT_REDIRECT" || error.message.includes("NEXT_REDIRECT"))
    ) {
      throw error
    }
    console.error("SchoolAdminDashboard: Error occurred:", error)
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Dashboard Error
            </CardTitle>
            <CardDescription className="text-red-500">
              An error occurred while loading the dashboard. Please try refreshing the page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-600 mb-4">
              Please refresh your browser to try again, or contact support if the issue persists.
            </p>
            <div className="text-xs text-red-500 font-mono bg-red-100 p-2 rounded">
              Error details: {error instanceof Error ? error.message : "Unknown error"}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }
}
