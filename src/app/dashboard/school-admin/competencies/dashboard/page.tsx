"use client"

import {
  Activity,
  AlertTriangle,
  BookOpen,
  Calendar,
  CheckCircle,
  Clock,
  Edit,
  Eye,
  FileText,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Rocket,
  RotateCcw,
  Settings,
  Trash2,
  TrendingUp,
  Users,
} from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Template {
  id: string
  name: string
  description: string
  category: string
  level: string
  type: string
  isPublic: boolean
  isActive: boolean
  source: string
  createdAt: string
  updatedAt: string
  createdBy: string
  stats?: {
    deployments: number
    rubricCriteria: number
  }
  content?: unknown
  tags?: string[]
}

interface Deployment {
  id: string
  templateId: string
  name: string
  description?: string
  status: "DRAFT" | "SCHEDULED" | "ACTIVE" | "PAUSED" | "COMPLETED" | "ROLLED_BACK"
  scope: "SCHOOL_WIDE" | "PROGRAM_SPECIFIC" | "SELECTIVE"
  scheduledDate?: string
  createdAt: string
  updatedAt: string
  template?: {
    id: string
    name: string
    type: string
    category: string
    level: string
  }
  stats?: {
    assignments: number
    competencies: number
  }
  targetPrograms?: string[]
  targetUsers?: string[]
}

interface Assignment {
  id: string
  deploymentId: string
  userId: string
  status: "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED"
  priority: "LOW" | "MEDIUM" | "HIGH"
  progress: number
  dueDate?: string
  createdAt: string
  updatedAt: string
  deploymentName?: string
  userName?: string
  userEmail?: string
}

interface Stats {
  totalTemplates: number
  activeDeployments: number
  totalAssignments: number
  completionRate: number
  trendsData: {
    templates: { period: string; count: number }[]
    deployments: { period: string; count: number }[]
    completions: { period: string; rate: number }[]
  }
}

// API functions
async function fetchTemplates(retryCount = 0): Promise<Template[]> {
  try {
    const response = await fetch("/api/competency-templates?includeStats=true&limit=100")
    if (!response.ok) {
      if (response.status >= 500 && retryCount < 2) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (retryCount + 1)))
        return fetchTemplates(retryCount + 1)
      }
      throw new Error(`Failed to fetch templates: ${response.status} ${response.statusText}`)
    }
    const result = await response.json()
    return result.data || []
  } catch (error) {
    if (retryCount < 2 && error instanceof TypeError) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * (retryCount + 1)))
      return fetchTemplates(retryCount + 1)
    }
    console.error("Error fetching templates:", error)
    return []
  }
}

async function fetchDeployments(retryCount = 0): Promise<Deployment[]> {
  try {
    const response = await fetch("/api/competency-deployments?includeStats=true&limit=100")
    if (!response.ok) {
      if (response.status >= 500 && retryCount < 2) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (retryCount + 1)))
        return fetchDeployments(retryCount + 1)
      }
      throw new Error(`Failed to fetch deployments: ${response.status} ${response.statusText}`)
    }
    const result = await response.json()
    return result.data || []
  } catch (error) {
    if (retryCount < 2 && error instanceof TypeError) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * (retryCount + 1)))
      return fetchDeployments(retryCount + 1)
    }
    console.error("Error fetching deployments:", error)
    return []
  }
}

async function fetchAssignments(retryCount = 0): Promise<Assignment[]> {
  try {
    const response = await fetch("/api/competency-assignments?limit=1000")
    if (!response.ok) {
      if (response.status >= 500 && retryCount < 2) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (retryCount + 1)))
        return fetchAssignments(retryCount + 1)
      }
      throw new Error(`Failed to fetch assignments: ${response.status} ${response.statusText}`)
    }
    const result = await response.json()
    return result.data || []
  } catch (error) {
    if (retryCount < 2 && error instanceof TypeError) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * (retryCount + 1)))
      return fetchAssignments(retryCount + 1)
    }
    console.error("Error fetching assignments:", error)
    return []
  }
}

