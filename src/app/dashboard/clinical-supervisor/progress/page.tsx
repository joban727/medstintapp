import { and, avg, count, eq, gte, sum } from "drizzle-orm"
import {
  Award,
  BarChart3,
  Clock,
  Filter,
  Search,
  Target,
  TrendingDown,
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
import { evaluations, timeRecords, users } from "../../../../database/schema"
import { requireAnyRole } from "../../../../lib/auth-clerk"

export default async function StudentProgressPage() {
  const user = await requireAnyRole(["CLINICAL_SUPERVISOR"], "/dashboard")

  // Get current date for filtering
  const currentDate = new Date()
  const thirtyDaysAgo = new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000)

  // Fetch students under supervision (same school)
  const userSchoolId = "schoolId" in user ? user.schoolId : null

  const students = userSchoolId
    ? await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          image: users.image,
          createdAt: users.createdAt,
          programId: users.programId,
        })
        .from(users)
        .where(and(eq(users.schoolId, userSchoolId), eq(users.role, "STUDENT")))
    : []

  // Fetch progress data for each student
  const progressData = await Promise.all(
    students.map(async (student) => {
      // Get time records
      const timeData = await db
        .select({
          totalHours: sum(timeRecords.totalHours),
          recordCount: count(timeRecords.id),
        })
        .from(timeRecords)
        .where(eq(timeRecords.studentId, student.id))

      // Get evaluations
      const evalData = await db
        .select({
          totalEvaluations: count(evaluations.id),
          avgScore: avg(evaluations.overallRating),
        })
        .from(evaluations)
        .where(eq(evaluations.studentId, student.id))

      // Get recent activity (last 30 days)
      const recentActivity = await db
        .select({
          recentHours: sum(timeRecords.totalHours),
        })
        .from(timeRecords)
        .where(and(eq(timeRecords.studentId, student.id), gte(timeRecords.date, thirtyDaysAgo)))

      return {
        ...student,
        totalHours: timeData[0]?.totalHours || 0,
        recordCount: timeData[0]?.recordCount || 0,
        totalEvaluations: evalData[0]?.totalEvaluations || 0,
        avgScore: evalData[0]?.avgScore || 0,
        recentHours: recentActivity[0]?.recentHours || 0,
        progressPercentage: Math.min(((Number(timeData[0]?.totalHours) || 0) / 200) * 100, 100), // Assuming 200 hours requirement
      }
    })
  )

  const overallStats = {
    totalStudents: students.length,
    activeStudents: progressData.filter((s) => Number(s.recentHours) > 0).length,
    avgProgress:
      progressData.length > 0
        ? progressData.reduce((sum, s) => sum + s.progressPercentage, 0) / progressData.length
        : 0,
    totalHours: progressData.reduce((sum, s) => sum + Number(s.totalHours), 0),
    avgEvalScore:
      progressData.length > 0
        ? progressData.reduce((sum, s) => sum + Number(s.avgScore), 0) / progressData.length
        : 0,
  }

  // Mock competency data for demonstration
  const competencyAreas = [
    { name: "Clinical Skills", avgProgress: 85, studentsCompleted: 12, totalStudents: 15 },
    { name: "Patient Care", avgProgress: 92, studentsCompleted: 14, totalStudents: 15 },
    { name: "Communication", avgProgress: 78, studentsCompleted: 10, totalStudents: 15 },
    { name: "Professionalism", avgProgress: 95, studentsCompleted: 15, totalStudents: 15 },
    { name: "Critical Thinking", avgProgress: 82, studentsCompleted: 11, totalStudents: 15 },
  ]

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl text-gray-900">Student Progress Tracking</h1>
          <p className="mt-1 text-gray-600">
            Monitor and analyze student performance and development
          </p>
        </div>
        <div className="flex space-x-2">
          <Select>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select time period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current-month">Current Month</SelectItem>
              <SelectItem value="current-semester">Current Semester</SelectItem>
              <SelectItem value="academic-year">Academic Year</SelectItem>
            </SelectContent>
          </Select>
          <Button>
            <BarChart3 className="mr-2 h-4 w-4" />
            Generate Report
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{overallStats.totalStudents}</div>
            <p className="text-muted-foreground text-xs">Under supervision</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Active Students</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{overallStats.activeStudents}</div>
            <p className="text-muted-foreground text-xs">Active last 30 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Avg Progress</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{Math.round(overallStats.avgProgress)}%</div>
            <p className="text-muted-foreground text-xs">Overall completion</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Total Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{Math.round(overallStats.totalHours)}</div>
            <p className="text-muted-foreground text-xs">Clinical hours logged</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Avg Score</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">
              {Math.round(overallStats.avgEvalScore * 10) / 10}
            </div>
            <p className="text-muted-foreground text-xs">Evaluation average</p>
          </CardContent>
        </Card>
      </div>

      {/* Progress Tracking Tabs */}
      <Tabs defaultValue="students" className="space-y-6">
        <TabsList>
          <TabsTrigger value="students">Individual Progress</TabsTrigger>
          <TabsTrigger value="competencies">Competency Overview</TabsTrigger>
          <TabsTrigger value="analytics">Performance Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="students" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Student Progress Overview</CardTitle>
              <CardDescription>
                Track individual student progress and performance metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Search and Filter */}
              <div className="mb-6 flex items-center space-x-4">
                <div className="relative flex-1">
                  <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 transform text-gray-400" />
                  <Input placeholder="Search students..." className="pl-10" />
                </div>
                <Select>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by progress" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Students</SelectItem>
                    <SelectItem value="on-track">On Track</SelectItem>
                    <SelectItem value="behind">Behind Schedule</SelectItem>
                    <SelectItem value="ahead">Ahead of Schedule</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline">
                  <Filter className="mr-2 h-4 w-4" />
                  More Filters
                </Button>
              </div>

              {/* Students Progress Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Clinical Hours</TableHead>
                    <TableHead>Evaluations</TableHead>
                    <TableHead>Recent Activity</TableHead>
                    <TableHead>Performance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {progressData.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={student.image || ""} />
                            <AvatarFallback>
                              {student.name
                                ?.split(" ")
                                .map((n) => n[0])
                                .join("") || "U"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{student.name}</div>
                            <div className="text-gray-500 text-sm">{student.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">
                              {Math.round(student.progressPercentage)}%
                            </span>
                            <span className="text-gray-500 text-xs">
                              {Math.round(Number(student.totalHours))}/200h
                            </span>
                          </div>
                          <Progress value={student.progressPercentage} className="h-2" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Clock className="mr-1 h-4 w-4 text-gray-400" />
                          <span className="font-medium">
                            {Math.round(Number(student.totalHours))}h
                          </span>
                        </div>
                        <div className="text-gray-500 text-xs">{student.recordCount} records</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Award className="mr-1 h-4 w-4 text-gray-400" />
                          <span className="font-medium">{student.totalEvaluations}</span>
                        </div>
                        <div className="text-gray-500 text-xs">
                          Avg: {Math.round(Number(student.avgScore) * 10) / 10}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          {Number(student.recentHours) > 0 ? (
                            <TrendingUp className="mr-1 h-4 w-4 text-green-500" />
                          ) : (
                            <TrendingDown className="mr-1 h-4 w-4 text-red-500" />
                          )}
                          <span className="text-sm">
                            {Math.round(Number(student.recentHours))}h
                          </span>
                        </div>
                        <div className="text-gray-500 text-xs">Last 30 days</div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            student.progressPercentage >= 80
                              ? "default"
                              : student.progressPercentage >= 60
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {student.progressPercentage >= 80
                            ? "Excellent"
                            : student.progressPercentage >= 60
                              ? "Good"
                              : "Needs Attention"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="competencies" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Competency Progress Overview</CardTitle>
              <CardDescription>Track competency development across all students</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {competencyAreas.map((competency) => (
                  <div key={competency.name} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{competency.name}</h4>
                        <p className="text-gray-500 text-sm">
                          {competency.studentsCompleted} of {competency.totalStudents} students
                          completed
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-2xl">{competency.avgProgress}%</div>
                        <div className="text-gray-500 text-xs">Average progress</div>
                      </div>
                    </div>
                    <Progress value={competency.avgProgress} className="h-3" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Performance Analytics</CardTitle>
              <CardDescription>
                Detailed analytics and trends for student performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="py-12 text-center">
                <BarChart3 className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 font-medium text-gray-900 text-sm">Analytics Dashboard</h3>
                <p className="mt-1 text-gray-500 text-sm">
                  Detailed performance analytics and trend charts will be displayed here.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
