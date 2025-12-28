"use client"

import {
  BarChart3,
  Calendar,
  Clock,
  Download,
  FileText,
  Filter,
  PieChart,
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
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { DateRange } from "react-day-picker"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
import { DatePickerWithRange } from "../ui/date-range-picker"
import { Progress } from "../ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"
import { toast } from "sonner"

const validateEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

interface ReportData {
  summary: {
    totalStudents: number
    totalCompetencies: number
    totalAssignments: number
    completionRate: number
    averageScore: number
    totalHours: number
  }
  timeTracking: {
    dailyHours: Array<{
      date: string
      hours: number
      students: number
    }>
    weeklyTrends: Array<{
      week: string
      totalHours: number
      averageHours: number
      completedActivities: number
    }>
    topActivities: Array<{
      activity: string
      totalHours: number
      studentCount: number
    }>
  }
  competencyProgress: {
    byCategory: Array<{
      category: string
      total: number
      completed: number
      inProgress: number
      overdue: number
      averageScore: number
    }>
    byLevel: Array<{
      level: string
      total: number
      completed: number
      averageScore: number
    }>
    trends: Array<{
      date: string
      completed: number
      assigned: number
    }>
  }
  studentPerformance: {
    topPerformers: Array<{
      studentId: string
      name: string
      completedCompetencies: number
      averageScore: number
      totalHours: number
    }>
    strugglingStudents: Array<{
      studentId: string
      name: string
      overdueAssignments: number
      averageScore: number
      lastActivity: string
    }>
    scoreDistribution: Array<{
      range: string
      count: number
      percentage: number
    }>
  }
  institutionalMetrics: {
    programComparison: Array<{
      program: string
      students: number
      completionRate: number
      averageScore: number
    }>
    departmentBreakdown: Array<{
      department: string
      activeStudents: number
      completedCompetencies: number
      averageHours: number
    }>
  }
}

interface ComprehensiveReportsDashboardProps {
  userRole?: string
  institutionId?: string
}

export function ComprehensiveReportsDashboard({
  userRole = "CLINICAL_SUPERVISOR",
  institutionId,
}: ComprehensiveReportsDashboardProps) {
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    to: new Date(),
  })
  const [selectedProgram, setSelectedProgram] = useState("all")
  const [selectedDepartment, setSelectedDepartment] = useState("all")
  const [reportType, setReportType] = useState("summary")

  useEffect(() => {
    fetchReportData()
  }, [dateRange, selectedProgram, selectedDepartment])

  const fetchReportData = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        from: dateRange?.from?.toISOString() ?? "",
        to: dateRange?.to?.toISOString() ?? "",
        ...(selectedProgram !== "all" && { program: selectedProgram }),
        ...(selectedDepartment !== "all" && { department: selectedDepartment }),
        ...(institutionId && { institutionId }),
      })

      const response = await fetch(`/api/reports/comprehensive?${params}`)
      if (response.ok) {
        const data = await response.json().catch((err) => {
          console.error("Failed to parse JSON response:", err)
          throw new Error("Invalid response format")
        })
        setReportData(data)
      } else {
        toast.error("Failed to load report data")
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred"
      console.error("[ComprehensiveReportsDashboard] Operation failed:", error)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const exportReport = async (format: "pdf" | "csv" | "excel") => {
    try {
      const params = new URLSearchParams({
        from: dateRange?.from?.toISOString() ?? "",
        to: dateRange?.to?.toISOString() ?? "",
        format,
        type: reportType,
        ...(selectedProgram !== "all" && { program: selectedProgram }),
        ...(selectedDepartment !== "all" && { department: selectedDepartment }),
        ...(institutionId && { institutionId }),
      })

      const response = await fetch(`/api/reports/export?${params}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `medstint-report-${reportType}-${new Date().toISOString().split("T")[0]}.${format}`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        toast.success(`Report exported as ${format.toUpperCase()}`)
      } else {
        toast.error("Failed to export report")
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred"
      console.error("[ComprehensiveReportsDashboard] Operation failed:", error)
      toast.error(errorMessage)
    }
  }

  const generateScheduledReport = async () => {
    try {
      const response = await fetch("/api/reports/schedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: reportType,
          frequency: "weekly",
          format: "pdf",
          recipients: [], // Add email recipients
          filters: {
            program: selectedProgram,
            department: selectedDepartment,
          },
        }),
      })

      if (response.ok) {
        toast.success("Scheduled report created successfully")
      } else {
        toast.error("Failed to create scheduled report")
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred"
      console.error("[ComprehensiveReportsDashboard] Operation failed:", error)
      toast.error(errorMessage)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="space-y-2 animate-pulse">
                  <div className="h-4 bg-muted rounded-md w-1/2" />
                  <div className="h-8 bg-muted rounded-md w-3/4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (!reportData) {
    return (
      <div className="text-center py-8">
        <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
        <div className="mt-4 text-lg font-medium">No report data available</div>
        <div className="text-muted-foreground">Try adjusting your filters or date range</div>
      </div>
    )
  }

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8", "#82ca9d"]

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Comprehensive Reports</h1>
          <p className="text-muted-foreground">
            Detailed analytics and insights across all clinical education activities
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DatePickerWithRange
            date={dateRange}
            onDateChange={(range) => range && setDateRange(range)}
          />
          <Select aria-label="Program" value={selectedProgram} onValueChange={setSelectedProgram}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Program" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Programs</SelectItem>
              <SelectItem value="nursing">Nursing</SelectItem>
              <SelectItem value="medicine">Medicine</SelectItem>
              <SelectItem value="pharmacy">Pharmacy</SelectItem>
            </SelectContent>
          </Select>
          <Select
            aria-label="Department"
            value={selectedDepartment}
            onValueChange={setSelectedDepartment}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              <SelectItem value="emergency">Emergency</SelectItem>
              <SelectItem value="surgery">Surgery</SelectItem>
              <SelectItem value="pediatrics">Pediatrics</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => exportReport("pdf")}>
            <Download className="mr-2 h-4 w-4" />
            PDF
          </Button>
          <Button variant="outline" onClick={() => exportReport("excel")}>
            <Download className="mr-2 h-4 w-4" />
            Excel
          </Button>
          <Button variant="outline" onClick={generateScheduledReport}>
            <Calendar className="mr-2 h-4 w-4" />
            Schedule
          </Button>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData.summary.totalStudents}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Competencies</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData.summary.totalCompetencies}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assignments</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData.summary.totalAssignments}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reportData.summary.completionRate.toFixed(1)}%
            </div>
            <Progress value={reportData.summary.completionRate} className="mt-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData.summary.averageScore.toFixed(1)}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reportData.summary.totalHours.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="time-tracking" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="time-tracking">Time Tracking</TabsTrigger>
          <TabsTrigger value="competencies">Competencies</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="institutional">Institutional</TabsTrigger>
          <TabsTrigger value="custom">Custom Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="time-tracking" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Daily Hours Trend */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Daily Activity Hours</CardTitle>
                <CardDescription>Student activity hours tracked over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={reportData.timeTracking.dailyHours}>
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="hours" stroke="#8884d8" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Weekly Trends */}
            <Card>
              <CardHeader>
                <CardTitle>Weekly Trends</CardTitle>
                <CardDescription>Weekly activity summary</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={reportData.timeTracking.weeklyTrends}>
                    <XAxis dataKey="week" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="totalHours" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Top Activities */}
            <Card>
              <CardHeader>
                <CardTitle>Top Activities</CardTitle>
                <CardDescription>Most time-consuming activities</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {reportData.timeTracking.topActivities.map((activity, index) => (
                    <div key={activity.activity} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 text-xs font-medium flex items-center justify-center">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium">{activity.activity}</div>
                          <div className="text-sm text-muted-foreground">
                            {activity.studentCount} students
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{activity.totalHours}h</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="competencies" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Competency by Category */}
            <Card>
              <CardHeader>
                <CardTitle>Competencies by Category</CardTitle>
                <CardDescription>Progress breakdown by competency category</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {reportData.competencyProgress.byCategory.map((category, index) => (
                    <div key={category.category} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{category.category}</span>
                        <span className="text-sm text-muted-foreground">
                          {category.completed}/{category.total}
                        </span>
                      </div>
                      <Progress
                        value={(category.completed / category.total) * 100}
                        className="h-2"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Avg Score: {category.averageScore.toFixed(1)}%</span>
                        <span>Overdue: {category.overdue}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Competency by Level */}
            <Card>
              <CardHeader>
                <CardTitle>Competencies by Level</CardTitle>
                <CardDescription>Distribution across difficulty levels</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsPieChart>
                    <Pie
                      data={reportData.competencyProgress.byLevel}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ payload }) => `${payload.level} (${payload.total})`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="total"
                    >
                      {reportData.competencyProgress.byLevel.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Competency Trends */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Competency Assignment Trends</CardTitle>
                <CardDescription>Assignment and completion trends over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={reportData.competencyProgress.trends}>
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="assigned" stroke="#82ca9d" name="Assigned" />
                    <Line type="monotone" dataKey="completed" stroke="#8884d8" name="Completed" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="students" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Top Performers */}
            <Card>
              <CardHeader>
                <CardTitle>Top Performing Students</CardTitle>
                <CardDescription>Students with highest completion rates and scores</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {reportData.studentPerformance.topPerformers.map((student, index) => (
                    <div key={student.studentId} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-green-100 text-green-800 text-xs font-medium flex items-center justify-center">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium">{student.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {student.completedCompetencies} competencies • {student.totalHours}h
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
                <CardTitle>Students Needing Support</CardTitle>
                <CardDescription>Students who may need additional attention</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {reportData.studentPerformance.strugglingStudents.map((student) => (
                    <div key={student.studentId} className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{student.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {student.overdueAssignments} overdue • Last: {student.lastActivity}
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

            {/* Score Distribution */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Score Distribution</CardTitle>
                <CardDescription>
                  Distribution of student scores across all competencies
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={reportData.studentPerformance.scoreDistribution}>
                    <XAxis dataKey="range" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="institutional" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Program Comparison */}
            <Card>
              <CardHeader>
                <CardTitle>Program Comparison</CardTitle>
                <CardDescription>Performance metrics across different programs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {reportData.institutionalMetrics.programComparison.map((program) => (
                    <div key={program.program} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{program.program}</span>
                        <Badge variant="secondary">{program.students} students</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm text-muted-foreground">Completion Rate</div>
                          <Progress value={program.completionRate} className="mt-1" />
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Average Score</div>
                          <div className="text-lg font-semibold">
                            {program.averageScore.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Department Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Department Activity</CardTitle>
                <CardDescription>Activity breakdown by department</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {reportData.institutionalMetrics.departmentBreakdown.map((dept) => (
                    <div key={dept.department} className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{dept.department}</div>
                        <div className="text-sm text-muted-foreground">
                          {dept.activeStudents} active students
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{dept.completedCompetencies}</div>
                        <div className="text-sm text-muted-foreground">
                          {dept.averageHours}h avg
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="custom" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Custom Report Builder</CardTitle>
              <CardDescription>
                Create custom reports with specific metrics and filters
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground" />
                <div className="mt-4 text-lg font-medium">Custom Report Builder</div>
                <div className="text-muted-foreground mb-4">
                  Build custom reports with drag-and-drop interface
                </div>
                <Button>
                  <PieChart className="mr-2 h-4 w-4" />
                  Launch Report Builder
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
