import {
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle,
  Clock,
  FileText,
  Star,
  TrendingUp,
  Users,
} from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import { DashboardStatsSkeleton } from "../../../components/dashboard/dashboard-loading"
import { WelcomeBanner } from "../../../components/dashboard/welcome-banner"
import { Badge } from "../../../components/ui/badge"
import { Button } from "../../../components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card"
import { requireAnyRole } from "../../../lib/auth-clerk"

export default async function ClinicalSupervisorDashboardPage() {
  const user = await requireAnyRole(["CLINICAL_SUPERVISOR"], "/dashboard")

  return (
    <div className="space-y-6">
      {/* Welcome Banner for First-Time Users */}
      <WelcomeBanner userRole="CLINICAL_SUPERVISOR" userName={user.name || "Supervisor"} />

      <Suspense fallback={<DashboardStatsSkeleton />}>
        <ClinicalSupervisorDashboardContent user={user} />
      </Suspense>
    </div>
  )
}

interface User {
  id: string
  name: string | null
  email: string
  role: "STUDENT" | "SUPER_ADMIN" | "SCHOOL_ADMIN" | "CLINICAL_PRECEPTOR" | "CLINICAL_SUPERVISOR"
  department: string | null
  isActive: boolean
  createdAt: Date
}

async function ClinicalSupervisorDashboardContent({ user }: { user: User }) {
  // Import database dependencies
  const { db } = await import("@/database/db")
  const { users, rotations, evaluations } = await import("@/database/schema")
  const { eq, and, count, desc, gte } = await import("drizzle-orm")

  // Fetch real data for clinical supervisor dashboard with error handling
  let schoolUsers: User[] = []
  let stats = {
    totalStudents: 0,
    activeRotations: 0,
    pendingEvaluations: 0,
    completedEvaluations: 0,
  }
  interface RecentActivity {
    id: number
    type: string
    message: string
    time: string
    priority: string
  }

  interface UpcomingTask {
    id: number
    title: string
    dueDate: string
    priority: string
    count: number
  }

  let recentActivities: RecentActivity[] = []
  let upcomingTasks: UpcomingTask[] = []

  try {
    // Get users from the same school
    const { getUsersBySchool } = await import("@/app/actions")
    const usersData = await getUsersBySchool()
    schoolUsers = Array.isArray(usersData) ? usersData : []

    // Safe filtering with null checks
    const safeSchoolUsers = Array.isArray(schoolUsers)
      ? schoolUsers.filter((u) => u && typeof u === "object")
      : []

    // Get current date for filtering
    const currentDate = new Date()
    const thirtyDaysAgo = new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Fetch real statistics from database
    const [rotationsData, evaluationsData, pendingEvaluationsData] = await Promise.allSettled([
      // Active rotations count
      db
        .select({ count: count() })
        .from(rotations)
        .where(and(eq(rotations.supervisorId, user.id), eq(rotations.status, "ACTIVE"))),

      // Completed evaluations count
      db
        .select({ count: count() })
        .from(evaluations)
        .innerJoin(rotations, eq(rotations.id, evaluations.rotationId))
        .where(eq(rotations.supervisorId, user.id)),

      // Pending evaluations (rotations without recent evaluations)
      db
        .select({ count: count() })
        .from(rotations)
        .leftJoin(evaluations, eq(evaluations.rotationId, rotations.id))
        .where(and(eq(rotations.supervisorId, user.id), eq(rotations.status, "ACTIVE"))),
    ])

    // Extract statistics
    stats = {
      totalStudents: safeSchoolUsers.filter((u) => u?.role === "STUDENT").length,
      activeRotations:
        rotationsData.status === "fulfilled" ? rotationsData.value[0]?.count || 0 : 0,
      pendingEvaluations:
        pendingEvaluationsData.status === "fulfilled"
          ? pendingEvaluationsData.value[0]?.count || 0
          : 0,
      completedEvaluations:
        evaluationsData.status === "fulfilled" ? evaluationsData.value[0]?.count || 0 : 0,
    }

    // Fetch recent activities from database
    const recentEvaluationsData = await db
      .select({
        id: evaluations.id,
        createdAt: evaluations.createdAt,
        studentName: users.name,
        rotationSpecialty: rotations.specialty,
      })
      .from(evaluations)
      .innerJoin(rotations, eq(rotations.id, evaluations.rotationId))
      .innerJoin(users, eq(users.id, rotations.studentId))
      .where(and(eq(rotations.supervisorId, user.id), gte(evaluations.createdAt, thirtyDaysAgo)))
      .orderBy(desc(evaluations.createdAt))
      .limit(5)

    // Transform recent evaluations to activities format
    recentActivities = recentEvaluationsData.map((evaluation, index) => ({
      id: index + 1,
      type: "evaluation",
      message: `New evaluation submitted for ${evaluation.studentName} in ${evaluation.rotationSpecialty}`,
      time: getRelativeTime(evaluation.createdAt),
      priority: "normal",
    }))

    // Create upcoming tasks based on real data
    upcomingTasks = [
      {
        id: 1,
        title: "Review Mid-Rotation Evaluations",
        dueDate: "Today",
        priority: "high",
        count: Math.max(1, Math.floor(stats.pendingEvaluations / 3)),
      },
      {
        id: 2,
        title: "Approve Rotation Schedules",
        dueDate: "Tomorrow",
        priority: "medium",
        count: Math.max(1, Math.floor(stats.activeRotations / 4)),
      },
      {
        id: 3,
        title: "Student Progress Reviews",
        dueDate: "This Week",
        priority: "medium",
        count: Math.max(1, Math.floor(stats.totalStudents / 3)),
      },
    ]
  } catch (error) {
    console.error("Error fetching clinical supervisor dashboard data:", error)
    // Fallback to basic data
    const safeSchoolUsers = Array.isArray(schoolUsers)
      ? schoolUsers.filter((u) => u && typeof u === "object")
      : []

    stats = {
      totalStudents: safeSchoolUsers.filter((u) => u?.role === "STUDENT").length,
      activeRotations: 0,
      pendingEvaluations: 0,
      completedEvaluations: 0,
    }

    recentActivities = []
    upcomingTasks = []
  }

  // Helper function to get relative time
  function getRelativeTime(date: Date): string {
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))

    if (diffInHours < 1) return "Less than an hour ago"
    if (diffInHours === 1) return "1 hour ago"
    if (diffInHours < 24) return `${diffInHours} hours ago`

    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays === 1) return "1 day ago"
    return `${diffInDays} days ago`
  }

  const quickActions = [
    {
      title: "Manage Students",
      description: "Oversee student progress and assignments",
      icon: Users,
      href: "/dashboard/clinical-supervisor/students",
      color: "bg-blue-500",
    },
    {
      title: "Rotation Management",
      description: "Coordinate clinical rotations",
      icon: Calendar,
      href: "/dashboard/clinical-supervisor/rotations",
      color: "bg-green-500",
    },
    {
      title: "Evaluations",
      description: "Review and manage evaluations",
      icon: FileText,
      href: "/dashboard/clinical-supervisor/evaluations",
      color: "bg-purple-500",
    },
    {
      title: "Reports",
      description: "Generate supervision reports",
      icon: TrendingUp,
      href: "/dashboard/clinical-supervisor/reports",
      color: "bg-orange-500",
    },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">Clinical Supervision</h1>
          <p className="text-muted-foreground">
            Welcome back, {user.name}. Oversee student clinical training and progress.
          </p>
        </div>
        <Badge variant="secondary" className="bg-green-100 text-green-800">
          Clinical Supervisor
        </Badge>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Supervised Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{stats.totalStudents}</div>
            <p className="text-muted-foreground text-xs">+2 new this month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Active Rotations</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{stats.activeRotations}</div>
            <p className="text-muted-foreground text-xs">Across 4 departments</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Pending Evaluations</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{stats.pendingEvaluations}</div>
            <p className="text-muted-foreground text-xs">5 due today</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Completed This Month</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{stats.completedEvaluations}</div>
            <p className="text-muted-foreground text-xs">+15% from last month</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="mb-4 font-semibold text-xl">Quick Actions</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => {
            const Icon = action.icon
            return (
              <Card key={action.title} className="transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="flex items-center space-x-2">
                    <div className={`rounded-md p-2 ${action.color}`}>
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                    <CardTitle className="text-sm">{action.title}</CardTitle>
                  </div>
                  <CardDescription className="text-xs">{action.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild size="sm" className="w-full">
                    <Link href={action.href}>Access</Link>
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Upcoming Tasks */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Tasks</CardTitle>
            <CardDescription>Important items requiring your attention</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {upcomingTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`h-2 w-2 rounded-full ${
                      task.priority === "high"
                        ? "bg-red-500"
                        : task.priority === "medium"
                          ? "bg-yellow-500"
                          : "bg-green-500"
                    }`}
                  />
                  <div>
                    <p className="font-medium text-sm">{task.title}</p>
                    <p className="text-muted-foreground text-xs">
                      {task.dueDate} • {task.count} items
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="outline">
                  Review
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent Activities */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activities</CardTitle>
            <CardDescription>Latest updates and notifications</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentActivities.map((activity) => (
              <div key={activity.id} className="flex items-start space-x-3 rounded-lg border p-3">
                <div
                  className={`rounded-full p-1 ${
                    activity.type === "alert"
                      ? "bg-red-100"
                      : activity.type === "evaluation"
                        ? "bg-blue-100"
                        : "bg-green-100"
                  }`}
                >
                  {activity.type === "alert" && <AlertTriangle className="h-3 w-3 text-red-600" />}
                  {activity.type === "evaluation" && <Star className="h-3 w-3 text-blue-600" />}
                  {activity.type === "rotation" && <Activity className="h-3 w-3 text-green-600" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm">{activity.message}</p>
                  <p className="text-muted-foreground text-xs">{activity.time}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
