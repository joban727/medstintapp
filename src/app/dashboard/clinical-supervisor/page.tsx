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
import { PageContainer } from "@/components/ui/page-container"
import { StatCard, StatGrid } from "@/components/ui/stat-card"
import { QuickActionCard } from "@/components/ui/quick-action-card"
import { ActivityList, TaskList } from "@/components/ui/activity-list"
import { AnalyticsCharts } from "@/components/dashboard/clinical-supervisor/analytics-charts"
import type { UserRole } from "@/types"
import { requireAnyRole } from "../../../lib/auth-clerk"

export default async function ClinicalSupervisorDashboardPage() {
  const user = await requireAnyRole(["CLINICAL_SUPERVISOR"], "/dashboard")

  return (
    <PageContainer>
      {/* Welcome Banner for First-Time Users */}
      <WelcomeBanner userRole="CLINICAL_SUPERVISOR" userName={user.name || "Supervisor"} />

      <Suspense fallback={<DashboardStatsSkeleton />}>
        <ClinicalSupervisorDashboardContent user={user} />
      </Suspense>
    </PageContainer>
  )
}

interface User {
  id: string
  name: string | null
  email: string
  role:
    | UserRole
    | "STUDENT"
    | "SUPER_ADMIN"
    | "SCHOOL_ADMIN"
    | "CLINICAL_PRECEPTOR"
    | "CLINICAL_SUPERVISOR"
  department: string | null
  isActive: boolean
  createdAt: Date
}

