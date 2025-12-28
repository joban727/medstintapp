import { auth } from "@clerk/nextjs/server"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { PageHeader } from "../../../components/layout/page-header"
import { ReportsDashboard } from "../../../components/reports/reports-dashboard"
import { getUserById } from "../../../lib/rbac-middleware"
import type { UserRole } from "@/types"

// Role validation utilities
const hasRole = (userRole: UserRole, allowedRoles: UserRole[]): boolean => {
  return allowedRoles.includes(userRole)
}

const isAdmin = (userRole: UserRole): boolean => {
  return hasRole(userRole, ["ADMIN" as UserRole, "SUPER_ADMIN" as UserRole])
}

const isSchoolAdmin = (userRole: UserRole): boolean => {
  return hasRole(userRole, [
    "SCHOOL_ADMIN" as UserRole,
    "ADMIN" as UserRole,
    "SUPER_ADMIN" as UserRole,
  ])
}
export const metadata: Metadata = {
  title: "Reports - MedStintClerk",
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
  if (!userRole || !allowedRoles.includes(userRole)) {
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
