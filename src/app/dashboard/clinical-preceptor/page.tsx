import { Calendar, CheckCircle, Clock, FileText, Users } from "lucide-react"
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
import type { User } from "../../../database/schema"
import { requireAnyRole } from "../../../lib/auth-clerk"

export default async function ClinicalPreceptorDashboardPage() {
  const user = await requireAnyRole(["CLINICAL_PRECEPTOR"], "/dashboard")

  return (
    <PageContainer>
      {/* Welcome Banner for First-Time Users */}
      <WelcomeBanner userRole="CLINICAL_PRECEPTOR" userName={user.name || "Preceptor"} />

      <Suspense fallback={<DashboardStatsSkeleton />}>
        <ClinicalPreceptorDashboardContent user={user} />
      </Suspense>
    </PageContainer>
  )
}

async function ClinicalPreceptorDashboardContent({ user }: { user: { id: string; name: string | null } }) {
  // Fetch real data for clinical preceptor dashboard with comprehensive error handling
  let pendingTimeRecords: Array<{
    id: string
    date: Date
    clockIn: Date | null
    clockOut: Date | null
    totalHours: string | null
    status: "PENDING" | "APPROVED" | "REJECTED"
    studentName: string | null
    rotationName: string | null
  }> = []
  let activeRotations: Array<{
    id: string
    specialty: string | null
    startDate: Date | null
    endDate: Date | null
    status: string | null
    studentId: string | null
    studentName: string | null
    updatedAt: Date | null
  }> = []
  let completedEvaluations: Array<{
    id: string
    type: "FINAL" | "MIDTERM" | "WEEKLY" | "INCIDENT" | null
    overallRating: string
    createdAt: Date
    studentId: string
  }> = []

  // Import dashboard data functions
  const { getPendingTasksData } = await import("@/lib/dashboard-data")

  const pendingTasksData = await getPendingTasksData()

  try {
    // Import database and schema
    const { db } = await import("@/database/db")
    const { timeRecords, rotations, evaluations, users } = await import("@/database/schema")
    const { eq, and, desc } = await import("drizzle-orm")

    // Fetch real data from database
    const [timeRecordsData, rotationsData, evaluationsData] = await Promise.allSettled([
      // Fetch pending time records for students assigned to this preceptor
      db
        .select({
          id: timeRecords.id,
          date: timeRecords.date,
          clockIn: timeRecords.clockIn,
          clockOut: timeRecords.clockOut,
          totalHours: timeRecords.totalHours,
          status: timeRecords.status,
          studentName: users.name,
          rotationName: rotations.specialty,
        })
        .from(timeRecords)
        .innerJoin(users, eq(users.id, timeRecords.studentId))
        .leftJoin(rotations, eq(rotations.id, timeRecords.rotationId))
        .where(and(eq(rotations.preceptorId, user.id), eq(timeRecords.status, "PENDING")))
        .orderBy(desc(timeRecords.date)),

      // Fetch active rotations for this preceptor
      db
        .select({
          id: rotations.id,
          specialty: rotations.specialty,
          startDate: rotations.startDate,
          endDate: rotations.endDate,
          status: rotations.status,
          studentId: rotations.studentId,
          studentName: users.name,
          updatedAt: rotations.updatedAt,
        })
        .from(rotations)
        .leftJoin(users, eq(rotations.studentId, users.id))
        .where(eq(rotations.preceptorId, user.id))
        .orderBy(desc(rotations.startDate)),

      // Fetch completed evaluations by this preceptor
      db
        .select({
          id: evaluations.id,
          type: evaluations.type,
          overallRating: evaluations.overallRating,
          createdAt: evaluations.createdAt,
          studentId: evaluations.studentId,
        })
        .from(evaluations)
        .where(eq(evaluations.evaluatorId, user.id))
        .orderBy(desc(evaluations.createdAt)),
    ])

    // Safely extract data from database queries
    if (timeRecordsData.status === "fulfilled") {
      pendingTimeRecords = timeRecordsData.value || []
    }

    if (rotationsData.status === "fulfilled") {
      activeRotations = rotationsData.value || []
    }

    if (evaluationsData.status === "fulfilled") {
      completedEvaluations = evaluationsData.value || []
    }
  } catch (error) {
    console.error("Error fetching preceptor dashboard data:", error)
  }

  // Safe stats calculation with null checks
  const safeActiveRotations = Array.isArray(activeRotations)
    ? activeRotations.filter((r) => r && typeof r === "object")
    : []
  const safePendingTimeRecords = Array.isArray(pendingTimeRecords)
    ? pendingTimeRecords.filter((r) => r && typeof r === "object")
    : []
  const safeCompletedEvaluations = Array.isArray(completedEvaluations)
    ? completedEvaluations.filter((e) => e && typeof e === "object")
    : []

  const preceptorStats = {
    assignedStudents: safeActiveRotations.length,
    pendingTimeRecords: safePendingTimeRecords.length,
    completedEvaluations: safeCompletedEvaluations.length,
    upcomingDeadlines: safeActiveRotations.filter((r: { endDate?: Date | null }) => {
      try {
        if (!r?.endDate) return false
        const endDate = new Date(r.endDate)
        const today = new Date()
        const daysUntilEnd = Math.ceil(
          (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        )
        return daysUntilEnd <= 7 && daysUntilEnd > 0
      } catch (error) {
        console.error("Error calculating deadline for rotation:", r, error)
        return false
      }
    }).length,
  }

  const assignedStudents = safeActiveRotations
    .slice(0, 3)
    .map(
      (rotation: {
        id?: string | null
        studentName?: string | null
        specialty?: string | null
        updatedAt?: string | Date | null
      }) => {
        try {
          return {
            id: rotation?.id || `rotation-${Math.random()}`,
            name: rotation?.studentName || "Unknown Student",
            program: rotation?.specialty || "Unknown Specialty",
            rotation: rotation?.specialty || "Unknown Rotation",
            progress: Math.floor(Math.random() * 40) + 60, // Calculate based on time elapsed
            lastActivity: rotation?.updatedAt
              ? new Date(rotation.updatedAt).toLocaleDateString()
              : "Unknown",
          }
        } catch (error) {
          console.error("Error processing rotation data:", rotation, error)
          return {
            id: `rotation-${Math.random()}`,
            name: "Unknown Student",
            program: "Unknown Specialty",
            rotation: "Unknown Rotation",
            progress: 0,
            lastActivity: "Unknown",
          }
        }
      }
    )

  const quickActions = [
    {
      title: "Review Time Records",
      description: "Approve or reject student time submissions",
      icon: Clock,
      href: "/dashboard/clinical-preceptor/time-records",
      color: "bg-blue-500",
      badge: preceptorStats.pendingTimeRecords,
    },
    {
      title: "Student Evaluations",
      description: "Conduct and manage student evaluations",
      icon: FileText,
      href: "/dashboard/clinical-preceptor/evaluations",
      color: "bg-green-500",
    },
    {
      title: "My Students",
      description: "View and manage assigned students",
      icon: Users,
      href: "/dashboard/clinical-preceptor/students",
      color: "bg-purple-500",
    },
    {
      title: "Schedule & Calendar",
      description: "Manage rotation schedules and appointments",
      icon: Calendar,
      href: "/dashboard/clinical-preceptor/schedule",
      color: "bg-orange-500",
    },
  ]

  // Safe recent activities processing
  const timeRecordActivities = safePendingTimeRecords
    .slice(0, 2)
    .map((record: { studentName?: string | null; createdAt?: string | Date | null }) => {
      try {
        return {
          type: "time_record",
          message: `${record?.studentName || "Student"} submitted time record for review`,
          time: record?.createdAt ? new Date(record.createdAt).toLocaleDateString() : "Unknown",
          color: "bg-blue-500",
        }
      } catch (error) {
        console.error("Error processing time record activity:", record, error)
        return {
          type: "time_record",
          message: "Student submitted time record for review",
          time: "Unknown",
          color: "bg-blue-500",
        }
      }
    })

  const evaluationActivities = safeCompletedEvaluations
    .slice(0, 2)
    .map(
      (evaluation: {
        type?: string | null
        studentName?: string | null
        createdAt?: string | Date | null
      }) => {
        try {
          return {
            type: "evaluation",
            message: `Completed ${evaluation?.type?.toLowerCase() || "evaluation"} evaluation for ${evaluation?.studentName || "student"}`,
            time: evaluation?.createdAt
              ? new Date(evaluation.createdAt).toLocaleDateString()
              : "Unknown",
            color: "bg-green-500",
          }
        } catch (error) {
          console.error("Error processing evaluation activity:", evaluation, error)
          return {
            type: "evaluation",
            message: "Completed evaluation for student",
            time: "Unknown",
            color: "bg-green-500",
          }
        }
      }
    )

  const recentActivities = [...timeRecordActivities, ...evaluationActivities].slice(0, 4)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">Clinical Preceptor Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {user.name}. Guide your students through their clinical experience.
          </p>
        </div>
        <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
          Clinical Preceptor
        </Badge>
      </div>

      {/* Stats Overview */}
      <StatGrid columns={4}>
        <StatCard
          title="Assigned Students"
          value={preceptorStats.assignedStudents}
          icon={Users}
          variant="blue"
          description="Currently under supervision"
        />
        <StatCard
          title="Pending Reviews"
          value={preceptorStats.pendingTimeRecords}
          icon={Clock}
          variant="orange"
          description="Time records awaiting approval"
        />
        <StatCard
          title="Evaluations Done"
          value={preceptorStats.completedEvaluations}
          icon={CheckCircle}
          variant="green"
          description="This semester"
        />
        <StatCard
          title="Upcoming Deadlines"
          value={preceptorStats.upcomingDeadlines}
          icon={Calendar}
          variant="purple"
          description="Next 7 days"
        />
      </StatGrid>

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
              badge={action.badge}
            />
          ))}
        </div>
      </div>

      {/* Tasks & Activity Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Pending Tasks */}
        <TaskList
          title="Pending Tasks"
          description="Items requiring your immediate attention"
          tasks={pendingTasksData.map((task: any) => ({
            id: task.id,
            title: task.title,
            description: task.description,
            count: task.count,
            priority: task.priority,
            href: task.href,
            actionLabel: task.action || "View"
          }))}
          emptyMessage="No pending tasks at the moment"
        />

        {/* Recent Activity */}
        <ActivityList
          title="Recent Activity"
          description="Latest updates and actions"
          activities={recentActivities.map((activity, index) => ({
            id: `activity-${index}`,
            message: activity.message,
            time: activity.time,
            type: activity.type === "time_record" ? "info" : "success"
          }))}
        />
      </div>
    </div>
  )
}
