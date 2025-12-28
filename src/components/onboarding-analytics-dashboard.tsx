"use client"

import { AlertCircle, CheckCircle, Clock, TrendingUp, Users } from "lucide-react"
import { useEffect, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"

interface OnboardingAnalytics {
  totalSessions: number
  completedSessions: number
  abandonedSessions: number
  averageCompletionTime: number
  completionRate: number
  dailyCompletionRates: Array<{
    date: string
    completion_rate: number
    total_sessions: number
    completed_sessions: number
  }>
  stepBreakdown: Array<{
    step: number
    step_name: string
    completions: number
    abandonment_rate: number
  }>
  recentSessions: Array<{
    id: string
    user_id: string
    current_step: number
    status: string
    created_at: string
    updated_at: string
  }>
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"]

export function OnboardingAnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<OnboardingAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>("")

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true)
        const response = await fetch("/api/analytics/onboarding")
        if (!response.ok) {
          const errorData = await response
            .json()
            .catch((err) => {
              console.error("Failed to parse JSON response:", err)
              throw new Error("Invalid response format")
            })
            .catch(() => ({}))
          throw new Error(errorData.error || errorData.message || "Failed to fetch analytics data")
        }
        const data = await response.json().catch((err) => {
          console.error("Failed to parse JSON response:", err)
          throw new Error("Invalid response format")
        })
        setAnalytics(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred")
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [])

  if (loading) {
    return (
      <div className="gap-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={`onboarding-skeleton-${i + 1}`}>
              <CardHeader className="flex items-center justify-between gap-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
                <Skeleton className="mt-1 h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-text-primary">
            <AlertCircle className="h-6 w-6 text-destructive" />
            Error Loading Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-text-secondary text-base">{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (!analytics) {
    return null
  }

  const pieData = [
    { name: "Completed", value: analytics.completedSessions, color: "#00C49F" },
    { name: "Abandoned", value: analytics.abandonedSessions, color: "#FF8042" },
  ]

  return (
    <div className="gap-6">
      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex items-center justify-between gap-0 pb-2">
            <CardTitle className="font-medium text-sm">Total Sessions</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{analytics.totalSessions}</div>
            <p className="text-muted-foreground text-xs">All onboarding sessions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex items-center justify-between gap-0 pb-2">
            <CardTitle className="font-medium text-sm">Completion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{analytics.completionRate.toFixed(1)}%</div>
            <Progress value={analytics.completionRate} className="mt-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex items-center justify-between gap-0 pb-2">
            <CardTitle className="font-medium text-sm">Avg. Completion Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">
              {Math.round(analytics.averageCompletionTime)} min
            </div>
            <p className="text-muted-foreground text-xs">Time to complete onboarding</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex items-center justify-between gap-0 pb-2">
            <CardTitle className="font-medium text-sm">Completed Sessions</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{analytics.completedSessions}</div>
            <p className="text-muted-foreground text-xs">Successfully completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Daily Completion Rates */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Completion Rates</CardTitle>
            <CardDescription>Completion rates over the last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.dailyCompletionRates}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => new Date(value).toLocaleDateString()}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(value) => new Date(value).toLocaleDateString()}
                  formatter={(value: number) => [`${value.toFixed(1)}%`, "Completion Rate"]}
                />
                <Bar dataKey="completion_rate" fill="#0088FE" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Session Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Session Status Distribution</CardTitle>
            <CardDescription>Breakdown of completed vs abandoned sessions</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry: any) => `${entry.name} ${(entry.percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Step-by-Step Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Step-by-Step Analysis</CardTitle>
          <CardDescription>
            Completion and abandonment rates for each onboarding step
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="gap-4">
            {analytics.stepBreakdown.map((step) => (
              <div
                key={step.step}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Step {step.step}</Badge>
                    <span className="font-medium">{step.step_name}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-muted-foreground text-sm">
                    <span>{step.completions} completions</span>
                    <span>{step.abandonment_rate.toFixed(1)}% abandonment rate</span>
                  </div>
                </div>
                <div className="w-32">
                  <Progress value={100 - step.abandonment_rate} className="h-2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Sessions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Sessions</CardTitle>
          <CardDescription>Latest onboarding sessions and their current status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="gap-2">
            {analytics.recentSessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="font-mono text-sm">{session.id.slice(0, 8)}...</div>
                  <Badge variant={session.status === "completed" ? "default" : "secondary"}>
                    {session.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-muted-foreground text-sm">
                  <span>Step {session.current_step}</span>
                  <span>{new Date(session.updated_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
