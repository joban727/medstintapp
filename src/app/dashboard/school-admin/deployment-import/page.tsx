"use client"

import {
  CheckCircle,
  Clock,
  Download,
  Pause,
  Play,
  Rocket,
  Target,
  Upload,
  Users,
} from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface DeploymentStats {
  activeDeployments: number
  totalAssignments: number
  completionRate: number
  pendingImports: number
}

export default function DeploymentImportPage() {
  const [stats, setStats] = useState<DeploymentStats>({
    activeDeployments: 0,
    totalAssignments: 0,
    completionRate: 0,
    pendingImports: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Mock data - replace with actual API calls
        setStats({
          activeDeployments: 8,
          totalAssignments: 156,
          completionRate: 78,
          pendingImports: 3,
        })
      } catch (error) {
        console.error("Error fetching deployment stats:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  const deploymentFeatures = [
    {
      title: "Deployment Console",
      description:
        "Deploy competencies to students and programs, monitor progress, and manage active assignments",
      icon: Rocket,
      href: "/dashboard/school-admin/competencies/deployment",
      color: "bg-orange-500",
      stats: `${stats.activeDeployments} active deployments`,
      features: [
        "Deploy to individuals or groups",
        "Real-time progress tracking",
        "Automated notifications",
        "Deadline management",
      ],
    },
    {
      title: "Import/Export Center",
      description:
        "Import templates from external sources and export your custom templates for sharing or backup",
      icon: Upload,
      href: "/dashboard/school-admin/competencies/import-export",
      color: "bg-teal-500",
      stats: `${stats.pendingImports} pending imports`,
      features: [
        "Bulk template import",
        "Export to multiple formats",
        "Validation and mapping",
        "Version control",
      ],
    },
  ]

  const quickActions = [
    {
      title: "New Deployment",
      description: "Deploy competencies to students or programs",
      icon: Play,
      href: "/dashboard/school-admin/competencies/deployment",
      variant: "default" as const,
    },
    {
      title: "Import Templates",
      description: "Import competency templates from external sources",
      icon: Upload,
      href: "/dashboard/school-admin/competencies/import-export",
      variant: "outline" as const,
    },
    {
      title: "Export Data",
      description: "Export templates and deployment data",
      icon: Download,
      href: "/dashboard/school-admin/competencies/import-export",
      variant: "outline" as const,
    },
  ]

  const recentDeployments = [
    {
      name: "Internal Medicine Q1 2024",
      status: "Active",
      progress: 78,
      assigned: 24,
      completed: 19,
      dueDate: "2024-03-15",
    },
    {
      name: "Surgery Skills Assessment",
      status: "Active",
      progress: 45,
      assigned: 12,
      completed: 5,
      dueDate: "2024-02-28",
    },
    {
      name: "Pediatrics Rotation Eval",
      status: "Completed",
      progress: 100,
      assigned: 18,
      completed: 18,
      dueDate: "2024-01-30",
    },
  ]

  const _getStatusColor = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-green-500"
      case "Completed":
        return "bg-blue-500"
      case "Paused":
        return "bg-yellow-500"
      default:
        return "bg-gray-500"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Active":
        return Play
      case "Completed":
        return CheckCircle
      case "Paused":
        return Pause
      default:
        return Clock
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-primary border-b-2" />
          <p className="text-muted-foreground">Loading deployment data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">Deployment & Import</h1>
          <p className="text-muted-foreground">
            Deploy competencies to students and manage template imports/exports
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/school-admin/competencies/import-export">
            <Button variant="outline">
              <Upload className="mr-2 h-4 w-4" />
              Import Templates
            </Button>
          </Link>
          <Link href="/dashboard/school-admin/competencies/deployment">
            <Button>
              <Rocket className="mr-2 h-4 w-4" />
              New Deployment
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
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
            <CardTitle className="font-medium text-sm">Total Assignments</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{stats.totalAssignments}</div>
            <p className="text-muted-foreground text-xs">Student assignments</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Completion Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{stats.completionRate}%</div>
            <p className="text-muted-foreground text-xs">Average completion</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Pending Imports</CardTitle>
            <Upload className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{stats.pendingImports}</div>
            <p className="text-muted-foreground text-xs">Awaiting processing</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Features */}
      <div className="grid gap-8 lg:grid-cols-2">
        {deploymentFeatures.map((feature) => {
          const IconComponent = feature.icon
          return (
            <Card key={feature.title} className="group transition-all duration-200 hover:shadow-lg">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-3 ${feature.color} text-white`}>
                    <IconComponent className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                    <Badge variant="secondary" className="mt-1">
                      {feature.stats}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <CardDescription className="text-base">{feature.description}</CardDescription>
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Key Features:</h4>
                  <ul className="space-y-1">
                    {feature.features.map((item, index) => (
                      <li
                        key={`feature-${feature.title}-${index}`}
                        className="flex items-center gap-2 text-muted-foreground text-sm"
                      >
                        <div className="h-1 w-1 rounded-full bg-muted-foreground" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <Link href={feature.href}>
                  <Button className="w-full transition-colors group-hover:bg-primary/90">
                    Access {feature.title}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )
        })}
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

      {/* Recent Deployments */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-xl">Recent Deployments</h2>
          <Link href="/dashboard/school-admin/competencies/deployment">
            <Button variant="outline" size="sm">
              View All
            </Button>
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {recentDeployments.map((deployment) => {
            const StatusIcon = getStatusIcon(deployment.status)
            return (
              <Card key={deployment.name} className="transition-all duration-200 hover:shadow-md">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-sm">{deployment.name}</h3>
                      <div className="flex items-center gap-1">
                        <StatusIcon className={"h-3 w-3 text-white"} />
                        <Badge
                          variant={
                            deployment.status === "Active"
                              ? "default"
                              : deployment.status === "Completed"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {deployment.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-muted-foreground text-xs">
                        <span>Progress</span>
                        <span>{deployment.progress}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-primary transition-all duration-300"
                          style={{ width: `${deployment.progress}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex justify-between text-muted-foreground text-xs">
                      <span>
                        {deployment.completed}/{deployment.assigned} completed
                      </span>
                      <span>Due {deployment.dueDate}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