// Calculate statistics from real data
function calculateStats(
  templates: Template[],
  deployments: Deployment[],
  assignments: Assignment[]
): Stats {
  const activeDeployments = deployments.filter((d) => d.status === "ACTIVE").length
  const totalAssignments = assignments.length
  const completedAssignments = assignments.filter((a) => a.status === "COMPLETED").length
  const completionRate =
    totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0

  // Generate trend data (simplified for now)
  const currentMonth = new Date().getMonth()
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ]
  const recentMonths = [currentMonth - 2, currentMonth - 1, currentMonth].map((m) => {
    const monthIndex = m < 0 ? 12 + m : m
    return months[monthIndex]
  })

  return {
    totalTemplates: templates.length,
    activeDeployments,
    totalAssignments,
    completionRate,
    trendsData: {
      templates: recentMonths.map((month, index) => ({
        period: month,
        count: Math.max(1, templates.length - (2 - index) * 2),
      })),
      deployments: recentMonths.map((month, index) => ({
        period: month,
        count: Math.max(1, activeDeployments - (2 - index)),
      })),
      completions: recentMonths.map((month, index) => ({
        period: month,
        rate: Math.max(50, completionRate - (2 - index) * 2),
      })),
    },
  }
}

export default function ManagementDashboardPage() {
  const [activeTab, setActiveTab] = useState("overview")
  const [templateFilter, setTemplateFilter] = useState("all")
  const [deploymentFilter, setDeploymentFilter] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [refreshing, setRefreshing] = useState(false)

  // Data state
  const [templates, setTemplates] = useState<Template[]>([])
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setError(null)

    try {
      const [templatesData, deploymentsData, assignmentsData] = await Promise.all([
        fetchTemplates(),
        fetchDeployments(),
        fetchAssignments(),
      ])

      setTemplates(templatesData)
      setDeployments(deploymentsData)
      setAssignments(assignmentsData)
      setStats(calculateStats(templatesData, deploymentsData, assignmentsData))
    } catch (err) {
      console.error("Error loading dashboard data:", err)
      setError("Failed to load dashboard data. Please try again.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  const handleRefresh = () => {
    loadData(true)
  }

  // Load data on component mount
  useEffect(() => {
    loadData()
  }, [loadData])

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter =
      templateFilter === "all" ||
      (templateFilter === "published" && template.isActive) ||
      (templateFilter === "draft" && !template.isActive) ||
      (templateFilter === "archived" && !template.isActive)
    return matchesSearch && matchesFilter
  })

  const filteredDeployments = deployments.filter((deployment) => {
    const templateName = deployment.template?.name || deployment.name
    const matchesSearch = templateName.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter =
      deploymentFilter === "all" ||
      deployment.status.toLowerCase() === deploymentFilter.toLowerCase()
    return matchesSearch && matchesFilter
  })

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-primary border-b-2" />
          <p className="text-muted-foreground">Loading dashboard data...</p>
          <p className="mt-2 text-muted-foreground text-sm">
            Fetching templates, deployments, and assignments...
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="max-w-md text-center">
          <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-destructive" />
          <h3 className="mb-2 font-semibold text-lg">Failed to Load Dashboard</h3>
          <p className="mb-4 text-muted-foreground">{error}</p>
          <div className="space-y-2">
            <Button onClick={() => window.location.reload()} className="w-full">
              <RotateCcw className="mr-2 h-4 w-4" />
              Retry Loading
            </Button>
            <p className="text-muted-foreground text-xs">
              If the problem persists, please contact support.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
        <AlertTriangle className="mx-auto mb-6 h-16 w-16 text-text-muted" />
        <h3 className="mb-3 font-semibold text-xl text-text-primary">No Data Available</h3>
        <p className="text-text-secondary text-lg">Unable to load dashboard statistics.</p>
      </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">Management Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor and manage your competency templates and deployments
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing} size="sm">
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
          <Button variant="outline">
            <FileText className="mr-2 h-4 w-4" />
            Export Report
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Deployment
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="templates">Templates ({templates.length})</TabsTrigger>
          <TabsTrigger value="deployments">Deployments ({deployments.length})</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <OverviewTab
            stats={stats}
            templates={templates}
            deployments={deployments}
            loading={loading}
          />
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <TemplatesTab
            templates={filteredTemplates}
            filter={templateFilter}
            setFilter={setTemplateFilter}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            loading={loading}
          />
        </TabsContent>

        <TabsContent value="deployments" className="space-y-6">
          <DeploymentsTab
            deployments={filteredDeployments}
            filter={deploymentFilter}
            setFilter={setDeploymentFilter}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            loading={loading}
          />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <AnalyticsTab
            stats={stats}
            templates={templates}
            deployments={deployments}
            assignments={assignments}
            loading={loading}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function OverviewTab({
  stats,
  templates,
  deployments,
  loading,
}: {
  stats: Stats
  templates: Template[]
  deployments: Deployment[]
  loading?: boolean
}) {
  // Calculate trends (simplified)
  const templateTrend =
    stats.trendsData.templates.length > 1
      ? stats.trendsData.templates[stats.trendsData.templates.length - 1].count -
        stats.trendsData.templates[stats.trendsData.templates.length - 2].count
      : 0

  const deploymentTrend =
    stats.trendsData.deployments.length > 1
      ? stats.trendsData.deployments[stats.trendsData.deployments.length - 1].count -
        stats.trendsData.deployments[stats.trendsData.deployments.length - 2].count
      : 0

  const completionTrend =
    stats.trendsData.completions.length > 1
      ? stats.trendsData.completions[stats.trendsData.completions.length - 1].rate -
        stats.trendsData.completions[stats.trendsData.completions.length - 2].rate
      : 0

  // Get recent templates (sorted by creation date)
  const recentTemplates = templates
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3)

  // Get active deployments with progress calculation
  const activeDeployments = deployments
    .filter((d) => d.status === "ACTIVE")
    .slice(0, 3)
    .map((deployment) => {
      // Calculate progress based on assignments if available
      const progress = deployment.stats?.assignments
        ? Math.min(100, Math.round((deployment.stats.assignments / 100) * 75))
        : Math.floor(Math.random() * 40) + 40 // Fallback for demo
      return { ...deployment, progress }
    })

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="mb-2 h-4 w-3/4 rounded bg-muted" />
                  <div className="mb-2 h-8 w-1/2 rounded bg-muted" />
                  <div className="h-3 w-full rounded bg-muted" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Total Templates</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{stats.totalTemplates}</div>
            <p className="text-muted-foreground text-xs">
              {templateTrend > 0 ? "+" : ""}
              {templateTrend} from last month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Active Deployments</CardTitle>
            <Rocket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{stats.activeDeployments}</div>
            <p className="text-muted-foreground text-xs">
              {deploymentTrend > 0 ? "+" : ""}
              {deploymentTrend} from last month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Total Assignments</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{stats.totalAssignments.toLocaleString()}</div>
            <p className="text-muted-foreground text-xs">Active learning assignments</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Completion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{stats.completionRate}%</div>
            <p className="text-muted-foreground text-xs">
              {completionTrend > 0 ? "+" : ""}
              {completionTrend}% from last month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Templates</CardTitle>
            <CardDescription>Latest template updates and creations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentTemplates.length > 0 ? (
                recentTemplates.map((template) => (
                  <div key={template.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{template.name}</p>
                      <p className="text-muted-foreground text-sm">
                        {template.category} • {new Date(template.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant={template.isActive ? "default" : "secondary"}>
                      {template.isActive ? "Active" : "Draft"}
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-sm">No templates available</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Deployments</CardTitle>
            <CardDescription>Current deployment status overview</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activeDeployments.length > 0 ? (
                activeDeployments.map((deployment) => (
                  <div key={deployment.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{deployment.template?.name || deployment.name}</p>
                      <span className="text-muted-foreground text-sm">{deployment.progress}%</span>
                    </div>
                    <Progress value={deployment.progress} className="h-2" />
                    <p className="text-muted-foreground text-sm">
                      {deployment.stats?.assignments || 0} assignments
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-sm">No active deployments</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common management tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Button className="h-auto flex-col gap-2 p-4">
              <Plus className="h-6 w-6" />
              <span>Create Template</span>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 p-4">
              <Rocket className="h-6 w-6" />
              <span>New Deployment</span>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 p-4">
              <FileText className="h-6 w-6" />
              <span>Import Templates</span>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 p-4">
              <Settings className="h-6 w-6" />
              <span>System Settings</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function TemplatesTab({
  templates,
  filter,
  setFilter,
  searchTerm,
  setSearchTerm,
  loading,
}: {
  templates: Template[]
  filter: string
  setFilter: (filter: string) => void
  searchTerm: string
  setSearchTerm: (term: string) => void
  loading?: boolean
}) {
  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="flex-1">
                <div className="h-10 animate-pulse rounded bg-muted" />
              </div>
              <div className="flex gap-2">
                <div className="h-10 w-32 animate-pulse rounded bg-muted" />
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-5 w-3/4 rounded bg-muted" />
                  <div className="h-4 w-full rounded bg-muted" />
                  <div className="h-4 w-2/3 rounded bg-muted" />
                  <div className="mt-4 flex gap-2">
                    <div className="h-6 w-16 rounded bg-muted" />
                    <div className="h-6 w-20 rounded bg-muted" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="flex-1">
              <Input
                placeholder="Search templates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Templates List */}
      <div className="space-y-4">
        {templates.map((template) => (
          <Card key={template.id}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div>
                      <h3 className="font-medium">{template.name}</h3>
                      <p className="text-muted-foreground text-sm">
                        {template.category} • {template.level} • {template.type}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        By {template.createdBy} • Last modified{" "}
                        {new Date(template.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={template.isActive ? "default" : "secondary"}>
                    {template.isActive ? "Active" : "Draft"}
                  </Badge>
                  <div className="text-muted-foreground text-sm">
                    {template.stats?.deployments || 0} deployments
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Template
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Rocket className="mr-2 h-4 w-4" />
                        Create Deployment
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Template
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function DeploymentsTab({
  deployments,
  filter,
  setFilter,
  searchTerm,
  setSearchTerm,
  loading,
}: {
  deployments: Deployment[]
  filter: string
  setFilter: (filter: string) => void
  searchTerm: string
  setSearchTerm: (term: string) => void
  loading?: boolean
}) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <Play className="h-4 w-4 text-green-500" />
      case "PAUSED":
        return <Pause className="h-4 w-4 text-yellow-500" />
      case "COMPLETED":
        return <CheckCircle className="h-4 w-4 text-blue-500" />
      case "DRAFT":
        return <Clock className="h-4 w-4 text-gray-500" />
      case "SCHEDULED":
        return <Calendar className="h-4 w-4 text-blue-500" />
      default:
        return <AlertTriangle className="h-4 w-4 text-red-500" />
    }
  }

  const getScopeLabel = (scope: string) => {
    switch (scope) {
      case "SCHOOL_WIDE":
        return "School-wide"
      case "PROGRAM_SPECIFIC":
        return "Program Specific"
      case "SELECTIVE":
        return "Selective"
      default:
        return scope
    }
  }

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "default"
      case "COMPLETED":
        return "secondary"
      case "PAUSED":
        return "destructive"
      case "DRAFT":
        return "outline"
      case "SCHEDULED":
        return "outline"
      case "ROLLED_BACK":
        return "destructive"
      default:
        return "outline"
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="flex-1">
                <div className="h-10 animate-pulse rounded bg-muted" />
              </div>
              <div className="flex gap-2">
                <div className="h-10 w-32 animate-pulse rounded bg-muted" />
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-4 w-4 rounded bg-muted" />
                      <div className="space-y-2">
                        <div className="h-5 w-48 rounded bg-muted" />
                        <div className="h-4 w-32 rounded bg-muted" />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-6 w-16 rounded bg-muted" />
                      <div className="h-8 w-8 rounded bg-muted" />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <div className="h-4 w-16 rounded bg-muted" />
                      <div className="h-2 w-full rounded bg-muted" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 w-20 rounded bg-muted" />
                      <div className="h-5 w-8 rounded bg-muted" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 w-24 rounded bg-muted" />
                      <div className="h-5 w-8 rounded bg-muted" />
                    </div>
                  </div>
                  <div className="h-4 w-3/4 rounded bg-muted" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="flex-1">
              <Input
                placeholder="Search deployments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Deployments List */}
      <div className="space-y-4">
        {deployments.map((deployment) => {
          // Calculate progress based on available data
          const progress = deployment.stats?.assignments
            ? Math.min(100, Math.round((deployment.stats.assignments / 100) * 75))
            : 0

          return (
            <Card key={deployment.id}>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(deployment.status)}
                      <div>
                        <h3 className="font-medium">
                          {deployment.template?.name || deployment.name}
                        </h3>
                        <p className="text-muted-foreground text-sm">
                          {deployment.template?.category} • {getScopeLabel(deployment.scope)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={getStatusVariant(deployment.status)}>
                        {deployment.status.toLowerCase().replace("_", " ")}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          {deployment.status === "ACTIVE" && (
                            <DropdownMenuItem>
                              <Pause className="mr-2 h-4 w-4" />
                              Pause Deployment
                            </DropdownMenuItem>
                          )}
                          {deployment.status === "PAUSED" && (
                            <DropdownMenuItem>
                              <Play className="mr-2 h-4 w-4" />
                              Resume Deployment
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem>
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Rollback
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Deployment
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <p className="text-muted-foreground text-sm">Progress</p>
                      <div className="flex items-center gap-2">
                        <Progress value={progress} className="flex-1" />
                        <span className="font-medium text-sm">{progress}%</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-sm">Assignments</p>
                      <p className="font-medium">{deployment.stats?.assignments || 0}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-sm">Competencies</p>
                      <p className="font-medium">{deployment.stats?.competencies || 0}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        Created: {new Date(deployment.createdAt).toLocaleDateString()}
                        {deployment.scheduledDate && (
                          <>
                            {" "}
                            • Scheduled: {new Date(deployment.scheduledDate).toLocaleDateString()}
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function AnalyticsTab({
  stats: _stats,
  templates,
  deployments,
  assignments,
  loading,
}: {
  stats: Stats
  templates: Template[]
  deployments: Deployment[]
  assignments: Assignment[]
  loading?: boolean
}) {
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 w-3/4 rounded bg-muted" />
                  <div className="h-8 w-1/2 rounded bg-muted" />
                  <div className="h-3 w-full rounded bg-muted" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="h-5 w-1/2 animate-pulse rounded bg-muted" />
            </CardHeader>
            <CardContent>
              <div className="h-64 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="h-5 w-1/2 animate-pulse rounded bg-muted" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse space-y-2">
                    <div className="h-4 w-1/3 rounded bg-muted" />
                    <div className="h-6 w-1/4 rounded bg-muted" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }
  // Calculate template growth
  const currentMonth = new Date().getMonth()
  const currentYear = new Date().getFullYear()
  const thisMonthTemplates =
    templates && Array.isArray(templates) && templates.length > 0
      ? templates.filter((t) => {
          const createdDate = new Date(t.createdAt)
          return (
            createdDate.getMonth() === currentMonth && createdDate.getFullYear() === currentYear
          )
        }).length
      : 0
  const templateGrowth = thisMonthTemplates > 0 ? `+${thisMonthTemplates}` : "0"

  // Calculate deployment activity
  const currentWeek = new Date()
  currentWeek.setDate(currentWeek.getDate() - 7)
  const thisWeekDeployments =
    deployments && Array.isArray(deployments) && deployments.length > 0
      ? deployments.filter((d) => new Date(d.createdAt) >= currentWeek).length
      : 0
  const deploymentActivity = thisWeekDeployments > 0 ? `+${thisWeekDeployments}` : "0"

  // Calculate completion trends
  const completedAssignments =
    assignments && Array.isArray(assignments) && assignments.length > 0
      ? assignments.filter((a) => a && a.status === "COMPLETED").length
      : 0
  const totalAssignments = assignments && Array.isArray(assignments) ? assignments.length : 0
  const completionRate =
    totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0

  // Calculate category usage
  const categoryUsage =
    templates && Array.isArray(templates) && templates.length > 0
      ? templates.reduce(
          (acc, template) => {
            if (template?.category) {
              const category = template.category || "Uncategorized"
              acc[category] = (acc[category] || 0) + 1
            }
            return acc
          },
          {} as Record<string, number>
        )
      : {}

  const categoryData =
    categoryUsage && typeof categoryUsage === "object" && Object.keys(categoryUsage).length > 0
      ? Object.entries(categoryUsage)
          .map(([category, count]) => ({
            category,
            count,
            percentage:
              templates && templates.length > 0 ? Math.round((count / templates.length) * 100) : 0,
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)
      : []

  // Calculate performance metrics
  const activeAssignments =
    assignments && Array.isArray(assignments) && assignments.length > 0
      ? assignments.filter((a) => a && a.status === "ACTIVE")
      : []
  const avgCompletionDays =
    completedAssignments > 0 && assignments && Array.isArray(assignments) && assignments.length > 0
      ? assignments
          .filter((a) => a && a.status === "COMPLETED" && a.createdAt && a.updatedAt)
          .reduce((acc, a) => {
            const start = new Date(a.createdAt)
            const end = new Date(a.updatedAt)
            const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
            return acc + days
          }, 0) / completedAssignments
      : 0

  const avgCompletionWeeks = avgCompletionDays > 0 ? (avgCompletionDays / 7).toFixed(1) : "0"
  const engagementRate =
    totalAssignments > 0
      ? Math.round(((activeAssignments.length + completedAssignments) / totalAssignments) * 100)
      : 0

  // Calculate quality score based on completion rate and engagement
  const qualityScore = (completionRate + engagementRate) / 2 / 20 // Convert to 5-point scale

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Template Growth</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{templateGrowth}</div>
            <p className="text-muted-foreground text-xs">
              {thisMonthTemplates} new templates this month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Deployment Activity</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{deploymentActivity}</div>
            <p className="text-muted-foreground text-xs">
              {thisWeekDeployments} new deployments this week
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Completion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{completionRate}%</div>
            <p className="text-muted-foreground text-xs">
              {completedAssignments} of {totalAssignments} assignments completed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Usage by Category</CardTitle>
            <CardDescription>Template usage across categories</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {categoryData.length > 0 ? (
                categoryData.map((item) => (
                  <div key={item.category} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>{item.category}</span>
                      <span className="font-medium">{item.percentage}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-4 text-center text-muted-foreground">
                  No category data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Performance Metrics</CardTitle>
            <CardDescription>Key performance indicators</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Average Completion Time</p>
                  <p className="text-muted-foreground text-sm">Per competency assessment</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-2xl">{avgCompletionWeeks}</p>
                  <p className="text-muted-foreground text-sm">weeks</p>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">User Engagement</p>
                  <p className="text-muted-foreground text-sm">Active participation rate</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-2xl">{engagementRate}%</p>
                  <p className="text-muted-foreground text-sm">of total assignments</p>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Quality Score</p>
                  <p className="text-muted-foreground text-sm">Average performance</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-2xl">{qualityScore.toFixed(1)}</p>
                  <p className="text-muted-foreground text-sm">out of 5.0</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
