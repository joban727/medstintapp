"use client"

import { Users, GraduationCap, Building2, Activity } from "lucide-react"
import { DashboardCard } from "@/components/dashboard/shared/dashboard-card"
import { cn } from "@/lib/utils"

interface MetricsOverviewProps {
  stats: {
    totalStudents?: number
    activePrograms?: number
    totalSites?: number
    placementRate?: number
  }
}

export function MetricsOverview({ stats }: MetricsOverviewProps) {
  const metrics = [
    {
      label: "Total Students",
      value: stats.totalStudents || 0,
      icon: Users,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
    },
    {
      label: "Active Programs",
      value: stats.activePrograms || 0,
      icon: GraduationCap,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
      border: "border-purple-500/20",
    },
    {
      label: "Clinical Sites",
      value: stats.totalSites || 0,
      icon: Building2,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
    },
    {
      label: "Placement Rate",
      value: `${stats.placementRate ?? 0}%`,
      icon: Activity,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
    },
  ]

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric, index) => (
        <DashboardCard
          key={metric.label}
          variant="premium"
          className="relative overflow-hidden group card-hover-lift"
        >
          <div className="relative z-10 flex flex-col h-full justify-between pt-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-sm font-medium text-[var(--text-tertiary)]">{metric.label}</h3>
                <div className="text-3xl font-bold tracking-tight mt-2 text-white">
                  {metric.value}
                </div>
              </div>
              <div className={cn("p-3 rounded-xl glass", metric.bg, "bg-opacity-10")}>
                <metric.icon className={cn("h-6 w-6", metric.color)} />
              </div>
            </div>
          </div>

          {/* Decorative Background Icon */}
          <div className="absolute -bottom-4 -right-4 opacity-5 group-hover:opacity-10 transition-opacity rotate-12">
            <metric.icon className={cn("h-32 w-32", metric.color)} />
          </div>
        </DashboardCard>
      ))}
    </div>
  )
}
