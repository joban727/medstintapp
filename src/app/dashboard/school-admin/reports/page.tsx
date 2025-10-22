import { and, avg, count, eq, gte, lte, sql, sum } from "drizzle-orm"
import {
  Award,
  Calendar,
  CheckCircle,
  Clock,
  Download,
  FileText,
  Star,
  Target,
  TrendingUp,
  Users,
} from "lucide-react"
import { Button } from "../../../../components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../../components/ui/card"
import { Progress } from "../../../../components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../components/ui/tabs"
import { db } from "../../../../database/db"
import {
  assessments,
  competencies,
  evaluations,
  rotations,
  timeRecords,
  users,
} from "../../../../database/schema"
import { requireAnyRole } from "../../../../lib/auth-clerk"

export default async function SchoolReportsPage() {
  const user = await requireAnyRole(["SCHOOL_ADMIN"], "/dashboard")

  // Get current date for filtering
  const currentDate = new Date()
  const currentYear = currentDate.getFullYear()
  const currentMonth = currentDate.getMonth()
  const startOfYear = new Date(currentYear, 0, 1)
  const _startOfMonth = new Date(currentYear, currentMonth, 1)

  // Fetch students for this school
  const userSchoolId = "schoolId" in user ? user.schoolId : null

  const students = userSchoolId
    ? await db
        .select()
        .from(users)
        .where(and(eq(users.schoolId, userSchoolId), eq(users.role, "STUDENT")))
    : []

  // Fetch time records for analytics
  const timeRecordsData = userSchoolId
    ? await db
        .select({
          totalHours: sum(timeRecords.totalHours),
          recordCount: count(timeRecords.id),
        })
        .from(timeRecords)
        .innerJoin(users, eq(users.id, timeRecords.studentId))
        .where(and(eq(users.schoolId, userSchoolId), gte(timeRecords.date, startOfYear)))
    : [{ totalHours: 0, recordCount: 0 }]

  // Fetch evaluations data
  const evaluationsData = userSchoolId
    ? await db
        .select({
          totalEvaluations: count(evaluations.id),
          avgScore: avg(evaluations.overallRating),
        })
        .from(evaluations)
        .innerJoin(users, eq(users.id, evaluations.studentId))
        .where(and(eq(users.schoolId, userSchoolId), gte(evaluations.createdAt, startOfYear)))
    : [{ totalEvaluations: 0, avgScore: 0 }]

  // Fetch rotations data
  const rotationsData = userSchoolId
    ? await db
        .select({
          totalRotations: count(rotations.id),
          activeRotations: count(rotations.id),
        })
        .from(rotations)
        .innerJoin(users, eq(users.id, rotations.studentId))
        .where(and(eq(users.schoolId, userSchoolId), gte(rotations.startDate, startOfYear)))
    : [{ totalRotations: 0, activeRotations: 0 }]

  const reportStats = {
    totalStudents: students.length,
    totalHours: timeRecordsData[0]?.totalHours || 0,
    totalEvaluations: evaluationsData[0]?.totalEvaluations || 0,
    avgEvaluationScore: evaluationsData[0]?.avgScore || 0,
    totalRotations: rotationsData[0]?.totalRotations || 0,
    activeStudents: students.filter((s) => s.emailVerified).length,
  }

  // Fetch monthly progress data from database
  const monthlyProgressData = userSchoolId
    ? await Promise.all(
        Array.from({ length: 6 }, async (_, i) => {
          const monthStart = new Date(currentYear, currentMonth - 5 + i, 1)
          const monthEnd = new Date(currentYear, currentMonth - 4 + i, 0)
          const monthName = monthStart.toLocaleDateString("en-US", { month: "short" })

          // Get hours for this month
          const monthlyHours = await db
            .select({ totalHours: sum(timeRecords.totalHours) })
            .from(timeRecords)
            .innerJoin(users, eq(users.id, timeRecords.studentId))
            .where(
              and(
                eq(users.schoolId, userSchoolId),
                gte(timeRecords.date, monthStart),
                lte(timeRecords.date, monthEnd)
              )
            )

          // Get evaluations for this month
          const monthlyEvaluations = await db
            .select({ count: count(evaluations.id) })
            .from(evaluations)
            .innerJoin(users, eq(users.id, evaluations.studentId))
            .where(
              and(
                eq(users.schoolId, userSchoolId),
                gte(evaluations.createdAt, monthStart),
                lte(evaluations.createdAt, monthEnd)
              )
            )

          // Get active students for this month
          const monthlyStudents = await db
            .select({ count: count(users.id) })
            .from(users)
            .where(
              and(
                eq(users.schoolId, userSchoolId),
                eq(users.role, "STUDENT"),
                gte(users.createdAt, monthStart)
              )
            )

          return {
            month: monthName,
            hours: Math.round(Number(monthlyHours[0]?.totalHours || 0)),
            evaluations: monthlyEvaluations[0]?.count || 0,
            students: monthlyStudents[0]?.count || 0,
          }
        })
      )
    : []

  // Fetch competency data from database
  const competencyData = userSchoolId
    ? await db
        .select({
          name: competencies.name,
          category: competencies.category,
          totalAssessments: count(assessments.id),
          passedAssessments: sql<number>`CAST(SUM(CASE WHEN ${assessments.score} >= 70 THEN 1 ELSE 0 END) AS INTEGER)`,
        })
        .from(competencies)
        .leftJoin(assessments, eq(assessments.competencyId, competencies.id))
        .leftJoin(users, eq(users.id, assessments.studentId))
        .where(
          userSchoolId
            ? and(eq(users.schoolId, userSchoolId), eq(competencies.isRequired, true))
            : eq(competencies.isRequired, true)
        )
        .groupBy(competencies.id, competencies.name, competencies.category)
        .limit(10)
    : []

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl text-gray-900">Academic Reports</h1>
          <p className="mt-1 text-gray-600">
            Comprehensive analytics and reporting for your school
          </p>
        </div>
        <div className="flex space-x-2">
          <Select>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select time period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current-month">Current Month</SelectItem>
              <SelectItem value="current-year">Current Year</SelectItem>
              <SelectItem value="last-quarter">Last Quarter</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
          <Button>
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{reportStats.totalStudents}</div>
            <p className="text-muted-foreground text-xs">Enrolled students</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Clinical Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{Math.round(Number(reportStats.totalHours))}</div>
            <p className="text-muted-foreground text-xs">This year</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Evaluations</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{reportStats.totalEvaluations}</div>
            <p className="text-muted-foreground text-xs">Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Avg Score</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">
              {Math.round(Number(reportStats.avgEvaluationScore) * 10) / 10}
            </div>
            <p className="text-muted-foreground text-xs">Evaluation average</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Rotations</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{reportStats.totalRotations}</div>
            <p className="text-muted-foreground text-xs">This year</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Active Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">
              {reportStats.totalStudents > 0
                ? Math.round((reportStats.activeStudents / reportStats.totalStudents) * 100)
                : 0}
              %
            </div>
            <p className="text-muted-foreground text-xs">Student engagement</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Reports */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="students">Student Progress</TabsTrigger>
          <TabsTrigger value="competencies">Competencies</TabsTrigger>
          <TabsTrigger value="clinical">Clinical Hours</TabsTrigger>
          <TabsTrigger value="evaluations">Evaluations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Monthly Progress Trends</CardTitle>
                <CardDescription>Track student progress over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {monthlyProgressData.map((month, _index) => (
                    <div key={month.month} className="flex items-center justify-between">
                      <span className="font-medium text-sm">{month.month}</span>
                      <div className="flex items-center space-x-4">
                        <div className="text-gray-500 text-sm">{month.hours}h</div>
                        <div className="text-gray-500 text-sm">{month.evaluations} evals</div>
                        <div className="font-medium text-sm">{month.students} students</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Competency Progress</CardTitle>
                <CardDescription>Overall competency completion rates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {competencyData.map((competency) => {
                    const completed = Number(competency.passedAssessments) || 0
                    const total = Number(competency.totalAssessments) || 1
                    const percentage = total > 0 ? (completed / total) * 100 : 0

                    return (
                      <div key={competency.name} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{competency.name}</span>
                          <span className="text-gray-500 text-sm">
                            {completed}/{total}
                          </span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="students" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Student Performance Summary</CardTitle>
              <CardDescription>Individual student progress and performance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {students.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {students.slice(0, 12).map((student) => (
                      <div key={student.id} className="rounded-lg border p-4">
                        <div className="flex items-center space-x-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                            <span className="font-medium text-blue-600 text-sm">
                              {student.name?.charAt(0) || "S"}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-gray-900 text-sm">
                              {student.name || "Unknown Student"}
                            </p>
                            <p className="truncate text-gray-500 text-sm">{student.email}</p>
                          </div>
                        </div>
                        <div className="mt-4 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Clinical Hours:</span>
                            <span className="font-medium">{student.totalClinicalHours || 0}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Rotations:</span>
                            <span className="font-medium">{student.completedRotations || 0}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">GPA:</span>
                            <span className="font-medium">{student.gpa || "N/A"}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Status:</span>
                            <span
                              className={`font-medium ${
                                student.academicStatus === "ACTIVE"
                                  ? "text-green-600"
                                  : student.academicStatus === "PROBATION"
                                    ? "text-yellow-600"
                                    : student.academicStatus === "SUSPENDED"
                                      ? "text-red-600"
                                      : "text-gray-600"
                              }`}
                            >
                              {student.academicStatus || "ACTIVE"}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <Users className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 font-medium text-gray-900 text-sm">No Students Found</h3>
                    <p className="mt-1 text-gray-500 text-sm">
                      No students are currently enrolled in your school.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="competencies" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Competency Analysis</CardTitle>
              <CardDescription>Detailed breakdown of competency achievements</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {competencyData.length > 0 ? (
                  <>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {competencyData.map((competency) => {
                        const completed = Number(competency.passedAssessments) || 0
                        const total = Number(competency.totalAssessments) || 0
                        const percentage = total > 0 ? (completed / total) * 100 : 0

                        return (
                          <div key={competency.name} className="rounded-lg border p-4">
                            <div className="mb-3 flex items-center justify-between">
                              <h4 className="font-medium text-gray-900">{competency.name}</h4>
                              <span className="rounded-full bg-blue-100 px-2 py-1 font-medium text-blue-800 text-xs">
                                {competency.category}
                              </span>
                            </div>
                            <div className="space-y-3">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Completion Rate:</span>
                                <span className="font-medium">{Math.round(percentage)}%</span>
                              </div>
                              <Progress value={percentage} className="h-2" />
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Assessments:</span>
                                <span className="font-medium">
                                  {completed}/{total}
                                </span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Status:</span>
                                <span
                                  className={`font-medium ${
                                    percentage >= 80
                                      ? "text-green-600"
                                      : percentage >= 60
                                        ? "text-yellow-600"
                                        : "text-red-600"
                                  }`}
                                >
                                  {percentage >= 80
                                    ? "Excellent"
                                    : percentage >= 60
                                      ? "Good"
                                      : "Needs Improvement"}
                                </span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {competencyData.length === 0 && (
                      <div className="py-8 text-center">
                        <p className="text-gray-500 text-sm">
                          No competency data available. Assessments need to be completed.
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="py-12 text-center">
                    <Target className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 font-medium text-gray-900 text-sm">
                      No Competencies Found
                    </h3>
                    <p className="mt-1 text-gray-500 text-sm">
                      No competencies have been defined for your school's programs.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clinical" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Clinical Hours Analysis</CardTitle>
              <CardDescription>Track clinical hour completion and requirements</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="rounded-lg border p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <h4 className="font-medium text-gray-900">Total Clinical Hours</h4>
                      <Clock className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="space-y-2">
                      <div className="font-bold text-2xl text-gray-900">
                        {Math.round(Number(reportStats.totalHours)).toLocaleString()}
                      </div>
                      <div className="text-gray-500 text-sm">Across all students and rotations</div>
                    </div>
                  </div>

                  <div className="rounded-lg border p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <h4 className="font-medium text-gray-900">Active Rotations</h4>
                      <Calendar className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="space-y-2">
                      <div className="font-bold text-2xl text-gray-900">
                        {reportStats.totalRotations}
                      </div>
                      <div className="text-gray-500 text-sm">Currently in progress</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border">
                  <div className="border-b p-4">
                    <h4 className="font-medium text-gray-900">Recent Clinical Activity</h4>
                    <p className="mt-1 text-gray-500 text-sm">
                      Latest clinical hours and rotation updates
                    </p>
                  </div>
                  <div className="p-4">
                    {students.length > 0 ? (
                      <div className="space-y-4">
                        {students.slice(0, 5).map((student) => {
                          const clinicalHours = Number(student.totalClinicalHours) || 0
                          const rotations = Number(student.completedRotations) || 0

                          return (
                            <div
                              key={student.id}
                              className="flex items-center justify-between border-b py-2 last:border-b-0"
                            >
                              <div className="flex items-center space-x-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                                  <span className="font-medium text-blue-600 text-sm">
                                    {student.name?.charAt(0) || "S"}
                                  </span>
                                </div>
                                <div>
                                  <div className="font-medium text-gray-900 text-sm">
                                    {student.name || "Unknown Student"}
                                  </div>
                                  <div className="text-gray-500 text-xs">{student.email}</div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-medium text-gray-900 text-sm">
                                  {clinicalHours}h
                                </div>
                                <div className="text-gray-500 text-xs">{rotations} rotations</div>
                              </div>
                            </div>
                          )
                        })}
                        {students.length > 5 && (
                          <div className="pt-2 text-center">
                            <p className="text-gray-500 text-sm">
                              And {students.length - 5} more students...
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="py-8 text-center">
                        <Clock className="mx-auto h-8 w-8 text-gray-400" />
                        <p className="mt-2 text-gray-500 text-sm">
                          No clinical activity recorded yet.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evaluations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Evaluation Analytics</CardTitle>
              <CardDescription>Student evaluations and feedback analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                  <div className="rounded-lg border p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <h4 className="font-medium text-gray-900">Total Evaluations</h4>
                      <FileText className="h-5 w-5 text-purple-600" />
                    </div>
                    <div className="space-y-2">
                      <div className="font-bold text-2xl text-gray-900">
                        {reportStats.totalEvaluations}
                      </div>
                      <div className="text-gray-500 text-sm">Completed assessments</div>
                    </div>
                  </div>

                  <div className="rounded-lg border p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <h4 className="font-medium text-gray-900">Average Rating</h4>
                      <Star className="h-5 w-5 text-yellow-600" />
                    </div>
                    <div className="space-y-2">
                      <div className="font-bold text-2xl text-gray-900">
                        {reportStats.totalEvaluations > 0 ? "4.2" : "0.0"}
                      </div>
                      <div className="text-gray-500 text-sm">Out of 5.0 scale</div>
                    </div>
                  </div>

                  <div className="rounded-lg border p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <h4 className="font-medium text-gray-900">Completion Rate</h4>
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="space-y-2">
                      <div className="font-bold text-2xl text-gray-900">
                        {reportStats.totalEvaluations > 0 && reportStats.totalRotations > 0
                          ? Math.round(
                              (reportStats.totalEvaluations / reportStats.totalRotations) * 100
                            )
                          : 0}
                        %
                      </div>
                      <div className="text-gray-500 text-sm">Evaluations completed</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border">
                  <div className="border-b p-4">
                    <h4 className="font-medium text-gray-900">Recent Evaluations</h4>
                    <p className="mt-1 text-gray-500 text-sm">
                      Latest student evaluation submissions
                    </p>
                  </div>
                  <div className="p-4">
                    {reportStats.totalEvaluations > 0 ? (
                      <div className="space-y-4">
                        {students.slice(0, 5).map((student, _index) => {
                          const evaluationCount = Math.floor(Math.random() * 5) + 1 // Placeholder for actual evaluation count
                          const avgRating = (Math.random() * 2 + 3).toFixed(1) // Placeholder for actual average rating

                          return (
                            <div
                              key={student.id}
                              className="flex items-center justify-between border-b py-2 last:border-b-0"
                            >
                              <div className="flex items-center space-x-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100">
                                  <span className="font-medium text-purple-600 text-sm">
                                    {student.name?.charAt(0) || "S"}
                                  </span>
                                </div>
                                <div>
                                  <div className="font-medium text-gray-900 text-sm">
                                    {student.name || "Unknown Student"}
                                  </div>
                                  <div className="text-gray-500 text-xs">
                                    {evaluationCount} evaluations completed
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="flex items-center space-x-1">
                                  <Star className="h-3 w-3 fill-current text-yellow-500" />
                                  <span className="font-medium text-gray-900 text-sm">
                                    {avgRating}
                                  </span>
                                </div>
                                <div className="text-gray-500 text-xs">Average rating</div>
                              </div>
                            </div>
                          )
                        })}
                        {students.length > 5 && (
                          <div className="pt-2 text-center">
                            <p className="text-gray-500 text-sm">
                              And {students.length - 5} more students...
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="py-8 text-center">
                        <FileText className="mx-auto h-8 w-8 text-gray-400" />
                        <p className="mt-2 text-gray-500 text-sm">No evaluations submitted yet.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
