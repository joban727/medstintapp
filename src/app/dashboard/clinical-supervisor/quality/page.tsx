"use client"

import {
  AlertTriangle,
  Award,
  BarChart3,
  CheckCircle,
  Clock,
  Edit,
  Eye,
  FileCheck,
  Flag,
  Plus,
  Search,
  Shield,
  Target,
  TrendingUp,
  XCircle,
} from "lucide-react"
import { useState } from "react"
import { Badge } from "../../../../components/ui/badge"
import { Button } from "../../../../components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../../components/ui/card"
import { Input } from "../../../../components/ui/input"
import { Progress } from "../../../../components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../components/ui/tabs"

interface Finding {
  category: string
  description: string
  type: string
}

interface QualityReview {
  id: string
  title: string
  reviewer: string
  type: string
  status: string
  priority: string
  overallScore: number | null
  findings: Finding[]
  recommendations: string[]
  followUpRequired: boolean
  followUpDate: string | null
}

interface QualityMetric {
  id: string
  metric: string
  value: number
  target: number
  trend: string
  description: string
}

interface ImprovementPlan {
  id: string
  title: string
  description: string
  priority: string
  status: string
  assignedTo: string
  dueDate: string
  progress: number
  actions: string[]
}

// TODO: Replace with actual API calls for quality data
const mockQualityReviews: QualityReview[] = []
const mockQualityMetrics: QualityMetric[] = []
const mockImprovementPlans: ImprovementPlan[] = []

