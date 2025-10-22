"use client"

import { Calendar, Plus, Search, Users, X } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
import { Checkbox } from "../ui/checkbox"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Textarea } from "../ui/textarea"
import { toast } from "sonner"

interface Student {
  id: string
  name: string
  email: string
  program: string
  year: string
}

interface Competency {
  id: string
  name: string
  description: string
  category: string
  level: string
  maxScore: number
}

interface CompetencyDeployment {
  id: string
  competencyId: string
  name: string
  description: string
  category: string
  isActive: boolean
}

interface AssignmentFormData {
  deploymentId: string
  selectedStudents: string[]
  dueDate: string
  priority: "low" | "medium" | "high"
  instructions: string
  notifyStudents: boolean
}

interface AssignmentCreationFormProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  supervisorId: string
}

export function AssignmentCreationForm({
  isOpen,
  onClose,
  onSuccess,
  supervisorId,
}: AssignmentCreationFormProps) {
  const [students, setStudents] = useState<Student[]>([])
  const [competencyDeployments, setCompetencyDeployments] = useState<CompetencyDeployment[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [studentSearch, setStudentSearch] = useState("")
  const [competencySearch, setCompetencySearch] = useState("")

  const [formData, setFormData] = useState<AssignmentFormData>({
    deploymentId: "",
    selectedStudents: [],
    dueDate: "",
    priority: "medium",
    instructions: "",
    notifyStudents: true,
  })

  const fetchData = useCallback(async () => {
    if (!isOpen) return

    try {
      setLoading(true)

      // Fetch students
      const studentsResponse = await fetch("/api/students?limit=100")
      if (studentsResponse.ok) {
        const studentsData = await studentsResponse.json()
        setStudents(studentsData.students || [])
      }

      // Fetch competency deployments
      const deploymentsResponse = await fetch("/api/competency-deployments?active=true&limit=100")
      if (deploymentsResponse.ok) {
        const deploymentsData = await deploymentsResponse.json()
        setCompetencyDeployments(deploymentsData.deployments || [])
      }
    } catch (error) {
      console.error("Failed to fetch data:", error)
      toast.error("Failed to load data")
    } finally {
      setLoading(false)
    }
  }, [isOpen])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const filteredStudents = students.filter(
    (student) =>
      student.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      student.email.toLowerCase().includes(studentSearch.toLowerCase()) ||
      student.program.toLowerCase().includes(studentSearch.toLowerCase())
  )

  const filteredCompetencies = competencyDeployments.filter(
    (deployment) =>
      deployment.name.toLowerCase().includes(competencySearch.toLowerCase()) ||
      deployment.category.toLowerCase().includes(competencySearch.toLowerCase())
  )

  const handleStudentToggle = (studentId: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedStudents: prev.selectedStudents.includes(studentId)
        ? prev.selectedStudents.filter((id) => id !== studentId)
        : [...prev.selectedStudents, studentId],
    }))
  }

  const handleSelectAllStudents = () => {
    setFormData((prev) => ({
      ...prev,
      selectedStudents:
        prev.selectedStudents.length === filteredStudents.length
          ? []
          : filteredStudents.map((s) => s.id),
    }))
  }

  const handleSubmit = async () => {
    if (!formData.deploymentId) {
      toast.error("Please select a competency")
      return
    }

    if (formData.selectedStudents.length === 0) {
      toast.error("Please select at least one student")
      return
    }

    if (!formData.dueDate) {
      toast.error("Please set a due date")
      return
    }

    try {
      setSubmitting(true)

      const response = await fetch("/api/competency-assignments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "bulk",
          deploymentId: formData.deploymentId,
          userIds: formData.selectedStudents,
          dueDate: formData.dueDate,
          priority: formData.priority,
          instructions: formData.instructions,
          assignedBy: supervisorId,
          notifyStudents: formData.notifyStudents,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create assignments")
      }

      const result = await response.json()
      toast.success(
        `Successfully created ${result.created || formData.selectedStudents.length} assignments`
      )

      // Reset form
      setFormData({
        deploymentId: "",
        selectedStudents: [],
        dueDate: "",
        priority: "medium",
        instructions: "",
        notifyStudents: true,
      })

      onSuccess()
      onClose()
    } catch (error) {
      console.error("Failed to create assignments:", error)
      toast.error(error instanceof Error ? error.message : "Failed to create assignments")
    } finally {
      setSubmitting(false)
    }
  }

  const selectedCompetency = competencyDeployments.find((d) => d.id === formData.deploymentId)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Competency Assignments</DialogTitle>
          <DialogDescription>
            Assign competencies to students with due dates and instructions
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Competency Selection */}
          <div className="space-y-2">
            <Label>Select Competency</Label>
            <div className="space-y-2">
              <Input
                placeholder="Search competencies..."
                value={competencySearch}
                onChange={(e) => setCompetencySearch(e.target.value)}
                className="w-full"
              />
              <Select value={formData.deploymentId} onValueChange={(value) => 
                setFormData(prev => ({ ...prev, deploymentId: value }))
              }>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a competency to assign" />
                </SelectTrigger>
                <SelectContent>
                  {filteredCompetencies.map((deployment) => (
                    <SelectItem key={deployment.id} value={deployment.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{deployment.name}</span>
                        <span className="text-sm text-muted-foreground">
                          {deployment.category}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedCompetency && (
              <Card>
                <CardContent className="pt-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{selectedCompetency.category}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {selectedCompetency.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Student Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Select Students ({formData.selectedStudents.length} selected)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSelectAllStudents}
              >
                {formData.selectedStudents.length === filteredStudents.length
                  ? "Deselect All"
                  : "Select All"}
              </Button>
            </div>
            <Input
              placeholder="Search students..."
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              className="w-full"
            />
            <Card className="max-h-60 overflow-y-auto">
              <CardContent className="p-4">
                <div className="space-y-2">
                  {loading ? (
                    <div className="text-center py-4">Loading students...</div>
                  ) : filteredStudents.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      No students found
                    </div>
                  ) : (
                    filteredStudents.map((student) => (
                      <div
                        key={student.id}
                        className="flex items-center space-x-2 p-2 rounded hover:bg-muted"
                      >
                        <Checkbox
                          id={student.id}
                          checked={formData.selectedStudents.includes(student.id)}
                          onCheckedChange={() => handleStudentToggle(student.id)}
                        />
                        <div className="flex-1">
                          <div className="font-medium">{student.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {student.program} • Year {student.year}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Assignment Details */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="datetime-local"
                value={formData.dueDate}
                onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value: "low" | "medium" | "high") =>
                  setFormData(prev => ({ ...prev, priority: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="instructions">Instructions (Optional)</Label>
            <Textarea
              id="instructions"
              placeholder="Provide specific instructions or context for this assignment..."
              value={formData.instructions}
              onChange={(e) => setFormData(prev => ({ ...prev, instructions: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="notifyStudents"
              checked={formData.notifyStudents}
              onCheckedChange={(checked) =>
                setFormData(prev => ({ ...prev, notifyStudents: !!checked }))
              }
            />
            <Label htmlFor="notifyStudents">Send email notifications to students</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || loading}>
            {submitting ? "Creating..." : `Create ${formData.selectedStudents.length} Assignments`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}