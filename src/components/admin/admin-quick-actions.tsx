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
import { QuickActionsFromArray, type QuickAction } from "@/components/ui/quick-actions"
import { cn } from "@/lib/utils"

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
      color: "blue",
      badge: { count: 12, variant: "secondary" },
    },
    {
      title: "School Management",
      description: "Oversee educational institutions",
      icon: School,
      href: "/dashboard/admin/schools",
      color: "green",
      badge: { count: 3, variant: "default" },
    },
    {
      title: "Clinical Sites",
      description: "Manage clinical training locations",
      icon: Building2,
      href: "/dashboard/admin/clinical-sites",
      color: "purple",
    },
    {
      title: "System Reports",
      description: "View comprehensive system analytics",
      icon: BarChart3,
      href: "/dashboard/admin/reports",
      color: "orange",
    },
    {
      title: "Performance Monitor",
      description: "Real-time system performance metrics",
      icon: Activity,
      href: "/admin/performance",
      color: "cyan",
    },
    {
      title: "System Settings",
      description: "Configure platform settings",
      icon: Settings,
      href: "/dashboard/admin/settings",
      color: "gray",
    },
    {
      title: "Security & Audit",
      description: "Monitor security and audit logs",
      icon: Shield,
      href: "/dashboard/admin/audit",
      color: "red",
      badge: { count: 5, variant: "destructive" },
    },
    {
      title: "Documentation",
      description: "System documentation and guides",
      icon: FileText,
      href: "/dashboard/admin/docs",
      color: "indigo",
    },
  ]

  return (
    <QuickActionsFromArray
      title="Quick Actions"
      badge="8 Actions Available"
      actions={quickActions}
      className={className}
    />
  )
}
