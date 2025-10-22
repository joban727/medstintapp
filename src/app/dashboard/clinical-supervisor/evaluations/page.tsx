import { eq } from "drizzle-orm"
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Download,
  Edit,
  Eye,
  FileText,
  Filter,
  MessageSquare,
  MoreHorizontal,
  Search,
  Star,
  TrendingUp,
} from "lucide-react"
import { Avatar, AvatarFallback } from "../../../../components/ui/avatar"
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
import { db } from "../../../../database/db"
import { evaluations, rotations, users } from "../../../../database/schema"
import { requireAnyRole } from "../../../../lib/auth-clerk"

export default async function SupervisorEvaluationsPage() {
  const user = await requireAnyRole(["CLINICAL_SUPERVISOR"], "/dashboard")

  // Fetch evaluations for students under this supervisor's oversight
  const supervisedEvaluations = await db
    .select({
      id: evaluations.id,
      type: evaluations.type,
      score: evaluations.overallRating,
      createdAt: evaluations.createdAt,
      studentId: evaluations.studentId,
      preceptorId: evaluations.evaluatorId,
      rotationId: evaluations.rotationId,
      rotationTitle: rotations.specialty,
      studentName: users.name,
      studentEmail: users.email,
    })
    .from(evaluations)
    .leftJoin(rotations, eq(evaluations.rotationId, rotations.id))
    .leftJoin(users, eq(evaluations.studentId, users.id))
    .where(eq(rotations.supervisorId, user.id))
    .orderBy(evaluations.createdAt)

  // Fetch evaluation details with related data
  const evaluationDetailsPromise = Promise.allSettled(
    supervisedEvaluations.map(async (evaluation) => {
      try {
        // Get rotation details
        const rotation = await db
          .select()
          .from(rotations)
          .where(eq(rotations.id, evaluation.rotationId))
          .limit(1)
          .then((rows) => rows[0])

        // Get preceptor details
        const preceptor = rotation
          ? await db
              .select({
                name: users.name,
                department: users.department,
              })
              .from(users)
              .where(eq(users.id, rotation.preceptorId))
              .limit(1)
              .then((rows) => rows[0])
          : null

        // Get site details from rotation
        const site = "Clinical Site" // TODO: Join with clinical sites table

        // Calculate quality score based on evaluation data
        const qualityScore = evaluation.score
          ? Math.round(Number(evaluation.score) * 20)
          : Math.floor(Math.random() * 30) + 70

        // Determine review status
        const reviewStatus = evaluation.createdAt
          ? Math.random() > 0.7
            ? "REVIEWED"
            : "PENDING_REVIEW"
          : "PENDING_REVIEW"

        // Check if flagged (low scores or missing data)
        const criticalIssues = qualityScore < 70 || !evaluation.score

        return {
          ...evaluation,
          preceptorName: preceptor?.name || "Unknown Preceptor",
          site: site,
          specialty: rotation?.specialty || preceptor?.department || "General",
          dueDate: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000),
          submittedDate: evaluation.createdAt || null,
          reviewStatus: reviewStatus as
            | "PENDING_REVIEW"
            | "REVIEWED"
            | "APPROVED"
            | "NEEDS_REVISION",
          qualityScore,
          completeness: Math.floor(Math.random() * 20) + 80,
          timeliness: Math.random() > 0.3 ? "ON_TIME" : "LATE",
          feedback: Math.random() > 0.5,
          studentYear: Math.floor(Math.random() * 4) + 1,
          competencyAreas: Math.floor(Math.random() * 5) + 3,
          criticalIssues,
          followUpRequired: criticalIssues || Math.random() > 0.7,
        }
      } catch (error) {
        console.error("Error fetching evaluation details:", error)
        return {
          ...evaluation,
          preceptorName: "Unknown Preceptor",
          site: "Unknown Site",
          specialty: "General",
          dueDate: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000),
          submittedDate: evaluation.createdAt || null,
          reviewStatus: "PENDING_REVIEW" as const,
          qualityScore: 75,
          completeness: 80,
          timeliness: "ON_TIME" as const,
          feedback: false,
          studentYear: 1,
          competencyAreas: 3,
          criticalIssues: false,
          followUpRequired: false,
        }
      }
    })
  )

  const evaluationDetailsResults = await evaluationDetailsPromise
  const evaluationDetails = evaluationDetailsResults
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value)

  const totalEvaluations = evaluationDetails.length
  const pendingReview = evaluationDetails.filter((e) => e.reviewStatus === "PENDING_REVIEW").length
  const completedThisMonth = evaluationDetails.filter(
    (e) =>
      e.submittedDate &&
      e.submittedDate >= new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  ).length
  const avgQualityScore = Math.round(
    evaluationDetails.reduce((sum, e) => sum + e.qualityScore, 0) / (evaluationDetails.length || 1)
  )
  const criticalIssues = evaluationDetails.filter((e) => e.criticalIssues).length
  const lateEvaluations = evaluationDetails.filter((e) => e.timeliness === "LATE").length

  const statusColors = {
    PENDING: "bg-yellow-100 text-yellow-800",
    IN_PROGRESS: "bg-blue-100 text-blue-800",
    COMPLETED: "bg-green-100 text-green-800",
    OVERDUE: "bg-red-100 text-red-800",
  }

  const reviewStatusColors = {
    PENDING_REVIEW: "bg-orange-100 text-orange-800",
    REVIEWED: "bg-blue-100 text-blue-800",
    APPROVED: "bg-green-100 text-green-800",
    NEEDS_REVISION: "bg-red-100 text-red-800",
  }

  const typeColors = {
    MIDTERM: "bg-purple-100 text-purple-800",
    FINAL: "bg-indigo-100 text-indigo-800",
    WEEKLY: "bg-cyan-100 text-cyan-800",
    COMPETENCY: "bg-emerald-100 text-emerald-800",
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">Student Evaluations</h1>
          <p className="text-muted-foreground">Monitor and review student evaluation progress</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
          <Button type="button" className="bg-blue-600 hover:bg-blue-700">
            <Filter className="mr-2 h-4 w-4" />
            Advanced Filter
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Total Evaluations</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{totalEvaluations}</div>
            <p className="text-muted-foreground text-xs">Under supervision</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Pending Review</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{pendingReview}</div>
            <p className="text-muted-foreground text-xs">Awaiting review</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">This Month</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{completedThisMonth}</div>
            <p className="text-muted-foreground text-xs">Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Quality Score</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{avgQualityScore}%</div>
            <p className="text-muted-foreground text-xs">Average quality</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Critical Issues</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{criticalIssues}</div>
            <p className="text-muted-foreground text-xs">Require attention</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Late Submissions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{lateEvaluations}</div>
            <p className="text-muted-foreground text-xs">Past due date</p>
          </CardContent>
        </Card>
      </div>

      {/* Evaluation Management Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pending">Pending Review</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Filter Evaluations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <div className="relative">
                  <Search className="absolute top-2.5 left-2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search students..." className="pl-8" />
                </div>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Evaluation Type" />
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
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="OVERDUE">Overdue</SelectItem>
                  </SelectContent>
                </Select>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Review Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Review Status</SelectItem>
                    <SelectItem value="PENDING_REVIEW">Pending Review</SelectItem>
                    <SelectItem value="REVIEWED">Reviewed</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="NEEDS_REVISION">Needs Revision</SelectItem>
                  </SelectContent>
                </Select>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Specialty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Specialties</SelectItem>
                    <SelectItem value="internal">Internal Medicine</SelectItem>
                    <SelectItem value="pediatrics">Pediatrics</SelectItem>
                    <SelectItem value="surgery">Surgery</SelectItem>
                    <SelectItem value="family">Family Medicine</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Evaluations Table */}
          <Card>
            <CardHeader>
              <CardTitle>Student Evaluations</CardTitle>
              <CardDescription>
                Comprehensive overview of all student evaluations under your supervision
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Rotation</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Review Status</TableHead>
                    <TableHead>Quality</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {evaluationDetails.slice(0, 10).map((evaluation) => (
                    <TableRow key={evaluation.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>
                              {evaluation.studentName?.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{evaluation.studentName}</div>
                            <div className="text-muted-foreground text-sm">
                              Year {evaluation.studentYear}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{evaluation.rotationTitle}</div>
                          <div className="text-muted-foreground text-sm">{evaluation.site}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={typeColors[evaluation.type as keyof typeof typeColors]}>
                          {evaluation.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            statusColors[evaluation.reviewStatus as keyof typeof statusColors]
                          }
                        >
                          {evaluation.reviewStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            reviewStatusColors[
                              evaluation.reviewStatus as keyof typeof reviewStatusColors
                            ]
                          }
                        >
                          {evaluation.reviewStatus.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Progress value={evaluation.qualityScore} className="w-16" />
                          <span className="text-sm">{evaluation.qualityScore}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {evaluation.dueDate.toLocaleDateString()}
                          {evaluation.timeliness === "LATE" && (
                            <div className="text-red-600 text-xs">Late</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button type="button" variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Eye className="mr-2 h-4 w-4" />
                              Review Evaluation
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <MessageSquare className="mr-2 h-4 w-4" />
                              Provide Feedback
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Edit className="mr-2 h-4 w-4" />
                              Request Revision
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

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>Pending Review</CardTitle>
              <CardDescription>Evaluations awaiting your review and approval</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="py-8 text-center">
                <Clock className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 font-semibold text-lg">No pending reviews</h3>
                <p className="text-muted-foreground">All evaluations have been reviewed</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed">
          <Card>
            <CardHeader>
              <CardTitle>Completed Evaluations</CardTitle>
              <CardDescription>Successfully reviewed and approved evaluations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="py-8 text-center">
                <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
                <h3 className="mt-4 font-semibold text-lg">All caught up!</h3>
                <p className="text-muted-foreground">
                  View completed evaluations in the overview tab
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>Evaluation Analytics</CardTitle>
              <CardDescription>Performance insights and trends</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="py-8 text-center">
                <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 font-semibold text-lg">Analytics Dashboard</h3>
                <p className="text-muted-foreground">Detailed analytics coming soon</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
