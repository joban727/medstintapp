import { eq } from "drizzle-orm"
import { Award, Download, FileText, Target, TrendingUp, Users } from "lucide-react"
import { Badge } from "../../../../components/ui/badge"
import { Button } from "../../../../components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../../components/ui/card"
import { Progress } from "../../../../components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../components/ui/tabs"
import { db } from "../../../../database/db"
import { evaluations, rotations } from "../../../../database/schema"
import { requireAnyRole } from "../../../../lib/auth-clerk"

export default async function PreceptorReportsPage() {
  const user = await requireAnyRole(["CLINICAL_PRECEPTOR"], "/dashboard")

  // Fetch data for reports
  const preceptorEvaluations = await db
    .select({
      id: evaluations.id,
      score: evaluations.overallRating,
      type: evaluations.type,
      createdAt: evaluations.createdAt,
      studentId: evaluations.studentId,
    })
    .from(evaluations)
    .where(eq(evaluations.evaluatorId, user.id))

  const preceptorRotations = await db
    .select({
      id: rotations.id,
      status: rotations.status,
      startDate: rotations.startDate,
      endDate: rotations.endDate,
    })
    .from(rotations)
    .where(eq(rotations.preceptorId, user.id))

  // Types for reporting data
  interface StudentProgress {
    id: string
    name: string
    currentScore: number
    attendance: number
    competenciesCompleted: number
    totalCompetencies: number
  }

  interface CompetencyBreakdown {
    area: string
    score: number
    total: number
  }

  interface StudentPerformanceData {
    date: string
    avgScore: number
    evaluationCount: number
  }

  interface EvaluationType {
    type: string
    count: number
    percentage: number
  }

  // TODO: Replace with actual API calls for reporting data
  const _studentPerformanceData: StudentPerformanceData[] = [
    { date: '2024-01-01', avgScore: 85, evaluationCount: 12 },
    { date: '2024-01-15', avgScore: 88, evaluationCount: 15 }
  ]

  const competencyBreakdown: CompetencyBreakdown[] = [
    { area: 'Clinical Skills', score: 88, total: 100 },
    { area: 'Patient Care', score: 92, total: 100 },
    { area: 'Communication', score: 85, total: 100 }
  ]

  const _evaluationTypes: EvaluationType[] = [
    { type: 'Clinical', count: 25, percentage: 60 },
    { type: 'Written', count: 15, percentage: 36 },
    { type: 'Practical', count: 2, percentage: 4 }
  ]

  const studentProgress: StudentProgress[] = [
    {
      id: '1',
      name: 'Sarah Johnson',
      currentScore: 88,
      attendance: 95,
      competenciesCompleted: 12,
      totalCompetencies: 15
    },
    {
      id: '2',
      name: 'Mike Chen',
      currentScore: 92,
      attendance: 98,
      competenciesCompleted: 14,
      totalCompetencies: 15
    }
  ]

  const teachingMetrics = {
    totalStudents: studentProgress.length,
    avgScore:
      studentProgress.length > 0
        ? Math.round(
            studentProgress.reduce((sum, s) => sum + s.currentScore, 0) / studentProgress.length
          )
        : 0,
    avgAttendance:
      studentProgress.length > 0
        ? Math.round(
            studentProgress.reduce((sum, s) => sum + s.attendance, 0) / studentProgress.length
          )
        : 0,
    completionRate:
      studentProgress.length > 0
        ? Math.round(
            (studentProgress.reduce(
              (sum, s) => sum + s.competenciesCompleted / s.totalCompetencies,
              0
            ) /
              studentProgress.length) *
              100
          )
        : 0,
    totalEvaluations: preceptorEvaluations.length,
    totalRotations: preceptorRotations.length,
  }

  const _radarData = competencyBreakdown.map((comp) => ({
    competency: comp.area.split(" ")[0], // Shortened for radar chart
    score: comp.score,
    benchmark: 85, // Target benchmark
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">Teaching Reports &amp; Analytics</h1>
          <p className="text-muted-foreground">
            Comprehensive insights into student performance and teaching effectiveness
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <FileText className="mr-2 h-4 w-4" />
            Generate Summary
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Students Taught</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{teachingMetrics.totalStudents}</div>
            <p className="text-muted-foreground text-xs">
              <span className="text-green-600">+2</span> from last rotation
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Avg Performance</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{teachingMetrics.avgScore}%</div>
            <p className="text-muted-foreground text-xs">
              <span className="text-green-600">+5%</span> improvement
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Completion Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{teachingMetrics.completionRate}%</div>
            <p className="text-muted-foreground text-xs">Competency completion</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Evaluations</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{teachingMetrics.totalEvaluations}</div>
            <p className="text-muted-foreground text-xs">Total completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Report Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Student Performance</TabsTrigger>
          <TabsTrigger value="competencies">Competency Analysis</TabsTrigger>
          <TabsTrigger value="trends">Trends &amp; Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Performance Trend */}
            <Card>
              <CardHeader>
                <CardTitle>Student Performance Trend</CardTitle>
                <CardDescription>Average scores and evaluation counts over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex h-[300px] w-full items-center justify-center rounded-lg bg-gray-100">
                  <div className="text-gray-500">Student Performance Chart Placeholder</div>
                </div>
              </CardContent>
            </Card>

            {/* Evaluation Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Evaluation Types Distribution</CardTitle>
                <CardDescription>Breakdown of different evaluation types conducted</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex h-[300px] w-full items-center justify-center rounded-lg bg-gray-100">
                  <div className="text-gray-500">Evaluation Types Chart Placeholder</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Teaching Load</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Active Rotations</span>
                  <Badge className="bg-green-100 text-green-800">
                    {preceptorRotations.filter((r) => r.status === "ACTIVE").length}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Weekly Hours</span>
                  <span className="font-medium">32 hrs</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Avg Students/Week</span>
                  <span className="font-medium">{teachingMetrics.totalStudents}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Student Outcomes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Pass Rate</span>
                  <Badge className="bg-green-100 text-green-800">96%</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Avg Improvement</span>
                  <span className="font-medium text-green-600">+12%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Excellence Rate</span>
                  <span className="font-medium">68%</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Feedback Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Response Rate</span>
                  <Badge className="bg-blue-100 text-blue-800">94%</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Satisfaction</span>
                  <span className="font-medium">4.8/5.0</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Recommendations</span>
                  <span className="font-medium">98%</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Individual Student Performance</CardTitle>
              <CardDescription>Detailed progress tracking for each student</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {studentProgress.map((student, index) => (
                  <div
                    key={`student-${student.name.replace(/\s+/g, "-").toLowerCase()}-${index}`}
                    className="space-y-4 rounded-lg border p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">{student.name}</h3>
                        <p className="text-muted-foreground text-sm">
                          Year {student.year} • {student.rotation}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-2xl">{student.currentScore}%</div>
                        <div className="text-muted-foreground text-sm">Current Score</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <div className="mb-2 font-medium text-sm">Attendance</div>
                        <div className="flex items-center space-x-2">
                          <Progress value={student.attendance} className="flex-1" />
                          <span className="font-medium text-sm">{student.attendance}%</span>
                        </div>
                      </div>
                      <div>
                        <div className="mb-2 font-medium text-sm">Competencies</div>
                        <div className="flex items-center space-x-2">
                          <Progress
                            value={
                              (student.competenciesCompleted / student.totalCompetencies) * 100
                            }
                            className="flex-1"
                          />
                          <span className="font-medium text-sm">
                            {student.competenciesCompleted}/{student.totalCompetencies}
                          </span>
                        </div>
                      </div>
                      <div>
                        <div className="mb-2 font-medium text-sm">Weekly Progress</div>
                        <div className="flex h-[40px] w-full items-center justify-center rounded bg-gray-100">
                          <div className="text-gray-500 text-xs">Progress Chart</div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="mb-2 font-medium text-green-600 text-sm">Strengths</div>
                        <div className="flex flex-wrap gap-1">
                          {(student.strengths || []).map((strength: string, i: number) => (
                            <Badge
                              key={`strength-${strength.replace(/\s+/g, "-").toLowerCase()}-${i}`}
                              className="bg-green-100 text-green-800"
                              variant="outline"
                            >
                              {strength}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="mb-2 font-medium text-orange-600 text-sm">
                          Areas for Improvement
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {(student.improvements || []).map((improvement: string, i: number) => (
                            <Badge
                              key={`improvement-${improvement.replace(/\s+/g, "-").toLowerCase()}-${i}`}
                              className="bg-orange-100 text-orange-800"
                              variant="outline"
                            >
                              {improvement}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="competencies" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Competency Radar Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Competency Performance Radar</CardTitle>
                <CardDescription>Overall competency scores vs. benchmarks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex h-[300px] w-full items-center justify-center rounded-lg bg-gray-100">
                  <div className="text-gray-500">Competency Radar Chart Placeholder</div>
                </div>
              </CardContent>
            </Card>

            {/* Competency Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Competency Area Breakdown</CardTitle>
                <CardDescription>Detailed analysis by competency area</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex h-[300px] w-full items-center justify-center rounded-lg bg-gray-100">
                  <div className="text-gray-500">Competency Breakdown Chart Placeholder</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Competency Table */}
          <Card>
            <CardHeader>
              <CardTitle>Competency Details</CardTitle>
              <CardDescription>Comprehensive breakdown of each competency area</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {competencyBreakdown.map((comp) => (
                  <div key={comp.area} className="rounded-lg border p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="font-medium">{comp.area}</h3>
                      <div className="flex items-center gap-2">
                        <Badge
                          className={
                            comp.score >= 90
                              ? "bg-green-100 text-green-800"
                              : comp.score >= 80
                                ? "bg-blue-100 text-blue-800"
                                : comp.score >= 70
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-red-100 text-red-800"
                          }
                        >
                          {comp.score}%
                        </Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Students Evaluated:</span> {comp.students}
                      </div>
                      <div>
                        <span className="font-medium">Improvement Needed:</span> {comp.improvement}%
                      </div>
                      <div>
                        <span className="font-medium">Benchmark:</span> 85%
                      </div>
                    </div>
                    <Progress value={comp.score} className="mt-3" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Performance Trends</CardTitle>
                <CardDescription>Key insights and patterns in student performance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-green-500 border-l-4 pl-4">
                  <h4 className="font-medium text-green-700">Positive Trends</h4>
                  <ul className="mt-2 space-y-1 text-muted-foreground text-sm">
                    <li>• 15% improvement in clinical skills over 6 months</li>
                    <li>• 98% attendance rate maintained</li>
                    <li>• Communication scores trending upward</li>
                    <li>• Faster competency completion rates</li>
                  </ul>
                </div>
                <div className="border-orange-500 border-l-4 pl-4">
                  <h4 className="font-medium text-orange-700">Areas for Focus</h4>
                  <ul className="mt-2 space-y-1 text-muted-foreground text-sm">
                    <li>• Medical knowledge scores need attention</li>
                    <li>• Documentation skills require improvement</li>
                    <li>• Time management challenges persist</li>
                    <li>• Differential diagnosis accuracy</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Teaching Effectiveness</CardTitle>
                <CardDescription>
                  Metrics on your teaching impact and student feedback
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Student Satisfaction</span>
                    <div className="flex items-center gap-2">
                      <Progress value={96} className="w-20" />
                      <span className="font-medium text-sm">4.8/5.0</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Knowledge Transfer</span>
                    <div className="flex items-center gap-2">
                      <Progress value={88} className="w-20" />
                      <span className="font-medium text-sm">88%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Mentorship Quality</span>
                    <div className="flex items-center gap-2">
                      <Progress value={94} className="w-20" />
                      <span className="font-medium text-sm">94%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Recommendation Rate</span>
                    <div className="flex items-center gap-2">
                      <Progress value={98} className="w-20" />
                      <span className="font-medium text-sm">98%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Action Items */}
          <Card>
            <CardHeader>
              <CardTitle>Recommended Actions</CardTitle>
              <CardDescription>
                Data-driven suggestions to improve teaching effectiveness
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <h4 className="font-medium">Immediate Actions</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="h-2 w-2 rounded-full bg-red-500" />
                      <span>Schedule additional medical knowledge sessions</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="h-2 w-2 rounded-full bg-orange-500" />
                      <span>Implement documentation workshops</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="h-2 w-2 rounded-full bg-yellow-500" />
                      <span>Review time management strategies</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <h4 className="font-medium">Long-term Improvements</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                      <span>Develop case-based learning modules</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      <span>Create competency tracking system</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="h-2 w-2 rounded-full bg-purple-500" />
                      <span>Enhance feedback mechanisms</span>
                    </div>
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
