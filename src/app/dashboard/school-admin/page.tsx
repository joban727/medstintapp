import { auth } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { AlertCircle } from "lucide-react"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import {
  DashboardSkeleton,
  SchoolAdminDashboardClient,
} from "@/components/dashboard/school-admin-dashboard-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { db } from "@/database/db"
import { users } from "@/database/schema"
import { getPendingTasksData, getRecentActivitiesData, getSchoolStats } from "@/lib/dashboard-data"

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

    // Ensure user has proper role and school access
    if (user.role !== "SCHOOL_ADMIN" || !user.schoolId) {
      redirect("/dashboard")
    }

    // Fetch dashboard data on the server side
    let pendingTasks: PendingTask[] = []
    let recentActivities: RecentActivity[] = []
    let schoolStats: SchoolStats | null = null

    try {
      const [tasksData, activitiesData, statsData] = await Promise.allSettled([
        getPendingTasksData(),
        getRecentActivitiesData(5),
        getSchoolStats(),
      ])

      if (tasksData.status === "fulfilled") {
        pendingTasks = tasksData.value || []
      }
      if (activitiesData.status === "fulfilled") {
        recentActivities = activitiesData.value || []
      }
      if (statsData.status === "fulfilled") {
        schoolStats = statsData.value
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error)
    }

    const dashboardData = {
      pendingTasks,
      recentActivities,
      schoolStats,
    }

    return (
      <Suspense fallback={<DashboardSkeleton />}>
        <SchoolAdminDashboardClient user={user} dashboardData={dashboardData} />
      </Suspense>
    )
  } catch (error) {
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
            <Button
              onClick={() => window.location.reload()}
              className="bg-red-600 hover:bg-red-700"
            >
              Refresh Page
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }
}
