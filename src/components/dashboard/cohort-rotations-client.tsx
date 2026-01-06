"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Clock,
  Calendar,
  GraduationCap,
  MapPin,
  MoreVertical,
  CheckCircle,
  XCircle,
  FileText,
  Users,
  Play,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

interface CohortRotationAssignment {
  id: string
  cohortId: string
  rotationTemplateId: string
  clinicalSiteId: string | null
  startDate: Date
  endDate: Date
  requiredHours: number
  maxStudents: number | null
  status: string
  notes: string | null
  createdAt: Date
  cohortName: string | null
  cohortGraduationYear: number | null
  templateName: string | null
  templateSpecialty: string | null
  clinicalSiteName: string | null
  programName: string | null
}

interface Cohort {
  id: string
  name: string
  programId: string
  graduationYear: number | null
  startDate: Date
  endDate: Date
  capacity: number
  programName: string | null
  studentCount: number
}

interface RotationTemplate {
  id: string
  name: string
  specialty: string
  defaultDurationWeeks: number
  defaultRequiredHours: number
  defaultClinicalSiteId: string | null
  programId: string
}

interface ClinicalSite {
  id: string
  name: string
}

interface Stats {
  totalAssignments: number
  draftAssignments: number
  publishedAssignments: number
  completedAssignments: number
}

interface CohortRotationsClientProps {
  assignments: CohortRotationAssignment[]
  cohorts: Cohort[]
  templates: RotationTemplate[]
  clinicalSites: ClinicalSite[]
  stats: Stats
  schoolId: string
}

