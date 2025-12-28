"use client"

import { Activity, Building2, School, TrendingDown, TrendingUp, Users } from "lucide-react"
import { StatCard, StatGrid } from "@/components/ui/stat-card"
import { cn } from "@/lib/utils"

interface AdminStatsProps {
  totalUsers: number
  totalSchools: number
  totalStudents: number
  activeSessions: number
  userGrowth?: number
  schoolGrowth?: number
  studentGrowth?: number
  sessionGrowth?: number
  className?: string
}

export function AdminStats({
  totalUsers,
  totalSchools,
  totalStudents,
  activeSessions,
  userGrowth = 12,
  schoolGrowth = 2,
  studentGrowth = 8,
  sessionGrowth = 5,
  className,
}: AdminStatsProps) {
  return (
    <StatGrid columns={4} className={className}>
      <StatCard
        title="Total Users"
        value={totalUsers}
        icon={Users}
        variant="blue"
        description={`${userGrowth >= 0 ? "+" : ""}${userGrowth}% from last month`}
      />
      <StatCard
        title="Schools"
        value={totalSchools}
        icon={School}
        variant="green"
        description={`${schoolGrowth >= 0 ? "+" : ""}${schoolGrowth} new this quarter`}
      />
      <StatCard
        title="Active Students"
        value={totalStudents}
        icon={Building2}
        variant="purple"
        description={`${studentGrowth >= 0 ? "+" : ""}${studentGrowth}% enrollment growth`}
      />
      <StatCard
        title="Active Sessions"
        value={activeSessions}
        icon={Activity}
        variant="orange"
        description="Current online users"
      />
    </StatGrid>
  )
}
