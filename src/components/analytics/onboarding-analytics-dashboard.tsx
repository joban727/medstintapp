"use client"

import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle,
  Clock,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react"
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
import type { OnboardingStep } from "../../types/onboarding"
import { Alert, AlertDescription } from "../ui/alert"
import { Badge } from "../ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Progress } from "../ui/progress"
import { Skeleton } from "../ui/skeleton"

interface OnboardingAnalyticsDashboardProps {
  className?: string
}

interface CompletionRate {
  step: OnboardingStep
  users_reached: number
  users_completed: number
  completion_rate_percent: number
}

interface AnalyticsSummary {
  step: OnboardingStep
  event_type: string
  event_count: number
  avg_duration_ms: number
  min_duration_ms: number
  max_duration_ms: number
  event_date: string
}

interface DashboardData {
  completionRates: CompletionRate[]
  analyticsSummary: AnalyticsSummary[]
  totalUsers: number
  completedUsers: number
  inProgressUsers: number
  abandonedUsers: number
  averageCompletionTime: number
}

const _COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"]

const stepDisplayNames: Record<OnboardingStep, string> = {
  welcome: "Welcome",
  "role-selection": "Role Selection",
  "school-selection": "School Selection",
  "program-selection": "Program Selection",
  "school-setup": "School Setup",
  "affiliation-setup": "Affiliation Setup",
  complete: "Complete",
}

export function OnboardingAnalyticsDashboard({ className }: OnboardingAnalyticsDashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const response = await fetch("/api/analytics/onboarding")
        if (!response.ok) {
          throw new Error("Failed to fetch analytics data")
        }

        const result = await response.json()
        setData(result.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load analytics")
      } finally {
        setIsLoading(false)
      }
    }

    fetchAnalytics()
  }, [])

  if (isLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={`analytics-skeleton-${i + 1}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-[100px]" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="mb-2 h-8 w-[60px]" />
                <Skeleton className="h-3 w-[120px]" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-[200px]" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[300px] w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-[200px]" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[300px] w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={className}>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!data) {
    return (
      <div className={className}>
        <Alert>
          <Activity className="h-4 w-4" />
          <AlertDescription>
            No analytics data available yet. Data will appear once users start the onboarding
            process.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const completionRate =
    data.totalUsers > 0 ? Math.round((data.completedUsers / data.totalUsers) * 100) : 0

  const chartData = data.completionRates.map((rate) => ({
    step: stepDisplayNames[rate.step] || rate.step,
    reached: rate.users_reached,
    completed: rate.users_completed,
    rate: rate.completion_rate_percent,
  }))

  const pieData = [
    { name: "Completed", value: data.completedUsers, color: "#00C49F" },
    { name: "In Progress", value: data.inProgressUsers, color: "#FFBB28" },
    { name: "Abandoned", value: data.abandonedUsers, color: "#FF8042" },
  ]

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{data.totalUsers.toLocaleString()}</div>
            <p className="text-muted-foreground text-xs">Started onboarding process</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Completion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{completionRate}%</div>
            <Progress value={completionRate} className="mt-2" />
            <p className="mt-1 text-muted-foreground text-xs">
              {data.completedUsers} of {data.totalUsers} users completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Avg. Completion Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">
              {Math.round(data.averageCompletionTime / 60000)}m
            </div>
            <p className="text-muted-foreground text-xs">Average time to complete</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">In Progress</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{data.inProgressUsers}</div>
            <p className="text-muted-foreground text-xs">Currently onboarding</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Step Completion Rates */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Step Completion Rates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="step" angle={-45} textAnchor="end" height={80} fontSize={12} />
                <YAxis />
                <Tooltip
                  formatter={(value, name) => [
                    name === "rate" ? `${value}%` : value,
                    name === "reached"
                      ? "Users Reached"
                      : name === "completed"
                        ? "Users Completed"
                        : "Completion Rate",
                  ]}
                />
                <Bar dataKey="reached" fill="#8884d8" name="reached" />
                <Bar dataKey="completed" fill="#82ca9d" name="completed" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* User Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>User Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry: { name: string; percent: number }) => `${entry.name} ${(entry.percent * 100).toFixed(0)}%`}
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

      {/* Step Details */}
      <Card>
        <CardHeader>
          <CardTitle>Step-by-Step Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.completionRates.map((rate) => {
              const stepName = stepDisplayNames[rate.step] || rate.step
              const completionPercent = rate.completion_rate_percent

              return (
                <div
                  key={rate.step}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-3">
                    {completionPercent >= 80 ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : completionPercent >= 50 ? (
                      <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    <div>
                      <h4 className="font-medium">{stepName}</h4>
                      <p className="text-muted-foreground text-sm">
                        {rate.users_completed} of {rate.users_reached} users completed
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={
                        completionPercent >= 80
                          ? "default"
                          : completionPercent >= 50
                            ? "secondary"
                            : "destructive"
                      }
                    >
                      {completionPercent.toFixed(1)}%
                    </Badge>
                    <div className="w-24">
                      <Progress value={completionPercent} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
