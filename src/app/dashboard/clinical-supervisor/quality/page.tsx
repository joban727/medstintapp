import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileText,
  Filter,
  Plus,
  Search,
  TrendingUp,
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../../components/ui/dropdown-menu"
import { Input } from "../../../../components/ui/input"
import { Progress } from "../../../../components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../components/ui/tabs"
import { db } from "@/database/connection-pool"
import { qualityReviews } from "../../../../database/schema"
import { requireAnyRole } from "../../../../lib/auth-clerk"
import { desc } from "drizzle-orm"

export default async function QualityAssurancePage() {
  const _user = await requireAnyRole(["CLINICAL_SUPERVISOR", "SUPER_ADMIN"], "/dashboard")

  // Fetch quality reviews from database
  const reviews = await db.select().from(qualityReviews).orderBy(desc(qualityReviews.updatedAt))

  // Calculate metrics
  const totalReviews = reviews.length
  const pendingReviews = reviews.filter((r) => r.status === "pending").length
  const complianceRate =
    totalReviews > 0
      ? (reviews.filter((r) => Number(r.overallScore) >= 80).length / totalReviews) * 100
      : 100

  // Mock improvement plans for now (could be a separate table later)
  const improvementPlans = [
    {
      id: "1",
      title: "Documentation Compliance",
      status: "In Progress",
      progress: 65,
      dueDate: "2024-04-15",
      assignee: "Dr. Sarah Smith",
    },
    {
      id: "2",
      title: "Clinical Supervision Standards",
      status: "Pending",
      progress: 0,
      dueDate: "2024-05-01",
      assignee: "Dr. Michael Chen",
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">Quality Assurance</h1>
          <p className="text-muted-foreground">Monitor and improve clinical education quality</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="mr-2 h-4 w-4" />
            New Review
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Quality Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">94.2%</div>
            <p className="text-muted-foreground text-xs">
              <span className="text-green-600">+2.1%</span> from last quarter
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Active Reviews</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{pendingReviews}</div>
            <p className="text-muted-foreground text-xs">
              <span className="text-yellow-600">
                {reviews.filter((r) => r.priority === "high").length} high priority
              </span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Compliance Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{complianceRate.toFixed(1)}%</div>
            <p className="text-muted-foreground text-xs">
              <span className="text-green-600">Above target</span> (90%)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Issues Found</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">
              {reviews.reduce((acc, r) => acc + (r.findings as any[]).length, 0)}
            </div>
            <p className="text-muted-foreground text-xs">
              <span className="text-red-600">-5</span> from last month
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="reviews" className="space-y-4">
        <TabsList>
          <TabsTrigger value="reviews">Quality Reviews</TabsTrigger>
          <TabsTrigger value="metrics">Detailed Metrics</TabsTrigger>
          <TabsTrigger value="plans">Improvement Plans</TabsTrigger>
        </TabsList>

        <TabsContent value="reviews" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search reviews..." className="pl-8" />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-10 gap-1">
                    <Filter className="h-3.5 w-3.5" />
                    <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Filter</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Filter by</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem checked>Status</DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem>Type</DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem>Priority</DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="rounded-md border">
            {reviews.length === 0 ? (
              <div className="flex h-40 items-center justify-center p-8 text-center text-muted-foreground">
                No reviews found. Click "New Review" to start one.
              </div>
            ) : (
              <div className="relative w-full overflow-auto">
                <table className="w-full caption-bottom text-sm">
                  <thead className="[&_tr]:border-b">
                    <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        Title
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        Type
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        Status
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        Score
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        Date
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="[&_tr:last-child]:border-0">
                    {reviews.map((review) => (
                      <tr
                        key={review.id}
                        className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                      >
                        <td className="p-4 align-middle font-medium">{review.title}</td>
                        <td className="p-4 align-middle">{review.type}</td>
                        <td className="p-4 align-middle">
                          <Badge
                            variant={
                              review.status === "completed"
                                ? "default" // was "success" but not in standard badge variants
                                : review.status === "in_progress"
                                  ? "default" // was "warning"
                                  : "secondary"
                            }
                            className={
                              review.status === "completed"
                                ? "bg-green-100 text-green-800 hover:bg-green-100"
                                : review.status === "in_progress"
                                  ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
                                  : ""
                            }
                          >
                            {review.status.replace("_", " ")}
                          </Badge>
                        </td>
                        <td className="p-4 align-middle">
                          {review.overallScore ? `${review.overallScore}%` : "-"}
                        </td>
                        <td className="p-4 align-middle">
                          {review.reviewDate.toLocaleDateString()}
                        </td>
                        <td className="p-4 align-middle">
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Trends</CardTitle>
              <CardDescription>Quality metrics over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex h-[300px] items-center justify-center rounded bg-gray-50">
                <p className="text-muted-foreground">Chart placeholder - Performance Trends</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {improvementPlans.map((plan) => (
              <Card key={plan.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{plan.title}</CardTitle>
                      <CardDescription>Assigned to: {plan.assignee}</CardDescription>
                    </div>
                    <Badge variant="outline">{plan.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Progress</span>
                        <span>{plan.progress}%</span>
                      </div>
                      <Progress value={plan.progress} className="h-2" />
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Due Date:</span>
                      <span>{new Date(plan.dueDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
