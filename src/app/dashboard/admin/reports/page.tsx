import { count, desc, eq, sql } from "drizzle-orm"
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
  const [totalUsers] = await db.select({ count: count() }).from(users)
  const [totalSchools] = await db.select({ count: count() }).from(schools)
  const [totalRotations] = await db.select({ count: count() }).from(rotations)
  const [totalEvaluations] = await db.select({ count: count() }).from(evaluations)

  // User distribution by role
  const usersByRole = await db
    .select({
      role: users.role,
      count: count(),
    })
    .from(users)
    .groupBy(users.role)

  // Monthly user registrations (last 6 months)
  const monthlyRegistrations = await db.execute(sql`
    SELECT
      TO_CHAR(created_at, 'Mon') as month,
      COUNT(*) as users
    FROM ${users}
    WHERE created_at >= NOW() - INTERVAL '6 months'
    GROUP BY TO_CHAR(created_at, 'Mon'), DATE_TRUNC('month', created_at)
    ORDER BY DATE_TRUNC('month', created_at)
  `)

  // Rotation completion stats
  const rotationStats = await db
    .select({
      status: rotations.status,
      count: count(),
    })
    .from(rotations)
    .groupBy(rotations.status)

  const completedRotations = rotationStats.find((s) => s.status === "COMPLETED")?.count || 0
  const completionRate =
    totalRotations.count > 0 ? (completedRotations / totalRotations.count) * 100 : 0

  // Evaluation average score
  const [avgEvaluation] = await db
    .select({
      avg: sql<number>`AVG(${evaluations.overallRating})`,
    })
    .from(evaluations)

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
            <div className="font-bold text-2xl">{totalUsers.count}</div>
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
            <div className="font-bold text-2xl">{totalSchools.count}</div>
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
            <div className="font-bold text-2xl">{totalRotations.count}</div>
            <p className="text-muted-foreground text-xs">
              <span className="text-green-600">{completionRate.toFixed(1)}%</span> completion rate
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Evaluations</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{totalEvaluations.count}</div>
            <p className="text-muted-foreground text-xs">
              <span className="text-green-600">{Number(avgEvaluation?.avg || 0).toFixed(1)}</span>{" "}
              avg score
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
                <div className="flex h-[300px] items-end justify-around rounded bg-gray-50 p-4">
                  {monthlyRegistrations.rows.map((row: any, i: number) => (
                    <div key={i} className="flex flex-col items-center gap-2">
                      <div
                        className="w-12 rounded-t bg-blue-500 transition-all hover:bg-blue-600"
                        style={{ height: `${Math.max(Number(row.users) * 5, 20)}px` }}
                      />
                      <span className="text-xs">{row.month}</span>
                    </div>
                  ))}
                  {monthlyRegistrations.rows.length === 0 && (
                    <p className="text-muted-foreground">No data available</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>User Distribution by Role</CardTitle>
                <CardDescription>Breakdown of users across different roles</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {usersByRole.map((role) => (
                    <div key={role.role} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{role.role}</span>
                        <span className="text-muted-foreground text-sm">{role.count} users</span>
                      </div>
                      <Progress
                        value={(role.count / (totalUsers.count || 1)) * 100}
                        className="h-2"
                      />
                    </div>
                  ))}
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
                  {usersByRole.map((role) => (
                    <div key={role.role} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{role.role}</span>
                        <span className="text-muted-foreground text-sm">{role.count} users</span>
                      </div>
                      <Progress
                        value={(role.count / (totalUsers.count || 1)) * 100}
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
              <CardTitle>Rotation Status Overview</CardTitle>
              <CardDescription>Current status of all rotations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {rotationStats.map((stat) => (
                  <div key={stat.status} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{stat.status}</span>
                      <span className="text-muted-foreground text-sm">{stat.count} rotations</span>
                    </div>
                    <Progress
                      value={(stat.count / (totalRotations.count || 1)) * 100}
                      className="h-2"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>Key performance indicators</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">Average Evaluation Score</span>
                    <Badge className="bg-green-100 text-green-800">
                      {Number(avgEvaluation?.avg || 0).toFixed(1)}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">Rotation Completion Rate</span>
                    <Badge className="bg-blue-100 text-blue-800">
                      {completionRate.toFixed(1)}%
                    </Badge>
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
