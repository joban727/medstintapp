"use client"

import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Edit,
  Eye,
  Plus,
  Search,
  Target,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react"
import { useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "../../../../components/ui/avatar"
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
import { Textarea } from "../../../../components/ui/textarea"

// Types for skills validation
export interface SkillValidation {
  id: string
  skill: string
  student: {
    id: string
    name: string
    avatar?: string
  }
  status: "validated" | "pending" | "in_progress" | "requires_improvement"
  category: string
  level: "Beginner" | "Intermediate" | "Advanced"
  date: string
  feedback?: string
  score?: number
  attempts?: number
  maxAttempts?: number
  validatedAt?: string
  validatedBy?: string
  evidence?: string[]
  notes?: string
  nextRevalidation?: string
}

export interface SkillLibraryItem {
  id: string
  name: string
  category: string
  level: "Beginner" | "Intermediate" | "Advanced"
  description: string
  requirements: string[]
  validationMethod?: string
  requiredAttempts?: number
  revalidationPeriod?: string
  criteria?: string[]
}

interface SkillsClientProps {
  skillsValidations: SkillValidation[]
  skillsLibrary: SkillLibraryItem[]
}

export function SkillsClient({ skillsValidations, skillsLibrary }: SkillsClientProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [selectedLevel, setSelectedLevel] = useState("all")
  const [selectedStudent, _setSelectedStudent] = useState("")

  const filteredValidations = skillsValidations.filter((validation) => {
    const matchesSearch =
      validation.skill.toLowerCase().includes(searchTerm.toLowerCase()) ||
      validation.student.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = selectedStatus === "all" || validation.status === selectedStatus
    const matchesCategory = selectedCategory === "all" || validation.category === selectedCategory
    const matchesLevel = selectedLevel === "all" || validation.level === selectedLevel
    const matchesStudent =
      selectedStudent === "" ||
      validation.student.name.toLowerCase().includes(selectedStudent.toLowerCase())

    return matchesSearch && matchesStatus && matchesCategory && matchesLevel && matchesStudent
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "validated":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            <CheckCircle className="mr-1 h-3 w-3" />
            Validated
          </Badge>
        )
      case "pending":
        return (
          <Badge variant="default" className="bg-yellow-100 text-yellow-800">
            <Clock className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        )
      case "in_progress":
        return (
          <Badge variant="default" className="bg-blue-100 text-blue-800">
            <Clock className="mr-1 h-3 w-3" />
            In Progress
          </Badge>
        )
      case "requires_improvement":
        return (
          <Badge variant="destructive">
            <AlertTriangle className="mr-1 h-3 w-3" />
            Needs Improvement
          </Badge>
        )
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const getLevelBadge = (level: string) => {
    const colors = {
      Beginner: "bg-blue-100 text-blue-800",
      Intermediate: "bg-yellow-100 text-yellow-800",
      Advanced: "bg-red-100 text-red-800",
    }
    return (
      <Badge className={colors[level as keyof typeof colors] || "bg-gray-100 text-gray-800"}>
        {level}
      </Badge>
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  // Calculate stats
  const totalValidations = skillsValidations.length
  const validated = skillsValidations.filter((v) => v.status === "validated").length
  const pending = skillsValidations.filter((v) => v.status === "pending").length
  const needsImprovement = skillsValidations.filter(
    (v) => v.status === "requires_improvement"
  ).length
  const validationRate = totalValidations > 0 ? Math.round((validated / totalValidations) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">Skills Validation</h1>
          <p className="text-muted-foreground">
            Validate and track student clinical skills and competencies
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Validation
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Total Validations</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{totalValidations}</div>
            <p className="text-muted-foreground text-xs">This semester</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Validated</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{validated}</div>
            <p className="text-muted-foreground text-xs">{validationRate}% success rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Pending Review</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{pending}</div>
            <p className="text-muted-foreground text-xs">Require attention</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Need Improvement</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{needsImprovement}</div>
            <p className="text-muted-foreground text-xs">Require remediation</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="validations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="validations">Validations</TabsTrigger>
          <TabsTrigger value="pending">Pending ({pending})</TabsTrigger>
          <TabsTrigger value="skills-library">Skills Library</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="validations" className="space-y-4">
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
                      placeholder="Search skills or students..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="validated">Validated</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="requires_improvement">Needs Improvement</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="Clinical Procedures">Clinical Procedures</SelectItem>
                    <SelectItem value="Assessment Skills">Assessment Skills</SelectItem>
                    <SelectItem value="Medication Safety">Medication Safety</SelectItem>
                    <SelectItem value="Communication">Communication</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="Beginner">Beginner</SelectItem>
                    <SelectItem value="Intermediate">Intermediate</SelectItem>
                    <SelectItem value="Advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Validations List */}
          <div className="grid gap-4">
            {filteredValidations.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <Target className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 font-semibold text-lg">No validations found</h3>
                  <p className="text-muted-foreground">
                    No skill validations match your current filters.
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredValidations.map((validation, index) => (
                <Card key={validation?.id || `validation-${index}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">
                            {validation?.skill || "Unknown Skill"}
                          </CardTitle>
                          {getStatusBadge(validation?.status || "pending")}
                          {getLevelBadge(validation?.level || "Beginner")}
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={validation?.student?.avatar} />
                              <AvatarFallback className="text-xs">
                                {(validation?.student?.name || "Unknown")
                                  .split(" ")
                                  .map((n: string) => n[0])
                                  .join("")}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-sm">
                              {validation?.student?.name || "Unknown Student"}
                            </span>
                          </div>
                          <span className="text-muted-foreground text-sm">
                            Category: {validation?.category || "Unknown"}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-muted-foreground text-sm">
                          <span>
                            Attempts: {validation?.attempts || 0}/{validation?.maxAttempts || 1}
                          </span>
                          {validation?.validatedAt && (
                            <span>Validated: {formatDate(validation.validatedAt)}</span>
                          )}
                          {validation?.validatedBy && <span>By: {validation.validatedBy}</span>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                        {validation?.status === "pending" && <Button size="sm">Validate</Button>}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Progress */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Progress</span>
                          <span>
                            {validation?.attempts || 0}/{validation?.maxAttempts || 1} attempts
                          </span>
                        </div>
                        <Progress
                          value={
                            ((validation?.attempts || 0) / (validation?.maxAttempts || 1)) * 100
                          }
                        />
                      </div>

                      {/* Evidence */}
                      <div className="space-y-2">
                        <span className="font-medium text-sm">Evidence:</span>
                        <div className="flex flex-wrap gap-2">
                          {(validation?.evidence || []).map((evidence: string, index: number) => (
                            <Badge
                              key={`evidence-${validation?.id || "unknown"}-${index}`}
                              variant="outline"
                            >
                              {evidence}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Notes */}
                      {validation?.notes && (
                        <div className="space-y-2">
                          <span className="font-medium text-sm">Notes:</span>
                          <p className="text-muted-foreground text-sm">{validation.notes}</p>
                        </div>
                      )}

                      {/* Next Revalidation */}
                      {validation?.nextRevalidation && (
                        <div className="text-muted-foreground text-sm">
                          Next revalidation due: {formatDate(validation.nextRevalidation)}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Validations</CardTitle>
              <CardDescription>
                Skills validations that require your review and approval
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {skillsValidations
                  .filter((v) => v?.status === "pending")
                  .map((validation, index) => (
                    <div
                      key={validation?.id || `pending-${index}`}
                      className="space-y-4 rounded-lg border p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="font-medium">{validation?.skill || "Unknown Skill"}</div>
                          <div className="text-muted-foreground text-sm">
                            {validation?.student?.name || "Unknown Student"} •{" "}
                            {validation?.category || "Unknown"} • {validation?.level || "Beginner"}
                          </div>
                          <div className="text-muted-foreground text-sm">
                            Attempt {validation?.attempts || 0} of {validation?.maxAttempts || 1}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            <Eye className="mr-2 h-4 w-4" />
                            Review
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="space-y-2">
                          <span className="font-medium text-sm">Validation Decision:</span>
                          <div className="flex gap-2">
                            <Button size="sm" className="bg-green-600 hover:bg-green-700">
                              <ThumbsUp className="mr-2 h-4 w-4" />
                              Validate
                            </Button>
                            <Button size="sm" variant="destructive">
                              <ThumbsDown className="mr-2 h-4 w-4" />
                              Needs Improvement
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <span className="font-medium text-sm">Feedback:</span>
                          <Textarea
                            placeholder="Provide feedback on the student's performance..."
                            className="min-h-[80px]"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                {skillsValidations.filter((v) => v?.status === "pending").length === 0 && (
                  <div className="py-8 text-center">
                    <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
                    <h3 className="mt-4 font-semibold text-lg">All caught up!</h3>
                    <p className="text-muted-foreground">No pending validations</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="skills-library" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Skills Library</CardTitle>
              <CardDescription>
                Manage the library of skills and validation criteria
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {skillsLibrary.length === 0 ? (
                  <div className="py-8 text-center">
                    <Target className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 font-semibold text-lg">No skills defined</h3>
                    <p className="text-muted-foreground">
                      Skills library is empty. Add competencies to your school to see them here.
                    </p>
                  </div>
                ) : (
                  skillsLibrary.map((skill, index) => (
                    <Card key={skill?.id || `skill-${index}`}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-lg">
                                {skill?.name || "Unknown Skill"}
                              </CardTitle>
                              {getLevelBadge(skill?.level || "Beginner")}
                            </div>
                            <CardDescription>
                              {skill?.description || "No description available"}
                            </CardDescription>
                            <div className="flex items-center gap-4 text-muted-foreground text-sm">
                              <span>Category: {skill?.category || "Unknown"}</span>
                              <span>Method: {skill?.validationMethod || "Unknown"}</span>
                              <span>Required attempts: {skill?.requiredAttempts || 1}</span>
                              <span>Revalidation: {skill?.revalidationPeriod || "Unknown"}</span>
                            </div>
                          </div>
                          <Button variant="outline" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <span className="font-medium text-sm">Validation Criteria:</span>
                          <div className="flex flex-wrap gap-2">
                            {(skill?.criteria || []).map((criterion: string, index: number) => (
                              <Badge
                                key={`criterion-${skill?.id || "unknown"}-${index}`}
                                variant="outline"
                              >
                                {criterion}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Validation Success Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                  {totalValidations > 0 ? (
                    <div className="text-center">
                      <div className="font-bold text-4xl text-green-600">{validationRate}%</div>
                      <p className="text-muted-foreground">Overall validation rate</p>
                    </div>
                  ) : (
                    "No validation data available"
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Skills Progress Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                  {totalValidations > 0 ? (
                    <div className="text-center">
                      <div className="font-bold text-4xl">{totalValidations}</div>
                      <p className="text-muted-foreground">Total validations this semester</p>
                    </div>
                  ) : (
                    "No timeline data available"
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
