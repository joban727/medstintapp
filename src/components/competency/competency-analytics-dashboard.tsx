"use client"

import {
  Award,
  BarChart3,
  Calendar,
  Clock,
  Download,
  Filter,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react"
import { useEffect, useState } from "react"
import {
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
import { Progress } from "../ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"

interface CompetencyAnalytics {
  totalAssignments: number
  completedAssignments: number
  averageScore: number
  averageCompletionTime: number
  completionRate: number
  trendsData: Array<{
    date: string
    completed: number
    assigned: number
    averageScore: number
  }>
  categoryBreakdown: Array<{
    category: string
    total: number
    completed: number
    averageScore: number
    color: string
  }>
  levelDistribution: Array<{
    level: string
    count: number
    percentage: number
  }>
  topPerformers: Array<{
    studentId: string
    studentName: string
    completedCount: number
    averageScore: number
  }>
  strugglingStudents: Array<{
    studentId: string
    studentName: string
    overdueCount: number
    averageScore: number
  }>
  competencyPerformance: Array<{
    competencyId: string
    competencyName: string
    category: string
    totalAssignments: number
    completedAssignments: number
    averageScore: number
    completionRate: number
  }>
}

interface CompetencyAnalyticsDashboardProps {
  supervisorId?: string
  timeRange?: string
}

export function CompetencyAnalyticsDashboard({
  supervisorId,
  timeRange = "30d",
}: CompetencyAnalyticsDashboardProps) {
  const [analytics, setAnalytics] = useState<CompetencyAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedTimeRange, setSelectedTimeRange] = useState(timeRange)
  const [selectedCategory, setSelectedCategory] = useState("all")

  useEffect(() => {
    fetchAnalytics()
  }, [selectedTimeRange, selectedCategory, supervisorId])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        timeRange: selectedTimeRange,
        ...(selectedCategory !== "all" && { category: selectedCategory }),
        ...(supervisorId && { supervisorId }),
      })

      const response = await fetch(`/api/competency-analytics?${params}`)
      if (response.ok) {
        const data = await response.json()
        setAnalytics(data)
      }
    } catch (error) {
      console.error("Failed to fetch analytics:", error)
    } finally {
      setLoading(false)
    }
  }

  const exportReport = async (format: "pdf" | "csv") => {
    try {
      const params = new URLSearchParams({
        timeRange: selectedTimeRange,
        format,
        ...(selectedCategory !== "all" && { category: selectedCategory }),
        ...(supervisorId && { supervisorId }),
      })

      const response = await fetch(`/api/competency-analytics/export?${params}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `competency-analytics-${selectedTimeRange}.${format}`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error("Failed to export report:", error)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-2">
                  <div className="h-4 bg-muted rounded w-1/2" />
                  <div className="h-8 bg-muted rounded w-3/4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="text-center py-8">
        <div className="text-muted-foreground">No analytics data available</div>
      </div>
    )
  }

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"]

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Competency Analytics</h2>
          <p className="text-muted-foreground">
            Comprehensive insights into competency performance and progress
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="Clinical Skills">Clinical Skills</SelectItem>
              <SelectItem value="Safety">Safety</SelectItem>
              <SelectItem value="Professional">Professional</SelectItem>
              <SelectItem value="Communication">Communication</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => exportReport("pdf")}>
            <Download className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
          <Button variant="outline" onClick={() => exportReport("csv")}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assignments</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalAssignments}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.completedAssignments} completed
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.completionRate.toFixed(1)}%</div>
            <Progress value={analytics.completionRate} className="mt-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.averageScore.toFixed(1)}%</div>
            <div className="flex items-center text-xs text-muted-foreground">
              {analytics.averageScore >= 80 ? (
                <TrendingUp className="mr-1 h-3 w-3 text-green-500" />
              ) : (
                <TrendingDown className="mr-1 h-3 w-3 text-red-500" />
              )}
              Performance indicator
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Completion Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.averageCompletionTime}d</div>
            <p className="text-xs text-muted-foreground">Days to complete</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Category Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Competency Categories</CardTitle>
                <CardDescription>Distribution by category</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analytics.categoryBreakdown}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ category, percentage }) => `${category} (${percentage}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="total"
                    >
                      {analytics.categoryBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Level Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Difficulty Levels</CardTitle>
                <CardDescription>Assignment distribution by level</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.levelDistribution}>
                    <XAxis dataKey="level" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Category Performance Details */}
          <Card>
            <CardHeader>
              <CardTitle>Category Performance Details</CardTitle>
              <CardDescription>Detailed breakdown by competency category</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.categoryBreakdown.map((category) => (
                  <div key={category.category} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                        <span className="font-medium">{category.category}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {category.completed}/{category.total} completed
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Completion Rate</div>
                        <Progress
                          value={(category.completed / category.total) * 100}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Average Score</div>
                        <div className="text-lg font-semibold">
                          {category.averageScore.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Completion Trends</CardTitle>
              <CardDescription>Assignment completion and scoring trends over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={analytics.trendsData}>
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Bar yAxisId="left" dataKey="completed" fill="#8884d8" name="Completed" />
                  <Bar yAxisId="left" dataKey="assigned" fill="#82ca9d" name="Assigned" />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="averageScore"
                    stroke="#ff7300"
                    name="Avg Score"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Competency Performance</CardTitle>
              <CardDescription>Individual competency performance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.competencyPerformance.map((competency) => (
                  <div
                    key={competency.competencyId}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="space-y-1">
                      <div className="font-medium">{competency.competencyName}</div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{competency.category}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {competency.completedAssignments}/{competency.totalAssignments} completed
                        </span>
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <div className="text-lg font-semibold">
                        {competency.averageScore.toFixed(1)}%
                      </div>
                      <Progress
                        value={competency.completionRate}
                        className="w-24"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="students" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Top Performers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-yellow-500" />
                  Top Performers
                </CardTitle>
                <CardDescription>Students with highest completion rates and scores</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics.topPerformers.map((student, index) => (
                    <div key={student.studentId} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-yellow-100 text-yellow-800 text-xs font-medium flex items-center justify-center">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium">{student.studentName}</div>
                          <div className="text-sm text-muted-foreground">
                            {student.completedCount} completed
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{student.averageScore.toFixed(1)}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Struggling Students */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-red-500" />
                  Needs Attention
                </CardTitle>
                <CardDescription>Students who may need additional support</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics.strugglingStudents.map((student) => (
                    <div key={student.studentId} className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{student.studentName}</div>
                        <div className="text-sm text-muted-foreground">
                          {student.overdueCount} overdue assignments
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-red-600">
                          {student.averageScore.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}