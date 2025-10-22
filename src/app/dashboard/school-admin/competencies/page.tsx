"use client"

import {
  Activity,
  BarChart3,
  BookOpen,
  FileText,
  Plus,
  Rocket,
  Target,
  Upload,
  Users,
  Wrench,
} from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface QuickStats {
  totalTemplates: number
  activeDeployments: number
  completionRate: number
  totalAssignments: number
}

export default function CompetenciesPage() {
  const [stats, setStats] = useState<QuickStats>({
    totalTemplates: 0,
    activeDeployments: 0,
    completionRate: 0,
    totalAssignments: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch quick stats from APIs
    const fetchStats = async () => {
      try {
        // This would normally fetch from your APIs
        // For now, using mock data
        setStats({
          totalTemplates: 24,
          activeDeployments: 8,
          completionRate: 78,
          totalAssignments: 156,
        })
      } catch (error) {
        console.error("Error fetching stats:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  const competencyFeatures = [
    {
      title: "Management Dashboard",
      description: "View comprehensive analytics, performance metrics, and system overview",
      icon: BarChart3,
      href: "/dashboard/school-admin/competencies/dashboard",
      color: "bg-blue-500",
      stats: `${stats.completionRate}% completion rate`,
    },
    {
      title: "Template Library",
      description: "Browse, search, and manage competency templates from various specialties",
      icon: BookOpen,
      href: "/dashboard/school-admin/competencies/templates",
      color: "bg-green-500",
      stats: `${stats.totalTemplates} templates available`,
    },
    {
      title: "Custom Builder",
      description: "Create and customize competency templates with detailed rubrics",
      icon: Wrench,
      href: "/dashboard/school-admin/competencies/builder",
      color: "bg-purple-500",
      stats: "Build custom templates",
    },
  ]

  const deploymentFeatures = [
    {
      title: "Deployment Console",
      description: "Deploy competencies to students, track progress, and manage assignments",
      icon: Rocket,
      href: "/dashboard/school-admin/competencies/deployment",
      color: "bg-orange-500",
      stats: `${stats.activeDeployments} active deployments`,
    },
    {
      title: "Import/Export Center",
      description: "Import templates from external sources and export your custom templates",
      icon: Upload,
      href: "/dashboard/school-admin/competencies/import-export",
      color: "bg-teal-500",
      stats: "Bulk operations available",
    },
  ]

  const quickActions = [
    {
      title: "Create New Template",
      description: "Start building a custom competency template",
      icon: Plus,
      href: "/dashboard/school-admin/competencies/builder",
      variant: "default" as const,
    },
    {
      title: "Deploy Competencies",
      description: "Assign competencies to students or programs",
      icon: Target,
      href: "/dashboard/school-admin/competencies/deployment",
      variant: "outline" as const,
    },
    {
      title: "View Analytics",
      description: "Check performance and completion metrics",
      icon: Activity,
      href: "/dashboard/school-admin/competencies/dashboard",
      variant: "outline" as const,
    },
  ]

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-primary border-b-2" />
          <p className="text-muted-foreground">Loading competencies...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">Competency Management</h1>
          <p className="text-muted-foreground">
            Manage templates, deploy assessments, and track student progress
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/school-admin/competencies/builder">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Template
            </Button>
          </Link>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Total Templates</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{stats.totalTemplates}</div>
            <p className="text-muted-foreground text-xs">Available for deployment</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Active Deployments</CardTitle>
            <Rocket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{stats.activeDeployments}</div>
            <p className="text-muted-foreground text-xs">Currently running</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Completion Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{stats.completionRate}%</div>
            <p className="text-muted-foreground text-xs">Average across all assignments</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Total Assignments</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{stats.totalAssignments}</div>
            <p className="text-muted-foreground text-xs">Student assignments</p>
          </CardContent>
        </Card>
      </div>

      {/* Core Competency Features */}
      <div className="space-y-6">
        <div>
          <h2 className="mb-4 font-semibold text-xl">Core Features</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {competencyFeatures.map((feature) => {
              const IconComponent = feature.icon
              return (
                <Link key={feature.title} href={feature.href}>
                  <Card className="group h-full cursor-pointer transition-all duration-200 hover:shadow-lg">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className={`rounded-lg p-2 ${feature.color} text-white`}>
                          <IconComponent className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle className="text-lg transition-colors group-hover:text-primary">
                            {feature.title}
                          </CardTitle>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="mb-3">{feature.description}</CardDescription>
                      <Badge variant="secondary" className="text-xs">
                        {feature.stats}
                      </Badge>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Deployment & Import Features */}
        <div>
          <h2 className="mb-4 font-semibold text-xl">Deployment & Import</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {deploymentFeatures.map((feature) => {
              const IconComponent = feature.icon
              return (
                <Link key={feature.title} href={feature.href}>
                  <Card className="group h-full cursor-pointer transition-all duration-200 hover:shadow-lg">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className={`rounded-lg p-2 ${feature.color} text-white`}>
                          <IconComponent className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle className="text-lg transition-colors group-hover:text-primary">
                            {feature.title}
                          </CardTitle>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="mb-3">{feature.description}</CardDescription>
                      <Badge variant="secondary" className="text-xs">
                        {feature.stats}
                      </Badge>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="space-y-4">
        <h2 className="font-semibold text-xl">Quick Actions</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {quickActions.map((action) => {
            const IconComponent = action.icon
            return (
              <Link key={action.title} href={action.href}>
                <Card className="group cursor-pointer transition-all duration-200 hover:shadow-md">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <IconComponent className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
                      <div>
                        <h3 className="font-medium transition-colors group-hover:text-primary">
                          {action.title}
                        </h3>
                        <p className="text-muted-foreground text-sm">{action.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