export default function QualityPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedType, setSelectedType] = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [selectedPriority, setSelectedPriority] = useState("all")

  const filteredReviews = mockQualityReviews.filter((review) => {
    const matchesSearch =
      review.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      review.reviewer.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = selectedType === "all" || review.type === selectedType
    const matchesStatus = selectedStatus === "all" || review.status === selectedStatus
    const matchesPriority = selectedPriority === "all" || review.priority === selectedPriority

    return matchesSearch && matchesType && matchesStatus && matchesPriority
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            <CheckCircle className="mr-1 h-3 w-3" />
            Completed
          </Badge>
        )
      case "in_progress":
        return (
          <Badge variant="default" className="bg-blue-100 text-blue-800">
            <Clock className="mr-1 h-3 w-3" />
            In Progress
          </Badge>
        )
      case "pending":
        return (
          <Badge variant="default" className="bg-yellow-100 text-yellow-800">
            <Clock className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        )
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return (
          <Badge variant="destructive">
            <Flag className="mr-1 h-3 w-3" />
            High
          </Badge>
        )
      case "medium":
        return (
          <Badge variant="default" className="bg-yellow-100 text-yellow-800">
            <Flag className="mr-1 h-3 w-3" />
            Medium
          </Badge>
        )
      case "low":
        return (
          <Badge variant="outline">
            <Flag className="mr-1 h-3 w-3" />
            Low
          </Badge>
        )
      default:
        return <Badge variant="secondary">{priority}</Badge>
    }
  }

  const getFindingIcon = (type: string) => {
    switch (type) {
      case "strength":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "improvement":
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case "concern":
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return <FileCheck className="h-4 w-4 text-gray-600" />
    }
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "up":
        return <TrendingUp className="h-4 w-4 text-green-600" />
      case "down":
        return <TrendingUp className="h-4 w-4 rotate-180 text-red-600" />
      case "stable":
        return <BarChart3 className="h-4 w-4 text-gray-600" />
      default:
        return <BarChart3 className="h-4 w-4 text-gray-600" />
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  // Calculate stats
  const totalReviews = mockQualityReviews.length
  const completedReviews = mockQualityReviews.filter((r) => r.status === "completed").length
  const pendingReviews = mockQualityReviews.filter((r) => r.status === "pending").length
  const highPriorityReviews = mockQualityReviews.filter((r) => r.priority === "high").length
  const averageScore =
    mockQualityReviews
      .filter((r) => r.overallScore !== null)
      .reduce((sum, r) => sum + (r.overallScore || 0), 0) / completedReviews || 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">Quality Assurance</h1>
          <p className="text-muted-foreground">
            Monitor and improve the quality of clinical education and assessments
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Review
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Total Reviews</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{totalReviews}</div>
            <p className="text-muted-foreground text-xs">This quarter</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Pending Reviews</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{pendingReviews}</div>
            <p className="text-muted-foreground text-xs">{highPriorityReviews} high priority</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Average Score</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{Math.round(averageScore)}%</div>
            <p className="text-muted-foreground text-xs">Quality rating</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Completion Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">
              {Math.round((completedReviews / totalReviews) * 100)}%
            </div>
            <p className="text-muted-foreground text-xs">Reviews completed</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="reviews" className="space-y-4">
        <TabsList>
          <TabsTrigger value="reviews">Quality Reviews</TabsTrigger>
          <TabsTrigger value="metrics">Quality Metrics</TabsTrigger>
          <TabsTrigger value="improvements">Improvement Plans</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="reviews" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute top-2.5 left-2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search reviews..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="Assessment Quality">Assessment Quality</SelectItem>
                    <SelectItem value="Supervision Quality">Supervision Quality</SelectItem>
                    <SelectItem value="Process Audit">Process Audit</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={selectedPriority} onValueChange={setSelectedPriority}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Reviews List */}
          <div className="grid gap-4">
            {filteredReviews.map((review) => (
              <Card key={review.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{review.title}</CardTitle>
                        {getStatusBadge(review.status)}
                        {getPriorityBadge(review.priority)}
                      </div>
                      <div className="flex items-center gap-4 text-muted-foreground text-sm">
                        <span>Type: {review.type}</span>
                        <span>Reviewer: {review.reviewer}</span>
                        <span>Date: {formatDate(review.reviewDate)}</span>
                      </div>
                      {review.overallScore && (
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">Overall Score:</span>
                          <span className="font-bold text-lg">{review.overallScore}%</span>
                          <Progress value={review.overallScore} className="w-32" />
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                {review.findings.length > 0 && (
                  <CardContent>
                    <div className="space-y-4">
                      {/* Findings */}
                      <div className="space-y-2">
                        <span className="font-medium text-sm">Key Findings:</span>
                        <div className="space-y-2">
                          {review.findings.map((finding, index: number) => (
                            <div
                              key={`finding-${finding.category.replace(/\s+/g, "-").toLowerCase()}-${index}`}
                              className="flex items-start gap-2 rounded border p-2"
                            >
                              {getFindingIcon(finding.type)}
                              <div className="flex-1">
                                <div className="font-medium text-sm">{finding.category}</div>
                                <div className="text-muted-foreground text-sm">
                                  {finding.description}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Recommendations */}
                      {review.recommendations.length > 0 && (
                        <div className="space-y-2">
                          <span className="font-medium text-sm">Recommendations:</span>
                          <ul className="list-inside list-disc space-y-1">
                            {review.recommendations.map((rec: string, index: number) => (
                              <li
                                key={`recommendation-${rec.substring(0, 20).replace(/\s+/g, "-").toLowerCase()}-${index}`}
                                className="text-muted-foreground text-sm"
                              >
                                {rec}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Follow-up */}
                      {review.followUpRequired && review.followUpDate && (
                        <div className="flex items-center gap-2 rounded border border-yellow-200 bg-yellow-50 p-2">
                          <AlertTriangle className="h-4 w-4 text-yellow-600" />
                          <span className="font-medium text-sm">
                            Follow-up required by {formatDate(review.followUpDate)}
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Quality Metrics Dashboard</CardTitle>
              <CardDescription>
                Key performance indicators for clinical education quality
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {mockQualityMetrics.map((metric) => (
                  <Card key={metric.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base">{metric.metric}</CardTitle>
                        {getTrendIcon(metric.trend)}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-2xl">
                            {typeof metric.value === "number" && metric.value < 10
                              ? metric.value.toFixed(1)
                              : Math.round(metric.value)}
                            {typeof metric.value === "number" && metric.value >= 10 ? "%" : ""}
                          </span>
                          <span className="text-muted-foreground text-sm">
                            Target:{" "}
                            {typeof metric.target === "number" && metric.target < 10
                              ? metric.target.toFixed(1)
                              : Math.round(metric.target)}
                            {typeof metric.target === "number" && metric.target >= 10 ? "%" : ""}
                          </span>
                        </div>
                        <Progress
                          value={
                            typeof metric.value === "number" && metric.value < 10
                              ? (metric.value / 5) * 100
                              : metric.value
                          }
                        />
                        <p className="text-muted-foreground text-xs">{metric.description}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="improvements" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Quality Improvement Plans</CardTitle>
              <CardDescription>
                Active initiatives to enhance clinical education quality
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockImprovementPlans.map((plan) => (
                  <Card key={plan.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-lg">{plan.title}</CardTitle>
                            {getPriorityBadge(plan.priority)}
                            <Badge variant={plan.status === "active" ? "default" : "secondary"}>
                              {plan.status === "active" ? "Active" : "Planning"}
                            </Badge>
                          </div>
                          <CardDescription>{plan.description}</CardDescription>
                          <div className="flex items-center gap-4 text-muted-foreground text-sm">
                            <span>Assigned to: {plan.assignedTo}</span>
                            <span>Due: {formatDate(plan.dueDate)}</span>
                          </div>
                        </div>
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Progress */}
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Progress</span>
                            <span>{plan.progress}%</span>
                          </div>
                          <Progress value={plan.progress} />
                        </div>

                        {/* Actions */}
                        <div className="space-y-2">
                          <span className="font-medium text-sm">Action Items:</span>
                          <ul className="space-y-1">
                            {plan.actions.map((action, index: number) => (
                              <li
                                key={`action-${action.substring(0, 20).replace(/\s+/g, "-").toLowerCase()}-${index}`}
                                className="flex items-center gap-2 text-sm"
                              >
                                <CheckCircle className="h-3 w-3 text-green-600" />
                                {action}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Quality Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                  Chart placeholder - Quality metrics trends over time
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Review Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                  Chart placeholder - Distribution of review types and outcomes
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
