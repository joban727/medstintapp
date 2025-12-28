// TODO: Add cache invalidation hooks for mutations
"use client"

import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Clock,
  Edit,
  Save,
  Search,
  Target,
  User,
  X,
} from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Progress } from "../ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Textarea } from "../ui/textarea"

const validateEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

interface CompetencyAssignment {
  id: string
  studentId: string
  competencyId: string
  assignedBy: string
  dueDate: string
  status: "pending" | "in_progress" | "submitted" | "approved" | "needs_revision"
  priority: "low" | "medium" | "high"
  createdAt: string
  student?: {
    name: string
    email: string
    program: string
  }
  competency?: {
    name: string
    category: string
    description: string
    maxScore: number
  }
  submission?: {
    id: string
    score: number
    feedback: string
    submittedAt: string
    reviewedAt?: string
  }
}

interface AssessmentFilters {
  status: string
  priority: string
  student: string
  competency: string
  dueDate: string
}

interface AssessmentCenterProps {
  supervisorId: string
}

export function AssessmentCenter({ supervisorId }: AssessmentCenterProps) {
  const [assignments, setAssignments] = useState<CompetencyAssignment[]>([])
  const [filteredAssignments, setFilteredAssignments] = useState<CompetencyAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedAssignment, setSelectedAssignment] = useState<CompetencyAssignment | null>(null)
  const [assessmentDialogOpen, setAssessmentDialogOpen] = useState(false)
  const [filters, setFilters] = useState<AssessmentFilters>({
    status: "all",
    priority: "all",
    student: "",
    competency: "",
    dueDate: "all",
  })
  const [searchQuery, setSearchQuery] = useState("")

  // Assessment form state
  const [assessmentForm, setAssessmentForm] = useState({
    score: 0,
    feedback: "",
    status: "approved" as "approved" | "needs_revision",
  })

  const fetchAssignments = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(
        `/api/competency-assessments?supervisorId=${supervisorId}&includeSubmissions=true&limit=100`
      )
      if (!response.ok) throw new Error("Failed to fetch assignments")
      const data = await response.json().catch((err) => {
        console.error("Failed to parse JSON response:", err)
        throw new Error("Invalid response format")
      })
      setAssignments(data.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }, [supervisorId])

  const applyFilters = useCallback(() => {
    let filtered = [...assignments]

    // Apply search query
    if (searchQuery) {
      filtered = filtered.filter(
        (assignment) =>
          assignment.student?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          assignment.competency?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          assignment.competency?.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Apply status filter
    if (filters.status !== "all") {
      filtered = filtered.filter((assignment) => assignment.status === filters.status)
    }

    // Apply priority filter
    if (filters.priority !== "all") {
      filtered = filtered.filter((assignment) => assignment.priority === filters.priority)
    }

    // Apply due date filter
    if (filters.dueDate !== "all") {
      const now = new Date()
      filtered = filtered.filter((assignment) => {
        const dueDate = new Date(assignment.dueDate)
        switch (filters.dueDate) {
          case "overdue":
            return dueDate < now && assignment.status !== "approved"
          case "due_soon": {
            const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
            return dueDate <= threeDaysFromNow && dueDate >= now
          }
          case "this_week": {
            const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
            return dueDate <= weekFromNow && dueDate >= now
          }
          default:
            return true
        }
      })
    }

    setFilteredAssignments(filtered)
  }, [assignments, searchQuery, filters])

  useEffect(() => {
    fetchAssignments()
  }, [fetchAssignments])

  useEffect(() => {
    applyFilters()
  }, [applyFilters])

  const handleAssessment = async () => {
    if (!selectedAssignment) return

    try {
      const response = await fetch("/api/competency-assessments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessments: [
            {
              assignmentId: selectedAssignment.id,
              score: assessmentForm.score,
              feedback: assessmentForm.feedback,
              status: assessmentForm.status,
              reviewedBy: supervisorId,
            },
          ],
        }),
      })

      if (!response.ok) throw new Error("Failed to submit assessment")

      // Refresh assignments
      await fetchAssignments()
      setAssessmentDialogOpen(false)
      setSelectedAssignment(null)
      setAssessmentForm({ score: 0, feedback: "", status: "approved" })
    } catch (_err) {
      // Assessment submission failed
    }
  }

  const openAssessmentDialog = (assignment: CompetencyAssignment) => {
    setSelectedAssignment(assignment)
    setAssessmentForm({
      score: assignment.submission?.score || 0,
      feedback: assignment.submission?.feedback || "",
      status: assignment.status === "approved" ? "approved" : "needs_revision",
    })
    setAssessmentDialogOpen(true)
  }

  // Statistics
  const stats = {
    total: assignments.length,
    pending: assignments.filter((a) => a.status === "pending" || a.status === "submitted").length,
    approved: assignments.filter((a) => a.status === "approved").length,
    needsRevision: assignments.filter((a) => a.status === "needs_revision").length,
    overdue: assignments.filter((a) => new Date(a.dueDate) < new Date() && a.status !== "approved")
      .length,
  }

  if (loading) {
    return (
      <div className="gap-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {["assessment-1", "assessment-2", "assessment-3", "assessment-4"].map((key) => (
            <Card key={key} className="animate-pulse">
              <CardHeader className="gap-0 pb-2">
                <div className="h-4 w-3/4 rounded-md bg-muted" />
              </CardHeader>
              <CardContent>
                <div className="mb-2 h-8 w-1/2 rounded-md bg-muted" />
                <div className="h-3 w-full rounded-md bg-muted" />
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
          <div className="text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
            <h3 className="mb-2 font-semibold text-lg">Error Loading Assessments</h3>
            <p className="mb-4 text-muted-foreground">{error}</p>
            <Button onClick={fetchAssignments}>Try Again</Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="gap-6">
      {/* Statistics Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex items-center justify-between gap-0 pb-2">
            <CardTitle className="font-medium text-sm">Total Assignments</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{stats.total}</div>
            <p className="text-muted-foreground text-xs">{stats.pending} pending review</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex items-center justify-between gap-0 pb-2">
            <CardTitle className="font-medium text-sm">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-healthcare-green" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl text-healthcare-green">{stats.approved}</div>
            <p className="text-muted-foreground text-xs">
              {stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0}% completion
              rate
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex items-center justify-between gap-0 pb-2">
            <CardTitle className="font-medium text-sm">Needs Revision</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl text-orange-600">{stats.needsRevision}</div>
            <p className="text-muted-foreground text-xs">Requires feedback</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex items-center justify-between gap-0 pb-2">
            <CardTitle className="font-medium text-sm">Overdue</CardTitle>
            <Clock className="h-4 w-4 text-error" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl text-error">{stats.overdue}</div>
            <p className="text-muted-foreground text-xs">Past due date</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Assessment Center</CardTitle>
          <CardDescription>Review and assess student competency submissions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute top-3 left-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by student name, competency, or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filters */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="gap-2">
                <Label>Status</Label>
                <Select
                  value={filters.status}
                  onValueChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="needs_revision">Needs Revision</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="gap-2">
                <Label>Priority</Label>
                <Select
                  value={filters.priority}
                  onValueChange={(value) => setFilters((prev) => ({ ...prev, priority: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priority</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="gap-2">
                <Label>Due Date</Label>
                <Select
                  value={filters.dueDate}
                  onValueChange={(value) => setFilters((prev) => ({ ...prev, dueDate: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Dates</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="due_soon">Due Soon (3 days)</SelectItem>
                    <SelectItem value="this_week">This Week</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setFilters({
                      status: "all",
                      priority: "all",
                      student: "",
                      competency: "",
                      dueDate: "all",
                    })
                    setSearchQuery("")
                  }}
                  className="w-full"
                >
                  <X className="mr-2 h-4 w-4" />
                  Clear Filters
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Assignments List */}
      <div className="gap-4">
        {filteredAssignments.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Target className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="mb-2 font-semibold text-lg">No Assignments Found</h3>
                <p className="text-muted-foreground">
                  {assignments.length === 0
                    ? "No competency assignments have been created yet."
                    : "No assignments match your current filters."}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredAssignments.map((assignment) => {
              const isOverdue =
                new Date(assignment.dueDate) < new Date() && assignment.status !== "approved"
              const daysUntilDue = Math.ceil(
                (new Date(assignment.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
              )

              return (
                <Card
                  key={assignment.id}
                  className={`${isOverdue ? "border-red-200 bg-red-50/50" : ""}`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="gap-1">
                        <CardTitle className="text-lg">
                          {assignment.competency?.name || "Unknown Competency"}
                        </CardTitle>
                        <CardDescription>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="flex items-center">
                              <User className="mr-1 h-3 w-3" />
                              {assignment.student?.name || "Unknown Student"}
                            </span>
                            <span className="flex items-center">
                              <Calendar className="mr-1 h-3 w-3" />
                              Due {new Date(assignment.dueDate).toLocaleDateString()}
                              {isOverdue && <span className="ml-1 text-error">(Overdue)</span>}
                              {!isOverdue && daysUntilDue <= 3 && daysUntilDue > 0 && (
                                <span className="ml-1 text-orange-600">
                                  ({daysUntilDue} days left)
                                </span>
                              )}
                            </span>
                          </div>
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            assignment.priority === "high"
                              ? "destructive"
                              : assignment.priority === "medium"
                                ? "default"
                                : "secondary"
                          }
                        >
                          {assignment.priority}
                        </Badge>
                        <Badge
                          variant={
                            assignment.status === "approved"
                              ? "default"
                              : assignment.status === "submitted"
                                ? "secondary"
                                : assignment.status === "needs_revision"
                                  ? "destructive"
                                  : "outline"
                          }
                        >
                          {assignment.status.replace("_", " ")}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="gap-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <h4 className="mb-2 font-medium text-sm">Competency Details</h4>
                          <div className="gap-1 text-muted-foreground text-sm">
                            <p>
                              <strong>Category:</strong> {assignment.competency?.category || "N/A"}
                            </p>
                            <p>
                              <strong>Max Score:</strong> {assignment.competency?.maxScore || "N/A"}
                            </p>
                            <p>
                              <strong>Description:</strong>{" "}
                              {assignment.competency?.description || "No description available"}
                            </p>
                          </div>
                        </div>
                        <div>
                          <h4 className="mb-2 font-medium text-sm">Student Information</h4>
                          <div className="gap-1 text-muted-foreground text-sm">
                            <p>
                              <strong>Email:</strong> {assignment.student?.email || "N/A"}
                            </p>
                            <p>
                              <strong>Program:</strong> {assignment.student?.program || "N/A"}
                            </p>
                            <p>
                              <strong>Assigned:</strong>{" "}
                              {new Date(assignment.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>

                      {assignment.submission && (
                        <div className="border-t pt-4">
                          <h4 className="mb-2 font-medium text-sm">Submission Details</h4>
                          <div className="gap-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm">Score:</span>
                              <div className="flex items-center gap-2">
                                <Progress
                                  value={
                                    (assignment.submission.score /
                                      (assignment.competency?.maxScore || 100)) *
                                    100
                                  }
                                  className="h-2 w-20"
                                />
                                <span className="font-medium text-sm">
                                  {assignment.submission.score}/
                                  {assignment.competency?.maxScore || 100}
                                </span>
                              </div>
                            </div>
                            {assignment.submission.feedback && (
                              <div>
                                <span className="font-medium text-sm">Feedback:</span>
                                <p className="mt-1 text-muted-foreground text-sm">
                                  {assignment.submission.feedback}
                                </p>
                              </div>
                            )}
                            <div className="flex justify-between text-muted-foreground text-xs">
                              <span>
                                Submitted:{" "}
                                {new Date(assignment.submission.submittedAt).toLocaleDateString()}
                              </span>
                              {assignment.submission.reviewedAt && (
                                <span>
                                  Reviewed:{" "}
                                  {new Date(assignment.submission.reviewedAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openAssessmentDialog(assignment)}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          {assignment.submission ? "Review Assessment" : "Assess"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Assessment Dialog */}
      <Dialog open={assessmentDialogOpen} onOpenChange={setAssessmentDialogOpen}>
        <DialogContent className="max-w-2xl" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Assess Competency</DialogTitle>
            <DialogDescription>
              {selectedAssignment && (
                <span>
                  Reviewing {selectedAssignment.competency?.name} for{" "}
                  {selectedAssignment.student?.name}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          {selectedAssignment && (
            <div className="gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="gap-2">
                  <Label htmlFor="score">Score</Label>
                  <Input
                    id="score"
                    type="number"
                    min="0"
                    max={selectedAssignment.competency?.maxScore || 100}
                    value={assessmentForm.score}
                    onChange={(e) =>
                      setAssessmentForm((prev) => ({
                        ...prev,
                        score: Number.parseInt(e.target.value) || 0,
                      }))
                    }
                  />
                  <p className="text-muted-foreground text-xs">
                    Max score: {selectedAssignment.competency?.maxScore || 100}
                  </p>
                </div>
                <div className="gap-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={assessmentForm.status}
                    onValueChange={(value: "approved" | "needs_revision") =>
                      setAssessmentForm((prev) => ({ ...prev, status: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="needs_revision">Needs Revision</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="gap-2">
                <Label htmlFor="feedback">Feedback</Label>
                <Textarea
                  id="feedback"
                  placeholder="Provide detailed feedback on the student's performance..."
                  value={assessmentForm.feedback}
                  onChange={(e) =>
                    setAssessmentForm((prev) => ({ ...prev, feedback: e.target.value }))
                  }
                  rows={4}
                />
              </div>
              {selectedAssignment.competency?.description && (
                <div className="rounded-lg bg-muted p-3">
                  <h4 className="mb-1 font-medium text-sm">Competency Description</h4>
                  <p className="text-muted-foreground text-sm">
                    {selectedAssignment.competency.description}
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssessmentDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssessment}>
              <Save className="mr-2 h-4 w-4" />
              Save Assessment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
