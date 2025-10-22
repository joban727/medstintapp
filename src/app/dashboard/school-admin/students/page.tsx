import { count, eq, sql } from "drizzle-orm"
import {
  Award,
  Calendar,
  Clock,
  Edit,
  Eye,
  GraduationCap,
  MoreHorizontal,
  Search,
  TrendingUp,
  UserPlus,
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
import { evaluations, rotations, users } from "../../../../database/schema"
import { requireAnyRole } from "../../../../lib/auth-clerk"

export default async function SchoolStudentsPage() {
  const user = await requireAnyRole(["SCHOOL_ADMIN"], "/dashboard")

  // Fetch students for this school
  const userSchoolId = "schoolId" in user ? user.schoolId : null

  // Optimized query: Fetch students with aggregated data in fewer queries
  const currentDate = new Date()

  const studentProgress = userSchoolId
    ? await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          emailVerified: users.emailVerified,
          isActive: users.isActive,
          createdAt: users.createdAt,
          programId: users.programId,
          academicStatus: users.academicStatus,
          completedRotations: users.completedRotations,
          totalRotations: count(rotations.id),
          averageScore: sql<number>`COALESCE(ROUND(AVG(${evaluations.overallRating})), 0)`,
          currentRotationName: sql<string>`
            CASE 
              WHEN EXISTS(
                SELECT 1 FROM ${rotations} r2 
                WHERE r2.student_id = ${users.id} 
                AND r2.start_date <= ${currentDate} 
                AND r2.end_date >= ${currentDate}
              ) THEN (
                SELECT r3.specialty 
                FROM ${rotations} r3 
                WHERE r3.student_id = ${users.id} 
                AND r3.start_date <= ${currentDate} 
                AND r3.end_date >= ${currentDate} 
                LIMIT 1
              )
              ELSE NULL
            END
          `,
        })
        .from(users)
        .leftJoin(rotations, eq(users.id, rotations.studentId))
        .leftJoin(evaluations, eq(users.id, evaluations.studentId))
        .where(eq(users.schoolId, userSchoolId))
        .groupBy(users.id)
        .orderBy(users.createdAt)
        .then((results) =>
          results.map((student) => ({
            ...student,
            completedRotations: student.completedRotations || 0,
            totalRotations: student.totalRotations || 0,
            averageScore: student.averageScore || 0,
            currentRotation: student.currentRotationName,
            status:
              student.academicStatus === "ACTIVE" && student.isActive
                ? "Active"
                : student.academicStatus === "GRADUATED"
                  ? "Graduated"
                  : student.academicStatus === "SUSPENDED"
                    ? "Suspended"
                    : "Inactive",
          }))
        )
    : []

  const activeStudents = studentProgress.filter((s) => s.status === "Active").length
  const totalRotations = studentProgress.reduce((sum, s) => sum + s.completedRotations, 0)
  const avgScore = Math.round(
    studentProgress.reduce((sum, s) => sum + s.averageScore, 0) / studentProgress.length
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">Student Management</h1>
          <p className="text-muted-foreground">
            Manage students, track progress, and monitor performance
          </p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700">
          <UserPlus className="mr-2 h-4 w-4" />
          Add Student
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
            <div className="font-bold text-2xl">{studentProgress.length}</div>
            <p className="text-muted-foreground text-xs">
              <span className="text-green-600">+{Math.floor(studentProgress.length * 0.1)}</span>{" "}
              this semester
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Active Students</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{activeStudents}</div>
            <p className="text-muted-foreground text-xs">
              {Math.round((activeStudents / studentProgress.length) * 100)}% of total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Completed Rotations</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{totalRotations}</div>
            <p className="text-muted-foreground text-xs">Across all students</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Average Score</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{avgScore}%</div>
            <p className="text-muted-foreground text-xs">
              <span className="text-green-600">+2.5%</span> from last term
            </p>
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
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="graduated">Graduated</SelectItem>
              </SelectContent>
            </Select>
            <Select>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Current Rotation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Rotations</SelectItem>
                <SelectItem value="internal-medicine">Internal Medicine</SelectItem>
                <SelectItem value="surgery">Surgery</SelectItem>
                <SelectItem value="pediatrics">Pediatrics</SelectItem>
                <SelectItem value="emergency">Emergency Medicine</SelectItem>
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

      {/* Students Table */}
      <Card>
        <CardHeader>
          <CardTitle>Students</CardTitle>
          <CardDescription>Overview of all students and their academic progress</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Current Rotation</TableHead>
                <TableHead>Average Score</TableHead>
                <TableHead>Enrolled</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {studentProgress.map((student) => (
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
                        <div className="text-muted-foreground text-sm">{student.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        student.status === "Active"
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }
                    >
                      {student.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>
                          {student.completedRotations}/{student.totalRotations} rotations
                        </span>
                        <span className="text-muted-foreground">
                          {Math.round((student.completedRotations / student.totalRotations) * 100)}%
                        </span>
                      </div>
                      <Progress
                        value={(student.completedRotations / student.totalRotations) * 100}
                        className="h-2"
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    {student.currentRotation ? (
                      <Badge variant="outline">{student.currentRotation}</Badge>
                    ) : (
                      <span className="text-muted-foreground">No active rotation</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">{student.averageScore}%</span>
                      <Badge
                        className={
                          student.averageScore >= 90
                            ? "bg-green-100 text-green-800"
                            : student.averageScore >= 80
                              ? "bg-blue-100 text-blue-800"
                              : "bg-yellow-100 text-yellow-800"
                        }
                      >
                        {student.averageScore >= 90
                          ? "Excellent"
                          : student.averageScore >= 80
                            ? "Good"
                            : "Needs Improvement"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>{new Date(student.createdAt).toLocaleDateString()}</TableCell>
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
                          <Edit className="mr-2 h-4 w-4" />
                          Edit Student
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Calendar className="mr-2 h-4 w-4" />
                          View Rotations
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <a href={`/dashboard/school-admin/time-records?search=${student.email}`}>
                            <div className="flex items-center">
                              <Clock className="mr-2 h-4 w-4" />
                              View Time Records
                            </div>
                          </a>
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Award className="mr-2 h-4 w-4" />
                          View Evaluations
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

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Bulk Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start">
              <UserPlus className="mr-2 h-4 w-4" />
              Import Students
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <Calendar className="mr-2 h-4 w-4" />
              Assign Rotations
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <Award className="mr-2 h-4 w-4" />
              Generate Reports
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Performance Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Excellent (90%+)</span>
                <Badge className="bg-green-100 text-green-800">
                  {studentProgress.filter((s) => s.averageScore >= 90).length}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Good (80-89%)</span>
                <Badge className="bg-blue-100 text-blue-800">
                  {
                    studentProgress.filter((s) => s.averageScore >= 80 && s.averageScore < 90)
                      .length
                  }
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Needs Improvement</span>
                <Badge className="bg-yellow-100 text-yellow-800">
                  {studentProgress.filter((s) => s.averageScore < 80).length}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span>5 students completed rotations</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                <span>3 new evaluations submitted</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 rounded-full bg-orange-500" />
                <span>2 students need attention</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
