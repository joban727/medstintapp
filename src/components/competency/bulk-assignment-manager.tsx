"use client"

import { Calendar, Download, Filter, Plus, Search, Upload, Users, X } from "lucide-react"
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
import { Progress } from "../ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Separator } from "../ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"
import { Textarea } from "../ui/textarea"
import { toast } from "sonner"

interface Student {
  id: string
  name: string
  email: string
  program: string
  year: string
  department?: string
}

interface CompetencyDeployment {
  id: string
  competencyId: string
  name: string
  description: string
  category: string
  level: string
  isActive: boolean
  estimatedHours?: number
}

interface BulkAssignmentData {
  deploymentIds: string[]
  studentIds: string[]
  dueDate: string
  priority: "low" | "medium" | "high"
  instructions: string
  notifyStudents: boolean
  staggerDueDates: boolean
  staggerDays: number
}

interface BulkAssignmentManagerProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  supervisorId: string
}

export function BulkAssignmentManager({
  isOpen,
  onClose,
  onSuccess,
  supervisorId,
}: BulkAssignmentManagerProps) {
  const [students, setStudents] = useState<Student[]>([])
  const [competencyDeployments, setCompetencyDeployments] = useState<CompetencyDeployment[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState("select")
  
  // Search and filter states
  const [studentSearch, setStudentSearch] = useState("")
  const [competencySearch, setCompetencySearch] = useState("")
  const [programFilter, setProgramFilter] = useState("all")
  const [yearFilter, setYearFilter] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all")

  const [formData, setFormData] = useState<BulkAssignmentData>({
    deploymentIds: [],
    studentIds: [],
    dueDate: "",
    priority: "medium",
    instructions: "",
    notifyStudents: true,
    staggerDueDates: false,
    staggerDays: 7,
  })

  const fetchData = useCallback(async () => {
    if (!isOpen) return

    try {
      setLoading(true)

      // Fetch students
      const studentsResponse = await fetch("/api/students?limit=500")
      if (studentsResponse.ok) {
        const studentsData = await studentsResponse.json()
        setStudents(studentsData.students || [])
      }

      // Fetch competency deployments
      const deploymentsResponse = await fetch("/api/competency-deployments?active=true&limit=200")
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

  // Filter functions
  const filteredStudents = students.filter((student) => {
    const matchesSearch =
      student.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      student.email.toLowerCase().includes(studentSearch.toLowerCase())
    const matchesProgram = programFilter === "all" || student.program === programFilter
    const matchesYear = yearFilter === "all" || student.year === yearFilter
    
    return matchesSearch && matchesProgram && matchesYear
  })

  const filteredCompetencies = competencyDeployments.filter((deployment) => {
    const matchesSearch =
      deployment.name.toLowerCase().includes(competencySearch.toLowerCase()) ||
      deployment.description.toLowerCase().includes(competencySearch.toLowerCase())
    const matchesCategory = categoryFilter === "all" || deployment.category === categoryFilter
    
    return matchesSearch && matchesCategory
  })

  // Selection handlers
  const handleStudentToggle = (studentId: string) => {
    setFormData((prev) => ({
      ...prev,
      studentIds: prev.studentIds.includes(studentId)
        ? prev.studentIds.filter((id) => id !== studentId)
        : [...prev.studentIds, studentId],
    }))
  }

  const handleCompetencyToggle = (deploymentId: string) => {
    setFormData((prev) => ({
      ...prev,
      deploymentIds: prev.deploymentIds.includes(deploymentId)
        ? prev.deploymentIds.filter((id) => id !== deploymentId)
        : [...prev.deploymentIds, deploymentId],
    }))
  }

  const handleSelectAllStudents = () => {
    setFormData((prev) => ({
      ...prev,
      studentIds:
        prev.studentIds.length === filteredStudents.length
          ? []
          : filteredStudents.map((s) => s.id),
    }))
  }

  const handleSelectAllCompetencies = () => {
    setFormData((prev) => ({
      ...prev,
      deploymentIds:
        prev.deploymentIds.length === filteredCompetencies.length
          ? []
          : filteredCompetencies.map((c) => c.id),
    }))
  }

  const handleSubmit = async () => {
    if (formData.deploymentIds.length === 0) {
      toast.error("Please select at least one competency")
      return
    }

    if (formData.studentIds.length === 0) {
      toast.error("Please select at least one student")
      return
    }

    if (!formData.dueDate) {
      toast.error("Please set a due date")
      return
    }

    try {
      setSubmitting(true)

      // Create assignments for each competency-student combination
      const assignments = []
      
      for (const deploymentId of formData.deploymentIds) {
        for (let i = 0; i < formData.studentIds.length; i++) {
          const studentId = formData.studentIds[i]
          let dueDate = formData.dueDate
          
          // Stagger due dates if enabled
          if (formData.staggerDueDates && i > 0) {
            const baseDueDate = new Date(formData.dueDate)
            baseDueDate.setDate(baseDueDate.getDate() + (i * formData.staggerDays))
            dueDate = baseDueDate.toISOString().slice(0, 16)
          }
          
          assignments.push({
            deploymentId,
            userId: studentId,
            dueDate,
            priority: formData.priority,
            instructions: formData.instructions,
            assignedBy: supervisorId,
          })
        }
      }

      const response = await fetch("/api/competency-assignments/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assignments,
          notifyStudents: formData.notifyStudents,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create bulk assignments")
      }

      const result = await response.json()
      toast.success(
        `Successfully created ${result.created || assignments.length} assignments`
      )

      // Reset form
      setFormData({
        deploymentIds: [],
        studentIds: [],
        dueDate: "",
        priority: "medium",
        instructions: "",
        notifyStudents: true,
        staggerDueDates: false,
        staggerDays: 7,
      })

      onSuccess()
      onClose()
    } catch (error) {
      console.error("Failed to create bulk assignments:", error)
      toast.error(error instanceof Error ? error.message : "Failed to create assignments")
    } finally {
      setSubmitting(false)
    }
  }

  const totalAssignments = formData.deploymentIds.length * formData.studentIds.length

  // Get unique values for filters
  const programs = [...new Set(students.map(s => s.program))].filter(Boolean)
  const years = [...new Set(students.map(s => s.year))].filter(Boolean)
  const categories = [...new Set(competencyDeployments.map(c => c.category))].filter(Boolean)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Competency Assignment Manager</DialogTitle>
          <DialogDescription>
            Assign multiple competencies to multiple students efficiently
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="select">1. Select</TabsTrigger>
            <TabsTrigger value="configure">2. Configure</TabsTrigger>
            <TabsTrigger value="review">3. Review</TabsTrigger>
            <TabsTrigger value="confirm">4. Confirm</TabsTrigger>
          </TabsList>

          <TabsContent value="select" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Student Selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Select Students ({formData.studentIds.length} selected)
                  </CardTitle>
                  <CardDescription>Choose students to assign competencies to</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Student Filters */}
                  <div className="space-y-2">
                    <Input
                      placeholder="Search students..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Select value={programFilter} onValueChange={setProgramFilter}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Program" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Programs</SelectItem>
                          {programs.map((program) => (
                            <SelectItem key={program} value={program}>
                              {program}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={yearFilter} onValueChange={setYearFilter}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Year" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Years</SelectItem>
                          {years.map((year) => (
                            <SelectItem key={year} value={year}>
                              Year {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSelectAllStudents}
                      className="w-full"
                    >
                      {formData.studentIds.length === filteredStudents.length
                        ? "Deselect All"
                        : "Select All Filtered"}
                    </Button>
                  </div>

                  {/* Student List */}
                  <div className="max-h-80 overflow-y-auto space-y-2">
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
                            id={`student-${student.id}`}
                            checked={formData.studentIds.includes(student.id)}
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

              {/* Competency Selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="h-5 w-5" />
                    Select Competencies ({formData.deploymentIds.length} selected)
                  </CardTitle>
                  <CardDescription>Choose competencies to assign</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Competency Filters */}
                  <div className="space-y-2">
                    <Input
                      placeholder="Search competencies..."
                      value={competencySearch}
                      onChange={(e) => setCompetencySearch(e.target.value)}
                    />
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {categories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSelectAllCompetencies}
                      className="w-full"
                    >
                      {formData.deploymentIds.length === filteredCompetencies.length
                        ? "Deselect All"
                        : "Select All Filtered"}
                    </Button>
                  </div>

                  {/* Competency List */}
                  <div className="max-h-80 overflow-y-auto space-y-2">
                    {loading ? (
                      <div className="text-center py-4">Loading competencies...</div>
                    ) : filteredCompetencies.length === 0 ? (
                      <div className="text-center py-4 text-muted-foreground">
                        No competencies found
                      </div>
                    ) : (
                      filteredCompetencies.map((competency) => (
                        <div
                          key={competency.id}
                          className="flex items-start space-x-2 p-2 rounded hover:bg-muted"
                        >
                          <Checkbox
                            id={`competency-${competency.id}`}
                            checked={formData.deploymentIds.includes(competency.id)}
                            onCheckedChange={() => handleCompetencyToggle(competency.id)}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="font-medium">{competency.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {competency.category} • {competency.level}
                            </div>
                            {competency.estimatedHours && (
                              <div className="text-xs text-muted-foreground">
                                Est. {competency.estimatedHours}h
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => setActiveTab("configure")}
                disabled={formData.studentIds.length === 0 || formData.deploymentIds.length === 0}
              >
                Next: Configure Settings
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="configure" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Assignment Configuration</CardTitle>
                <CardDescription>
                  Configure assignment details and scheduling options
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="dueDate">Base Due Date</Label>
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

                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="staggerDueDates"
                      checked={formData.staggerDueDates}
                      onCheckedChange={(checked) =>
                        setFormData(prev => ({ ...prev, staggerDueDates: !!checked }))
                      }
                    />
                    <Label htmlFor="staggerDueDates">Stagger due dates for students</Label>
                  </div>
                  
                  {formData.staggerDueDates && (
                    <div className="ml-6 space-y-2">
                      <Label htmlFor="staggerDays">Days between each student</Label>
                      <Input
                        id="staggerDays"
                        type="number"
                        min="1"
                        max="30"
                        value={formData.staggerDays}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          staggerDays: Number.parseInt(e.target.value) || 7 
                        }))}
                        className="w-32"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="instructions">Instructions (Optional)</Label>
                  <Textarea
                    id="instructions"
                    placeholder="Provide specific instructions or context for these assignments..."
                    value={formData.instructions}
                    onChange={(e) => setFormData(prev => ({ ...prev, instructions: e.target.value }))}
                    rows={4}
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
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setActiveTab("select")}>
                Back: Selection
              </Button>
              <Button
                onClick={() => setActiveTab("review")}
                disabled={!formData.dueDate}
              >
                Next: Review
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="review" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Assignment Summary</CardTitle>
                <CardDescription>
                  Review your bulk assignment before creating
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <div className="text-2xl font-bold">{formData.studentIds.length}</div>
                    <div className="text-sm text-muted-foreground">Students</div>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <div className="text-2xl font-bold">{formData.deploymentIds.length}</div>
                    <div className="text-sm text-muted-foreground">Competencies</div>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <div className="text-2xl font-bold">{totalAssignments}</div>
                    <div className="text-sm text-muted-foreground">Total Assignments</div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Selected Students</h4>
                    <div className="flex flex-wrap gap-2">
                      {formData.studentIds.slice(0, 10).map((studentId) => {
                        const student = students.find(s => s.id === studentId)
                        return student ? (
                          <Badge key={studentId} variant="secondary">
                            {student.name}
                          </Badge>
                        ) : null
                      })}
                      {formData.studentIds.length > 10 && (
                        <Badge variant="outline">
                          +{formData.studentIds.length - 10} more
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Selected Competencies</h4>
                    <div className="flex flex-wrap gap-2">
                      {formData.deploymentIds.slice(0, 5).map((deploymentId) => {
                        const competency = competencyDeployments.find(c => c.id === deploymentId)
                        return competency ? (
                          <Badge key={deploymentId} variant="secondary">
                            {competency.name}
                          </Badge>
                        ) : null
                      })}
                      {formData.deploymentIds.length > 5 && (
                        <Badge variant="outline">
                          +{formData.deploymentIds.length - 5} more
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h4 className="font-medium mb-2">Assignment Details</h4>
                    <div className="space-y-1 text-sm">
                      <div>Due Date: {new Date(formData.dueDate).toLocaleString()}</div>
                      <div>Priority: {formData.priority}</div>
                      <div>Staggered: {formData.staggerDueDates ? `Yes (${formData.staggerDays} days)` : "No"}</div>
                      <div>Notifications: {formData.notifyStudents ? "Enabled" : "Disabled"}</div>
                    </div>
                  </div>
                  {formData.instructions && (
                    <div>
                      <h4 className="font-medium mb-2">Instructions</h4>
                      <div className="text-sm text-muted-foreground bg-muted p-2 rounded">
                        {formData.instructions}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setActiveTab("configure")}>
                Back: Configure
              </Button>
              <Button onClick={() => setActiveTab("confirm")}>
                Next: Confirm
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="confirm" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-center">Ready to Create Assignments</CardTitle>
                <CardDescription className="text-center">
                  This will create {totalAssignments} individual competency assignments
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center space-y-4">
                  <div className="text-6xl">🎯</div>
                  <div className="space-y-2">
                    <div className="text-lg font-medium">
                      {formData.studentIds.length} students will receive {formData.deploymentIds.length} competencies each
                    </div>
                    <div className="text-muted-foreground">
                      {formData.notifyStudents && "Email notifications will be sent to all students"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setActiveTab("review")}>
                Back: Review
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Creating Assignments..." : `Create ${totalAssignments} Assignments`}
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}