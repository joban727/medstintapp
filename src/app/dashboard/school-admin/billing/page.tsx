import { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/database/db"
import { schools, seatAssignments, users } from "@/database/schema"
import { eq, desc } from "drizzle-orm"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SeatManagementTable } from "@/components/dashboard/school-admin/billing/seat-management-table"
import { PurchaseSeatsForm } from "@/components/dashboard/school-admin/billing/purchase-seats-form"
import { Progress } from "@/components/ui/progress"

export const metadata: Metadata = {
  title: "Billing & Seats | MedStint",
  description: "Manage school billing and student seat assignments",
}

export default async function BillingPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const [currentUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1)

  if (!currentUser || currentUser.role !== "SCHOOL_ADMIN" || !currentUser.schoolId) {
    redirect("/dashboard")
  }

  const [school] = await db
    .select()
    .from(schools)
    .where(eq(schools.id, currentUser.schoolId))
    .limit(1)

  if (!school) redirect("/dashboard")

  // Fetch seat assignments
  const assignments = await db
    .select({
      id: seatAssignments.id,
      studentId: seatAssignments.studentId,
      assignedAt: seatAssignments.assignedAt,
      status: seatAssignments.status,
      studentName: users.name,
      studentEmail: users.email,
    })
    .from(seatAssignments)
    .innerJoin(users, eq(seatAssignments.studentId, users.id))
    .where(eq(seatAssignments.schoolId, school.id))
    .orderBy(desc(seatAssignments.assignedAt))

  const activeAssignments = assignments.filter((a) => a.status === "ACTIVE")
  const usagePercentage = school.seatsLimit > 0 ? (school.seatsUsed / school.seatsLimit) * 100 : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing & Seats</h1>
        <p className="text-muted-foreground">
          Manage your school's subscription and student licenses.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Seat Usage</CardTitle>
            <CardDescription>Overview of your purchased student licenses.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Used Seats</span>
                <span className="font-medium">
                  {school.seatsUsed} / {school.seatsLimit}
                </span>
              </div>
              <Progress value={usagePercentage} className="h-2" />
            </div>
            <div className="rounded-lg border p-4 bg-muted/50">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium">Billing Model</p>
                  <p className="text-sm text-muted-foreground">
                    {school.billingModel === "SCHOOL_PAYS" ? "School Pays" : "Student Pays"}
                  </p>
                </div>
                {/* Add toggle or upgrade button if needed */}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Purchase More Seats</CardTitle>
            <CardDescription>Add more licenses to your plan.</CardDescription>
          </CardHeader>
          <CardContent>
            <PurchaseSeatsForm schoolId={school.id} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Assigned Seats</CardTitle>
          <CardDescription>
            Manage students who are currently using a school-paid license.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SeatManagementTable
            assignments={assignments.map((a) => ({
              ...a,
              studentName: a.studentName || "Unknown",
              status: a.status as "ACTIVE" | "REVOKED",
            }))}
            schoolId={school.id}
          />
        </CardContent>
      </Card>
    </div>
  )
}