export function CohortRotationsClient({
  assignments: initialAssignments,
  cohorts,
  templates,
  clinicalSites,
  stats,
  schoolId,
}: CohortRotationsClientProps) {
  const router = useRouter()
  const [assignments, setAssignments] = useState<CohortRotationAssignment[]>(initialAssignments)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("ALL")
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingAssignment, setEditingAssignment] = useState<CohortRotationAssignment | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [generatingId, setGeneratingId] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    cohortId: "",
    rotationTemplateId: "",
    clinicalSiteId: "",
    startDate: "",
    endDate: "",
    requiredHours: 0,
    maxStudents: "",
    notes: "",
    status: "DRAFT",
  })

  const resetForm = () => {
    setFormData({
      cohortId: "",
      rotationTemplateId: "",
      clinicalSiteId: "",
      startDate: "",
      endDate: "",
      requiredHours: 0,
      maxStudents: "",
      notes: "",
      status: "DRAFT",
    })
  }

  // When template is selected, auto-fill some fields
  const handleTemplateChange = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId)
    if (template) {
      setFormData((prev) => ({
        ...prev,
        rotationTemplateId: templateId,
        requiredHours: template.defaultRequiredHours,
        clinicalSiteId: template.defaultClinicalSiteId || prev.clinicalSiteId,
      }))
    } else {
      setFormData((prev) => ({ ...prev, rotationTemplateId: templateId }))
    }
  }

  // Filter templates by selected cohort's program
  const selectedCohort = cohorts.find((c) => c.id === formData.cohortId)
  const filteredTemplates = selectedCohort
    ? templates.filter((t) => t.programId === selectedCohort.programId)
    : templates

  const openEditModal = (assignment: CohortRotationAssignment) => {
    setEditingAssignment(assignment)
    setFormData({
      cohortId: assignment.cohortId,
      rotationTemplateId: assignment.rotationTemplateId,
      clinicalSiteId: assignment.clinicalSiteId || "",
      startDate: new Date(assignment.startDate).toISOString().split("T")[0],
      endDate: new Date(assignment.endDate).toISOString().split("T")[0],
      requiredHours: assignment.requiredHours,
      maxStudents: assignment.maxStudents?.toString() || "",
      notes: assignment.notes || "",
      status: assignment.status,
    })
    setIsCreateModalOpen(true)
  }

  const handleSubmit = async () => {
    if (!formData.cohortId) {
      toast.error("Please select a cohort")
      return
    }
    if (!formData.rotationTemplateId) {
      toast.error("Please select a rotation template")
      return
    }
    if (!formData.startDate || !formData.endDate) {
      toast.error("Please select start and end dates")
      return
    }

    setIsSubmitting(true)

    try {
      const payload = {
        ...formData,
        startDate: new Date(formData.startDate).toISOString(),
        endDate: new Date(formData.endDate).toISOString(),
        clinicalSiteId: formData.clinicalSiteId || null,
        maxStudents: formData.maxStudents ? parseInt(formData.maxStudents) : null,
      }

      const method = editingAssignment ? "PUT" : "POST"
      const body = editingAssignment ? { ...payload, id: editingAssignment.id } : payload

      const response = await fetch("/api/cohort-rotations", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to save assignment")
      }

      toast.success(
        editingAssignment ? "Assignment updated successfully" : "Assignment created successfully"
      )
      setIsCreateModalOpen(false)
      setEditingAssignment(null)
      resetForm()
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save assignment")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/cohort-rotations?id=${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to delete assignment")
      }

      toast.success("Assignment deleted successfully")
      setDeleteConfirmId(null)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete assignment")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGenerateRotations = async (assignmentId: string) => {
    setGeneratingId(assignmentId)
    try {
      const response = await fetch("/api/cohort-rotations/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cohortRotationAssignmentId: assignmentId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate rotations")
      }

      toast.success(`Generated ${data.data.created} rotations for cohort students`)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate rotations")
    } finally {
      setGeneratingId(null)
    }
  }

  const filteredAssignments = assignments.filter((assignment) => {
    const matchesSearch =
      assignment.cohortName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assignment.templateName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assignment.templateSpecialty?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = filterStatus === "ALL" || assignment.status === filterStatus
    return matchesSearch && matchesStatus
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DRAFT":
        return (
          <Badge
            variant="secondary"
            className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
          >
            Draft
          </Badge>
        )
      case "PUBLISHED":
        return (
          <Badge
            variant="default"
            className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
          >
            Published
          </Badge>
        )
      case "COMPLETED":
        return (
          <Badge
            variant="default"
            className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
          >
            Completed
          </Badge>
        )
      case "CANCELLED":
        return <Badge variant="destructive">Cancelled</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cohort Rotations</h1>
          <p className="text-muted-foreground">
            Assign rotation templates to cohorts and generate student rotations
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm()
            setEditingAssignment(null)
            setIsCreateModalOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> Assign Template to Cohort
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Assignments</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAssignments}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Drafts</CardTitle>
            <Edit className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">{stats.draftAssignments}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Published</CardTitle>
            <Play className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.publishedAssignments}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completedAssignments}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search assignments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="PUBLISHED">Published</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Assignments Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cohort / Template</TableHead>
                <TableHead>Clinical Site</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssignments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    {assignments.length === 0
                      ? "No cohort rotation assignments yet. Create your first assignment to get started."
                      : "No assignments match your search."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredAssignments.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium flex items-center gap-2">
                          <Users className="h-4 w-4 text-blue-500" />
                          {assignment.cohortName}
                          {assignment.cohortGraduationYear && (
                            <span className="text-muted-foreground text-sm">
                              (Class of {assignment.cohortGraduationYear})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <GraduationCap className="h-3 w-3" />
                          {assignment.templateName} - {assignment.templateSpecialty}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {assignment.programName}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {assignment.clinicalSiteName ? (
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {assignment.clinicalSiteName}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Not assigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {formatDate(assignment.startDate)} - {formatDate(assignment.endDate)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {assignment.requiredHours} hrs
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(assignment.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {assignment.status === "DRAFT" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleGenerateRotations(assignment.id)}
                            disabled={generatingId === assignment.id}
                          >
                            {generatingId === assignment.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditModal(assignment)}>
                              <Edit className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => setDeleteConfirmId(assignment.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Dialog
        open={isCreateModalOpen}
        onOpenChange={(open) => {
          setIsCreateModalOpen(open)
          if (!open) setEditingAssignment(null)
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAssignment ? "Edit Assignment" : "Assign Template to Cohort"}
            </DialogTitle>
            <DialogDescription>
              {editingAssignment
                ? "Update the cohort rotation assignment details."
                : "Assign a rotation template to a cohort with specific dates."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cohortId">Cohort *</Label>
                <Select
                  value={formData.cohortId}
                  onValueChange={(value) => {
                    setFormData({ ...formData, cohortId: value, rotationTemplateId: "" })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a cohort" />
                  </SelectTrigger>
                  <SelectContent>
                    {cohorts.map((cohort) => (
                      <SelectItem key={cohort.id} value={cohort.id}>
                        <div className="flex flex-col">
                          <span>{cohort.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {cohort.programName} • {cohort.studentCount} students
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rotationTemplateId">Rotation Template *</Label>
                <Select
                  value={formData.rotationTemplateId}
                  onValueChange={handleTemplateChange}
                  disabled={!formData.cohortId}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={formData.cohortId ? "Select a template" : "Select cohort first"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredTemplates.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground text-center">
                        No templates for this program
                      </div>
                    ) : (
                      filteredTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name} ({template.specialty})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date *</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="clinicalSiteId">Clinical Site</Label>
                <Select
                  value={formData.clinicalSiteId}
                  onValueChange={(value) => setFormData({ ...formData, clinicalSiteId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a site (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {clinicalSites.map((site) => (
                      <SelectItem key={site.id} value={site.id}>
                        {site.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="requiredHours">Required Hours *</Label>
                <Input
                  id="requiredHours"
                  type="number"
                  min={1}
                  value={formData.requiredHours}
                  onChange={(e) =>
                    setFormData({ ...formData, requiredHours: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="maxStudents">Max Students (optional)</Label>
                <Input
                  id="maxStudents"
                  type="number"
                  min={1}
                  placeholder="Leave empty for no limit"
                  value={formData.maxStudents}
                  onChange={(e) => setFormData({ ...formData, maxStudents: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="PUBLISHED">Published</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Optional notes about this assignment..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting
                ? "Saving..."
                : editingAssignment
                  ? "Update Assignment"
                  : "Create Assignment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Assignment</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this cohort rotation assignment? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
