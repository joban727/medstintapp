"use client"

import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Bell,
  BookOpen,
  CheckCircle,
  Clock,
  Copy,
  Edit,
  Eye,
  Filter,
  Info,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  School,
  Search,
  Send,
  Settings,
  Target,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react"
import type React from "react"
import { useEffect, useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

interface Deployment {
  id: string
  name: string
  templateName: string
  templateVersion: string
  status: "draft" | "active" | "paused" | "completed" | "cancelled"
  scope: "school_wide" | "program_specific" | "selective"
  targetPrograms?: string[]
  targetUsers?: string[]
  startDate: string
  endDate?: string
  assignedCount: number
  completedCount: number
  progressPercentage: number
  createdBy: string
  createdAt: string
  lastModified: string
}

interface NotificationTemplate {
  id: string
  name: string
  type: "deployment_start" | "reminder" | "deadline_warning" | "completion"
  subject: string
  content: string
  isActive: boolean
}

interface DeploymentStats {
  totalDeployments: number
  activeDeployments: number
  completedDeployments: number
  totalAssignments: number
  completedAssignments: number
  averageCompletionRate: number
}

// API functions
const fetchDeployments = async (): Promise<Deployment[]> => {
  try {
    const response = await fetch("/api/competency-deployments")
    if (!response.ok) {
      throw new Error("Failed to fetch deployments")
    }
    const result = await response.json()
    // Extract the data array from the API response structure
    if (result?.success && Array.isArray(result.data)) {
      return result.data
    }
    // Fallback to empty array if structure is unexpected
    console.warn("Unexpected API response structure:", result)
    return []
  } catch (error) {
    console.error("Error fetching deployments:", error)
    return []
  }
}

const fetchNotificationTemplates = async (): Promise<NotificationTemplate[]> => {
  try {
    const response = await fetch("/api/notification-templates")
    if (!response.ok) {
      throw new Error("Failed to fetch notification templates")
    }
    return await response.json()
  } catch (error) {
    console.error("Error fetching notification templates:", error)
    return []
  }
}

const calculateStats = (deployments: Deployment[]): DeploymentStats => {
  const totalDeployments = deployments.length
  const activeDeployments = deployments.filter((d) => d.status === "active").length
  const completedDeployments = deployments.filter((d) => d.status === "completed").length
  const totalAssignments = deployments.reduce((sum, d) => sum + d.assignedCount, 0)
  const completedAssignments = deployments.reduce((sum, d) => sum + d.completedCount, 0)
  const averageCompletionRate =
    totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0

  return {
    totalDeployments,
    activeDeployments,
    completedDeployments,
    totalAssignments,
    completedAssignments,
    averageCompletionRate,
  }
}

export default function DeploymentConsolePage() {
  const [activeTab, setActiveTab] = useState("deployments")
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [notificationTemplates, setNotificationTemplates] = useState<NotificationTemplate[]>([])
  const [stats, setStats] = useState<DeploymentStats>({
    totalDeployments: 0,
    activeDeployments: 0,
    completedDeployments: 0,
    totalAssignments: 0,
    completedAssignments: 0,
    averageCompletionRate: 0,
  })
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)

        const [deploymentsData, templatesData] = await Promise.all([
          fetchDeployments(),
          fetchNotificationTemplates(),
        ])

        setDeployments(deploymentsData)
        setNotificationTemplates(templatesData)
        setStats(calculateStats(deploymentsData))
      } catch (err) {
        setError("Failed to load deployment data. Please try again.")
        console.error("Error loading data:", err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const refreshData = async () => {
    const [deploymentsData, templatesData] = await Promise.all([
      fetchDeployments(),
      fetchNotificationTemplates(),
    ])

    setDeployments(deploymentsData)
    setNotificationTemplates(templatesData)
    setStats(calculateStats(deploymentsData))
  }

  const filteredDeployments = deployments.filter((deployment) => {
    const matchesStatus = filterStatus === "all" || deployment.status === filterStatus
    const matchesSearch =
      deployment.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deployment.templateName.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesStatus && matchesSearch
  })

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <Play className="h-4 w-4 text-green-500" />
      case "paused":
        return <Pause className="h-4 w-4 text-yellow-500" />
      case "completed":
        return <CheckCircle className="h-4 w-4 text-blue-500" />
      case "cancelled":
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case "draft":
        return <Clock className="h-4 w-4 text-gray-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "default"
      case "paused":
        return "secondary"
      case "completed":
        return "outline"
      case "cancelled":
        return "destructive"
      case "draft":
        return "secondary"
      default:
        return "secondary"
    }
  }

  const getScopeIcon = (scope: string) => {
    switch (scope) {
      case "school_wide":
        return <School className="h-4 w-4" />
      case "program_specific":
        return <BookOpen className="h-4 w-4" />
      case "selective":
        return <UserCheck className="h-4 w-4" />
      default:
        return <Target className="h-4 w-4" />
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">Loading deployment data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">Deployment Console</h1>
          <p className="text-muted-foreground">
            Manage school-wide competency deployments and track progress
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Activity className="mr-2 h-4 w-4" />
            Analytics
          </Button>
          <Button>
            <Play className="mr-2 h-4 w-4" />
            New Deployment
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Total Deployments</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{stats.totalDeployments}</div>
            <p className="text-muted-foreground text-xs">
              {stats.activeDeployments} currently active
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Active Deployments</CardTitle>
            <Play className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{stats.activeDeployments}</div>
            <p className="text-muted-foreground text-xs">
              {stats.completedDeployments} completed this quarter
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Total Assignments</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{stats.totalAssignments}</div>
            <p className="text-muted-foreground text-xs">{stats.completedAssignments} completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Completion Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{stats.averageCompletionRate}%</div>
            <p className="text-muted-foreground text-xs">Average across all deployments</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="deployments">Deployments</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="rollback">Rollback Center</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="deployments" className="space-y-6">
          <DeploymentsTab
            deployments={filteredDeployments}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            getStatusIcon={getStatusIcon}
            getStatusColor={getStatusColor}
            getScopeIcon={getScopeIcon}
            onRefresh={refreshData}
          />
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <NotificationsTab
            notificationTemplates={notificationTemplates}
            setNotificationTemplates={setNotificationTemplates}
            onRefresh={refreshData}
            loading={loading}
          />
        </TabsContent>

        <TabsContent value="rollback" className="space-y-6">
          <RollbackTab deployments={deployments} />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <AnalyticsTab stats={stats} deployments={deployments} loading={loading} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function DeploymentsTab({
  deployments,
  filterStatus,
  setFilterStatus,
  searchQuery,
  setSearchQuery,
  getStatusIcon,
  getStatusColor,
  getScopeIcon,
  onRefresh,
}: {
  deployments: Deployment[]
  filterStatus: string
  setFilterStatus: (status: string) => void
  searchQuery: string
  setSearchQuery: (query: string) => void
  getStatusIcon: (status: string) => React.JSX.Element
  getStatusColor: (status: string) => string
  getScopeIcon: (scope: string) => React.JSX.Element
  onRefresh: () => Promise<void>
}) {
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setRefreshing(false)
    }
  }
  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 transform text-muted-foreground" />
                <Input
                  placeholder="Search deployments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-48">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Deployments List */}
      <div className="space-y-4">
        {deployments.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="py-8 text-center">
                <Target className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="mb-2 font-semibold text-lg">No deployments found</h3>
                <p className="mb-4 text-muted-foreground">
                  {filterStatus !== "all" || searchQuery
                    ? "No deployments match your current filters."
                    : "Get started by creating your first competency deployment."}
                </p>
                {filterStatus === "all" && !searchQuery && (
                  <Button>
                    <Play className="mr-2 h-4 w-4" />
                    Create First Deployment
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          deployments.map((deployment) => (
            <Card key={deployment.id}>
              <CardContent className="pt-6">
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(deployment.status)}
                      {getScopeIcon(deployment.scope)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{deployment.name}</h3>
                      <p className="text-muted-foreground">
                        {deployment.templateName} v{deployment.templateVersion}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        Created by {deployment.createdBy} •{" "}
                        {new Date(deployment.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        getStatusColor(deployment.status) as
                          | "default"
                          | "secondary"
                          | "destructive"
                          | "outline"
                      }
                    >
                      {deployment.status}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit Deployment
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Copy className="mr-2 h-4 w-4" />
                          Duplicate
                        </DropdownMenuItem>
                        {deployment.status === "active" && (
                          <DropdownMenuItem>
                            <Pause className="mr-2 h-4 w-4" />
                            Pause Deployment
                          </DropdownMenuItem>
                        )}
                        {deployment.status === "paused" && (
                          <DropdownMenuItem>
                            <Play className="mr-2 h-4 w-4" />
                            Resume Deployment
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Cancel Deployment
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="mb-4 grid gap-4 md:grid-cols-3">
                  <div>
                    <p className="text-muted-foreground text-sm">Scope</p>
                    <p className="font-medium capitalize">{deployment.scope.replace("_", " ")}</p>
                    {deployment.targetPrograms && (
                      <p className="text-muted-foreground text-xs">
                        {deployment.targetPrograms.join(", ")}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">Duration</p>
                    <p className="font-medium">
                      {new Date(deployment.startDate).toLocaleDateString()}
                      {deployment.endDate && (
                        <> - {new Date(deployment.endDate).toLocaleDateString()}</>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">Assignments</p>
                    <p className="font-medium">
                      {deployment.completedCount} / {deployment.assignedCount}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Progress</span>
                    <span>{deployment.progressPercentage}%</span>
                  </div>
                  <Progress value={deployment.progressPercentage} className="h-2" />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

function NotificationsTab({
  notificationTemplates,
  setNotificationTemplates,
  loading,
}: {
  notificationTemplates: NotificationTemplate[]
  setNotificationTemplates: (templates: NotificationTemplate[]) => void
  loading: boolean
}) {
  const [_isCreating, setIsCreating] = useState(false)
  const [_editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null)

  const toggleTemplateStatus = (templateId: string) => {
    setNotificationTemplates(
      notificationTemplates.map((template) =>
        template.id === templateId ? { ...template, isActive: !template.isActive } : template
      )
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />
          <p className="text-muted-foreground text-sm">Loading notification templates...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Notification Templates</CardTitle>
              <CardDescription>
                Manage automated notifications for deployment events
              </CardDescription>
            </div>
            <Button onClick={() => setIsCreating(true)}>
              <Bell className="mr-2 h-4 w-4" />
              Create Template
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Templates List */}
      <div className="space-y-4">
        {notificationTemplates.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="py-8 text-center">
                <Bell className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="mb-2 font-semibold text-lg">No notification templates</h3>
                <p className="mb-4 text-muted-foreground">
                  Create your first notification template to automate deployment communications.
                </p>
                <Button onClick={() => setIsCreating(true)}>
                  <Bell className="mr-2 h-4 w-4" />
                  Create Template
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          notificationTemplates.map((template) => (
            <Card key={template.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-3">
                      <h3 className="font-semibold">{template.name}</h3>
                      <Badge variant={template.isActive ? "default" : "secondary"}>
                        {template.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <Badge variant="outline">{template.type.replace("_", " ")}</Badge>
                    </div>
                    <p className="mb-1 font-medium text-sm">{template.subject}</p>
                    <p className="text-muted-foreground text-sm">{template.content}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleTemplateStatus(template.id)}
                    >
                      {template.isActive ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingTemplate(template)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Notification Settings</CardTitle>
          <CardDescription>Configure global notification preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="emailNotifications">Email Notifications</Label>
                <Checkbox id="emailNotifications" defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="smsNotifications">SMS Notifications</Label>
                <Checkbox id="smsNotifications" />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="inAppNotifications">In-App Notifications</Label>
                <Checkbox id="inAppNotifications" defaultChecked />
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <Label htmlFor="reminderFrequency">Reminder Frequency</Label>
                <Select defaultValue="weekly">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="biweekly">Bi-weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="deadlineWarning">Deadline Warning (days before)</Label>
                <Select defaultValue="3">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 day</SelectItem>
                    <SelectItem value="3">3 days</SelectItem>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="14">14 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function RollbackTab({ deployments }: { deployments: Deployment[] }) {
  const activeDeployments = deployments.filter(
    (d) => d.status === "active" || d.status === "paused"
  )
  const _completedDeployments = deployments.filter((d) => d.status === "completed")

  return (
    <div className="space-y-6">
      {/* Rollback Warning */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Warning:</strong> Rollback operations will revert competency assignments and may
          affect student progress. Please ensure you have proper backups before proceeding.
        </AlertDescription>
      </Alert>

      {/* Active Deployments Rollback */}
      <Card>
        <CardHeader>
          <CardTitle>Active Deployments</CardTitle>
          <CardDescription>Rollback or modify currently active deployments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {activeDeployments.map((deployment) => (
              <div
                key={deployment.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div>
                  <h4 className="font-medium">{deployment.name}</h4>
                  <p className="text-muted-foreground text-sm">
                    {deployment.templateName} • {deployment.assignedCount} assignments
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Started {new Date(deployment.startDate).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Pause className="mr-2 h-4 w-4" />
                        Pause
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Pause Deployment</DialogTitle>
                        <DialogDescription>
                          This will pause the deployment and stop new assignments. Existing
                          assignments will remain active.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button variant="outline">Cancel</Button>
                        <Button>Pause Deployment</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Rollback
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Rollback Deployment</DialogTitle>
                        <DialogDescription>
                          This will completely rollback the deployment and remove all associated
                          assignments. This action cannot be undone.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="rollbackReason">Reason for Rollback</Label>
                          <Textarea
                            id="rollbackReason"
                            placeholder="Please provide a reason for this rollback..."
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox id="confirmRollback" />
                          <Label htmlFor="confirmRollback">
                            I understand this action cannot be undone
                          </Label>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline">Cancel</Button>
                        <Button variant="destructive">Confirm Rollback</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            ))}
            {activeDeployments.length === 0 && (
              <div className="py-8 text-center text-muted-foreground">
                <Info className="mx-auto mb-2 h-8 w-8" />
                <p>No active deployments to rollback</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Rollback History */}
      <Card>
        <CardHeader>
          <CardTitle>Rollback History</CardTitle>
          <CardDescription>View previous rollback operations and their details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="py-8 text-center text-muted-foreground">
              <RotateCcw className="mx-auto mb-2 h-8 w-8" />
              <p>No rollback operations performed yet</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Emergency Rollback */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600">Emergency Rollback</CardTitle>
          <CardDescription>
            Immediately rollback all active deployments (use with extreme caution)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                This will immediately rollback ALL active deployments and remove ALL associated
                assignments. This action is irreversible and should only be used in emergency
                situations.
              </AlertDescription>
            </Alert>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="destructive">
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  Emergency Rollback All
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Emergency Rollback Confirmation</DialogTitle>
                  <DialogDescription>
                    You are about to rollback ALL active deployments. This will affect{" "}
                    {activeDeployments.length} deployments and remove all associated assignments.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="emergencyReason">Emergency Reason</Label>
                    <Textarea
                      id="emergencyReason"
                      placeholder="Please provide a detailed reason for this emergency rollback..."
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox id="confirmEmergency" />
                      <Label htmlFor="confirmEmergency">
                        I understand this will affect all active deployments
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="confirmIrreversible" />
                      <Label htmlFor="confirmIrreversible">
                        I understand this action is irreversible
                      </Label>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline">Cancel</Button>
                  <Button variant="destructive">Execute Emergency Rollback</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function AnalyticsTab({
  stats,
  deployments,
  loading,
}: {
  stats: DeploymentStats
  deployments: Deployment[]
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">Loading analytics data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-medium text-sm">Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl text-green-600">{stats.averageCompletionRate}%</div>
            <p className="text-muted-foreground text-xs">Deployment success rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-medium text-sm">Avg. Duration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">45 days</div>
            <p className="text-muted-foreground text-xs">Average deployment duration</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-medium text-sm">User Engagement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">
              {Math.round(
                stats.totalAssignments > 0
                  ? (stats.completedAssignments / stats.totalAssignments) * 100
                  : 0
              )}
              %
            </div>
            <p className="text-muted-foreground text-xs">Users actively participating</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-medium text-sm">Time to Complete</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">12 days</div>
            <p className="text-muted-foreground text-xs">Average completion time</p>
          </CardContent>
        </Card>
      </div>

      {/* Deployment Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Deployment Performance</CardTitle>
          <CardDescription>Track the performance of individual deployments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {deployments.map((deployment) => (
              <div
                key={deployment.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="flex-1">
                  <h4 className="font-medium">{deployment.name}</h4>
                  <p className="text-muted-foreground text-sm">
                    {deployment.assignedCount} assignments • {deployment.progressPercentage}%
                    complete
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-medium text-sm">
                      {deployment.completedCount}/{deployment.assignedCount}
                    </p>
                    <p className="text-muted-foreground text-xs">Completed</p>
                  </div>
                  <div className="w-24">
                    <Progress value={deployment.progressPercentage} className="h-2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Trends and Insights */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Completion Trends</CardTitle>
            <CardDescription>Monthly completion rates over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-64 items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Activity className="mx-auto mb-2 h-8 w-8" />
                <p>Chart visualization would go here</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Program Performance</CardTitle>
            <CardDescription>Completion rates by medical program</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Internal Medicine</span>
                <div className="flex items-center gap-2">
                  <Progress value={85} className="h-2 w-20" />
                  <span className="font-medium text-sm">85%</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Surgery</span>
                <div className="flex items-center gap-2">
                  <Progress value={72} className="h-2 w-20" />
                  <span className="font-medium text-sm">72%</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Pediatrics</span>
                <div className="flex items-center gap-2">
                  <Progress value={91} className="h-2 w-20" />
                  <span className="font-medium text-sm">91%</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Family Medicine</span>
                <div className="flex items-center gap-2">
                  <Progress value={78} className="h-2 w-20" />
                  <span className="font-medium text-sm">78%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
