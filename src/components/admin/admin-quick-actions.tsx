"use client"

import {
  Activity,
  BarChart3,
  Building2,
  FileText,
  School,
  Settings,
  Shield,
  Users,
} from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface QuickAction {
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  href: string
  color: string
  bgColor: string
  badge?: {
    count: number
    variant: "default" | "secondary" | "destructive" | "outline"
  }
}

interface AdminQuickActionsProps {
  className?: string
}

export function AdminQuickActions({ className }: AdminQuickActionsProps) {
  const quickActions: QuickAction[] = [
    {
      title: "User Management",
      description: "Manage system users and permissions",
      icon: Users,
      href: "/dashboard/admin/users",
      color: "text-blue-600",
      bgColor: "bg-blue-100",
      badge: { count: 12, variant: "secondary" },
    },
    {
      title: "School Management",
      description: "Oversee educational institutions",
      icon: School,
      href: "/dashboard/admin/schools",
      color: "text-green-600",
      bgColor: "bg-green-100",
      badge: { count: 3, variant: "default" },
    },
    {
      title: "Clinical Sites",
      description: "Manage clinical training locations",
      icon: Building2,
      href: "/dashboard/admin/clinical-sites",
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      title: "System Reports",
      description: "View comprehensive system analytics",
      icon: BarChart3,
      href: "/dashboard/admin/reports",
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    },
    {
      title: "Performance Monitor",
      description: "Real-time system performance metrics",
      icon: Activity,
      href: "/admin/performance",
      color: "text-cyan-600",
      bgColor: "bg-cyan-100",
    },
    {
      title: "System Settings",
      description: "Configure platform settings",
      icon: Settings,
      href: "/dashboard/admin/settings",
      color: "text-gray-600",
      bgColor: "bg-gray-100",
    },
    {
      title: "Security & Audit",
      description: "Monitor security and audit logs",
      icon: Shield,
      href: "/dashboard/admin/audit",
      color: "text-red-600",
      bgColor: "bg-red-100",
      badge: { count: 5, variant: "destructive" },
    },
    {
      title: "Documentation",
      description: "System documentation and guides",
      icon: FileText,
      href: "/dashboard/admin/docs",
      color: "text-indigo-600",
      bgColor: "bg-indigo-100",
    },
  ]

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-xl">Quick Actions</h2>
        <Badge variant="outline" className="text-xs">
          8 Actions Available
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {quickActions.map((action) => {
          const Icon = action.icon

          return (
            <Card
              key={action.title}
              className="group hover:-translate-y-1 relative overflow-hidden transition-all hover:shadow-lg"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

              <CardHeader className="relative">
                <div className="flex items-start justify-between">
                  <div className={cn("rounded-lg p-2", action.bgColor)}>
                    <Icon className={cn("h-5 w-5", action.color)} />
                  </div>
                  {action.badge && (
                    <Badge variant={action.badge.variant} className="text-xs">
                      {action.badge.count}
                    </Badge>
                  )}
                </div>
                <CardTitle className="mt-3 text-base">{action.title}</CardTitle>
                <CardDescription className="text-xs">{action.description}</CardDescription>
              </CardHeader>

              <CardContent>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="w-full transition-colors group-hover:bg-primary group-hover:text-primary-foreground"
                >
                  <Link href={action.href}>Access {action.title.split(" ")[0]}</Link>
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
