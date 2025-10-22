"use client"

import { Calendar, CheckCircle, Clock, Target, TrendingUp, User } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
import { Progress } from "../ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"

interface CompetencyProgress {
  id: string
  competencyId: string
  assignmentId: string
  currentScore: number
  maxScore: number
  status: "not_started" | "in_progress" | "completed" | "needs_review"
  lastUpdated: string
  dueDate: string
  competency: {
    name: string
    category: string
    description: string
    level: string
  }
  assignment: {
    priority: "low" | "medium" | "high"
    instructions?: string
  }
  evaluations: Array<{
    id: string
    score: number
    feedback: string
    evaluatedAt: string
    evaluator: {
      name: string
      role: string
    }
  }>
  milestones: Array<{
    id: string
    name: string
    description: string
    completed: boolean
    completedAt?: string
  }>
}

interface ProgressSummary {
  totalCompetencies: number
  completedCompetencies: number
  inProgressCompetencies: number
  overdueCompetencies: number
  averageScore: number
  completionRate: number
}

interface CompetencyProgressTrackerProps {
  studentId: string
  programId?: string
  showActions?: boolean
}

export function CompetencyProgressTracker({
  studentId,
  programId,
  showActions = true,
}: CompetencyProgressTrackerProps) {
  const [progressData, setProgressData] = useState<CompetencyProgress[]>([])
  const [summary, setSummary] = useState<ProgressSummary>({
    totalCompetencies: 0,
    completedCompetencies: 0,
    inProgressCompetencies: 0,
    overdueCompetencies: 0,
    averageScore: 0,
    completionRate: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("overview")

  const fetchProgressData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        studentId,
        includeEvaluations: "true",
        includeMilestones: "true",
        limit: "100",
      })

      if (programId) {
        params.append("programId", programId)
      }

      const response = await fetch(`/api/competency-progress?${params}`)
      if (!response.ok) throw new Error("Failed to fetch progress data")

      const data = await response.json()
      setProgressData(data.progress || [])

      // Calculate summary statistics
      const total = data.progress?.length || 0
      const completed = data.progress?.filter((p: CompetencyProgress) => p.status === "completed").length || 0
      const inProgress = data.progress?.filter((p: CompetencyProgress) => p.status === "in_progress").length || 0
      
      const now = new Date()
      const overdue = data.progress?.filter((p: CompetencyProgress) => {
        const dueDate = new Date(p.dueDate)
        return dueDate < now && p.status !== "completed"
      }).length || 0

      const totalScore = data.progress?.reduce((sum: number, p: CompetencyProgress) => sum + p.currentScore, 0) || 0
      const averageScore = total > 0 ? totalScore / total : 0
      const completionRate = total > 0 ? (completed / total) * 100 : 0

      setSummary({
        totalCompetencies: total,
        completedCompetencies: completed,
        inProgressCompetencies: inProgress,
        overdueCompetencies: overdue,
        averageScore: Math.round(averageScore * 100) / 100,
        completionRate: Math.round(completionRate * 100) / 100,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }, [studentId, programId])

  useEffect(() => {
    fetchProgressData()
  }, [fetchProgressData])

  const getStatusColor = (status: CompetencyProgress["status"]) => {
    switch (status) {
      case "completed":
        return "text-green-600 bg-green-50"
      case "in_progress":
        return "text-blue-600 bg-blue-50"
      case "needs_review":
        return "text-yellow-600 bg-yellow-50"
      default:
        return "text-gray-600 bg-gray-50"
    }
  }

  const getPriorityColor = (priority: "low" | "medium" | "high") => {
    switch (priority) {
      case "high":
        return "destructive"
      case "medium":
        return "default"
      default:
        return "secondary"
    }
  }

  const isOverdue = (dueDate: string, status: string) => {
    const due = new Date(dueDate)
    const now = new Date()
    return due < now && status !== "completed"
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-8 bg-gray-200 rounded w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-red-600">
            <p>Error loading progress data: {error}</p>
            <Button variant="outline" onClick={fetchProgressData} className="mt-2">
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Target className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Total Competencies</p>
                <p className="text-2xl font-bold">{summary.totalCompetencies}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-green-600">{summary.completedCompetencies}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">In Progress</p>
                <p className="text-2xl font-bold text-yellow-600">{summary.inProgressCompetencies}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Average Score</p>
                <p className="text-2xl font-bold text-purple-600">{summary.averageScore}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overall Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Overall Progress</CardTitle>
          <CardDescription>
            {summary.completionRate}% of competencies completed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={summary.completionRate} className="h-3" />
          <div className="flex justify-between text-sm text-muted-foreground mt-2">
            <span>{summary.completedCompetencies} completed</span>
            <span>{summary.totalCompetencies - summary.completedCompetencies} remaining</span>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Progress */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">All Competencies</TabsTrigger>
          <TabsTrigger value="in_progress">In Progress</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="overdue">Overdue</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <CompetencyList 
            competencies={progressData} 
            showActions={showActions}
            onRefresh={fetchProgressData}
          />
        </TabsContent>

        <TabsContent value="in_progress" className="space-y-4">
          <CompetencyList 
            competencies={progressData.filter(p => p.status === "in_progress")} 
            showActions={showActions}
            onRefresh={fetchProgressData}
          />
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          <CompetencyList 
            competencies={progressData.filter(p => p.status === "completed")} 
            showActions={showActions}
            onRefresh={fetchProgressData}
          />
        </TabsContent>

        <TabsContent value="overdue" className="space-y-4">
          <CompetencyList 
            competencies={progressData.filter(p => isOverdue(p.dueDate, p.status))} 
            showActions={showActions}
            onRefresh={fetchProgressData}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

interface CompetencyListProps {
  competencies: CompetencyProgress[]
  showActions: boolean
  onRefresh: () => void
}

function CompetencyList({ competencies, showActions, onRefresh }: CompetencyListProps) {
  if (competencies.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <Target className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 font-medium text-gray-900">No competencies found</h3>
            <p className="mt-1 text-gray-500">
              No competencies match the current filter criteria.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {competencies.map((progress) => (
        <Card key={progress.id}>
          <CardContent className="p-6">
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h3 className="font-semibold">{progress.competency.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {progress.competency.description}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={getPriorityColor(progress.assignment.priority)}>
                    {progress.assignment.priority}
                  </Badge>
                  <Badge className={getStatusColor(progress.status)}>
                    {progress.status.replace("_", " ")}
                  </Badge>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>{progress.currentScore} / {progress.maxScore}</span>
                </div>
                <Progress 
                  value={(progress.currentScore / progress.maxScore) * 100} 
                  className="h-2" 
                />
              </div>

              {/* Details */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4" />
                    <span>Due: {new Date(progress.dueDate).toLocaleDateString()}</span>
                    {isOverdue(progress.dueDate, progress.status) && (
                      <Badge variant="destructive" className="text-xs">Overdue</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Target className="h-4 w-4" />
                    <span>Category: {progress.competency.category}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="font-medium">Level:</span> {progress.competency.level}
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">Last Updated:</span>{" "}
                    {new Date(progress.lastUpdated).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* Recent Evaluations */}
              {progress.evaluations.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Recent Evaluations</h4>
                  <div className="space-y-2">
                    {progress.evaluations.slice(0, 2).map((evaluation) => (
                      <div key={evaluation.id} className="bg-muted p-3 rounded text-sm">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">Score: {evaluation.score}</p>
                            <p className="text-muted-foreground">{evaluation.feedback}</p>
                          </div>
                          <div className="text-right text-xs text-muted-foreground">
                            <p>{evaluation.evaluator.name}</p>
                            <p>{new Date(evaluation.evaluatedAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              {showActions && (
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm">
                    View Details
                  </Button>
                  {progress.status === "in_progress" && (
                    <Button size="sm">
                      Submit Evidence
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function getPriorityColor(priority: "low" | "medium" | "high") {
  switch (priority) {
    case "high":
      return "destructive"
    case "medium":
      return "default"
    default:
      return "secondary"
  }
}