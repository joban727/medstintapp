"use client"

import { Award, Edit, Eye, Plus, Search, Target, TrendingUp, Users } from "lucide-react"
import { useState, useEffect } from "react"
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
import { AssignmentCreationForm } from "../../../../components/competency/assignment-creation-form"
import { toast } from "sonner"

// Fetch competencies and student progress from API
let competencies: {
  id: string
  title: string
  category: string
  description: string
  level: string
  totalStudents: number
  completedStudents: number
  averageScore: number
  status: string
  lastUpdated: string
  scores: number[]
}[] = []
let studentProgress: {
  id: string
  name: string
  email: string
  avatar: string
  completedCompetencies: number
  totalCompetencies: number
  averageScore: number
  lastActivity: string
  scores: number[]
}[] = []

try {
  // Fetch competency assignments for students under supervision
  const assignmentsResponse = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/competency-assignments`,
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  )

  if (assignmentsResponse.ok) {
    const assignmentsData = await assignmentsResponse.json()

    // Transform assignments data to competencies format
    const competencyMap = new Map()

    assignmentsData.assignments?.forEach(
      (assignment: {
        competencyId: string
        competencyTitle?: string
        competencyCategory?: string
        competencyDescription?: string
        competencyLevel?: string
        status: string
        averageScore?: number
        updatedAt?: string
        createdAt: string
        userId: string
        userName?: string
        userEmail?: string
      }) => {
        const competencyId = assignment.competencyId
        if (!competencyMap.has(competencyId)) {
          competencyMap.set(competencyId, {
            id: competencyId,
            title: assignment.competencyTitle || "Competency",
            category: assignment.competencyCategory || "General",
            description: assignment.competencyDescription || "",
            level: assignment.competencyLevel || "Intermediate",
            totalStudents: 0,
            completedStudents: 0,
            averageScore: 0,
            status: "active",
            lastUpdated: assignment.updatedAt || assignment.createdAt,
            scores: [],
          })
        }

        const comp = competencyMap.get(competencyId)
        comp.totalStudents++

        if (assignment.status === "COMPLETED") {
          comp.completedStudents++
        }

        if (assignment.averageScore) {
          comp.scores.push(assignment.averageScore)
        }
      }
    )

    // Calculate average scores
    competencies = Array.from(competencyMap.values()).map((comp) => ({
      ...comp,
      averageScore:
        comp.scores.length > 0
          ? Math.round(comp.scores.reduce((a: number, b: number) => a + b, 0) / comp.scores.length)
          : 0,
      status: comp.completedStudents === comp.totalStudents ? "completed" : "active",
    }))

    // Transform to student progress format
    const studentMap = new Map()

    assignmentsData.assignments?.forEach(
      (assignment: {
        userId: string
        userName?: string
        userEmail?: string
        status: string
        averageScore?: number
        updatedAt?: string
        createdAt: string
      }) => {
        const userId = assignment.userId
        if (!studentMap.has(userId)) {
          studentMap.set(userId, {
            id: userId,
            name: assignment.userName || "Student",
            email: assignment.userEmail || "",
            avatar: "",
            completedCompetencies: 0,
            totalCompetencies: 0,
            averageScore: 0,
            lastActivity: assignment.updatedAt || assignment.createdAt,
            scores: [],
          })
        }

        const student = studentMap.get(userId)
        student.totalCompetencies++

        if (assignment.status === "COMPLETED") {
          student.completedCompetencies++
        }

        if (assignment.averageScore) {
          student.scores.push(assignment.averageScore)
        }
      }
    )

    // Calculate student progress
    studentProgress = Array.from(studentMap.values()).map((student) => ({
      ...student,
      averageScore:
        student.scores.length > 0
          ? Math.round(
              student.scores.reduce((a: number, b: number) => a + b, 0) / student.scores.length
            )
          : 0,
    }))
  }
} catch (error) {
  console.error("Error fetching competency data:", error)
}

// TODO: Replace with actual API calls for competency data
const mockCompetencies: typeof competencies = []
const mockStudentProgress: typeof studentProgress = []

// Use API data if available, otherwise fallback to mock data
if (competencies.length === 0) {
  competencies = mockCompetencies
}

if (studentProgress.length === 0) {
  studentProgress = mockStudentProgress
}

export default function CompetenciesPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [selectedLevel, setSelectedLevel] = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [showAssignmentForm, setShowAssignmentForm] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const filteredCompetencies = competencies.filter((competency) => {
    const matchesSearch =
      competency.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      competency.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === "all" || competency.category === selectedCategory
    const matchesLevel = selectedLevel === "all" || competency.level === selectedLevel
    const matchesStatus = selectedStatus === "all" || competency.status === selectedStatus

    return matchesSearch && matchesCategory && matchesLevel && matchesStatus
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            Active
          </Badge>
        )
      case "draft":
        return <Badge variant="secondary">Draft</Badge>
      case "archived":
        return <Badge variant="outline">Archived</Badge>
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">Competency Management</h1>
          <p className="text-muted-foreground">
            Manage and track student competencies and learning outcomes
          </p>
        </div>
        <Button onClick={() => setShowAssignmentForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Assign Competency
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Total Competencies</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">12</div>
            <p className="text-muted-foreground text-xs">+2 from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Active Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">24</div>
            <p className="text-muted-foreground text-xs">Across all competencies</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Average Completion</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">67%</div>
            <p className="text-muted-foreground text-xs">+5% from last week</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Average Score</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">84%</div>
            <p className="text-muted-foreground text-xs">+2% from last month</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="competencies" className="space-y-4">
        <TabsList>
          <TabsTrigger value="competencies">Competencies</TabsTrigger>
          <TabsTrigger value="student-progress">Student Progress</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="competencies" className="space-y-4">
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
                      placeholder="Search competencies..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="Clinical Skills">Clinical Skills</SelectItem>
                    <SelectItem value="Safety">Safety</SelectItem>
                    <SelectItem value="Professional">Professional</SelectItem>
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
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Competencies List */}
          <div className="grid gap-4">
            {filteredCompetencies.map((competency) => (
              <Card key={competency.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{competency.title}</CardTitle>
                        {getStatusBadge(competency.status)}
                        {getLevelBadge(competency.level)}
                      </div>
                      <CardDescription>{competency.description}</CardDescription>
                      <div className="flex items-center gap-4 text-muted-foreground text-sm">
                        <span>Category: {competency.category}</span>
                        <span>Last updated: {competency.lastUpdated}</span>
                      </div>
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
                <CardContent>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Student Progress</span>
                        <span>
                          {competency.completedStudents}/{competency.totalStudents}
                        </span>
                      </div>
                      <Progress
                        value={(competency.completedStudents / competency.totalStudents) * 100}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Average Score</span>
                        <span>{competency.averageScore}%</span>
                      </div>
                      <Progress value={competency.averageScore} />
                    </div>
                    <div className="flex items-center justify-center">
                      <div className="text-center">
                        <div className="font-bold text-2xl">
                          {Math.round(
                            (competency.completedStudents / competency.totalStudents) * 100
                          )}
                          %
                        </div>
                        <div className="text-muted-foreground text-sm">Completion Rate</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="student-progress" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Student Progress Overview</CardTitle>
              <CardDescription>
                Track individual student progress across all competencies
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {studentProgress.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="flex items-center gap-4">
                      <Avatar>
                        <AvatarImage src={student.avatar} />
                        <AvatarFallback>
                          {student.name
                            .split(" ")
                            .map((n: string) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{student.name}</div>
                        <div className="text-muted-foreground text-sm">{student.email}</div>
                        <div className="text-muted-foreground text-sm">
                          Last activity: {student.lastActivity}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2 text-right">
                      <div className="flex items-center gap-4">
                        <div className="text-sm">
                          <span className="font-medium">
                            {student.completedCompetencies}/{student.totalCompetencies}
                          </span>
                          <span className="text-muted-foreground"> competencies</span>
                        </div>
                        <div className="text-sm">
                          <span className="font-medium">{student.averageScore}%</span>
                          <span className="text-muted-foreground"> avg score</span>
                        </div>
                      </div>
                      <Progress
                        value={(student.completedCompetencies / student.totalCompetencies) * 100}
                        className="w-32"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Competency Completion Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                  Chart placeholder - Competency completion over time
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Score Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                  Chart placeholder - Score distribution across competencies
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Assignment Creation Form */}
      <AssignmentCreationForm
        isOpen={showAssignmentForm}
        onClose={() => setShowAssignmentForm(false)}
        onSuccess={() => {
          setRefreshKey(prev => prev + 1)
          toast.success("Competency assignments created successfully!")
        }}
        supervisorId="current-supervisor-id" // TODO: Get from auth context
      />
    </div>
  )
}
