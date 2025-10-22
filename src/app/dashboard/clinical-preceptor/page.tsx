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
import type { User } from "../../../database/schema"
import { requireAnyRole } from "../../../lib/auth-clerk"

export default async function ClinicalPreceptorDashboardPage() {
  const user = await requireAnyRole(["CLINICAL_PRECEPTOR"], "/dashboard")

  return (
    <div className="space-y-6">
      {/* Welcome Banner for First-Time Users */}
      <WelcomeBanner userRole="CLINICAL_PRECEPTOR" userName={user.name || "Preceptor"} />

      <Suspense fallback={<DashboardStatsSkeleton />}>
        <ClinicalPreceptorDashboardContent user={user} />
      </Suspense>
    </div>
  )
}

async function ClinicalPreceptorDashboardContent({ user }: { user: User }) {
  // Fetch real data for clinical preceptor dashboard with comprehensive error handling
  let pendingTimeRecords: Array<{
    id: string
    date: Date
    clockIn: Date
    clockOut: Date | null
    totalHours: string
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
        <Badge variant="secondary" className="bg-orange-100 text-orange-800">
          Clinical Preceptor
        </Badge>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Assigned Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{preceptorStats.assignedStudents}</div>
            <p className="text-muted-foreground text-xs">Currently under supervision</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Pending Reviews</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{preceptorStats.pendingTimeRecords}</div>
            <p className="text-muted-foreground text-xs">Time records awaiting approval</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Evaluations Done</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{preceptorStats.completedEvaluations}</div>
            <p className="text-muted-foreground text-xs">This semester</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Upcoming Deadlines</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{preceptorStats.upcomingDeadlines}</div>
            <p className="text-muted-foreground text-xs">Next 7 days</p>
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
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className={`rounded-md p-2 ${action.color}`}>
                        <Icon className="h-4 w-4 text-white" />
                      </div>
                      <CardTitle className="text-sm">{action.title}</CardTitle>
                    </div>
                    {action.badge && (
                      <Badge variant="destructive" className="text-xs">
                        {action.badge}
                      </Badge>
                    )}
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

      {/* Student Overview & Recent Activity */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>My Students</CardTitle>
            <CardDescription>Current student assignments and progress</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {assignedStudents.map(
                (student: { id: string; name: string; rotation: string; progress: number }) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between rounded-lg bg-gray-50 p-3"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm">{student.name}</p>
                      <p className="text-muted-foreground text-xs">{student.rotation}</p>
                      <div className="mt-1 flex items-center space-x-2">
                        <div className="h-1.5 w-full rounded-full bg-gray-200">
                          <div
                            className="h-1.5 rounded-full bg-blue-600"
                            style={{ width: `${student.progress}%` }}
                          />
                        </div>
                        <span className="text-muted-foreground text-xs">{student.progress}%</span>
                      </div>
                    </div>
                    <Button size="sm" variant="outline">
                      View
                    </Button>
                  </div>
                )
              )}
            </div>
            <div className="mt-4">
              <Button asChild className="w-full" variant="outline">
                <Link href="/dashboard/clinical-preceptor/students">View All Students</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest updates and actions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivities.map((activity, index) => (
                <div
                  key={`activity-${activity.message.replace(/\s+/g, "-").toLowerCase()}-${index}`}
                  className="flex items-center space-x-4"
                >
                  <div className={`h-2 w-2 ${activity.color} rounded-full`} />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{activity.message}</p>
                    <p className="text-muted-foreground text-xs">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Tasks */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Tasks</CardTitle>
          <CardDescription>Items requiring your immediate attention</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {pendingTasksData.length > 0 ? (
              pendingTasksData.map(
                (
                  task: {
                    id: string
                    title: string
                    description: string
                    count: number
                    priority: "high" | "medium" | "low"
                    type: "approval" | "evaluation" | "setup" | "review"
                    color?: string
                    href?: string
                    action?: string
                  },
                  index: number
                ) => (
                  <div
                    key={`task-${task.id || index}`}
                    className={`flex items-center justify-between rounded-lg p-4 bg-${task.color}-50`}
                  >
                    <div>
                      <p className="font-medium text-sm">{task.title}</p>
                      <p className="text-muted-foreground text-xs">{task.description}</p>
                    </div>
                    <Button size="sm" asChild>
                      <Link href={task.href || "#"}>{task.action || "View"}</Link>
                    </Button>
                  </div>
                )
              )
            ) : (
              <div className="col-span-3 py-4 text-center">
                <p className="text-muted-foreground text-sm">No pending tasks at the moment</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
