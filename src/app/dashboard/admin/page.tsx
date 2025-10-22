import { BarChart3, Building2, School, Settings, Shield, Users } from "lucide-react"
import { headers } from "next/headers"
import { Suspense } from "react"
import { AdminActivityFeed } from "@/components/admin/admin-activity-feed"
import { AdminHeader } from "@/components/admin/admin-header"
import { AdminQuickActions } from "@/components/admin/admin-quick-actions"
import { AdminStats } from "@/components/admin/admin-stats"
import { SystemStatus } from "@/components/admin/system-status"
import { DashboardStatsSkeleton } from "../../../components/dashboard/dashboard-loading"
import { WelcomeBanner } from "../../../components/dashboard/welcome-banner"
import { SchoolSelector } from "../../../components/school-selector"
import type { User } from "../../../database/schema"
import { requireAnyRole } from "../../../lib/auth-clerk"

export default async function AdminDashboardPage() {
  const user = await requireAnyRole(["SUPER_ADMIN"], "/dashboard")

  return (
    <div className="space-y-6">
      {/* Welcome Banner for First-Time Users */}
      <WelcomeBanner userRole={user.role} userName={user.name || "Admin User"} />

      <Suspense fallback={<DashboardStatsSkeleton />}>
        <AdminDashboardContent user={user} />
      </Suspense>
    </div>
  )
}

async function AdminDashboardContent({ user }: { user: User }) {
  // Fetch real data for super admin dashboard with school awareness and error handling
  let allUsers: User[] = []
  let allSchools: typeof import("@/database/schema").schools.$inferSelect[] = []

  try {
    const { getAllUsers, getAccessibleSchools } = await import("@/app/actions")

    // Safely fetch users
    try {
      const usersData = await getAllUsers()
      allUsers = Array.isArray(usersData) ? usersData : []
    } catch (error) {
      console.error("Error fetching all users:", error)
      allUsers = []
    }

    // Safely fetch schools
    try {
      const schoolsData = await getAccessibleSchools()
      allSchools = Array.isArray(schoolsData) ? schoolsData : []
    } catch (error) {
      console.error("Error fetching accessible schools:", error)
      allSchools = []
    }
  } catch (error) {
    console.error("Error importing actions:", error)
  }

  // Fetch active sessions count
  async function getActiveSessions() {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001"
      const cookieHeader = (await headers()).get("cookie") || ""

      // Query sessions table for active sessions (created within last 24 hours)
      const response = await fetch(`${baseUrl}/api/health`, {
        method: "POST",
        headers: {
          Cookie: cookieHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ includeSessionCount: true }),
      })

      if (response.ok) {
        const data = await response.json()
        return data?.activeSessions || 0
      }

      return 0
    } catch (error) {
      console.error("Error fetching active sessions:", error)
      return 0
    }
  }

  const activeSessions = await getActiveSessions()

  // Safe filtering with null checks
  const safeAllUsers = Array.isArray(allUsers)
    ? allUsers.filter((u) => u && typeof u === "object")
    : []
  const safeAllSchools = Array.isArray(allSchools)
    ? allSchools.filter((s) => s && typeof s === "object")
    : []

  const stats = {
    totalUsers: safeAllUsers.length,
    totalSchools: safeAllSchools.length,
    totalStudents: safeAllUsers.filter((u) => u?.role === "STUDENT").length,
    activeSessions,
  }

  const _quickActions = [
    {
      title: "User Management",
      description: "Manage system users and permissions",
      icon: Users,
      href: "/dashboard/admin/users",
      color: "bg-blue-500",
    },
    {
      title: "School Management",
      description: "Oversee educational institutions",
      icon: School,
      href: "/dashboard/admin/schools",
      color: "bg-green-500",
    },
    {
      title: "Clinical Sites",
      description: "Manage clinical training locations",
      icon: Building2,
      href: "/dashboard/admin/clinical-sites",
      color: "bg-purple-500",
    },
    {
      title: "System Reports",
      description: "View comprehensive system analytics",
      icon: BarChart3,
      href: "/dashboard/admin/reports",
      color: "bg-orange-500",
    },
    {
      title: "System Settings",
      description: "Configure platform settings",
      icon: Settings,
      href: "/dashboard/admin/settings",
      color: "bg-gray-500",
    },
    {
      title: "Security & Audit",
      description: "Monitor security and audit logs",
      icon: Shield,
      href: "/dashboard/admin/audit",
      color: "bg-red-500",
    },
  ]

  return (
    <div className="space-y-6">
      {/* Admin Header */}
      <AdminHeader
        user={{
          name: user.name || "Admin User",
          email: user.email || "",
          avatar: user.image || undefined,
        }}
      />

      {/* School Selector */}
      <SchoolSelector
        schools={safeAllSchools}
        userRole={user?.role || "ADMIN"}
        className="max-w-md"
      />

      {/* System Status */}
      <SystemStatus />

      {/* Admin Stats */}
      <AdminStats
        totalUsers={stats.totalUsers}
        totalStudents={stats.totalStudents}
        totalSchools={stats.totalSchools}
        activeSessions={stats.activeSessions}
      />

      {/* Quick Actions */}
      <AdminQuickActions />

      {/* Activity Feed */}
      <AdminActivityFeed />
    </div>
  )
}
