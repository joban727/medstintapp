"use client"

import { BookOpen, Download, Eye, FileText, Plus, Search, Star, Wrench } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface TemplateStats {
  totalTemplates: number
  customTemplates: number
  officialTemplates: number
  recentlyUsed: number
}

export default function TemplatesBuilderPage() {
  const [stats, setStats] = useState<TemplateStats>({
    totalTemplates: 0,
    customTemplates: 0,
    officialTemplates: 0,
    recentlyUsed: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Mock data - replace with actual API calls
        setStats({
          totalTemplates: 24,
          customTemplates: 8,
          officialTemplates: 16,
          recentlyUsed: 5,
        })
      } catch (error) {
        console.error("Error fetching template stats:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  const templateFeatures = [
    {
      title: "Template Library",
      description:
        "Browse and manage official and custom competency templates from various medical specialties",
      icon: BookOpen,
      href: "/dashboard/school-admin/competencies/templates",
      color: "bg-blue-500",
      stats: `${stats.totalTemplates} templates available`,
      features: [
        "Browse official templates",
        "Search by specialty or category",
        "Preview template content",
        "Download and customize",
      ],
    },
    {
      title: "Custom Builder",
      description:
        "Create, edit, and customize competency templates with detailed rubrics and assessment criteria",
      icon: Wrench,
      href: "/dashboard/school-admin/competencies/builder",
      color: "bg-purple-500",
      stats: `${stats.customTemplates} custom templates`,
      features: [
        "Drag-and-drop builder",
        "Custom rubric creation",
        "Template versioning",
        "Real-time preview",
      ],
    },
  ]

  const quickActions = [
    {
      title: "Create New Template",
      description: "Start building a custom competency template from scratch",
      icon: Plus,
      href: "/dashboard/school-admin/competencies/builder",
      variant: "default" as const,
    },
    {
      title: "Browse Templates",
      description: "Explore available templates and find the right fit",
      icon: Search,
      href: "/dashboard/school-admin/competencies/templates",
      variant: "outline" as const,
    },
    {
      title: "Import Template",
      description: "Import templates from external sources",
      icon: Download,
      href: "/dashboard/school-admin/competencies/import-export",
      variant: "outline" as const,
    },
  ]

  const recentTemplates = [
    {
      name: "General Radiology Core",
      category: "General Radiology",
      lastModified: "2 days ago",
      status: "Published",
    },
    {
      name: "MRI Safety & Procedures",
      category: "MRI",
      lastModified: "1 week ago",
      status: "Draft",
    },
    {
      name: "Pediatric Imaging Protocols",
      category: "Pediatric Radiology",
      lastModified: "2 weeks ago",
      status: "Published",
    },
  ]

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-primary border-b-2" />
          <p className="text-muted-foreground">Loading templates...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">Templates & Builder</h1>
          <p className="text-muted-foreground">
            Create, customize, and manage competency templates for your programs
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/school-admin/competencies/templates">
            <Button variant="outline">
              <BookOpen className="mr-2 h-4 w-4" />
              Browse Templates
            </Button>
          </Link>
          <Link href="/dashboard/school-admin/competencies/builder">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Template
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Total Templates</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{stats.totalTemplates}</div>
            <p className="text-muted-foreground text-xs">Available in library</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Custom Templates</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{stats.customTemplates}</div>
            <p className="text-muted-foreground text-xs">Created by your school</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Official Templates</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{stats.officialTemplates}</div>
            <p className="text-muted-foreground text-xs">From medical organizations</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Recently Used</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{stats.recentlyUsed}</div>
            <p className="text-muted-foreground text-xs">In the last 30 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Features */}
      <div className="grid gap-8 lg:grid-cols-2">
        {templateFeatures.map((feature) => {
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

      {/* Recent Templates */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-xl">Recent Templates</h2>
          <Link href="/dashboard/school-admin/competencies/templates">
            <Button variant="outline" size="sm">
              View All
            </Button>
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {recentTemplates.map((template, index) => (
            <Card
              key={`template-${template.name}-${index}`}
              className="transition-all duration-200 hover:shadow-md"
            >
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">{template.name}</h3>
                    <Badge variant={template.status === "Published" ? "default" : "secondary"}>
                      {template.status}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-sm">{template.category}</p>
                  <p className="text-muted-foreground text-xs">Modified {template.lastModified}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
