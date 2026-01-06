"use client"

import {
  Activity,
  AlertTriangle,
  Award,
  BookOpen,
  Calendar,
  CheckCircle,
  Download,
  Eye,
  GraduationCap,
  RefreshCw,
  Star,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react"
import { useEffect, useState } from "react"
import { Badge } from "../../../../components/ui/badge"
import { Button } from "../../../../components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../../components/ui/card"
import { Progress } from "../../../../components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../components/ui/tabs"
import { toast } from "sonner"

interface AnalyticsData {
  sitePerformance: {
    id: string
    name: string
    students: number
    avgScore: number
    passRate: number
  }[]
  competencyData: {
    id: string
    name: string
    completed: number
    total: number
    avgScore: number
  }[]
  predictiveInsights: {
    id: string
    type: string
    title: string
    description: string
    confidence: number
    action: string
  }[]
}

const riskFactors = [
  { factor: "Low Attendance", impact: "High", frequency: 15, trend: "up" },
  { factor: "Poor Communication", impact: "Medium", frequency: 8, trend: "stable" },
  { factor: "Knowledge Gaps", impact: "High", frequency: 12, trend: "down" },
  { factor: "Time Management", impact: "Medium", frequency: 20, trend: "up" },
  { factor: "Technical Skills", impact: "Low", frequency: 5, trend: "down" },
]

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState("6months")
  const [selectedSite, setSelectedSite] = useState("all")
  const [selectedCompetency, setSelectedCompetency] = useState("all")
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/analytics/clinical-supervisor?timeRange=${timeRange}`)
      if (!response.ok) throw new Error("Failed to fetch analytics")
      const result = await response.json()
      setData(result)
    } catch (error) {
      console.error("Error fetching analytics:", error)
      toast.error("Failed to load analytics data")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [timeRange])

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case "High":
        return "text-red-600"
      case "Medium":
        return "text-yellow-600"
      case "Low":
        return "text-green-600"
      default:
        return "text-gray-600"
    }
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "up":
        return <TrendingUp className="h-4 w-4 text-red-500" />
      case "down":
        return <TrendingDown className="h-4 w-4 text-green-500" />
      case "stable":
        return <Activity className="h-4 w-4 text-gray-500" />
      default:
        return <Activity className="h-4 w-4 text-gray-500" />
    }
  }

  const getInsightIcon = (type: string) => {
    switch (type) {
      case "risk":
        return <AlertTriangle className="h-5 w-5 text-red-500" />
      case "opportunity":
        return <Star className="h-5 w-5 text-green-500" />
      case "trend":
        return <TrendingUp className="h-5 w-5 text-blue-500" />
      default:
        return <Eye className="h-5 w-5 text-gray-500" />
    }
  }

  // Calculate key metrics
  const sitePerformance = data?.sitePerformance || []
  const competencyData = data?.competencyData || []
  const predictiveInsights = data?.predictiveInsights || []

  const totalStudents = sitePerformance.reduce((sum, site) => sum + site.students, 0)
  const overallAvgScore =
    totalStudents > 0
      ? Math.round(
          sitePerformance.reduce((sum, site) => sum + site.avgScore * site.students, 0) /
            totalStudents
        )
      : 0
  const overallPassRate =
    totalStudents > 0
      ? Math.round(
          sitePerformance.reduce((sum, site) => sum + site.passRate * site.students, 0) /
            totalStudents
        )
      : 0
  const competencyCompletion =
    competencyData.length > 0
      ? Math.round(
          (competencyData.reduce(
            (sum, comp) => sum + (comp.total > 0 ? comp.completed / comp.total : 0),
            0
          ) /
            competencyData.length) *
            100
        )
      : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">Assessment Analytics</h1>
          <p className="text-muted-foreground">
            Comprehensive insights into student performance and clinical education effectiveness
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh Data
          </Button>
          <Button>
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Key Performance Indicators */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Total Students</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{totalStudents}</div>
            <p className="text-muted-foreground text-xs">
              <span className="text-green-600">+12%</span> from last period
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Average Score</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{overallAvgScore}%</div>
            <p className="text-muted-foreground text-xs">
              <span className="text-green-600">+3.2%</span> improvement
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Pass Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{overallPassRate}%</div>
            <p className="text-muted-foreground text-xs">
              <span className="text-green-600">+1.8%</span> vs target
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Competency Completion</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{competencyCompletion}%</div>
            <p className="text-muted-foreground text-xs">
              <span className="text-yellow-600">-2.1%</span> needs attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Time Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1month">Last Month</SelectItem>
                <SelectItem value="3months">Last 3 Months</SelectItem>
                <SelectItem value="6months">Last 6 Months</SelectItem>
                <SelectItem value="1year">Last Year</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedSite} onValueChange={setSelectedSite}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Clinical Site" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sites</SelectItem>
                {sitePerformance.map((site) => (
                  <SelectItem key={site.name} value={site.name}>
                    {site.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedCompetency} onValueChange={setSelectedCompetency}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Competency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Competencies</SelectItem>
                {competencyData.map((comp) => (
                  <SelectItem key={comp.name} value={comp.name}>
                    {comp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance Trends</TabsTrigger>
          <TabsTrigger value="competencies">Competency Analysis</TabsTrigger>
          <TabsTrigger value="sites">Site Comparison</TabsTrigger>
          <TabsTrigger value="insights">Predictive Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Performance Trends Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Performance Trends</CardTitle>
                <CardDescription>Average scores and pass rates over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex h-[300px] w-full items-center justify-center rounded-lg bg-gray-50">
                  <div className="text-center text-gray-500">
                    <div className="text-sm">Chart will be available when data is loaded</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Assessment Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Assessment Distribution</CardTitle>
                <CardDescription>Types of assessments conducted</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex h-[300px] w-full items-center justify-center rounded-lg bg-gray-50">
                  <div className="text-center text-gray-500">
                    <div className="text-sm">Chart will be available when data is loaded</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Risk Factors Analysis */}
          <Card>
            <CardHeader>
              <CardTitle>Risk Factors Analysis</CardTitle>
              <CardDescription>Factors affecting student performance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {riskFactors.map((factor) => (
                  <div
                    key={`risk-factor-${factor.factor.replace(/\s+/g, "-").toLowerCase()}-${factor.frequency}`}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        {getTrendIcon(factor.trend)}
                        <span className="font-medium">{factor.factor}</span>
                      </div>
                      <Badge className={`${getImpactColor(factor.impact)} border bg-transparent`}>
                        {factor.impact} Impact
                      </Badge>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{factor.frequency} cases</div>
                      <div className="text-muted-foreground text-sm">
                        {factor.trend === "up"
                          ? "Increasing"
                          : factor.trend === "down"
                            ? "Decreasing"
                            : "Stable"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Detailed Performance Analysis</CardTitle>
              <CardDescription>Comprehensive view of student performance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex h-[400px] w-full items-center justify-center rounded-lg bg-gray-50">
                <div className="text-center text-gray-500">
                  <div className="text-sm">Chart will be available when data is loaded</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="competencies" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Competency Progress */}
            <Card>
              <CardHeader>
                <CardTitle>Competency Completion Rates</CardTitle>
                <CardDescription>Progress across different competency areas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex h-[300px] w-full items-center justify-center rounded-lg bg-gray-50">
                  <div className="text-center text-gray-500">
                    <div className="text-sm">Chart will be available when data is loaded</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Competency Radar */}
            <Card>
              <CardHeader>
                <CardTitle>Competency Performance Radar</CardTitle>
                <CardDescription>Comparative analysis of competency scores</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex h-[300px] w-full items-center justify-center rounded-lg bg-gray-50">
                  <div className="text-center text-gray-500">
                    <div className="text-sm">Chart will be available when data is loaded</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Competency Table */}
          <Card>
            <CardHeader>
              <CardTitle>Competency Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {competencyData.map((comp) => (
                  <div
                    key={`competency-${comp.name.replace(/\s+/g, "-").toLowerCase()}-${comp.total}`}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex-1">
                      <div className="font-medium">{comp.name}</div>
                      <div className="text-muted-foreground text-sm">
                        {comp.completed}/{comp.total} students completed
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-medium">{comp.avgScore}%</div>
                        <div className="text-muted-foreground text-sm">Avg Score</div>
                      </div>
                      <div className="w-32">
                        <Progress
                          value={comp.total > 0 ? (comp.completed / comp.total) * 100 : 0}
                        />
                      </div>
                      <div className="font-medium text-sm">
                        {Math.round(comp.total > 0 ? (comp.completed / comp.total) * 100 : 0)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sites" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Site Performance Comparison</CardTitle>
              <CardDescription>Performance metrics across different clinical sites</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex h-[300px] w-full items-center justify-center rounded-lg bg-gray-50">
                <div className="text-center text-gray-500">
                  <div className="text-sm">Chart will be available when data is loaded</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Site Details */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sitePerformance.map((site) => (
              <Card key={`site-${site.name.replace(/\s+/g, "-").toLowerCase()}-${site.students}`}>
                <CardHeader>
                  <CardTitle className="text-lg">{site.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm">Students</span>
                      <span className="font-medium">{site.students}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Average Score</span>
                      <span className="font-medium">{site.avgScore}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Pass Rate</span>
                      <span className="font-medium">{site.passRate}%</span>
                    </div>
                    <Progress value={site.avgScore} className="mt-2" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Predictive Insights & Recommendations</CardTitle>
              <CardDescription>
                AI-powered insights to improve clinical education outcomes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {predictiveInsights.map((insight) => (
                  <Card key={insight.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-4">
                        {getInsightIcon(insight.type)}
                        <div className="flex-1">
                          <div className="mb-2 flex items-center justify-between">
                            <h3 className="font-semibold">{insight.title}</h3>
                            <Badge variant="outline">{insight.confidence}% confidence</Badge>
                          </div>
                          <p className="mb-3 text-muted-foreground">{insight.description}</p>
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-blue-600 text-sm">
                              Recommended Action: {insight.action}
                            </span>
                            <Button size="sm" variant="outline">
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Action Items */}
          <Card>
            <CardHeader>
              <CardTitle>Recommended Actions</CardTitle>
              <CardDescription>Priority actions based on analytics insights</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    <div>
                      <div className="font-medium">Schedule intervention for at-risk students</div>
                      <div className="text-muted-foreground text-sm">3 students identified</div>
                    </div>
                  </div>
                  <Button size="sm">
                    <Calendar className="mr-2 h-4 w-4" />
                    Schedule
                  </Button>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <Star className="h-5 w-5 text-green-500" />
                    <div>
                      <div className="font-medium">Offer advanced opportunities</div>
                      <div className="text-muted-foreground text-sm">
                        7 high-performing students
                      </div>
                    </div>
                  </div>
                  <Button size="sm">
                    <Users className="mr-2 h-4 w-4" />
                    Contact
                  </Button>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-5 w-5 text-blue-500" />
                    <div>
                      <div className="font-medium">Continue communication training</div>
                      <div className="text-muted-foreground text-sm">Positive trend observed</div>
                    </div>
                  </div>
                  <Button size="sm" variant="outline">
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Acknowledge
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
