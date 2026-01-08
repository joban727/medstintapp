"use client"

import { useState, useCallback, useEffect } from "react"
import { BarChart3, BookOpen, Calendar, Clock, GraduationCap, Users, Activity } from "lucide-react"
import { motion } from "framer-motion"
import { DashboardHero } from "./school-admin/dashboard-hero"
import { MetricsOverview } from "./school-admin/metrics-overview"
import { QuickNav } from "./school-admin/quick-nav"
import { RecentActivityFeed } from "./school-admin/recent-activity-feed"
import { FloatingActionCenter } from "./school-admin/floating-action-center"
import dynamic from "next/dynamic"

const EnrollmentTrendChart = dynamic(
  () => import("./school-admin/analytics-charts").then((mod) => mod.EnrollmentTrendChart),
  { ssr: false, loading: () => <div className="h-[300px] w-full animate-pulse bg-muted/20 rounded-lg" /> }
)
const SiteCapacityChart = dynamic(
  () => import("./school-admin/analytics-charts").then((mod) => mod.SiteCapacityChart),
  { ssr: false, loading: () => <div className="h-[300px] w-full animate-pulse bg-muted/20 rounded-lg" /> }
)
const CompetencyRadarChart = dynamic(
  () => import("./school-admin/analytics-charts").then((mod) => mod.CompetencyRadarChart),
  { ssr: false, loading: () => <div className="h-[300px] w-full animate-pulse bg-muted/20 rounded-lg" /> }
)

import { toast } from "sonner"
import type { UserRole } from "@/types"

interface User {
  id: string
  name: string | null
  email: string
  role: UserRole
  schoolId: string | null
  onboardingCompleted: boolean
}

interface PendingTask {
  id: string
  title: string
  description: string
  count: number
  priority: "high" | "medium" | "low"
  type: "approval" | "evaluation" | "setup" | "review" | "system"
}

interface RecentActivity {
  action: string
  details: string
  timestamp: string
}

interface SchoolStats {
  totalStudents?: number
  totalPrograms?: number
  pendingEvaluations?: number
  avgCompetencyProgress?: number
  activeRotations?: number
  totalSites?: number
  placementRate?: number
  schoolName?: string
}

interface DashboardData {
  pendingTasks: PendingTask[]
  recentActivities: RecentActivity[]
  schoolStats: SchoolStats
  analytics: {
    enrollmentTrend: { month: string; students: number }[]
    siteCapacity: { name: string; capacity: number; used: number }[]
    competencyOverview: { subject: string; A: number; fullMark: number }[]
  }
}

interface SchoolAdminDashboardClientProps {
  user: User
  dashboardData: DashboardData
}

import { DashboardBackground } from "./dashboard-background"

// ... (imports remain the same, ensuring DashboardBackground is imported)

const quickActions = [
  {
    title: "Students",
    description: "View and manage student enrollment",
    icon: Users,
    href: "/dashboard/school-admin/students",
    color: "text-foreground/70",
  },
  {
    title: "Programs",
    description: "Configure curricula and requirements",
    icon: BookOpen,
    href: "/dashboard/school-admin/programs",
    color: "text-foreground/70",
  },
  {
    title: "Sites",
    description: "Manage rotation sites and partnerships",
    icon: Calendar,
    href: "/dashboard/school-admin/sites",
    color: "text-foreground/70",
  },
  {
    title: "Reports",
    description: "View performance metrics and reports",
    icon: BarChart3,
    href: "/dashboard/school-admin/reports",
    color: "text-foreground/70",
  },
  {
    title: "Faculty",
    description: "Manage preceptors and supervisors",
    icon: GraduationCap,
    href: "/dashboard/school-admin/faculty-staff",
    color: "text-foreground/70",
  },
  {
    title: "Timecards",
    description: "Monitor student timecards and corrections",
    icon: Clock,
    href: "/dashboard/school-admin/time-records",
    color: "text-foreground/70",
  },
]

// Action item type from API
interface ActionItem {
  id: string
  title: string
  description: string
  type: "approval" | "time-approval" | "evaluation" | "system"
  priority: "high" | "medium" | "low"
  date: string
  entityId: string
  entityType: string
}