async function ClinicalSupervisorDashboardContent({ user }: { user: User }) {
  // Import database dependencies
  const { db } = await import("@/database/db")
  const { users, rotations, evaluations, timeRecords } = await import("@/database/schema")
  const { eq, and, count, desc, gte, sql } = await import("drizzle-orm")

  // Fetch real data for clinical supervisor dashboard with error handling
  // Using any[] for schoolUsers since getUsersBySchool returns a subset of User fields
  let schoolUsers: any[] = []
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

  // Chart Data
  let studentProgress: { month: string; averageScore: number }[] = []
  let rotationStatus: { name: string; value: number; color: string }[] = []
  let evaluationsChartData: { name: string; completed: number; pending: number }[] = []

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
    const sixMonthsAgo = new Date(currentDate.getTime() - 180 * 24 * 60 * 60 * 1000)

    // Fetch real statistics from database
    const [
      rotationsData,
      evaluationsData,
      pendingEvaluationsData,
      rawEvaluations,
      rawRotations,
      pendingTimecards,
    ] = await Promise.allSettled([
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

      // Raw evaluations for charts (last 6 months)
      db
        .select({
          rating: evaluations.overallRating,
          createdAt: evaluations.createdAt,
          specialty: rotations.specialty,
        })
        .from(evaluations)
        .innerJoin(rotations, eq(rotations.id, evaluations.rotationId))
        .where(and(eq(rotations.supervisorId, user.id), gte(evaluations.createdAt, sixMonthsAgo))),

      // Raw rotations for charts
      db
        .select({
          status: rotations.status,
          specialty: rotations.specialty,
        })
        .from(rotations)
        .where(eq(rotations.supervisorId, user.id)),

      // Pending timecards
      db
        .select({ count: count() })
        .from(timeRecords)
        .innerJoin(rotations, eq(rotations.id, timeRecords.rotationId))
        .where(and(eq(rotations.supervisorId, user.id), eq(timeRecords.status, "PENDING"))),
    ])

    // Extract statistics
    stats = {
      totalStudents: safeSchoolUsers.filter((u) => u?.role === ("STUDENT" as UserRole)).length,
      activeRotations:
        rotationsData.status === "fulfilled" ? rotationsData.value[0]?.count || 0 : 0,
      pendingEvaluations:
        pendingEvaluationsData.status === "fulfilled"
          ? pendingEvaluationsData.value[0]?.count || 0
          : 0,
      completedEvaluations:
        evaluationsData.status === "fulfilled" ? evaluationsData.value[0]?.count || 0 : 0,
    }

    // Process Chart Data
    if (rawEvaluations.status === "fulfilled" && rawRotations.status === "fulfilled") {
      const evals = rawEvaluations.value
      const rots = rawRotations.value

      // Student Progress (Monthly Average)
      const monthlyScores = new Map<string, { total: number; count: number }>()
      evals.forEach((e) => {
        const month = e.createdAt.toLocaleString("default", { month: "short" })
        const current = monthlyScores.get(month) || { total: 0, count: 0 }
        monthlyScores.set(month, {
          total: current.total + Number(e.rating),
          count: current.count + 1,
        })
      })

      // Ensure last 6 months are represented
      const last6Months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date()
        d.setMonth(d.getMonth() - i)
        return d.toLocaleString("default", { month: "short" })
      }).reverse()

      studentProgress = last6Months.map((month) => {
        const data = monthlyScores.get(month)
        return {
          month,
          averageScore: data ? Math.round((data.total / data.count) * 20) : 0,
        }
      })

      // Rotation Status
      const statusCounts = rots.reduce(
        (acc, r) => {
          acc[r.status] = (acc[r.status] || 0) + 1
          return acc
        },
        {} as Record<string, number>
      )

      rotationStatus = [
        { name: "Active", value: statusCounts["ACTIVE"] || 0, color: "#22c55e" },
        { name: "Scheduled", value: statusCounts["SCHEDULED"] || 0, color: "#3b82f6" },
        { name: "Completed", value: statusCounts["COMPLETED"] || 0, color: "#a855f7" },
        { name: "Cancelled", value: statusCounts["CANCELLED"] || 0, color: "#ef4444" },
      ].filter((item) => item.value > 0)

      // Evaluations by Specialty
      const specialties = Array.from(new Set(rots.map((r) => r.specialty)))
      evaluationsChartData = specialties
        .map((specialty) => {
          const completed = evals.filter((e) => e.specialty === specialty).length
          const pending = rots.filter(
            (r) => r.specialty === specialty && r.status === "ACTIVE"
          ).length
          return {
            name: specialty,
            completed,
            pending,
          }
        })
        .slice(0, 5) // Limit to top 5
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
    const pendingTimecardsCount =
      pendingTimecards.status === "fulfilled" ? pendingTimecards.value[0]?.count || 0 : 0

    upcomingTasks = []

    if (pendingTimecardsCount > 0) {
      upcomingTasks.push({
        id: 1,
        title: "Approve Time Records",
        dueDate: "Today",
        priority: "high",
        count: pendingTimecardsCount,
      })
    }

    if (stats.pendingEvaluations > 0) {
      upcomingTasks.push({
        id: 2,
        title: "Pending Evaluations",
        dueDate: "This Week",
        priority: "medium",
        count: stats.pendingEvaluations,
      })
    }

    if (stats.activeRotations > 0) {
      upcomingTasks.push({
        id: 3,
        title: "Active Rotations Review",
        dueDate: "Ongoing",
        priority: "low",
        count: stats.activeRotations,
      })
    }

    // Fill with generic if empty
    if (upcomingTasks.length === 0) {
      upcomingTasks.push({
        id: 1,
        title: "No pending tasks",
        dueDate: "",
        priority: "low",
        count: 0,
      })
    }
  } catch (error) {
    console.error("Error fetching clinical supervisor dashboard data:", error)
    // Fallback to basic data
    const safeSchoolUsers = Array.isArray(schoolUsers)
      ? schoolUsers.filter((u) => u && typeof u === "object")
      : []

    stats = {
      totalStudents: safeSchoolUsers.filter((u) => u?.role === ("STUDENT" as UserRole)).length,
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
        <Badge
          variant="secondary"
          className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
        >
          Clinical Supervisor
        </Badge>
      </div>

      {/* Stats Overview */}
      <StatGrid columns={4}>
        <StatCard
          title="Supervised Students"
          value={stats.totalStudents}
          icon={Users}
          variant="blue"
          description="+2 new this month"
        />
        <StatCard
          title="Active Rotations"
          value={stats.activeRotations}
          icon={Calendar}
          variant="green"
          description="Across 4 departments"
        />
        <StatCard
          title="Pending Evaluations"
          value={stats.pendingEvaluations}
          icon={Clock}
          variant="orange"
          description="5 due today"
        />
        <StatCard
          title="Completed This Month"
          value={stats.completedEvaluations}
          icon={CheckCircle}
          variant="purple"
          description="+15% from last month"
        />
      </StatGrid>

      {/* Analytics Charts */}
      <AnalyticsCharts
        studentProgress={studentProgress}
        rotationStatus={rotationStatus}
        evaluations={evaluationsChartData}
      />

      {/* Quick Actions */}
      <div>
        <h2 className="mb-4 font-semibold text-xl">Quick Actions</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 stagger-children">
          {quickActions.map((action) => (
            <QuickActionCard
              key={action.title}
              title={action.title}
              description={action.description}
              icon={action.icon}
              href={action.href}
              color={action.color}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Upcoming Tasks */}
        <TaskList
          title="Upcoming Tasks"
          description="Important items requiring your attention"
          tasks={upcomingTasks.map((task) => ({
            id: task.id.toString(),
            title: task.title,
            dueDate: task.dueDate,
            priority: task.priority as "high" | "medium" | "low",
            count: task.count,
            actionLabel: "Review",
          }))}
        />

        {/* Recent Activities */}
        <ActivityList
          title="Recent Activities"
          description="Latest updates and notifications"
          activities={recentActivities.map((activity) => ({
            id: activity.id.toString(),
            message: activity.message,
            time: activity.time,
            type:
              activity.type === "alert"
                ? "warning"
                : activity.type === "evaluation"
                  ? "info"
                  : "success",
          }))}
        />
      </div>
    </div>
  )
}
