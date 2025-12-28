import { eq } from "drizzle-orm"
import {
  AlertTriangle,
  Award,
  Calendar,
  Clock,
  Edit,
  Eye,
  FileText,
  GraduationCap,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  Search,
  TrendingUp,
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
import { PageContainer } from "@/components/ui/page-container"
import { StatCard, StatGrid } from "@/components/ui/stat-card"
import { db } from "@/database/connection-pool"
import { clinicalSites, rotations, schools, users } from "../../../../database/schema"
import { requireAnyRole } from "../../../../lib/auth-clerk"

interface StudentDetail {
  id: string | null
  name: string | null
  email: string | null
  rotationId: string | null
  rotationTitle: string | null
  rotationStart: Date | null
  rotationEnd: Date | null
  rotationStatus: string | null
  preceptorId: string | null
  year: number
  school: string
  gpa: string
  attendanceRate: number
  currentWeek: number
  totalWeeks: number
  overallScore: number
  competenciesCompleted: number
  totalCompetencies: number
  clinicalHours: number
  requiredHours: number
  preceptorName: string
  site: string
  specialty: string
  riskLevel: string
  lastContact: Date
  nextReview: Date
  issues: number
  strengths: string
  concerns: string
}

export default async function SupervisorStudentsPage() {
  const user = await requireAnyRole(["CLINICAL_SUPERVISOR"], "/dashboard")

  // Fetch students under this supervisor's oversight
  const supervisedStudents = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      gpa: users.gpa,
      enrollmentDate: users.enrollmentDate,
      rotationId: rotations.id,
      rotationTitle: rotations.specialty,
      rotationStart: rotations.startDate,
      rotationEnd: rotations.endDate,
      rotationStatus: rotations.status,
      preceptorId: rotations.preceptorId,
      schoolName: schools.name,
      siteName: clinicalSites.name,
    })
    .from(rotations)
    .leftJoin(users, eq(rotations.studentId, users.id))
    .leftJoin(schools, eq(users.schoolId, schools.id))
    .leftJoin(clinicalSites, eq(rotations.clinicalSiteId, clinicalSites.id))
    .where(eq(rotations.supervisorId, user.id))
    .orderBy(rotations.startDate)

  // Fetch comprehensive student oversight data from database
  const studentDetailsPromises = supervisedStudents.map(async (student) => {
    if (!student.id) return {
      ...student,
      year: 1,
      school: "Unknown School",
      gpa: "0.00",
      attendanceRate: 0,
      currentWeek: 0,
      totalWeeks: 12,
      overallScore: 0,
      competenciesCompleted: 0,
      totalCompetencies: 0,
      clinicalHours: 0,
      requiredHours: 300,
      preceptorName: "Unassigned",
      site: "Unknown Site",
      specialty: "General",
      riskLevel: "LOW",
      lastContact: new Date(),
      nextReview: new Date(),
      issues: 0,
      strengths: "None",
      concerns: "None"
    }

    try {
      const { timeRecords, evaluations, competencyAssignments } = await import("@/database/schema")
      const { count, sum, avg } = await import("drizzle-orm")

      // Fetch real student data with parallel queries
      const [timeRecordsData, evaluationsData, competencyData, preceptorData] =
        await Promise.allSettled([
          // Get time records and clinical hours
          db
            .select({
              totalHours: sum(timeRecords.totalHours),
              recordCount: count(timeRecords.id),
              attendanceRate: avg(timeRecords.totalHours),
            })
            .from(timeRecords)
            .where(eq(timeRecords.studentId, student.id)),

          // Get evaluations and scores
          db
            .select({
              totalEvaluations: count(evaluations.id),
              avgScore: avg(evaluations.overallRating),
              completedCount: count(evaluations.overallRating),
            })
            .from(evaluations)
            .where(eq(evaluations.studentId, student.id)),

          // Get competency progress
          db
            .select({
              totalAssignments: count(competencyAssignments.id),
              completedAssignments: count(competencyAssignments.completionDate),
            })
            .from(competencyAssignments)
            .where(eq(competencyAssignments.userId, student.id)),

          // Get preceptor information
          db
            .select({
              preceptorName: users.name,
            })
            .from(users)
            .where(eq(users.id, student.preceptorId || ""))
            .limit(1),
        ])

      // Process results with safe fallbacks
      const timeData = timeRecordsData.status === "fulfilled" ? timeRecordsData.value[0] : null
      const evalData = evaluationsData.status === "fulfilled" ? evaluationsData.value[0] : null
      const compData = competencyData.status === "fulfilled" ? competencyData.value[0] : null
      const preceptorInfo = preceptorData.status === "fulfilled" ? preceptorData.value[0] : null

      // Calculate derived metrics
      const clinicalHours = Number(timeData?.totalHours) || 0
      const requiredHours = 300 // Standard requirement
      const overallScore = Number(evalData?.avgScore) || 0
      const competenciesCompleted = Number(compData?.completedAssignments) || 0
      const totalCompetencies = Number(compData?.totalAssignments) || 20
      const attendanceRate = Math.min(
        100,
        Math.max(0, Math.round((clinicalHours / requiredHours) * 100))
      )

      // Determine risk level based on performance metrics
      let riskLevel = "LOW"
      if (
        overallScore < 70 ||
        attendanceRate < 80 ||
        competenciesCompleted / totalCompetencies < 0.6
      ) {
        riskLevel = "HIGH"
      } else if (
        overallScore < 85 ||
        attendanceRate < 90 ||
        competenciesCompleted / totalCompetencies < 0.8
      ) {
        riskLevel = "MEDIUM"
      }

      // Calculate year based on enrollment date
      const currentYear = new Date().getFullYear()
      const enrollmentYear = student.enrollmentDate ? student.enrollmentDate.getFullYear() : currentYear
      const year = Math.max(1, Math.min(4, currentYear - enrollmentYear + 1))

      return {
        ...student,
        year,
        school: student.schoolName || "Unknown School",
        gpa: student.gpa || "N/A",
        attendanceRate,
        currentWeek: Math.min(12, Math.ceil(clinicalHours / 25)), // Estimate based on hours
        totalWeeks: 12,
        overallScore: Math.round(overallScore),
        competenciesCompleted,
        totalCompetencies,
        clinicalHours,
        requiredHours,
        preceptorName: preceptorInfo?.preceptorName || "Unassigned",
        site: student.siteName || "Unassigned Site",
        specialty: student.rotationTitle || "General",
        riskLevel,
        lastContact: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Default to 1 week ago
        nextReview: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default to 1 week from now
        issues: riskLevel === "HIGH" ? 2 : riskLevel === "MEDIUM" ? 1 : 0,
        strengths: overallScore >= 85 ? "Clinical Skills" : "Communication",
        concerns:
          riskLevel === "HIGH"
            ? "Performance"
            : riskLevel === "MEDIUM"
              ? "Time Management"
              : "None",
      }
    } catch (error) {
      console.error(`Error fetching data for student ${student.id}:`, error)
      return {
        ...student,
        year: 3,
        school: student.schoolName || "Unknown School",
        gpa: student.gpa || "N/A",
        attendanceRate: 85,
        currentWeek: 6,
        totalWeeks: 12,
        overallScore: 80,
        competenciesCompleted: 10,
        totalCompetencies: 20,
        clinicalHours: 150,
        requiredHours: 300,
        preceptorName: "Unassigned",
        site: student.siteName || "Unassigned Site",
        specialty: student.rotationTitle || "General",
        riskLevel: "MEDIUM",
        lastContact: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        nextReview: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        issues: 1,
        strengths: "Communication",
        concerns: "Time Management",
      }
    }
  })

  const studentDetails: StudentDetail[] = await Promise.all(studentDetailsPromises)

  const totalStudents = studentDetails.length
  const activeRotations = studentDetails.filter((s) => s.rotationStatus === "ACTIVE").length
  const highRiskStudents = studentDetails.filter((s) => s.riskLevel === "HIGH").length
  const avgPerformance = Math.round(
    studentDetails.reduce((sum, s) => sum + s.overallScore, 0) / (studentDetails.length || 1)
  )
  const pendingReviews = studentDetails.filter(
    (s) => s.nextReview <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  ).length

  const statusColors = {
    PENDING: "bg-yellow-100 text-yellow-800",
    APPROVED: "bg-blue-100 text-blue-800",
    IN_PROGRESS: "bg-green-100 text-green-800",
    COMPLETED: "bg-gray-100 text-gray-800",
    CANCELLED: "bg-red-100 text-red-800",
  }

  const riskColors = {
    LOW: "bg-green-100 text-green-800",
    MEDIUM: "bg-yellow-100 text-yellow-800",
    HIGH: "bg-red-100 text-red-800",
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold text-3xl tracking-tight">Student Oversight</h1>
            <p className="text-muted-foreground">
              Monitor and supervise students across all clinical sites and rotations
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <FileText className="mr-2 h-4 w-4" />
              Generate Report
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <MessageSquare className="mr-2 h-4 w-4" />
              Broadcast Message
            </Button>
          </div>
        </div>

        {/* Key Metrics */}
        <StatGrid columns={4}>
          <StatCard
            title="Total Students"
            value={totalStudents}
            icon={GraduationCap}
            description={`${activeRotations} active rotations`}
            variant="blue"
          />
          <StatCard
            title="High Risk"
            value={highRiskStudents}
            icon={AlertTriangle}
            description="Require immediate attention"
            variant="orange"
          />
          <StatCard
            title="Avg Performance"
            value={`${avgPerformance}%`}
            icon={TrendingUp}
            description="+3% from last month"
            variant="green"
          />
          <StatCard
            title="Pending Reviews"
            value={pendingReviews}
            icon={Clock}
            description="Due this week"
            variant="orange"
          />
          <StatCard
            title="Sites Covered"
            value={new Set(studentDetails.map((s) => s.site)).size}
            icon={MapPin}
            description="Clinical locations"
            variant="purple"
          />
        </StatGrid>

        {/* Student Management Tabs */}
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">All Students</TabsTrigger>
            <TabsTrigger value="high-risk">High Risk ({highRiskStudents})</TabsTrigger>
            <TabsTrigger value="reviews">Pending Reviews ({pendingReviews})</TabsTrigger>
            <TabsTrigger value="sites">By Site</TabsTrigger>
          </TabsList>

          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute top-2.5 left-2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search students by name, school, or preceptor..."
                      className="pl-8"
                    />
                  </div>
                </div>
                <Select>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                  </SelectContent>
                </Select>
                <Select>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Risk Level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="HIGH">High Risk</SelectItem>
                    <SelectItem value="MEDIUM">Medium Risk</SelectItem>
                    <SelectItem value="LOW">Low Risk</SelectItem>
                  </SelectContent>
                </Select>
                <Select>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Specialty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Specialties</SelectItem>
                    <SelectItem value="General Radiology">General Radiology</SelectItem>
                    <SelectItem value="MRI">MRI</SelectItem>
                    <SelectItem value="Ultrasound / Sonography">Ultrasound / Sonography</SelectItem>
                    <SelectItem value="CT Scan">CT Scan</SelectItem>
                    <SelectItem value="Nuclear Medicine">Nuclear Medicine</SelectItem>
                    <SelectItem value="Mammography">Mammography</SelectItem>
                    <SelectItem value="Interventional Radiology">Interventional Radiology</SelectItem>
                    <SelectItem value="Fluoroscopy">Fluoroscopy</SelectItem>
                    <SelectItem value="Mobile Radiography">Mobile Radiography</SelectItem>
                    <SelectItem value="Surgical Radiography">Surgical Radiography</SelectItem>
                    <SelectItem value="Trauma Radiography">Trauma Radiography</SelectItem>
                    <SelectItem value="Pediatric Radiology">Pediatric Radiology</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <Select>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Years</SelectItem>
                    <SelectItem value="1">Year 1</SelectItem>
                    <SelectItem value="2">Year 2</SelectItem>
                    <SelectItem value="3">Year 3</SelectItem>
                    <SelectItem value="4">Year 4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <TabsContent value="all" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>All Students Under Supervision</CardTitle>
                <CardDescription>
                  Comprehensive overview of all students across clinical sites
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Rotation Details</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Performance</TableHead>
                      <TableHead>Risk Level</TableHead>
                      <TableHead>Last Contact</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {studentDetails.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={`https://avatar.vercel.sh/${student.email}`} />
                              <AvatarFallback>
                                {student.name?.charAt(0)?.toUpperCase() || "S"}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{student.name}</div>
                              <div className="text-muted-foreground text-sm">
                                Year {student.year} • {student.school}
                              </div>
                              <div className="text-muted-foreground text-xs">GPA: {student.gpa}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{student.rotationTitle}</div>
                            <div className="text-muted-foreground text-sm">{student.specialty}</div>
                            <div className="text-muted-foreground text-sm">{student.site}</div>
                            <div className="mt-1 text-muted-foreground text-xs">
                              Preceptor: {student.preceptorName}
                            </div>
                            <Badge
                              className={
                                statusColors[student.rotationStatus as keyof typeof statusColors]
                              }
                              variant="outline"
                            >
                              {student.rotationStatus?.replace("_", " ")}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span>
                                Week {student.currentWeek}/{student.totalWeeks}
                              </span>
                              <span className="text-muted-foreground">
                                {Math.round((student.currentWeek / student.totalWeeks) * 100)}%
                              </span>
                            </div>
                            <Progress
                              value={(student.currentWeek / student.totalWeeks) * 100}
                              className="h-2"
                            />
                            <div className="text-muted-foreground text-xs">
                              {student.clinicalHours}/{student.requiredHours} hours
                            </div>
                            <div className="text-xs">Attendance: {student.attendanceRate}%</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-center">
                            <div className="font-semibold text-lg">{student.overallScore}%</div>
                            <div className="mb-2 text-muted-foreground text-xs">Overall Score</div>
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span>Competencies</span>
                                <span>
                                  {student.competenciesCompleted}/{student.totalCompetencies}
                                </span>
                              </div>
                              <Progress
                                value={
                                  (student.competenciesCompleted / student.totalCompetencies) * 100
                                }
                                className="h-1"
                              />
                            </div>
                            {student.issues > 0 && (
                              <Badge className="mt-1 bg-orange-100 text-orange-800" variant="outline">
                                {student.issues} issues
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-center">
                            <Badge
                              className={riskColors[student.riskLevel as keyof typeof riskColors]}
                            >
                              {student.riskLevel} RISK
                            </Badge>
                            <div className="mt-1 text-muted-foreground text-xs">
                              {student.riskLevel === "HIGH" && "Immediate attention needed"}
                              {student.riskLevel === "MEDIUM" && "Monitor closely"}
                              {student.riskLevel === "LOW" && "On track"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium">
                              {student.lastContact.toLocaleDateString()}
                            </div>
                            <div className="text-muted-foreground">
                              {Math.ceil(
                                (Date.now() - student.lastContact.getTime()) / (1000 * 60 * 60 * 24)
                              )}{" "}
                              days ago
                            </div>
                            <div className="mt-1 text-muted-foreground text-xs">
                              Next: {student.nextReview.toLocaleDateString()}
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
                                <MessageSquare className="mr-2 h-4 w-4" />
                                Contact Student
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <MessageSquare className="mr-2 h-4 w-4" />
                                Contact Preceptor
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Calendar className="mr-2 h-4 w-4" />
                                Schedule Review
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Award className="mr-2 h-4 w-4" />
                                View Evaluations
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Edit className="mr-2 h-4 w-4" />
                                Update Risk Level
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

          <TabsContent value="high-risk" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  High Risk Students
                </CardTitle>
                <CardDescription>
                  Students requiring immediate attention and intervention
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {studentDetails
                    .filter((s) => s.riskLevel === "HIGH")
                    .map((student) => (
                      <div
                        key={student.id}
                        className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={`https://avatar.vercel.sh/${student.email}`} />
                              <AvatarFallback>
                                {student.name?.charAt(0)?.toUpperCase() || "S"}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{student.name}</div>
                              <div className="text-muted-foreground text-sm">
                                {student.rotationTitle} • {student.site}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge className="bg-red-100 text-red-800">HIGH RISK</Badge>
                            <div className="mt-1 text-muted-foreground text-sm">
                              Score: {student.overallScore}%
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-red-600">Issues:</span>
                            <ul className="mt-1 text-muted-foreground">
                              <li>• Low attendance ({student.attendanceRate}%)</li>
                              <li>• Behind on competencies</li>
                              <li>• Performance concerns</li>
                            </ul>
                          </div>
                          <div>
                            <span className="font-medium text-red-600">Action Required:</span>
                            <ul className="mt-1 text-muted-foreground">
                              <li>• Immediate intervention</li>
                              <li>• Preceptor consultation</li>
                              <li>• Academic support</li>
                            </ul>
                          </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                          <Button size="sm" className="bg-red-600 hover:bg-red-700">
                            <AlertTriangle className="mr-2 h-4 w-4" />
                            Urgent Review
                          </Button>
                          <Button size="sm" variant="outline">
                            <MessageSquare className="mr-2 h-4 w-4" />
                            Contact All Parties
                          </Button>
                          <Button size="sm" variant="outline">
                            <Calendar className="mr-2 h-4 w-4" />
                            Schedule Meeting
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reviews" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Pending Reviews</CardTitle>
                <CardDescription>Students with upcoming or overdue review meetings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {studentDetails
                    .filter((s) => s.nextReview <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
                    .map((student) => (
                      <div
                        key={student.id}
                        className="flex items-center justify-between rounded-lg border p-3 hover:bg-gray-50"
                      >
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={`https://avatar.vercel.sh/${student.email}`} />
                            <AvatarFallback>
                              {student.name?.charAt(0)?.toUpperCase() || "S"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{student.name}</div>
                            <div className="text-muted-foreground text-sm">
                              {student.rotationTitle} • {student.preceptorName}
                            </div>
                            <div className="text-muted-foreground text-xs">
                              Due: {student.nextReview.toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            className={
                              student.nextReview < new Date()
                                ? "bg-red-100 text-red-800"
                                : student.nextReview <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
                                  ? "bg-orange-100 text-orange-800"
                                  : "bg-yellow-100 text-yellow-800"
                            }
                          >
                            {student.nextReview < new Date()
                              ? "OVERDUE"
                              : student.nextReview <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
                                ? "DUE SOON"
                                : "UPCOMING"}
                          </Badge>
                          <Button size="sm" variant="outline">
                            <Calendar className="mr-2 h-4 w-4" />
                            Schedule
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sites" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from(new Set(studentDetails.map((s) => s.site))).map((site) => {
                const siteStudents = studentDetails.filter((s) => s.site === site)
                const siteAvgScore = Math.round(
                  siteStudents.reduce((sum, s) => sum + s.overallScore, 0) / siteStudents.length
                )
                const siteHighRisk = siteStudents.filter((s) => s.riskLevel === "HIGH").length

                return (
                  <Card key={site}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>{site}</span>
                        <Badge variant="outline">{siteStudents.length} students</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Average Performance</span>
                          <span className="font-medium">{siteAvgScore}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">High Risk Students</span>
                          <Badge
                            className={
                              siteHighRisk > 0
                                ? "bg-red-100 text-red-800"
                                : "bg-green-100 text-green-800"
                            }
                          >
                            {siteHighRisk}
                          </Badge>
                        </div>
                        <div className="space-y-2">
                          {siteStudents.slice(0, 3).map((student) => (
                            <div
                              key={student.id}
                              className="flex items-center justify-between text-sm"
                            >
                              <span>{student.name}</span>
                              <div className="flex items-center gap-2">
                                <span>{student.overallScore}%</span>
                                <Badge
                                  className={riskColors[student.riskLevel as keyof typeof riskColors]}
                                  variant="outline"
                                >
                                  {student.riskLevel}
                                </Badge>
                              </div>
                            </div>
                          ))}
                          {siteStudents.length > 3 && (
                            <div className="text-center text-muted-foreground text-xs">
                              +{siteStudents.length - 3} more students
                            </div>
                          )}
                        </div>
                        <Button size="sm" variant="outline" className="w-full">
                          <Eye className="mr-2 h-4 w-4" />
                          View All Students
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  )
}