export function SchoolAdminDashboardClient({
  user,
  dashboardData,
}: SchoolAdminDashboardClientProps) {
  const { schoolStats, recentActivities, analytics } = dashboardData
  const [actionItems, setActionItems] = useState<ActionItem[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch action items from API
  useEffect(() => {
    async function fetchActionItems() {
      try {
        const response = await fetch("/api/school-admin/action-items")
        const data = await response.json()
        if (data.success) {
          setActionItems(data.data || [])
        }
      } catch (error) {
        console.error("Failed to fetch action items:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchActionItems()
  }, [])

  // Transform data for components
  const transformedStats = {
    totalStudents: schoolStats.totalStudents,
    activePrograms: schoolStats.totalPrograms,
    totalSites: schoolStats.totalSites,
    placementRate: schoolStats.placementRate,
  }

  // Action handlers with real API calls
  const handleApprove = useCallback(
    async (taskId: string, entityId: string, entityType: string) => {
      try {
        let response: Response

        if (entityType === "user") {
          // Approve user account
          response = await fetch("/api/school-admin/approvals", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targetUserId: entityId, action: "APPROVE" }),
          })
        } else if (entityType === "timeRecord") {
          // Approve time record
          response = await fetch("/api/time-records", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: entityId, status: "APPROVED" }),
          })
        } else {
          toast.info("This action type requires manual review")
          return
        }

        const data = await response.json()
        if (data.success) {
          toast.success("Approved successfully")
          setActionItems((prev) => prev.filter((item) => item.id !== taskId))
        } else {
          toast.error(data.error || "Failed to approve")
        }
      } catch (error) {
        console.error("Approve error:", error)
        toast.error("An error occurred")
      }
    },
    []
  )

  const handleDismiss = useCallback(
    async (taskId: string, entityId: string, entityType: string) => {
      try {
        let response: Response

        if (entityType === "user") {
          // Reject user account
          response = await fetch("/api/school-admin/approvals", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targetUserId: entityId, action: "REJECT" }),
          })
        } else if (entityType === "timeRecord") {
          // Reject time record
          response = await fetch("/api/time-records", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: entityId, status: "REJECTED" }),
          })
        } else {
          // Just remove from UI for system notifications
          setActionItems((prev) => prev.filter((item) => item.id !== taskId))
          toast.info("Dismissed")
          return
        }

        const data = await response.json()
        if (data.success) {
          toast.success("Action completed")
          setActionItems((prev) => prev.filter((item) => item.id !== taskId))
        } else {
          toast.error(data.error || "Failed to process")
        }
      } catch (error) {
        console.error("Dismiss error:", error)
        toast.error("An error occurred")
      }
    },
    []
  )

  const handleView = useCallback((taskId: string, entityId: string, entityType: string) => {
    // Navigate based on entity type
    if (entityType === "evaluation") {
      window.location.href = `/dashboard/school-admin/students?highlight=${entityId}`
    } else if (entityType === "timeRecord") {
      window.location.href = `/dashboard/school-admin/time-records?highlight=${entityId}`
    } else {
      window.location.href = `/dashboard/school-admin/approvals?highlight=${entityId}`
    }
  }, [])

  return (
    <div className="relative min-h-screen w-full bg-background text-foreground">
      {/* Subtle Background Accents */}
      <DashboardBackground />

      {/* Content */}
      <div className="relative z-10 max-w-[1600px] mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">
        {/* Hero - Compact */}
        <div data-tutorial="hero-section">
          <DashboardHero
            userName={user.name || "Admin"}
            schoolName={schoolStats.schoolName || "Medical Institute"}
          />
        </div>

        {/* Metrics - Single Row */}
        <div data-tutorial="metrics-section">
          <MetricsOverview stats={transformedStats} />
        </div>

        {/* Analytics Charts */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="grid grid-cols-1 lg:grid-cols-6 gap-6"
        >
          <EnrollmentTrendChart data={analytics.enrollmentTrend} />
          <SiteCapacityChart data={analytics.siteCapacity} />
          <CompetencyRadarChart data={analytics.competencyOverview} />
        </motion.section>

        {/* Quick Access - Compact Grid */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          data-tutorial="quick-nav-section"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="h-5 w-1 rounded-full bg-medical-primary" />
            <h2 className="text-sm font-semibold text-foreground/80 uppercase tracking-wider">
              Quick Access
            </h2>
          </div>
          <QuickNav actions={quickActions} />
        </motion.section>

        {/* Recent Activity - Compact Inline */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          data-tutorial="activity-section"
        >
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-4 w-4 text-info" />
            <h2 className="text-sm font-semibold text-foreground/80 uppercase tracking-wider">
              Recent Activity
            </h2>
          </div>
          <RecentActivityFeed activities={recentActivities} />
        </motion.section>
      </div>

      {/* Floating Action Center */}
      <div data-tutorial="action-center">
        <FloatingActionCenter
          tasks={actionItems}
          onApprove={handleApprove}
          onDismiss={handleDismiss}
          onView={handleView}
        />
      </div>
    </div>
  )
}

export function DashboardError({ error }: { error: string }) {
  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-background text-foreground">
      <div className="text-center space-y-4 max-w-md">
        <div className="mx-auto mb-4 rounded-full bg-destructive/10 p-3 w-fit">
          <Clock className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold text-destructive">Dashboard Error</h2>
        <p className="text-muted-foreground">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Retry Loading
        </button>
      </div>
    </div>
  )
}
