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
import Link from "next/link"
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
import { db } from "@/database/connection-pool"
import { cohorts, evaluations, rotations, users } from "../../../../database/schema"
import { requireAnyRole } from "../../../../lib/auth-clerk"
import { PageContainer, PageHeader } from "@/components/ui/page-container"
import { StatCard, StatGrid } from "@/components/ui/stat-card"
import {
  ResponsiveTableWrapper,
  MobileDataCard,
  MobileDataField,
} from "@/components/ui/responsive-table"
import { cn } from "@/lib/utils"
import { DashboardCard } from "@/components/dashboard/shared/dashboard-card"

export const dynamic = "force-dynamic"

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
          cohortId: users.cohortId,
          cohortName: cohorts.name,
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
        .leftJoin(cohorts, eq(users.cohortId, cohorts.id))
        .where(eq(users.schoolId, userSchoolId))
        .groupBy(users.id, cohorts.name)
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

  // Extract unique cohorts for filter
  const uniqueCohorts = Array.from(
    new Set(studentProgress.map((s) => s.cohortName).filter(Boolean))
  ).sort()

  const activeStudents = studentProgress.filter((s) => s.status === "Active").length
  const totalRotations = studentProgress.reduce((sum, s) => sum + s.completedRotations, 0)
  const avgScore = Math.round(
    studentProgress.reduce((sum, s) => sum + s.averageScore, 0) / (studentProgress.length || 1)
  )

  return (
    <PageContainer>
      <PageHeader
        title="Student Management"
        description="Manage students, track progress, and monitor performance"
      >
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          Add Student
        </Button>
      </PageHeader>

      {/* Stats Cards - Inline since Server Component cannot pass icon functions to Client Components */}
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 stagger-children">
        <DashboardCard
          title="Total Students"
          icon={
            <div className="icon-container icon-container-blue">
              <GraduationCap className="h-4 w-4" />
            </div>
          }
          variant="glass"
          className="card-hover-lift spotlight-card border-l-4 border-l-primary"
        >
          <div className="font-bold text-2xl animate-stat-value">{studentProgress.length}</div>
          <p className="text-muted-foreground text-xs">
            +{Math.floor(studentProgress.length * 0.1)} this semester
          </p>
        </DashboardCard>
        <DashboardCard
          title="Active Students"
          icon={
            <div className="icon-container icon-container-green">
              <TrendingUp className="h-4 w-4" />
            </div>
          }
          variant="glass"
          className="card-hover-lift spotlight-card border-l-4 border-l-success"
        >
          <div className="font-bold text-2xl animate-stat-value">{activeStudents}</div>
          <p className="text-muted-foreground text-xs">
            {studentProgress.length > 0
              ? Math.round((activeStudents / studentProgress.length) * 100)
              : 0}
            % of total
          </p>
        </DashboardCard>
        <DashboardCard
          title="Completed Rotations"
          icon={
            <div className="icon-container icon-container-purple">
              <Calendar className="h-4 w-4" />
            </div>
          }
          variant="glass"
          className="card-hover-lift spotlight-card border-l-4 border-l-medical-teal"
        >
          <div className="font-bold text-2xl animate-stat-value">{totalRotations}</div>
          <p className="text-muted-foreground text-xs">Across all students</p>
        </DashboardCard>
        <DashboardCard
          title="Average Score"
          icon={
            <div className="icon-container icon-container-orange">
              <Award className="h-4 w-4" />
            </div>
          }
          variant="glass"
          className="card-hover-lift spotlight-card border-l-4 border-l-warning"
        >
          <div className="font-bold text-2xl animate-stat-value">{avgScore}%</div>
          <p className="text-muted-foreground text-xs">+2.5% from last term</p>
        </DashboardCard>
      </div>

      {/* Filters */}
      <Card className="bg-white/5 backdrop-blur-sm border border-white/10">
        <CardHeader>
          <CardTitle>Search &amp; Filter Students</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute top-2.5 left-2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search students by name or email..."
                  className="pl-8 bg-background/50"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pb-2 md:pb-0">
              <Select>
                <SelectTrigger className="w-full sm:w-[150px] bg-background/50 min-h-[44px]">
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
                <SelectTrigger className="w-full sm:w-[180px] bg-background/50 min-h-[44px]">
                  <SelectValue placeholder="Current Rotation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Rotations</SelectItem>
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
                <SelectTrigger className="w-full sm:w-[150px] bg-background/50 min-h-[44px]">
                  <SelectValue placeholder="Cohort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cohorts</SelectItem>
                  {uniqueCohorts.map((cohort) => (
                    <SelectItem key={cohort} value={cohort || "unknown"}>
                      {cohort}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Students Table */}
      <Card className="bg-white/5 backdrop-blur-md border border-white/10 shadow-sm overflow-hidden">
        <CardHeader>
          <CardTitle>Students</CardTitle>
          <CardDescription>Overview of all students and their academic progress</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {/* Mobile Card View */}
          <div className="block md:hidden p-4 space-y-3">
            {studentProgress.map((student) => (
              <MobileDataCard key={`mobile-${student.id}`}>
                <div className="flex items-center gap-3 pb-2 border-b border-border/30">
                  <Avatar className="h-10 w-10 ring-2 ring-background">
                    <AvatarImage src={`https://avatar.vercel.sh/${student.email}`} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {student.name?.charAt(0)?.toUpperCase() || "S"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{student.name}</div>
                    <div className="text-muted-foreground text-xs truncate">{student.email}</div>
                  </div>
                  <Badge
                    className={cn(
                      "shrink-0",
                      student.status === "Active" ? "success" : "secondary"
                    )}
                  >
                    {student.status}
                  </Badge>
                </div>
                <MobileDataField label="Cohort">
                  <Badge variant="outline" className="text-xs">
                    {student.cohortName || "N/A"}
                  </Badge>
                </MobileDataField>
                <MobileDataField label="Progress">
                  <span>
                    {student.completedRotations}/{student.totalRotations} (
                    {student.totalRotations > 0
                      ? Math.round((student.completedRotations / student.totalRotations) * 100)
                      : 0}
                    %)
                  </span>
                </MobileDataField>
                <MobileDataField label="Current Rotation">
                  {student.currentRotation ? (
                    <Badge variant="outline" className="text-xs">
                      {student.currentRotation}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">None</span>
                  )}
                </MobileDataField>
                <MobileDataField label="Avg Score">
                  <span className="font-bold">{student.averageScore}%</span>
                </MobileDataField>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" className="flex-1 min-h-[44px]">
                    <Eye className="h-4 w-4 mr-1" /> View
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 min-h-[44px]">
                    <Edit className="h-4 w-4 mr-1" /> Edit
                  </Button>
                </div>
              </MobileDataCard>
            ))}
          </div>

          {/* Desktop Table View */}
          <ResponsiveTableWrapper className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-border/50">
                  <TableHead>Student</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cohort</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Current Rotation</TableHead>
                  <TableHead>Average Score</TableHead>
                  <TableHead>Enrolled</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {studentProgress.map((student) => (
                  <TableRow
                    key={student.id}
                    className="group hover:bg-muted/30 transition-colors duration-200 border-b border-border/50"
                  >
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-10 w-10 ring-2 ring-background group-hover:ring-primary/20 transition-all">
                          <AvatarImage src={`https://avatar.vercel.sh/${student.email}`} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {student.name?.charAt(0)?.toUpperCase() || "S"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium group-hover:text-primary transition-colors">
                            {student.name}
                          </div>
                          <div className="text-muted-foreground text-sm">{student.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          "transition-all duration-300",
                          student.status === "Active" ? "success" : "secondary"
                        )}
                      >
                        {student.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-background/50">
                        {student.cohortName || "N/A"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 w-[140px]">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            {student.completedRotations}/{student.totalRotations}
                          </span>
                          <span className="font-medium">
                            {student.totalRotations > 0
                              ? Math.round(
                                  (student.completedRotations / student.totalRotations) * 100
                                )
                              : 0}
                            %
                          </span>
                        </div>
                        <Progress
                          value={
                            student.totalRotations > 0
                              ? (student.completedRotations / student.totalRotations) * 100
                              : 0
                          }
                          className="h-1.5"
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      {student.currentRotation ? (
                        <Badge
                          variant="outline"
                          className="bg-background/50 backdrop-blur-sm border-primary/20 text-primary"
                        >
                          {student.currentRotation}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm italic">
                          No active rotation
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm">{student.averageScore}%</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] px-1.5 py-0 h-5 border-0",
                            student.averageScore >= 90
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                              : student.averageScore >= 80
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                                : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                          )}
                        >
                          {student.averageScore >= 90
                            ? "Excellent"
                            : student.averageScore >= 80
                              ? "Good"
                              : "Needs Work"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(student.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-background/80">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="bg-black/80 backdrop-blur-xl border border-white/10"
                        >
                          <DropdownMenuItem className="cursor-pointer focus:bg-primary/10">
                            <Eye className="mr-2 h-4 w-4 text-blue-500" />
                            View Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer focus:bg-primary/10">
                            <Edit className="mr-2 h-4 w-4 text-orange-500" />
                            Edit Student
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer focus:bg-primary/10">
                            <Calendar className="mr-2 h-4 w-4 text-purple-500" />
                            View Rotations
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild className="cursor-pointer focus:bg-primary/10">
                            <a
                              href={`/dashboard/school-admin/time-records?search=${student.email}`}
                            >
                              <div className="flex items-center w-full">
                                <Clock className="mr-2 h-4 w-4 text-green-500" />
                                View Time Records
                              </div>
                            </a>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer focus:bg-primary/10">
                            <Award className="mr-2 h-4 w-4 text-yellow-500" />
                            View Evaluations
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ResponsiveTableWrapper>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-white/5 backdrop-blur-sm border border-white/10 card-hover-lift">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                <UserPlus className="h-4 w-4" />
              </div>
              Bulk Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/dashboard/school-admin/setup" className="w-full block">
              <Button
                variant="outline"
                className="w-full justify-start hover:bg-primary/5 hover:text-primary hover:border-primary/30 transition-all"
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Import Students
              </Button>
            </Link>
            <Button
              variant="outline"
              className="w-full justify-start hover:bg-primary/5 hover:text-primary hover:border-primary/30 transition-all"
            >
              <Calendar className="mr-2 h-4 w-4" />
              Assign Rotations
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start hover:bg-primary/5 hover:text-primary hover:border-primary/30 transition-all"
            >
              <Award className="mr-2 h-4 w-4" />
              Generate Reports
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-white/5 backdrop-blur-sm border border-white/10 card-hover-lift">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-success/10 text-success">
                <TrendingUp className="h-4 w-4" />
              </div>
              Performance Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <span className="text-sm font-medium">Excellent (90%+)</span>
                <Badge variant="success">
                  {studentProgress.filter((s) => s.averageScore >= 90).length}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <span className="text-sm font-medium">Good (80-89%)</span>
                <Badge variant="info">
                  {
                    studentProgress.filter((s) => s.averageScore >= 80 && s.averageScore < 90)
                      .length
                  }
                </Badge>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <span className="text-sm font-medium">Needs Improvement</span>
                <Badge variant="warning">
                  {studentProgress.filter((s) => s.averageScore < 80).length}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 backdrop-blur-sm border border-white/10 card-hover-lift">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-warning/10 text-warning">
                <Clock className="h-4 w-4" />
              </div>
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm">
              <div className="flex items-center space-x-3">
                <div className="h-2 w-2 rounded-full bg-success shadow-[0_0_8px_hsl(var(--success)/0.6)] animate-pulse" />
                <span className="text-muted-foreground">5 students completed rotations</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="h-2 w-2 rounded-full bg-info shadow-[0_0_8px_hsl(var(--info)/0.6)] animate-pulse" />
                <span className="text-muted-foreground">3 new evaluations submitted</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="h-2 w-2 rounded-full bg-warning shadow-[0_0_8px_hsl(var(--warning)/0.6)] animate-pulse" />
                <span className="text-muted-foreground">2 students need attention</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}
