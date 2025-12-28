import { eq } from "drizzle-orm"
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Edit,
  Eye,
  FileText,
  MoreHorizontal,
  Plus,
  Search,
  Target,
  TrendingUp,
  Users,
} from "lucide-react"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../../components/ui/dropdown-menu"
import { Input } from "../../../../components/ui/input"
import { Progress } from "../../../../components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../../components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../components/ui/tabs"
import { db } from "@/database/connection-pool"
import { evaluations, rotations, users } from "../../../../database/schema"
import { requireAnyRole } from "../../../../lib/auth-clerk"

export default async function PreceptorEvaluationsPage() {
  const user = await requireAnyRole(["CLINICAL_PRECEPTOR"], "/dashboard")

  // Fetch evaluations created by this preceptor
  const preceptorEvaluations = await db
    .select({
      id: evaluations.id,
      type: evaluations.type,
      score: evaluations.overallRating,
      feedback: evaluations.comments,
      createdAt: evaluations.createdAt,
      studentId: evaluations.studentId,
      studentName: users.name,
      studentEmail: users.email,
      rotationTitle: rotations.specialty,
      studentSignature: evaluations.studentSignature,
      evaluatorSignature: evaluations.evaluatorSignature,
    })
    .from(evaluations)
    .leftJoin(users, eq(evaluations.studentId, users.id))
    .leftJoin(rotations, eq(evaluations.rotationId, rotations.id))
    .where(eq(evaluations.evaluatorId, user.id))
    .orderBy(evaluations.createdAt)

  // Use actual evaluation data from database with default values
  const evaluationDetails = preceptorEvaluations.map((evaluation) => ({
    ...evaluation,
    status: "COMPLETED" as const, // Default status since not selected from DB
    studentYear: 3, // Default year
    rotationWeek: 1, // Default week
    dueDate: new Date(), // Default due date
    priority: "MEDIUM" as const, // Default priority
    progress: 100, // Default progress
    competencyArea: "Clinical Skills", // Default competency area
    timeSpent: 30, // Default time spent
  }))

  // Filter pending evaluations from actual data (based on signature status)
  const pendingEvaluations = evaluationDetails.filter(
    (e) => !e.studentSignature || !e.evaluatorSignature
  )

  const totalEvaluations = evaluationDetails.length
  const completedEvaluations = evaluationDetails.filter(
    (e) => e.studentSignature && e.evaluatorSignature
  ).length
  const pendingCount = pendingEvaluations.length
  const avgScore = Math.round(
    evaluationDetails.reduce((sum, e) => sum + (Number(e.score) || 0), 0) /
      (evaluationDetails.length || 1)
  )

  const statusColors = {
    DRAFT: "bg-gray-100 text-gray-800",
    SUBMITTED: "bg-blue-100 text-blue-800",
    REVIEWED: "bg-yellow-100 text-yellow-800",
    COMPLETED: "bg-green-100 text-green-800",
  }

  const priorityColors = {
    HIGH: "bg-red-100 text-red-800",
    MEDIUM: "bg-yellow-100 text-yellow-800",
    LOW: "bg-green-100 text-green-800",
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">Student Evaluations</h1>
          <p className="text-muted-foreground">
            Create, manage, and track student evaluations and assessments
          </p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700">
          <Plus className="mr-2 h-4 w-4" />
          New Evaluation
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Total Evaluations</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{totalEvaluations}</div>
            <p className="text-muted-foreground text-xs">
              <span className="text-green-600">{completedEvaluations}</span> completed
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Pending Reviews</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{pendingCount}</div>
            <p className="text-muted-foreground text-xs">
              <span className="text-red-600">2</span> due this week
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Average Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{avgScore}%</div>
            <p className="text-muted-foreground text-xs">
              <span className="text-green-600">+3%</span> from last month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Students Evaluated</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">
              {new Set(evaluationDetails.map((e) => e.studentId)).size}
            </div>
            <p className="text-muted-foreground text-xs">Unique students</p>
          </CardContent>
        </Card>
      </div>

      {/* Evaluation Management Tabs */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Evaluations</TabsTrigger>
          <TabsTrigger value="pending">Pending ({pendingCount})</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute top-2.5 left-2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search evaluations by student or rotation..."
                    className="pl-8"
                  />
                </div>
              </div>
              <Select>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="MIDTERM">Midterm</SelectItem>
                  <SelectItem value="FINAL">Final</SelectItem>
                  <SelectItem value="WEEKLY">Weekly</SelectItem>
                  <SelectItem value="COMPETENCY">Competency</SelectItem>
                </SelectContent>
              </Select>
              <Select>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="SUBMITTED">Submitted</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                </SelectContent>
              </Select>
              <Select>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Competency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Areas</SelectItem>
                  <SelectItem value="clinical">Clinical Skills</SelectItem>
                  <SelectItem value="patient-care">Patient Care</SelectItem>
                  <SelectItem value="communication">Communication</SelectItem>
                  <SelectItem value="professionalism">Professionalism</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <TabsContent value="all" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Evaluations</CardTitle>
              <CardDescription>Complete overview of all student evaluations</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Evaluation Details</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {evaluationDetails.map((evaluation) => (
                    <TableRow key={evaluation.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage
                              src={`https://avatar.vercel.sh/${evaluation.studentEmail}`}
                            />
                            <AvatarFallback>
                              {evaluation.studentName?.charAt(0)?.toUpperCase() || "S"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{evaluation.studentName}</div>
                            <div className="text-muted-foreground text-sm">
                              Year {evaluation.studentYear} • Week {evaluation.rotationWeek}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{evaluation.type?.replace("_", " ")}</div>
                          <div className="text-muted-foreground text-sm">
                            {evaluation.rotationTitle}
                          </div>
                          <Badge variant="outline" className="mt-1">
                            {evaluation.competencyArea}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span>Completion</span>
                            <span className="text-muted-foreground">
                              {evaluation.status === "COMPLETED"
                                ? "100%"
                                : evaluation.status === "REVIEWED"
                                  ? "80%"
                                  : evaluation.status === "SUBMITTED"
                                    ? "60%"
                                    : "20%"}
                            </span>
                          </div>
                          <Progress
                            value={
                              evaluation.status === "COMPLETED"
                                ? 100
                                : evaluation.status === "REVIEWED"
                                  ? 80
                                  : evaluation.status === "SUBMITTED"
                                    ? 60
                                    : 20
                            }
                            className="h-2"
                          />
                          <div className="text-muted-foreground text-xs">
                            {evaluation.timeSpent} min spent
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-center">
                          {evaluation.score ? (
                            <>
                              <div className="font-semibold text-lg">{evaluation.score}%</div>
                              <div className="text-muted-foreground text-xs">
                                {Number(evaluation.score) >= 90
                                  ? "Excellent"
                                  : Number(evaluation.score) >= 80
                                    ? "Good"
                                    : Number(evaluation.score) >= 70
                                      ? "Satisfactory"
                                      : "Needs Improvement"}
                              </div>
                            </>
                          ) : (
                            <span className="text-muted-foreground">Not scored</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge
                            className={statusColors[evaluation.status as keyof typeof statusColors]}
                          >
                            {evaluation.status}
                          </Badge>
                          <Badge
                            className={
                              priorityColors[evaluation.priority as keyof typeof priorityColors]
                            }
                            variant="outline"
                          >
                            {evaluation.priority}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">
                            {evaluation.dueDate.toLocaleDateString()}
                          </div>
                          <div className="text-muted-foreground">
                            {Math.ceil(
                              (evaluation.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                            )}{" "}
                            days left
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
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
                              Edit Evaluation
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Mark Complete
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <FileText className="mr-2 h-4 w-4" />
                              Export PDF
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-500" />
                Pending Evaluations
              </CardTitle>
              <CardDescription>Evaluations that require your immediate attention</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pendingEvaluations.map((evaluation) => (
                  <div key={evaluation.id} className="space-y-3 rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage
                            src={`https://avatar.vercel.sh/${evaluation.studentEmail}`}
                          />
                          <AvatarFallback>
                            {evaluation.studentName?.charAt(0)?.toUpperCase() || "S"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{evaluation.studentName}</div>
                          <div className="text-muted-foreground text-sm">
                            {evaluation.rotationTitle} • Year {evaluation.studentYear}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge
                          className={
                            priorityColors[evaluation.priority as keyof typeof priorityColors]
                          }
                        >
                          {evaluation.priority} PRIORITY
                        </Badge>
                        <div className="mt-1 text-muted-foreground text-sm">
                          Due: {evaluation.dueDate.toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex gap-2">
                        <Badge variant="outline">{evaluation.type}</Badge>
                        <Badge variant="outline">{evaluation.competencyArea}</Badge>
                        <Badge variant="outline">Week {evaluation.rotationWeek}</Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          <Eye className="mr-2 h-4 w-4" />
                          Review
                        </Button>
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                          <Edit className="mr-2 h-4 w-4" />
                          Start Evaluation
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Completed Evaluations</CardTitle>
              <CardDescription>
                Successfully completed student evaluations and their outcomes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {evaluationDetails
                  .filter((e) => e.status === "COMPLETED")
                  .map((evaluation) => (
                    <Card key={evaluation.id} className="border-green-200">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            COMPLETED
                          </Badge>
                          <div className="font-bold text-lg">{evaluation.score}%</div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="font-medium">{evaluation.studentName}</div>
                          <div className="text-muted-foreground text-sm">
                            {evaluation.rotationTitle}
                          </div>
                          <div className="text-sm">
                            <span className="font-medium">Type:</span> {evaluation.type}
                          </div>
                          <div className="text-sm">
                            <span className="font-medium">Area:</span> {evaluation.competencyArea}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            Completed: {evaluation.createdAt?.toLocaleDateString()}
                          </div>
                          <div className="mt-3 flex gap-1">
                            <Button size="sm" variant="outline" className="flex-1">
                              <Eye className="mr-1 h-3 w-3" />
                              View
                            </Button>
                            <Button size="sm" variant="outline" className="flex-1">
                              <FileText className="mr-1 h-3 w-3" />
                              Export
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Evaluation Templates</CardTitle>
              <CardDescription>
                Pre-configured evaluation templates for different competency areas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[
                  {
                    name: "Clinical Skills Assessment",
                    competency: "Clinical Skills",
                    questions: 15,
                    duration: "30 min",
                  },
                  {
                    name: "Patient Care Evaluation",
                    competency: "Patient Care",
                    questions: 12,
                    duration: "25 min",
                  },
                  {
                    name: "Communication Skills",
                    competency: "Communication",
                    questions: 10,
                    duration: "20 min",
                  },
                  {
                    name: "Professionalism Review",
                    competency: "Professionalism",
                    questions: 8,
                    duration: "15 min",
                  },
                  {
                    name: "Medical Knowledge Test",
                    competency: "Medical Knowledge",
                    questions: 20,
                    duration: "45 min",
                  },
                  {
                    name: "Comprehensive Midterm",
                    competency: "All Areas",
                    questions: 25,
                    duration: "60 min",
                  },
                ].map(
                  (
                    template: {
                      name: string
                      competency: string
                      questions: number
                      duration: string
                    },
                    index: number
                  ) => (
                    <Card
                      key={`template-${template.name.replace(/\s+/g, "-").toLowerCase()}-${index}`}
                      className="border-blue-200"
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline">{template.competency}</Badge>
                          <Target className="h-4 w-4 text-blue-500" />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="font-medium">{template.name}</div>
                          <div className="text-muted-foreground text-sm">
                            {template.questions} questions • {template.duration}
                          </div>
                          <Button size="sm" className="mt-3 w-full bg-blue-600 hover:bg-blue-700">
                            <Plus className="mr-2 h-4 w-4" />
                            Use Template
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
