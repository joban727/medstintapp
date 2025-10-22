// TODO: Add cache invalidation hooks for mutations
"use client"

import { useAuth } from "@clerk/nextjs"
import { Activity, AlertCircle, Award, BarChart3, CheckCircle, Clock, Target } from "lucide-react"
import { useCallback, useEffect, useState, memo, useMemo } from "react"

import { Alert, AlertDescription } from "../ui/alert"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
import { Progress } from "../ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"

interface ProgressSnapshot {
  id: string
  userId: string
  competencyId: string
  assignmentId: string
  currentScore: number
  maxScore: number
  status: "not_started" | "in_progress" | "completed" | "needs_review"
  lastUpdated: string
  competency?: {
    name: string
    category: string
    description: string
  }
  assignment?: {
    title: string
    dueDate: string
  }
}

interface CompetencyAnalytics {
  id: string
  type: "progress_overview" | "competency_performance" | "learning_trends"
  data: Record<string, unknown>
  generatedAt: string
}

interface CompetencyNotification {
  id: string
  userId: string
  type: "assignment_due" | "competency_completed" | "feedback_available" | "milestone_reached"
  title: string
  message: string
  isRead: boolean
  createdAt: string
}

interface CompetencyDashboardProps {
  userId: string
}

export const CompetencyDashboard = memo(function CompetencyDashboard({ userId }: CompetencyDashboardProps) {
  const { getToken } = useAuth()
  const [progressSnapshots, setProgressSnapshots] = useState<ProgressSnapshot[]>([])
  const [_analytics, setAnalytics] = useState<CompetencyAnalytics[]>([])
  const [notifications, setNotifications] = useState<CompetencyNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Periodic refresh for updates (replacing WebSocket)
  const [lastRefresh, setLastRefresh] = useState(Date.now())

  const fetchProgressData = useCallback(async () => {
    try {
      const progressResponse = await fetch(`/api/competency-progress?userId=${userId}&limit=50`)
      if (!progressResponse.ok) throw new Error("Failed to fetch progress data")
      const progressData = await progressResponse.json()
      setProgressSnapshots(progressData.snapshots || [])
    } catch (_err) {
      // Failed to fetch progress data
    }
  }, [userId])

  const fetchAnalytics = useCallback(async () => {
    try {
      const token = await getToken()
      const analyticsResponse = await fetch(
        `/api/competency-analytics?userId=${userId}&analyticsType=PROGRESS_OVERVIEW`,
        {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      )
      if (!analyticsResponse.ok) throw new Error("Failed to fetch analytics")
      const analyticsData = await analyticsResponse.json()
      setAnalytics(analyticsData.analytics || [])
    } catch (err: unknown) {
      // In development, silently handle ERR_ABORTED errors from HMR
      if (
        process.env.NODE_ENV === "development" &&
        (err instanceof Error && (err.message?.includes("ERR_ABORTED") || err.name === "AbortError"))
      ) {
        return
      }
      // Failed to fetch analytics
    }
  }, [userId, getToken])

  const fetchNotifications = useCallback(async () => {
    try {
      const token = await getToken()
      const notificationsResponse = await fetch(
        `/api/competency-notifications?userId=${userId}&limit=10`,
        {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      )
      if (!notificationsResponse.ok) throw new Error("Failed to fetch notifications")
      const notificationsData = await notificationsResponse.json()
      setNotifications(notificationsData.data || [])
    } catch (err: unknown) {
      // In development, silently handle ERR_ABORTED errors from HMR
      if (
        process.env.NODE_ENV === "development" &&
        (err instanceof Error && (err.message?.includes("ERR_ABORTED") || err.name === "AbortError"))
      ) {
        return
      }
      // Failed to fetch notifications
    }
  }, [userId, getToken])

  const fetchCompetencyData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      await Promise.all([fetchProgressData(), fetchAnalytics(), fetchNotifications()])
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }, [fetchProgressData, fetchAnalytics, fetchNotifications])

  useEffect(() => {
    fetchCompetencyData()
  }, [fetchCompetencyData])

  // Periodic refresh to replace WebSocket real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setLastRefresh(Date.now())
      fetchCompetencyData()
    }, 30000) // Refresh every 30 seconds

    return () => clearInterval(interval)
  }, [fetchCompetencyData])

  // Auto-refresh when lastRefresh changes (for manual refresh triggers)
  useEffect(() => {
    if (lastRefresh > 0) {
      fetchCompetencyData()
    }
  }, [lastRefresh, fetchCompetencyData])

  const markNotificationAsRead = async (notificationId: string) => {
    try {
      const token = await getToken()
      const response = await fetch("/api/competency-notifications", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ notificationId, isRead: true }),
      })

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
        )
      }
    } catch (_err) {
      // Failed to mark notification as read
    }
  }

  // Calculate overall statistics - memoized for performance
  const overallStats = useMemo(() => ({
    totalCompetencies: progressSnapshots?.length || 0,
    completedCompetencies: progressSnapshots?.filter((p) => p.status === "completed").length || 0,
    inProgressCompetencies:
      progressSnapshots?.filter((p) => p.status === "in_progress").length || 0,
    averageScore:
      progressSnapshots && progressSnapshots.length > 0
        ? Math.round(
            progressSnapshots.reduce((sum, p) => sum + (p.currentScore / p.maxScore) * 100, 0) /
              progressSnapshots.length
          )
        : 0,
    unreadNotifications: notifications?.filter((n) => !n.isRead).length || 0,
  }), [progressSnapshots, notifications])

  // Group progress by category - memoized for performance
  const progressByCategory = useMemo(() => progressSnapshots.reduce(
    (acc, snapshot) => {
      const category = snapshot.competency?.category || "General"
      if (!acc[category]) {
        acc[category] = {
          total: 0,
          completed: 0,
          inProgress: 0,
          averageScore: 0,
          snapshots: [],
        }
      }
      acc[category].total++
      acc[category].snapshots.push(snapshot)
      if (snapshot.status === "completed") acc[category].completed++
      if (snapshot.status === "in_progress") acc[category].inProgress++
      return acc
    },
    {} as Record<string, {
      total: number;
      completed: number;
      inProgress: number;
      averageScore: number;
      snapshots: ProgressSnapshot[];
    }>
  ), [progressSnapshots])

  // Calculate average scores for each category - memoized for performance
  const progressByCategoryWithScores = useMemo(() => {
    const result = { ...progressByCategory }
    Object.keys(result).forEach((category) => {
      const categoryData = result[category]
      categoryData.averageScore =
        categoryData.snapshots.length > 0
          ? Math.round(
              categoryData.snapshots.reduce(
                (sum: number, s: ProgressSnapshot) => sum + (s.currentScore / s.maxScore) * 100,
                0
              ) / categoryData.snapshots.length
            )
          : 0
    })
    return result
  }, [progressByCategory])

  // Recent activity from progress snapshots - memoized for performance
  const recentActivity = useMemo(() => progressSnapshots
    .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
    .slice(0, 5)
    .map((snapshot) => ({
      id: snapshot.id,
      title: snapshot.competency?.name || "Unknown Competency",
      description: `Score: ${snapshot.currentScore}/${snapshot.maxScore} (${Math.round((snapshot.currentScore / snapshot.maxScore) * 100)}%)`,
      time: new Date(snapshot.lastUpdated).toLocaleDateString(),
      status: snapshot.status,
      icon:
        snapshot.status === "completed"
          ? CheckCircle
          : snapshot.status === "in_progress"
            ? Clock
            : snapshot.status === "needs_review"
              ? AlertCircle
              : Target,
    })), [progressSnapshots])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {['competency-1', 'competency-2', 'competency-3', 'competency-4'].map((key) => (
            <Card key={key} className="animate-pulse">
              <CardHeader className="space-y-0 pb-2">
                <div className="h-4 w-3/4 rounded bg-muted" />
              </CardHeader>
              <CardContent>
                <div className="mb-2 h-8 w-1/2 rounded bg-muted" />
                <div className="h-3 w-full rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
            <h3 className="mb-2 font-semibold text-lg">Error Loading Competency Data</h3>
            <p className="mb-4 text-muted-foreground">{error}</p>
            <Button onClick={fetchCompetencyData}>Try Again</Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">


      {/* Overview Statistics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Total Competencies</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{overallStats.totalCompetencies}</div>
            <p className="text-muted-foreground text-xs">
              {overallStats.completedCompetencies} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Completion Rate</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">
              {overallStats.totalCompetencies > 0
                ? Math.round(
                    (overallStats.completedCompetencies / overallStats.totalCompetencies) * 100
                  )
                : 0}
              %
            </div>
            <Progress
              value={
                overallStats.totalCompetencies > 0
                  ? (overallStats.completedCompetencies / overallStats.totalCompetencies) * 100
                  : 0
              }
              className="mt-2 h-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Average Score</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{overallStats.averageScore}%</div>
            <p className="text-muted-foreground text-xs">
              {overallStats.inProgressCompetencies} in progress
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Notifications</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{overallStats.unreadNotifications}</div>
            <p className="text-muted-foreground text-xs">unread updates</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="progress" className="space-y-4">
        <TabsList>
          <TabsTrigger value="progress">Progress Overview</TabsTrigger>
          <TabsTrigger value="categories">By Category</TabsTrigger>
          <TabsTrigger value="activity">Recent Activity</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="progress" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Competency Progress Overview</CardTitle>
              <CardDescription>
                Track your overall competency development and achievements
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {!progressSnapshots || progressSnapshots.length === 0 ? (
                  <div className="py-8 text-center">
                    <Target className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                    <h3 className="mb-2 font-semibold text-lg">No Competencies Yet</h3>
                    <p className="text-muted-foreground">
                      Your competency progress will appear here once assignments are created.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {progressSnapshots.slice(0, 6).map((snapshot) => {
                      const progressPercentage = Math.round(
                        (snapshot.currentScore / snapshot.maxScore) * 100
                      )
                      return (
                        <Card key={snapshot.id} className="relative">
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm">
                                {snapshot.competency?.name || "Unknown Competency"}
                              </CardTitle>
                              <Badge
                                variant={
                                  snapshot.status === "completed"
                                    ? "default"
                                    : snapshot.status === "in_progress"
                                      ? "secondary"
                                      : snapshot.status === "needs_review"
                                        ? "destructive"
                                        : "outline"
                                }
                              >
                                {snapshot.status.replace("_", " ")}
                              </Badge>
                            </div>
                            <CardDescription className="text-xs">
                              {snapshot.competency?.category || "General"}
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span>Score</span>
                                <span>
                                  {snapshot.currentScore}/{snapshot.maxScore}
                                </span>
                              </div>
                              <Progress value={progressPercentage} className="h-2" />
                              <div className="flex justify-between text-muted-foreground text-xs">
                                <span>{progressPercentage}% complete</span>
                                <span>
                                  Updated {new Date(snapshot.lastUpdated).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(progressByCategoryWithScores).map(([category, data]) => (
              <Card key={category}>
                <CardHeader>
                  <CardTitle className="text-lg">{category}</CardTitle>
                  <CardDescription>
                    {data.completed} of {data.total} completed
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Progress</span>
                        <span>{Math.round((data.completed / data.total) * 100)}%</span>
                      </div>
                      <Progress value={(data.completed / data.total) * 100} className="h-2" />
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="font-bold text-2xl text-green-600">{data.completed}</div>
                        <div className="text-muted-foreground">Completed</div>
                      </div>
                      <div>
                        <div className="font-bold text-2xl text-blue-600">{data.inProgress}</div>
                        <div className="text-muted-foreground">In Progress</div>
                      </div>
                    </div>

                    <div className="border-t pt-2">
                      <div className="flex justify-between text-sm">
                        <span>Average Score</span>
                        <span className="font-semibold">{data.averageScore}%</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Your latest competency updates and achievements</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {!recentActivity || recentActivity.length === 0 ? (
                  <div className="py-8 text-center">
                    <Activity className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                    <h3 className="mb-2 font-semibold text-lg">No Recent Activity</h3>
                    <p className="text-muted-foreground">
                      Your recent competency updates will appear here.
                    </p>
                  </div>
                ) : (
                  recentActivity.map((activity) => {
                    const Icon = activity.icon
                    return (
                      <div
                        key={activity.id}
                        className="flex items-start space-x-3 rounded-lg bg-muted/50 p-3"
                      >
                        <div className="rounded-lg bg-white p-2">
                          <Icon
                            className={`h-4 w-4 ${
                              activity.status === "completed"
                                ? "text-green-600"
                                : activity.status === "in_progress"
                                  ? "text-blue-600"
                                  : activity.status === "needs_review"
                                    ? "text-red-600"
                                    : "text-gray-600"
                            }`}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-medium text-sm">{activity.title}</h4>
                          <p className="text-muted-foreground text-sm">{activity.description}</p>
                          <p className="mt-1 text-muted-foreground text-xs">{activity.time}</p>
                        </div>
                        <Badge
                          variant={
                            activity.status === "completed"
                              ? "default"
                              : activity.status === "in_progress"
                                ? "secondary"
                                : activity.status === "needs_review"
                                  ? "destructive"
                                  : "outline"
                          }
                        >
                          {activity.status.replace("_", " ")}
                        </Badge>
                      </div>
                    )
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Important updates about your competency progress</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {!notifications || notifications.length === 0 ? (
                  <div className="py-8 text-center">
                    <Activity className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                    <h3 className="mb-2 font-semibold text-lg">No Notifications</h3>
                    <p className="text-muted-foreground">
                      You're all caught up! New notifications will appear here.
                    </p>
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <button
                      key={notification.id}
                      type="button"
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${
                        notification.isRead ? "bg-muted/30" : "border-blue-200 bg-blue-50"
                      }`}
                      onClick={() =>
                        !notification.isRead && markNotificationAsRead(notification.id)
                      }
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4
                            className={`font-medium text-sm ${
                              notification.isRead ? "text-muted-foreground" : "text-foreground"
                            }`}
                          >
                            {notification.title}
                          </h4>
                          <p className="mt-1 text-muted-foreground text-sm">
                            {notification.message}
                          </p>
                          <p className="mt-2 text-muted-foreground text-xs">
                            {new Date(notification.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge
                            variant={
                              notification.type === "assignment_due"
                                ? "destructive"
                                : notification.type === "competency_completed"
                                  ? "default"
                                  : notification.type === "feedback_available"
                                    ? "secondary"
                                    : "outline"
                            }
                          >
                            {notification.type.replace("_", " ")}
                          </Badge>
                          {!notification.isRead && (
                            <div className="h-2 w-2 rounded-full bg-blue-600" />
                          )}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
})
