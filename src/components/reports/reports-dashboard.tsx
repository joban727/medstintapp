"use client"

import { BarChart3, Download, FileText, Filter, RefreshCw, TrendingUp, Users } from "lucide-react"
import { useEffect, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { toast } from "sonner"
import { ScheduledReports } from "../reports/scheduled-reports"
import { Button } from "../ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
import { Checkbox } from "../ui/checkbox"
import { DatePickerWithRange } from "../ui/date-range-picker"
import { Label } from "../ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"
import { safeFetchApi } from "@/lib/safe-fetch"

interface ReportsDashboardProps {
  userId: string
  userRole: string
}

interface ReportData {
  type: string
  generatedAt: string
  totalRecords: number
  data: any[]
  summary: any
}

interface FilterState {
  type: string
  startDate?: Date
  endDate?: Date
  studentIds: string[]
  competencyIds: string[]
  rotationIds: string[]
  includeDetails: boolean
  groupBy?: string
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"]

export function ReportsDashboard({ userId, userRole }: ReportsDashboardProps) {
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState<FilterState>({
    type: "progress",
    studentIds: [],
    competencyIds: [],
    rotationIds: [],
    includeDetails: false,
  })
  const [availableStudents, setAvailableStudents] = useState<any[]>([])
  const [_availableCompetencies, setAvailableCompetencies] = useState<any[]>([])
  const [_availableRotations, setAvailableRotations] = useState<any[]>([])

  const fetchFilterOptions = async () => {
    try {
      const [studentsResponse, competenciesResponse, rotationsResponse] = await Promise.all([
        safeFetchApi("/api/students"),
        safeFetchApi("/api/competencies"),
        safeFetchApi("/api/rotations"),
      ])

      if (studentsResponse.success) {
        // Handle standardized API response: { success: true, data: { students: [] } }
        const data = studentsResponse.data as { students: any[] }
        const students = data?.students || (studentsResponse.data as any[]) || []
        setAvailableStudents(students)
      }

      if (competenciesResponse.success) {
        // Handle standardized API response

        const data = competenciesResponse.data as { competencies: any[] }
        const competencies = data?.competencies || (competenciesResponse.data as any[]) || []
        setAvailableCompetencies(Array.isArray(competencies) ? competencies : [])
      }

      if (rotationsResponse.success) {
        // Handle standardized API response: { success: true, data: { items: [], pagination: {} } }

        const data = rotationsResponse.data as { items: any[]; data: any[] }
        const rotations = data?.items || data?.data || (rotationsResponse.data as any[]) || []
        setAvailableRotations(Array.isArray(rotations) ? rotations : [])
      }
    } catch (_error) {
      // Error fetching filter options - fallback to empty arrays
      setAvailableStudents([])
      setAvailableCompetencies([])
      setAvailableRotations([])
    }
  }

  // Fetch available filter options
  useEffect(() => {
    fetchFilterOptions()
  }, [])

  const generateReport = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        type: filters.type,
        includeDetails: filters.includeDetails.toString(),
      })

      if (filters.startDate) {
        params.append("startDate", filters.startDate.toISOString())
      }
      if (filters.endDate) {
        params.append("endDate", filters.endDate.toISOString())
      }
      if (filters.studentIds.length > 0) {
        params.append("studentIds", filters.studentIds.join(","))
      }
      if (filters.competencyIds.length > 0) {
        params.append("competencyIds", filters.competencyIds.join(","))
      }
      if (filters.rotationIds.length > 0) {
        params.append("rotationIds", filters.rotationIds.join(","))
      }
      if (filters.groupBy) {
        params.append("groupBy", filters.groupBy)
      }

      const response = await safeFetchApi(`/api/reports?${params.toString()}`)

      if (response.success) {
        // Handle standardized API response
        const data = response.data as ReportData
        setReportData(data)
        toast.success("Report generated successfully")
      } else {
        throw new Error(response.error || "Failed to generate report")
      }
    } catch (error) {
      // Error generating report
      toast.error(error instanceof Error ? error.message : "Failed to generate report")
    } finally {
      setLoading(false)
    }
  }

  const exportReport = async (format: "pdf" | "excel") => {
    try {
      const params = new URLSearchParams({
        type: filters.type,
        format,
        includeDetails: filters.includeDetails.toString(),
      })

      if (filters.startDate) {
        params.append("startDate", filters.startDate.toISOString())
      }
      if (filters.endDate) {
        params.append("endDate", filters.endDate.toISOString())
      }
      if (filters.studentIds.length > 0) {
        params.append("studentIds", filters.studentIds.join(","))
      }

      // For blob downloads, we still need raw fetch or a specialized safeFetchBlob
      const response = await fetch(`/api/reports/export?${params.toString()}`)
      if (!response.ok) {
        const errorData = await response
          .json()
          .catch((err) => {
            console.error("Failed to parse JSON response:", err)
            throw new Error("Invalid response format")
          })
          .catch(() => ({}))
        throw new Error(errorData.error || errorData.message || "Failed to export report")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.style.display = "none"
      a.href = url
      a.download = `report_${filters.type}_${new Date().toISOString().split("T")[0]}.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)

      toast.success(`Report exported as ${format.toUpperCase()}`)
    } catch (error) {
      // Error exporting report
      toast.error(error instanceof Error ? error.message : "Failed to export report")
    }
  }

  const renderProgressChart = () => {
    if (!reportData || reportData.type !== "progress_report") return null

    const chartData = reportData.data.reduce(
      (
        acc: Array<{ competencyTitle: string; averageCompletion: number; count: number }>,
        item: { competencyTitle?: string; completionPercentage?: number }
      ) => {
        const existing = acc.find((d) => d.competencyTitle === item.competencyTitle)
        if (existing) {
          existing.averageCompletion =
            (existing.averageCompletion + (item.completionPercentage || 0)) / 2
          existing.count += 1
        } else {
          acc.push({
            competencyTitle: item.competencyTitle || "Unknown",
            averageCompletion: item.completionPercentage || 0,
            count: 1,
          })
        }
        return acc
      },
      []
    )

    return (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="competencyTitle" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="averageCompletion" fill="#8884d8" name="Average Completion %" />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  const renderAssessmentChart = () => {
    if (!reportData || reportData.type !== "assessment_summary_report") return null

    const statusData = [
      { name: "Completed", value: reportData.summary.completedAssessments, color: "#00C49F" },
      { name: "Pending", value: reportData.summary.pendingAssessments, color: "#FFBB28" },
    ]

    return (
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={statusData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={(entry: any) => {
              const { name, percent } = entry
              return `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`
            }}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {statusData.map((entry, index) => (
              <Cell key={`cell-${entry.name.toLowerCase()}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  const renderAnalyticsChart = () => {
    if (!reportData || reportData.type !== "competency_analytics_report") return null

    const typeData = reportData.summary.analyticsTypes.map((type: string, index: number) => ({
      type,
      count: reportData.data.filter(
        (item: { analyticsType: string }) => item.analyticsType === type
      ).length,
      color: COLORS[index % COLORS.length],
    }))

    return (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={typeData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="type" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="count" fill="#82ca9d" name="Analytics Count" />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="generate" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="generate">Generate Reports</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled Reports</TabsTrigger>
          <TabsTrigger value="history">Report History</TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-6">
          {/* Filters Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Report Filters
              </CardTitle>
              <CardDescription>Configure your report parameters and filters</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="report-type">Report Type</Label>
                  <Select
                    value={filters.type}
                    onValueChange={(value) => setFilters({ ...filters, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select report type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="progress">Progress Report</SelectItem>
                      <SelectItem value="competency_analytics">Competency Analytics</SelectItem>
                      <SelectItem value="assessment_summary">Assessment Summary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Date Range</Label>
                  <DatePickerWithRange
                    date={{
                      from: filters.startDate,
                      to: filters.endDate,
                    }}
                    onDateChange={(range) => {
                      setFilters({
                        ...filters,
                        startDate: range?.from,
                        endDate: range?.to,
                      })
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="group-by">Group By</Label>
                  <Select
                    value={filters.groupBy || ""}
                    onValueChange={(value) =>
                      setFilters({ ...filters, groupBy: value || undefined })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select grouping" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="competency">Competency</SelectItem>
                      <SelectItem value="rotation">Rotation</SelectItem>
                      <SelectItem value="date">Date</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {userRole !== "STUDENT" && (
                <div className="space-y-2">
                  <Label>Students (Optional)</Label>
                  <div className="flex flex-wrap gap-2">
                    {availableStudents.map((student) => (
                      <div key={student.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`student-${student.id}`}
                          checked={filters.studentIds.includes(student.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setFilters({
                                ...filters,
                                studentIds: [...filters.studentIds, student.id],
                              })
                            } else {
                              setFilters({
                                ...filters,
                                studentIds: filters.studentIds.filter((id) => id !== student.id),
                              })
                            }
                          }}
                        />
                        <Label htmlFor={`student-${student.id}`} className="text-sm">
                          {student.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Checkbox
                  id="include-details"
                  checked={filters.includeDetails}
                  onCheckedChange={(checked) => {
                    setFilters({ ...filters, includeDetails: !!checked })
                  }}
                />
                <Label htmlFor="include-details">Include detailed data</Label>
              </div>

              <div className="flex gap-2">
                <Button onClick={generateReport} disabled={loading}>
                  {loading ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <BarChart3 className="mr-2 h-4 w-4" />
                  )}
                  Generate Report
                </Button>
                {reportData && (
                  <>
                    <Button variant="outline" onClick={() => exportReport("pdf")}>
                      <Download className="mr-2 h-4 w-4" />
                      Export PDF
                    </Button>
                    <Button variant="outline" onClick={() => exportReport("excel")}>
                      <Download className="mr-2 h-4 w-4" />
                      Export Excel
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Report Results */}
          {reportData && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Records</CardTitle>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{reportData.totalRecords}</div>
                  </CardContent>
                </Card>

                {reportData.summary.studentsCount !== undefined && (
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Students</CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{reportData.summary.studentsCount}</div>
                    </CardContent>
                  </Card>
                )}

                {reportData.summary.averageCompletion !== undefined && (
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Avg Completion</CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {reportData.summary.averageCompletion.toFixed(1)}%
                      </div>
                    </CardContent>
                  </Card>
                )}

                {reportData.summary.averageScore !== undefined && (
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Avg Score</CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {reportData.summary.averageScore.toFixed(1)}%
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Charts */}
              <Card>
                <CardHeader>
                  <CardTitle>Data Visualization</CardTitle>
                  <CardDescription>Visual representation of your report data</CardDescription>
                </CardHeader>
                <CardContent>
                  {renderProgressChart()}
                  {renderAssessmentChart()}
                  {renderAnalyticsChart()}
                </CardContent>
              </Card>

              {/* Data Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Report Data</CardTitle>
                  <CardDescription>
                    Generated on {new Date(reportData.generatedAt).toLocaleString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-gray-50">
                          {reportData.data.length > 0 &&
                            Object.keys(reportData.data[0]).map((key) => (
                              <th key={key} className="border border-gray-300 px-4 py-2 text-left">
                                {key.charAt(0).toUpperCase() +
                                  key.slice(1).replace(/([A-Z])/g, " $1")}
                              </th>
                            ))}
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.data.slice(0, 50).map((row, index) => (
                          <tr
                            key={`row-${JSON.stringify(row)
                              .slice(0, 30)
                              .replace(/[^a-zA-Z0-9]/g, "")}-${Object.keys(row).length}`}
                            className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                          >
                            {Object.values(row).map((value: any, cellIndex) => (
                              <td
                                key={`cell-${JSON.stringify(value)
                                  .slice(0, 10)
                                  .replace(/[^a-zA-Z0-9]/g, "")}-${cellIndex}`}
                                className="border border-gray-300 px-4 py-2"
                              >
                                {value instanceof Date
                                  ? value.toLocaleDateString()
                                  : typeof value === "object"
                                    ? JSON.stringify(value)
                                    : String(value)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {reportData.data.length > 50 && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Showing first 50 records of {reportData.totalRecords} total records. Export
                        to see all data.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="scheduled" className="space-y-6">
          <ScheduledReports userId={userId} userRole={userRole} />
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Report History</CardTitle>
              <CardDescription>View previously generated reports and their status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="py-8 text-center text-muted-foreground">
                <FileText className="mx-auto mb-4 h-12 w-12 opacity-50" />
                <p>Report history will be displayed here</p>
                <p className="text-sm">Generated reports will appear in this section</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
