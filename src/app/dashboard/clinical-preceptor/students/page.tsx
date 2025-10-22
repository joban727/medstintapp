import { eq } from "drizzle-orm"
import {
  Award,
  Calendar,
  Clock,
  Edit,
  Eye,
  GraduationCap,
  MessageSquare,
  MoreHorizontal,
  Search,
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
import { db } from "../../../../database/db"
import { rotations, users } from "../../../../database/schema"
import { requireAnyRole } from "../../../../lib/auth-clerk"

export default async function PreceptorStudentsPage() {
  const user = await requireAnyRole(["CLINICAL_PRECEPTOR"], "/dashboard")

  // Fetch students assigned to this preceptor
  const assignedStudents = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      rotationId: rotations.id,
      rotationTitle: rotations.specialty,
      rotationStart: rotations.startDate,
      rotationEnd: rotations.endDate,
      rotationStatus: rotations.status,
    })
    .from(rotations)
    .leftJoin(users, eq(rotations.studentId, users.id))
    .where(eq(rotations.preceptorId, user.id))
    .orderBy(rotations.startDate)

  // Mock additional data for comprehensive student management
  const studentDetails = assignedStudents.map((student) => ({
    ...student,
    year: Math.floor(Math.random() * 4) + 1, // Year 1-4
    gpa: (Math.random() * 1.5 + 2.5).toFixed(2), // 2.5-4.0
    attendanceRate: Math.floor(Math.random() * 20) + 80, // 80-100%
    currentWeek: Math.floor(Math.random() * 12) + 1, // Week 1-12
    totalWeeks: 12,
    lastEvaluation: Math.floor(Math.random() * 30) + 70, // 70-100
    competenciesCompleted: Math.floor(Math.random() * 15) + 5, // 5-20
    totalCompetencies: 20,
    clinicalHours: Math.floor(Math.random() * 200) + 100, // 100-300
    requiredHours: 300,
    strengths: [
      "Patient Communication",
      "Clinical Reasoning",
      "Procedural Skills",
      "Professionalism",
    ][Math.floor(Math.random() * 4)],
    areasForImprovement: [
      "Time Management",
      "Documentation",
      "Differential Diagnosis",
      "Patient Presentation",
    ][Math.floor(Math.random() * 4)],
    nextMeeting: new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000), // Next 7 days
  }))

  const activeStudents = studentDetails.filter((s) => s.rotationStatus === "ACTIVE").length
  const totalHours = studentDetails.reduce((sum, s) => sum + s.clinicalHours, 0)
  const avgAttendance = Math.round(
    studentDetails.reduce((sum, s) => sum + s.attendanceRate, 0) / (studentDetails.length || 1)
  )
  const avgEvaluation = Math.round(
    studentDetails.reduce((sum, s) => sum + s.lastEvaluation, 0) / (studentDetails.length || 1)
  )

  const statusColors = {
    PENDING: "bg-yellow-100 text-yellow-800",
    APPROVED: "bg-blue-100 text-blue-800",
    IN_PROGRESS: "bg-green-100 text-green-800",
    COMPLETED: "bg-gray-100 text-gray-800",
    CANCELLED: "bg-red-100 text-red-800",
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">My Students</h1>
          <p className="text-muted-foreground">
            Monitor and guide your assigned students through their clinical rotations
          </p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700">
          <MessageSquare className="mr-2 h-4 w-4" />
          Send Group Message
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Total Students</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{studentDetails.length}</div>
            <p className="text-muted-foreground text-xs">
              <span className="text-green-600">{activeStudents}</span> currently active
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Clinical Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{totalHours}</div>
            <p className="text-muted-foreground text-xs">Total supervised hours</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Avg Attendance</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{avgAttendance}%</div>
            <p className="text-muted-foreground text-xs">
              <span className="text-green-600">+2%</span> from last rotation
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Avg Performance</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{avgEvaluation}%</div>
            <p className="text-muted-foreground text-xs">Latest evaluation scores</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Search &amp; Filter Students</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute top-2.5 left-2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search students by name or email..." className="pl-8" />
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
            <Select>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Performance" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Performance</SelectItem>
                <SelectItem value="excellent">Excellent (90%+)</SelectItem>
                <SelectItem value="good">Good (80-89%)</SelectItem>
                <SelectItem value="needs-improvement">Needs Improvement</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Students Table */}
      <Card>
        <CardHeader>
          <CardTitle>Student Progress Overview</CardTitle>
          <CardDescription>
            Track your students' progress, performance, and development
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Rotation Progress</TableHead>
                <TableHead>Attendance</TableHead>
                <TableHead>Competencies</TableHead>
                <TableHead>Performance</TableHead>
                <TableHead>Next Meeting</TableHead>
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
                          Year {student.year} • GPA: {student.gpa}
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
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-center">
                      <div className="font-semibold text-lg">{student.attendanceRate}%</div>
                      <Badge
                        className={
                          student.attendanceRate >= 95
                            ? "bg-green-100 text-green-800"
                            : student.attendanceRate >= 85
                              ? "bg-blue-100 text-blue-800"
                              : "bg-yellow-100 text-yellow-800"
                        }
                      >
                        {student.attendanceRate >= 95
                          ? "Excellent"
                          : student.attendanceRate >= 85
                            ? "Good"
                            : "Needs Attention"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>
                          {student.competenciesCompleted}/{student.totalCompetencies}
                        </span>
                        <span className="text-muted-foreground">
                          {Math.round(
                            (student.competenciesCompleted / student.totalCompetencies) * 100
                          )}
                          %
                        </span>
                      </div>
                      <Progress
                        value={(student.competenciesCompleted / student.totalCompetencies) * 100}
                        className="h-2"
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-center">
                      <div className="font-semibold text-lg">{student.lastEvaluation}%</div>
                      <div className="mb-1 text-muted-foreground text-xs">Latest Score</div>
                      <div className="text-xs">
                        <div className="text-green-600">✓ {student.strengths}</div>
                        <div className="text-orange-600">⚠ {student.areasForImprovement}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div className="font-medium">{student.nextMeeting.toLocaleDateString()}</div>
                      <div className="text-muted-foreground">
                        {student.nextMeeting.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
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
                          View Profile
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Award className="mr-2 h-4 w-4" />
                          Create Evaluation
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <MessageSquare className="mr-2 h-4 w-4" />
                          Send Message
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Calendar className="mr-2 h-4 w-4" />
                          Schedule Meeting
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Edit className="mr-2 h-4 w-4" />
                          Update Progress
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

      {/* Quick Actions and Insights */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start">
              <Award className="mr-2 h-4 w-4" />
              Batch Evaluations
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <Calendar className="mr-2 h-4 w-4" />
              Schedule Group Meeting
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <MessageSquare className="mr-2 h-4 w-4" />
              Send Announcements
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Performance Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Excellent (90%+)</span>
                <Badge className="bg-green-100 text-green-800">
                  {studentDetails.filter((s) => s.lastEvaluation >= 90).length}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Good (80-89%)</span>
                <Badge className="bg-blue-100 text-blue-800">
                  {
                    studentDetails.filter((s) => s.lastEvaluation >= 80 && s.lastEvaluation < 90)
                      .length
                  }
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Needs Support</span>
                <Badge className="bg-yellow-100 text-yellow-800">
                  {studentDetails.filter((s) => s.lastEvaluation < 80).length}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Upcoming Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 rounded-full bg-red-500" />
                <span>3 evaluations due this week</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 rounded-full bg-orange-500" />
                <span>2 student meetings scheduled</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                <span>1 rotation ending soon</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span>5 competencies to review</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
