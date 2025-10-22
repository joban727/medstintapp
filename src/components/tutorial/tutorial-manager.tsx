"use client"

import { AnimatePresence, motion } from "framer-motion"
import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  Edit,
  Eye,
  EyeOff,
  Plus,
  RefreshCw,
  Search,
  Target,
  Trash2,
  Users,
} from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { cn } from "../../lib/utils"
import type { UserRole } from "../../types"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Card, CardContent } from "../ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog"
import { Input } from "../ui/input"
import { Progress } from "../ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Switch } from "../ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"
import { Textarea } from "../ui/textarea"
import type { WalkthroughConfig, WalkthroughStep } from "./guided-walkthrough"

export interface TutorialAnalytics {
  tutorialId: string
  totalStarts: number
  totalCompletions: number
  averageCompletionTime: number
  averageScore: number
  dropOffPoints: { stepId: string; dropOffRate: number }[]
  userFeedback: {
    rating: number
    comments: string[]
  }
  completionRate: number
  popularityScore: number
  lastUpdated: Date
}

export interface TutorialTemplate {
  id: string
  name: string
  description: string
  category: "onboarding" | "feature" | "advanced"
  targetRole: UserRole | "all"
  steps: WalkthroughStep[]
  isActive: boolean
  version: string
  createdAt: Date
  updatedAt: Date
  createdBy: string
  analytics?: TutorialAnalytics
}

export interface ABTestConfig {
  id: string
  name: string
  description: string
  tutorialId: string
  variants: {
    id: string
    name: string
    config: Partial<WalkthroughConfig>
    trafficPercentage: number
  }[]
  isActive: boolean
  startDate: Date
  endDate?: Date
  metrics: {
    variantId: string
    completionRate: number
    averageTime: number
    userSatisfaction: number
  }[]
}

export interface TutorialManagerProps {
  userRole: UserRole
  isAdmin?: boolean
  onTutorialUpdate?: (tutorial: TutorialTemplate) => void
  onAnalyticsExport?: (data: TutorialAnalytics[]) => void
  className?: string
}

