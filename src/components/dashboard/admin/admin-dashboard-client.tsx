"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SystemStats } from "@/lib/admin/stats-service"
import { DollarSign, School, Users, CreditCard, Plus, ArrowRight, Loader2 } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useState, useEffect } from "react"
import { DashboardBackground } from "../dashboard-background"

interface AdminDashboardClientProps {
  stats: SystemStats | null
  recentSchools: any[] | null
}

// Default stats to prevent null errors during hydration
const defaultStats: SystemStats = {
  revenue: { totalMrr: 0, studentMrr: 0, schoolMrr: 0 },
  counts: {
    schools: 0,
    users: { total: 0, students: 0, admins: 0, preceptors: 0 },
    activeSubscriptions: 0,
  },
}

export function AdminDashboardClient({
  stats: rawStats,
  recentSchools: rawSchools,
}: AdminDashboardClientProps) {
  const [isClient, setIsClient] = useState(false)

  // Wait for client-side hydration to complete
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Apply defaults to handle null/undefined cases
  const stats = rawStats || defaultStats
  const recentSchools = rawSchools || []

  // Show loading state during hydration
  if (!isClient) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    )
  }

  return (
    <div className="space-y-8 relative">
      <DashboardBackground />

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-white/5 backdrop-blur-md border-white/10 rounded-xl border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[var(--text-tertiary)]">
              Total Revenue (MRR)
            </CardTitle>
            <DollarSign className="h-4 w-4 text-white/70" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              ${stats.revenue.totalMrr.toFixed(2)}
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              ${stats.revenue.studentMrr.toFixed(2)} from students
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 backdrop-blur-md border-white/10 rounded-xl border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[var(--text-tertiary)]">
              Active Schools
            </CardTitle>
            <School className="h-4 w-4 text-white/70" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.counts.schools}</div>
            <p className="text-xs text-[var(--text-muted)]">
              {stats.revenue.schoolMrr > 0 ? "Generating revenue" : "No revenue yet"}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 backdrop-blur-md border-white/10 rounded-xl border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[var(--text-tertiary)]">
              Total Users
            </CardTitle>
            <Users className="h-4 w-4 text-white/70" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.counts.users.total}</div>
            <p className="text-xs text-[var(--text-muted)]">
              {stats.counts.users.students} Students, {stats.counts.users.preceptors} Preceptors
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 backdrop-blur-md border-white/10 rounded-xl border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[var(--text-tertiary)]">
              Active Subscriptions
            </CardTitle>
            <CreditCard className="h-4 w-4 text-white/70" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.counts.activeSubscriptions}</div>
            <p className="text-xs text-[var(--text-muted)]">Stripe subscriptions</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Recent Schools */}
        <Card className="col-span-4 bg-white/5 backdrop-blur-md border-white/10 rounded-xl border">
          <CardHeader>
            <CardTitle className="text-white">Recent Schools</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentSchools.length === 0 ? (
                <p className="text-sm text-[var(--text-tertiary)]">No schools found.</p>
              ) : (
                recentSchools.map((school) => (
                  <div
                    key={school.id}
                    className="flex items-center justify-between border-b border-white/10 pb-4 last:border-0 last:pb-0"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none text-white">{school.name}</p>
                      <p className="text-xs text-[var(--text-tertiary)]">
                        {school.email || "No email"}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-medium text-white">
                          {school.seatsUsed} / {school.seatsLimit} Seats
                        </p>
                        <p className="text-xs text-[var(--text-tertiary)]">
                          {school.billingModel === "SCHOOL_PAYS" ? "School Pays" : "Student Pays"}
                        </p>
                      </div>
                      <Badge
                        variant={school.isActive ? "default" : "secondary"}
                        className={
                          school.isActive
                            ? "bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30 border-0"
                            : "bg-white/10 text-white/70 hover:bg-white/20 border-0"
                        }
                      >
                        {school.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="col-span-3 bg-white/5 backdrop-blur-md border-white/10 rounded-xl border">
          <CardHeader>
            <CardTitle className="text-white">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link href="/dashboard/admin/plans/new" className="block">
              <Button variant="glass" className="w-full justify-start">
                <Plus className="mr-2 h-4 w-4" />
                Create New Plan
              </Button>
            </Link>
            <Link href="/dashboard/admin/schools" className="block">
              <Button variant="glass" className="w-full justify-start">
                <School className="mr-2 h-4 w-4" />
                Manage Schools
              </Button>
            </Link>
            <Link href="/dashboard/admin/users" className="block">
              <Button variant="glass" className="w-full justify-start">
                <Users className="mr-2 h-4 w-4" />
                Manage Users
              </Button>
            </Link>
            <div className="pt-4">
              <Link
                href="/dashboard/admin/plans"
                className="text-sm text-white/70 hover:text-white hover:underline flex items-center transition-colors"
              >
                View all plans <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
