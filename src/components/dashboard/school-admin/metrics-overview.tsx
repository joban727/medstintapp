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
            sparkline: "M0 20 Q 10 18, 20 15 T 40 10 T 60 12 T 80 5 T 100 2"
        },
        {
            label: "Active Programs",
            value: stats.activePrograms || 0,
            icon: GraduationCap,
            color: "text-purple-500",
            bg: "bg-purple-500/10",
            border: "border-purple-500/20",
            sparkline: "M0 20 Q 20 15, 40 10 T 60 15 T 80 8 T 100 5"
        },
        {
            label: "Clinical Sites",
            value: stats.totalSites || 0,
            icon: Building2,
            color: "text-emerald-500",
            bg: "bg-emerald-500/10",
            border: "border-emerald-500/20",
            sparkline: "M0 20 L 20 18 L 40 12 L 60 14 L 80 6 L 100 4"
        },
        {
            label: "Placement Rate",
            value: `${stats.placementRate ?? 0}%`,
            icon: Activity,
            color: "text-amber-500",
            bg: "bg-amber-500/10",
            border: "border-amber-500/20",
            sparkline: "M0 10 Q 25 10, 50 15 T 100 18"
        },
    ]

    return (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.map((metric, index) => (
                <DashboardCard
                    key={metric.label}
                    variant="default"
                    className="relative overflow-hidden group card-hover-lift"
                >
                    <div className="relative z-10 flex flex-col h-full justify-between pt-6">
                        <div className="flex items-start justify-between mb-4">
                            <div className={cn("p-3 rounded-xl backdrop-blur-md border bg-background/50", metric.color, "border-border/50")}>
                                <metric.icon className="h-6 w-6" />
                            </div>
                        </div>

                        <div>
                            <h3 className="text-sm font-medium text-muted-foreground">{metric.label}</h3>
                            <div className="text-3xl font-bold tracking-tight mt-1 text-foreground">{metric.value}</div>
                        </div>
                    </div>

                    {/* Sparkline Background */}
                    <div className="absolute bottom-0 left-0 right-0 h-16 opacity-10 group-hover:opacity-20 transition-opacity">
                        <svg viewBox="0 0 100 25" className="w-full h-full preserve-3d" preserveAspectRatio="none">
                            <path
                                d={metric.sparkline}
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                className={metric.color}
                                vectorEffect="non-scaling-stroke"
                            />
                            <path
                                d={`${metric.sparkline} L 100 30 L 0 30 Z`}
                                fill="currentColor"
                                className={metric.color}
                                fillOpacity="0.1"
                            />
                        </svg>
                    </div>
                </DashboardCard>
            ))}
        </div>
    )
}
