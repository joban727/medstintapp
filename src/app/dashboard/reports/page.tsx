import { auth } from "@clerk/nextjs/server"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { PageHeader } from "../../../components/layout/page-header"
import { ReportsDashboard } from "../../../components/reports/reports-dashboard"
import { getUserById } from "../../../lib/rbac-middleware"

export const metadata: Metadata = {
  title: "Reports - MedstintClerk",
  description: "Generate and export comprehensive competency reports",
}

export default async function ReportsPage() {
  const { userId } = await auth()

  if (!userId) {
    redirect("/sign-in")
  }

  const user = await getUserById(userId)
  if (!user) {
    redirect("/sign-in")
  }

  const userRole = user.role

  // Only allow certain roles to access reports
  const allowedRoles = ["SCHOOL_ADMIN", "CLINICAL_SUPERVISOR", "STUDENT"]
  if (!allowedRoles.includes(userRole)) {
    redirect("/dashboard")
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Generate comprehensive reports on competency progress, assessments, and analytics"
      />

      <ReportsDashboard userId={userId} userRole={userRole} />
    </div>
  )
}
