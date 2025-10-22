"use client"

import {
  AlertCircle,
  BarChart3,
  BookOpen,
  Calendar,
  CheckCircle,
  Clock,
  FileText,
  GraduationCap,
  TrendingUp,
  Users,
} from "lucide-react"
import { Suspense } from "react"
import { WelcomeBanner } from "@/components/dashboard/welcome-banner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { UserRole } from "@/types"

interface User {
  id: string
  name: string | null
  email: string
  role: UserRole
  schoolId: string | null
  onboardingCompleted: boolean
}

interface PendingTask {
  title: string
  description: string
  count: number
}

interface RecentActivity {
  action: string
  details: string
  timestamp: string
}

interface SchoolStats {
  totalStudents?: number
  totalPrograms?: number
  pendingEvaluations?: number
  avgCompetencyProgress?: number
}

interface DashboardData {
  pendingTasks: PendingTask[]
  recentActivities: RecentActivity[]
  schoolStats: SchoolStats
}

interface SchoolAdminDashboardClientProps {
  user: User
  dashboardData: DashboardData
}

export function SchoolAdminDashboardClient({
  user,
  dashboardData,
}: SchoolAdminDashboardClientProps) {
  const { pendingTasks, recentActivities, schoolStats } = dashboardData

  const quickActions = [
    {
      title: "Manage Students",
      description: "View and manage student enrollment",
      icon: Users,
      href: "/dashboard/school-admin/students",
      color: "bg-blue-500",
    },
    {
      title: "Program Management",
      description: "Configure curricula and requirements",
      icon: BookOpen,
      href: "/dashboard/school-admin/programs",
      color: "bg-green-500",
    },
    {
      title: "Clinical Sites",
      description: "Manage rotation sites and partnerships",
      icon: Calendar,
      href: "/dashboard/school-admin/sites",
      color: "bg-purple-500",
    },
    {
      title: "Analytics & Reports",
      description: "View performance metrics and reports",
      icon: BarChart3,
      href: "/dashboard/school-admin/reports",
      color: "bg-indigo-500",
    },
    {
      title: "Faculty & Staff",
      description: "Manage preceptors and supervisors",
      icon: GraduationCap,
      href: "/dashboard/school-admin/faculty-staff",
      color: "bg-teal-500",
    },
    {
      title: "Timecard Monitoring",
      description: "Monitor student timecards and corrections",
      icon: Clock,
      href: "/dashboard/school-admin/time-records",
      color: "bg-red-500",
    },
  ]

  return (
    <div className="container mx-auto space-y-6 px-4 py-6">
      {/* School Name Display */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">School Administration</h1>
          <p className="mt-1 text-muted-foreground">Manage your institution and student programs</p>
        </div>
      </div>

      {/* Welcome Banner */}
      <Suspense fallback={<div className="h-32 animate-pulse rounded-lg bg-gray-100" />}>
        <WelcomeBanner userRole={user.role} userName={user.name || "Administrator"} />
      </Suspense>

      {/* Dashboard Content */}
      <div className="space-y-6">
        {/* Statistics Cards */}
        {schoolStats && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 animate-in slide-in-from-bottom-4 duration-700">
            <Card className="border-blue-500/20 bg-card/50 backdrop-blur hover:border-blue-500/30">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="font-medium text-sm text-foreground">Total Students</CardTitle>
                <div className="rounded-full bg-blue-500/10 p-2">
                  <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="font-bold text-2xl text-foreground">{schoolStats.totalStudents || 0}</div>
                <p className="text-muted-foreground text-xs">Active learners in programs</p>
                <div className="mt-2 h-1 w-full bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${Math.min((schoolStats.totalStudents || 0) / 100 * 100, 100)}%` }}
                  />
                </div>
              </CardContent>
            </Card>
            <Card className="border-green-500/20 bg-card/50 backdrop-blur hover:border-green-500/30">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="font-medium text-sm text-foreground">Active Programs</CardTitle>
                <div className="rounded-full bg-green-500/10 p-2">
                  <BookOpen className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="font-bold text-2xl text-foreground">{schoolStats.totalPrograms || 0}</div>
                <p className="text-muted-foreground text-xs">Educational programs running</p>
                <div className="mt-2 h-1 w-full bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-600 dark:bg-green-400 transition-all duration-300"
                    style={{ width: `${Math.min((schoolStats.totalPrograms || 0) / 50 * 100, 100)}%` }}
                  />
                </div>
              </CardContent>
            </Card>
            <Card className="border-orange-500/20 bg-card/50 backdrop-blur hover:border-orange-500/30">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="font-medium text-sm text-foreground">Pending Evaluations</CardTitle>
                <div className="rounded-full bg-orange-500/10 p-2">
                  <FileText className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="font-bold text-2xl text-foreground">{schoolStats.pendingEvaluations || 0}</div>
                <p className="text-muted-foreground text-xs">Awaiting review</p>
                <div className="mt-2 h-1 w-full bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-orange-600 dark:bg-orange-400 transition-all duration-300"
                    style={{ width: `${Math.min((schoolStats.pendingEvaluations || 0) / 25 * 100, 100)}%` }}
                  />
                </div>
              </CardContent>
            </Card>
            <Card className="border-purple-500/20 bg-card/50 backdrop-blur hover:border-purple-500/30">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="font-medium text-sm text-foreground">Completion Rate</CardTitle>
                <div className="rounded-full bg-purple-500/10 p-2">
                  <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="font-bold text-2xl text-foreground">
                  {Math.round(schoolStats.avgCompetencyProgress || 0)}%
                </div>
                <p className="text-muted-foreground text-xs">Average competency progress</p>
                <div className="mt-2 h-1 w-full bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-purple-600 dark:bg-purple-400 transition-all duration-300"
                    style={{ width: `${schoolStats.avgCompetencyProgress || 0}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks and management tools</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {quickActions.map((action) => {
                const Icon = action.icon
                return (
                  <Button
                    key={action.title}
                    variant="outline"
                    className="h-auto justify-start p-4 hover:bg-secondary/80"
                    asChild
                  >
                    <a href={action.href}>
                      <div className="flex items-center space-x-3">
                        <div className={`rounded-md p-2 ${action.color} text-white`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="text-left">
                          <div className="font-medium">{action.title}</div>
                          <div className="text-muted-foreground text-sm">{action.description}</div>
                        </div>
                      </div>
                    </a>
                  </Button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2 animate-in slide-in-from-bottom-6 duration-900">
          {/* Pending Tasks */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Pending Tasks
              </CardTitle>
              <CardDescription>Items requiring your attention</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingTasks.length > 0 ? (
                <div className="space-y-3">
                  {pendingTasks.slice(0, 5).map((task, index) => (
                    <div
                      key={`pending-task-${task.title.replace(/\s+/g, '-').toLowerCase()}-${index}`}
                      className="flex items-center justify-between rounded-lg bg-secondary/50 p-3 transition-colors hover:bg-secondary/70"
                    >
                      <div>
                        <p className="font-medium text-foreground">{task.title}</p>
                        <p className="text-muted-foreground text-sm">{task.description}</p>
                      </div>
                      <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
                        {task.count}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-muted-foreground">
                  <CheckCircle className="mx-auto mb-2 h-8 w-8" />
                  <p>No pending tasks</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activities */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activities</CardTitle>
              <CardDescription>Latest actions in your school</CardDescription>
            </CardHeader>
            <CardContent>
              {recentActivities.length > 0 ? (
                <div className="space-y-3">
                  {recentActivities.slice(0, 5).map((activity, index) => (
                    <div
                      key={`recent-activity-${activity.action.replace(/\s+/g, '-').toLowerCase()}-${index}`}
                      className="flex items-start space-x-3 rounded-lg bg-secondary/50 p-3 transition-colors hover:bg-secondary/70"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{activity.action}</p>
                        <p className="text-muted-foreground text-sm">{activity.details}</p>
                        <p className="mt-1 text-muted-foreground text-xs">
                          {new Date(activity.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-muted-foreground">
                  <p>No recent activities</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export function DashboardError({ error }: { error: string }) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Card className="border-destructive/20 bg-destructive/5 max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 rounded-full bg-destructive/10 p-3 w-fit">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-destructive">Dashboard Error</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">{error}</p>
          <Button 
            onClick={() => window.location.reload()} 
            variant="outline"
            className="border-destructive/20 text-destructive hover:bg-destructive/10"
          >
            Retry Loading
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-6 animate-in fade-in-0 duration-1000">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-1 w-full mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border">
          <CardHeader>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-6 w-16" />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardHeader>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-6 w-16" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