export function TutorialManager({
  userRole,
  isAdmin = false,
  onTutorialUpdate,
  onAnalyticsExport,
  className,
}: TutorialManagerProps) {
  const [tutorials, setTutorials] = useState<TutorialTemplate[]>([])
  const [analytics, setAnalytics] = useState<TutorialAnalytics[]>([])
  const [_abTests, _setABTests] = useState<ABTestConfig[]>([])
  const [selectedTutorial, setSelectedTutorial] = useState<TutorialTemplate | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterCategory, setFilterCategory] = useState<string>("all")
  const [filterRole, setFilterRole] = useState<string>("all")
  const [showInactive, setShowInactive] = useState(false)
  const [expandedAnalytics, setExpandedAnalytics] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Load tutorials from localStorage or API
  const loadTutorials = useCallback(async () => {
    setLoading(true)
    try {
      // In a real app, this would be an API call
      const savedTutorials = localStorage.getItem("tutorial-templates")
      if (savedTutorials) {
        const parsed = JSON.parse(savedTutorials)
        setTutorials(
          parsed.map((t: any) => ({
            ...t,
            createdAt: new Date(t.createdAt),
            updatedAt: new Date(t.updatedAt),
          }))
        )
      } else {
        // Initialize with default tutorials
        const defaultTutorials: TutorialTemplate[] = [
          {
            id: "user-type-selection",
            name: "User Type Selection",
            description: "Guide users through selecting their account type",
            category: "onboarding",
            targetRole: "all",
            steps: [
              {
                id: "welcome",
                title: "Welcome to MedstintClerk",
                text: "Let's get you started by selecting your account type.",
                attachTo: { element: '[data-tutorial="user-type"]', on: "bottom" },
              },
              {
                id: "select-type",
                title: "Choose Your Role",
                text: "Select the option that best describes your role in medical education.",
                attachTo: { element: '[data-tutorial="role-options"]', on: "top" },
              },
            ],
            isActive: true,
            version: "1.0.0",
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: "system",
          },
          {
            id: "school-profile-setup",
            name: "School Profile Setup",
            description: "Help users set up their school profile information",
            category: "onboarding",
            targetRole: "SCHOOL_ADMIN",
            steps: [
              {
                id: "school-info",
                title: "School Information",
                text: "Enter your school's basic information to get started.",
                attachTo: { element: '[data-tutorial="school-form"]', on: "right" },
              },
              {
                id: "contact-details",
                title: "Contact Details",
                text: "Add contact information for your institution.",
                attachTo: { element: '[data-tutorial="contact-form"]', on: "left" },
              },
            ],
            isActive: true,
            version: "1.0.0",
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: "system",
          },
        ]
        setTutorials(defaultTutorials)
        localStorage.setItem("tutorial-templates", JSON.stringify(defaultTutorials))
      }

      // Load analytics
      const savedAnalytics = localStorage.getItem("tutorial-analytics")
      if (savedAnalytics) {
        const parsed = JSON.parse(savedAnalytics)
        setAnalytics(
          parsed.map((a: any) => ({
            ...a,
            lastUpdated: new Date(a.lastUpdated),
          }))
        )
      }
    } catch (error) {
      console.error("Failed to load tutorials:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Save tutorials
  const saveTutorials = useCallback((newTutorials: TutorialTemplate[]) => {
    try {
      localStorage.setItem("tutorial-templates", JSON.stringify(newTutorials))
      setTutorials(newTutorials)
    } catch (error) {
      console.error("Failed to save tutorials:", error)
    }
  }, [])

  // Create new tutorial
  const createTutorial = () => {
    const newTutorial: TutorialTemplate = {
      id: `tutorial-${Date.now()}`,
      name: "New Tutorial",
      description: "Tutorial description",
      category: "feature",
      targetRole: "all",
      steps: [
        {
          id: "step-1",
          title: "Step 1",
          text: "Step description",
          attachTo: { element: "body", on: "top" },
        },
      ],
      isActive: false,
      version: "1.0.0",
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: "admin",
    }

    setSelectedTutorial(newTutorial)
    setIsEditing(true)
  }

  // Update tutorial
  const updateTutorial = (tutorial: TutorialTemplate) => {
    const updatedTutorials = tutorials.map((t) =>
      t.id === tutorial.id ? { ...tutorial, updatedAt: new Date() } : t
    )

    if (!tutorials.find((t) => t.id === tutorial.id)) {
      updatedTutorials.push(tutorial)
    }

    saveTutorials(updatedTutorials)
    onTutorialUpdate?.(tutorial)
    setIsEditing(false)
    setSelectedTutorial(null)
  }

  // Delete tutorial
  const deleteTutorial = (tutorialId: string) => {
    const updatedTutorials = tutorials.filter((t) => t.id !== tutorialId)
    saveTutorials(updatedTutorials)
  }

  // Toggle tutorial active status
  const toggleTutorialStatus = (tutorialId: string) => {
    const updatedTutorials = tutorials.map((t) =>
      t.id === tutorialId ? { ...t, isActive: !t.isActive, updatedAt: new Date() } : t
    )
    saveTutorials(updatedTutorials)
  }

  // Filter tutorials
  const filteredTutorials = tutorials.filter((tutorial) => {
    const matchesSearch =
      tutorial.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tutorial.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = filterCategory === "all" || tutorial.category === filterCategory
    const matchesRole =
      filterRole === "all" || tutorial.targetRole === filterRole || tutorial.targetRole === "all"
    const matchesStatus = showInactive || tutorial.isActive

    return matchesSearch && matchesCategory && matchesRole && matchesStatus
  })

  // Export analytics
  const exportAnalytics = () => {
    const dataStr = JSON.stringify(analytics, null, 2)
    const dataBlob = new Blob([dataStr], { type: "application/json" })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement("a")
    link.href = url
    link.download = `tutorial-analytics-${new Date().toISOString().split("T")[0]}.json`
    link.click()
    URL.revokeObjectURL(url)
    onAnalyticsExport?.(analytics)
  }

  // Load data on mount
  useEffect(() => {
    loadTutorials()
  }, [loadTutorials])

  if (!isAdmin) {
    return (
      <div className="py-8 text-center">
        <p className="text-gray-600">Access denied. Admin privileges required.</p>
      </div>
    )
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-2xl text-gray-900">Tutorial Management</h2>
          <p className="text-gray-600">Manage tutorials, view analytics, and run A/B tests</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportAnalytics} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export Analytics
          </Button>
          <Button onClick={createTutorial}>
            <Plus className="mr-2 h-4 w-4" />
            New Tutorial
          </Button>
        </div>
      </div>

      <Tabs defaultValue="tutorials" className="space-y-6">
        <TabsList>
          <TabsTrigger value="tutorials">Tutorials</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="ab-tests">A/B Tests</TabsTrigger>
        </TabsList>

        {/* Tutorials Tab */}
        <TabsContent value="tutorials" className="space-y-6">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="min-w-[200px] flex-1">
                  <div className="relative">
                    <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 transform text-gray-400" />
                    <Input
                      placeholder="Search tutorials..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="onboarding">Onboarding</SelectItem>
                    <SelectItem value="feature">Feature</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterRole} onValueChange={setFilterRole}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="school_admin">School Admin</SelectItem>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-2">
                  <Switch checked={showInactive} onCheckedChange={setShowInactive} />
                  <span className="text-gray-600 text-sm">Show Inactive</span>
                </div>

                <Button variant="outline" onClick={loadTutorials} disabled={loading}>
                  <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Tutorials List */}
          <div className="grid gap-4">
            {filteredTutorials.map((tutorial) => {
              const tutorialAnalytics = analytics.find((a) => a.tutorialId === tutorial.id)

              return (
                <Card
                  key={tutorial.id}
                  className={cn("transition-all duration-200", !tutorial.isActive && "opacity-60")}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="mb-2 flex items-center gap-3">
                          <h3 className="font-semibold text-lg">{tutorial.name}</h3>
                          <Badge variant={tutorial.isActive ? "default" : "secondary"}>
                            {tutorial.isActive ? "Active" : "Inactive"}
                          </Badge>
                          <Badge variant="outline">{tutorial.category}</Badge>
                          <Badge variant="outline">{tutorial.targetRole}</Badge>
                        </div>

                        <p className="mb-3 text-gray-600">{tutorial.description}</p>

                        <div className="flex items-center gap-4 text-gray-500 text-sm">
                          <span>{tutorial.steps.length} steps</span>
                          <span>v{tutorial.version}</span>
                          <span>Updated {tutorial.updatedAt.toLocaleDateString()}</span>
                          {tutorialAnalytics && (
                            <span className="text-green-600">
                              {Math.round(tutorialAnalytics.completionRate)}% completion rate
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleTutorialStatus(tutorial.id)}
                        >
                          {tutorial.isActive ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedTutorial(tutorial)
                            setIsEditing(true)
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteTutorial(tutorial.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-100 p-2">
                    <Users className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Total Users</p>
                    <p className="font-bold text-2xl">
                      {analytics.reduce((sum, a) => sum + a.totalStarts, 0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-green-100 p-2">
                    <Target className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Avg Completion</p>
                    <p className="font-bold text-2xl">
                      {analytics.length > 0
                        ? Math.round(
                            analytics.reduce((sum, a) => sum + a.completionRate, 0) /
                              analytics.length
                          )
                        : 0}
                      %
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-purple-100 p-2">
                    <Clock className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Avg Time</p>
                    <p className="font-bold text-2xl">
                      {analytics.length > 0
                        ? Math.round(
                            analytics.reduce((sum, a) => sum + a.averageCompletionTime, 0) /
                              analytics.length /
                              60
                          )
                        : 0}
                      m
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-yellow-100 p-2">
                    <BarChart3 className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Avg Rating</p>
                    <p className="font-bold text-2xl">
                      {analytics.length > 0
                        ? (
                            analytics.reduce((sum, a) => sum + a.userFeedback.rating, 0) /
                            analytics.length
                          ).toFixed(1)
                        : "0.0"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Analytics */}
          <div className="space-y-4">
            {analytics.map((analytic) => {
              const tutorial = tutorials.find((t) => t.id === analytic.tutorialId)
              const isExpanded = expandedAnalytics === analytic.tutorialId

              return (
                <Card key={analytic.tutorialId}>
                  <CardContent className="p-6">
                    <div
                      className="flex cursor-pointer items-center justify-between"
                      onClick={() => setExpandedAnalytics(isExpanded ? null : analytic.tutorialId)}
                    >
                      <div>
                        <h3 className="font-semibold text-lg">
                          {tutorial?.name || analytic.tutorialId}
                        </h3>
                        <div className="mt-1 flex items-center gap-4 text-gray-600 text-sm">
                          <span>{analytic.totalStarts} starts</span>
                          <span>{analytic.totalCompletions} completions</span>
                          <span>{Math.round(analytic.completionRate)}% rate</span>
                          <span>{Math.round(analytic.averageCompletionTime / 60)}m avg time</span>
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5" />
                      ) : (
                        <ChevronDown className="h-5 w-5" />
                      )}
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="mt-6 space-y-4"
                        >
                          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                            <div>
                              <h4 className="mb-3 font-semibold">Drop-off Points</h4>
                              <div className="space-y-2">
                                {analytic.dropOffPoints.map((point) => (
                                  <div
                                    key={point.stepId}
                                    className="flex items-center justify-between"
                                  >
                                    <span className="text-sm">{point.stepId}</span>
                                    <div className="flex items-center gap-2">
                                      <Progress value={point.dropOffRate} className="h-2 w-20" />
                                      <span className="text-gray-600 text-sm">
                                        {Math.round(point.dropOffRate)}%
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div>
                              <h4 className="mb-3 font-semibold">User Feedback</h4>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm">Rating:</span>
                                  <div className="flex items-center gap-1">
                                    {[...Array(5)].map((_, i) => (
                                      <span
                                        key={i}
                                        className={cn(
                                          "text-lg",
                                          i < Math.round(analytic.userFeedback.rating)
                                            ? "text-yellow-400"
                                            : "text-gray-300"
                                        )}
                                      >
                                        ★
                                      </span>
                                    ))}
                                    <span className="ml-2 text-gray-600 text-sm">
                                      ({analytic.userFeedback.rating.toFixed(1)})
                                    </span>
                                  </div>
                                </div>

                                {analytic.userFeedback.comments.length > 0 && (
                                  <div>
                                    <span className="font-medium text-sm">Recent Comments:</span>
                                    <div className="mt-2 space-y-1">
                                      {analytic.userFeedback.comments
                                        .slice(0, 3)
                                        .map((comment, index) => (
                                          <p key={`comment-${comment.slice(0, 20)}-${index}`} className="text-gray-600 text-sm italic">
                                            "{comment}"
                                          </p>
                                        ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        {/* A/B Tests Tab */}
        <TabsContent value="ab-tests" className="space-y-6">
          <Card>
            <CardContent className="p-6 text-center">
              <h3 className="mb-2 font-semibold text-lg">A/B Testing</h3>
              <p className="mb-4 text-gray-600">
                A/B testing functionality will be available in the next version.
              </p>
              <Button variant="outline" disabled>
                Coming Soon
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Tutorial Editor Dialog */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-h-[80vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedTutorial?.id.startsWith("tutorial-") ? "Create Tutorial" : "Edit Tutorial"}
            </DialogTitle>
          </DialogHeader>

          {selectedTutorial && (
            <TutorialEditor
              tutorial={selectedTutorial}
              onSave={updateTutorial}
              onCancel={() => {
                setIsEditing(false)
                setSelectedTutorial(null)
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Tutorial Editor Component
function TutorialEditor({
  tutorial,
  onSave,
  onCancel,
}: {
  tutorial: TutorialTemplate
  onSave: (tutorial: TutorialTemplate) => void
  onCancel: () => void
}) {
  const [editedTutorial, setEditedTutorial] = useState<TutorialTemplate>(tutorial)

  const updateTutorial = (updates: Partial<TutorialTemplate>) => {
    setEditedTutorial((prev) => ({ ...prev, ...updates }))
  }

  const addStep = () => {
    const newStep: WalkthroughStep = {
      id: `step-${Date.now()}`,
      title: "New Step",
      text: "Step description",
      attachTo: { element: "body", on: "top" },
    }

    updateTutorial({
      steps: [...editedTutorial.steps, newStep],
    })
  }

  const updateStep = (index: number, step: WalkthroughStep) => {
    const newSteps = [...editedTutorial.steps]
    newSteps[index] = step
    updateTutorial({ steps: newSteps })
  }

  const removeStep = (index: number) => {
    const newSteps = editedTutorial.steps.filter((_, i) => i !== index)
    updateTutorial({ steps: newSteps })
  }

  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block font-medium text-sm">Name</label>
          <Input
            value={editedTutorial.name}
            onChange={(e) => updateTutorial({ name: e.target.value })}
          />
        </div>

        <div>
          <label className="mb-2 block font-medium text-sm">Category</label>
          <Select
            value={editedTutorial.category}
            onValueChange={(value: any) => updateTutorial({ category: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="onboarding">Onboarding</SelectItem>
              <SelectItem value="feature">Feature</SelectItem>
              <SelectItem value="advanced">Advanced</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="mb-2 block font-medium text-sm">Target Role</label>
          <Select
            value={editedTutorial.targetRole}
            onValueChange={(value: any) => updateTutorial({ targetRole: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="student">Student</SelectItem>
              <SelectItem value="school_admin">School Admin</SelectItem>
              <SelectItem value="super_admin">Super Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            checked={editedTutorial.isActive}
            onCheckedChange={(checked) => updateTutorial({ isActive: checked })}
          />
          <span className="text-sm">Active</span>
        </div>
      </div>

      <div>
        <label className="mb-2 block font-medium text-sm">Description</label>
        <Textarea
          value={editedTutorial.description}
          onChange={(e) => updateTutorial({ description: e.target.value })}
          rows={3}
        />
      </div>

      {/* Steps */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-lg">Tutorial Steps</h3>
          <Button onClick={addStep} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Step
          </Button>
        </div>

        <div className="space-y-4">
          {editedTutorial.steps.map((step, index) => (
            <Card key={step.id}>
              <CardContent className="p-4">
                <div className="mb-4 flex items-start justify-between">
                  <h4 className="font-medium">Step {index + 1}</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeStep(index)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block font-medium text-sm">Title</label>
                    <Input
                      value={step.title}
                      onChange={(e) => updateStep(index, { ...step, title: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block font-medium text-sm">Element Selector</label>
                    <Input
                      value={step.attachTo?.element || ""}
                      onChange={(e) =>
                        updateStep(index, {
                          ...step,
                          attachTo: { ...step.attachTo!, element: e.target.value },
                        })
                      }
                      placeholder="CSS selector (e.g., #my-element)"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="mb-2 block font-medium text-sm">Description</label>
                  <Textarea
                    value={step.text}
                    onChange={(e) => updateStep(index, { ...step, text: e.target.value })}
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 border-t pt-4">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={() => onSave(editedTutorial)}>Save Tutorial</Button>
      </div>
    </div>
  )
}
