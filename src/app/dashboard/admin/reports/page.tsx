import { count } from "drizzle-orm"
import {
  Award,
  Building,
  Calendar,
  Download,
  FileText,
  GraduationCap,
  TrendingUp,
  Users,
} from "lucide-react"
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
import { db } from "@/database/connection-pool"
import { evaluations, rotations, schools, users } from "../../../../database/schema"
import { requireAnyRole } from "../../../../lib/auth-clerk"

export default async function AdminReportsPage() {
  const _user = await requireAnyRole(["SUPER_ADMIN"], "/dashboard")

  // Fetch analytics data
  const totalUsers = await db.select({ count: count() }).from(users)
  const totalSchools = await db.select({ count: count() }).from(schools)
  const totalRotations = await db.select({ count: count() }).from(rotations)
  const totalEvaluations = await db.select({ count: count() }).from(evaluations)

  // User distribution by role
  const usersByRole = await db
    .select({
      role: users.role,
      count: count(),
    })
    .from(users)
    .groupBy(users.role)

  // Monthly user registrations (mock data for demo)
  const _monthlyRegistrations = [
    { month: "Jan", users: 45 },
    { month: "Feb", users: 52 },
    { month: "Mar", users: 48 },
    { month: "Apr", users: 61 },
    { month: "May", users: 55 },
    { month: "Jun", users: 67 },
  ]

  // TODO: Replace with actual API calls for rotation and evaluation data

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">Reports &amp; Analytics</h1>
          <p className="text-muted-foreground">Comprehensive insights and performance metrics</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export Data
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <FileText className="mr-2 h-4 w-4" />
            Generate Report
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{totalUsers[0]?.count || 0}</div>
            <p className="text-muted-foreground text-xs">
              <span className="text-green-600">+12%</span> from last month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Active Schools</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{totalSchools[0]?.count || 0}</div>
            <p className="text-muted-foreground text-xs">
              <span className="text-green-600">+2</span> new this month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Total Rotations</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{totalRotations[0]?.count || 0}</div>
            <p className="text-muted-foreground text-xs">
              <span className="text-green-600">+8%</span> completion rate
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Evaluations</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{totalEvaluations[0]?.count || 0}</div>
            <p className="text-muted-foreground text-xs">
              <span className="text-green-600">94%</span> avg score
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Report Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">User Analytics</TabsTrigger>
          <TabsTrigger value="rotations">Rotation Reports</TabsTrigger>
          <TabsTrigger value="performance">Performance Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Monthly User Registrations</CardTitle>
                <CardDescription>New user sign-ups over the last 6 months</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex h-[300px] items-center justify-center rounded bg-gray-50">
                  <p className="text-muted-foreground">
                    Chart placeholder - Monthly user registrations
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>User Distribution by Role</CardTitle>
                <CardDescription>Breakdown of users across different roles</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex h-[300px] items-center justify-center rounded bg-gray-50">
                  <p className="text-muted-foreground">
                    Chart placeholder - User distribution by role
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle>User Growth Metrics</CardTitle>
                <CardDescription>Detailed user analytics and growth patterns</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {usersByRole.map((role, _index) => (
                    <div key={role.role} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{role.role}</span>
                        <span className="text-muted-foreground text-sm">{role.count} users</span>
                      </div>
                      <Progress
                        value={(role.count / (totalUsers[0]?.count || 1)) * 100}
                        className="h-2"
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="rotations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Rotation Completion by School</CardTitle>
              <CardDescription>Progress tracking across educational institutions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex h-[400px] items-center justify-center rounded bg-gray-50">
                <p className="text-muted-foreground">
                  Chart placeholder - Rotation completion by school
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Evaluation Score Distribution</CardTitle>
                <CardDescription>Student performance across all evaluations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex h-[300px] items-center justify-center rounded bg-gray-50">
                  <p className="text-muted-foreground">
                    Chart placeholder - Evaluation score distribution
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>Key performance indicators</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">Average Evaluation Score</span>
                    <Badge className="bg-green-100 text-green-800">87.5%</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">Rotation Completion Rate</span>
                    <Badge className="bg-blue-100 text-blue-800">92.3%</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">Student Satisfaction</span>
                    <Badge className="bg-purple-100 text-purple-800">4.6/5</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">Preceptor Engagement</span>
                    <Badge className="bg-orange-100 text-orange-800">89.1%</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Report Actions</CardTitle>
          <CardDescription>Generate specific reports and exports</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Button variant="outline" className="h-20 flex-col">
              <Users className="mb-2 h-6 w-6" />
              <span>User Report</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col">
              <GraduationCap className="mb-2 h-6 w-6" />
              <span>Academic Report</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col">
              <TrendingUp className="mb-2 h-6 w-6" />
              <span>Performance Report</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
