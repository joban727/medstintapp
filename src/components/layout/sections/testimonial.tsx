"use client"

import {
  Award,
  BarChart3,
  BookOpen,
  Building2,
  Calendar,
  ClipboardCheck,
  Clock,
  FileCheck,
  GraduationCap,
  LayoutDashboard,
  MapPin,
  Plus,
  Settings,
  Target,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { getNavigationItems, getQuickActions } from "../../../lib/auth"
import { cn } from "../../../lib/utils"
import type { UserRole } from "../../../types"
import { Badge } from "../../ui/badge"
import { Button } from "../../ui/button"

// Icon mapping for dynamic navigation
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Users,
  GraduationCap,
  Building2,
  MapPin,
  Calendar,
  Clock,
  ClipboardCheck,
  BarChart3,
  Settings,
  Award,
  Target,
  BookOpen,
  TrendingUp,
  Plus,
  UserCheck,
  FileCheck,
}

interface SidebarProps {
  userRole: UserRole
}

export function Sidebar({ userRole }: SidebarProps) {
  const pathname = usePathname()
  const [isCollapsed, _setIsCollapsed] = useState(false)

  const navigationItems = getNavigationItems(userRole)
  const quickActions = getQuickActions(userRole)

  return (
    <aside
      className={cn(
        "fixed top-16 left-0 z-40 h-[calc(100vh-4rem)] border-gray-200 border-r bg-white transition-all duration-300",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex h-full flex-col">
        {/* Navigation Header */}
        <div className="border-gray-100 border-b p-4">
          <div className={cn("flex items-center justify-between", isCollapsed && "justify-center")}>
            {!isCollapsed && (
              <div className="flex items-center space-x-2">
                <GraduationCap className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium text-blue-900 text-sm">Clinical Education</p>
                  <p className="text-blue-600 text-xs">Management System</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-2 p-4">
          {navigationItems.map((item) => {
            const Icon = iconMap[item.icon] || LayoutDashboard
            const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center space-x-3 rounded-lg px-3 py-2 font-medium text-sm transition-colors",
                  isActive
                    ? "border-blue-700 border-r-2 bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                  isCollapsed && "justify-center px-2"
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 flex-shrink-0",
                    isActive ? "text-blue-700" : "text-gray-400"
                  )}
                />
                {!isCollapsed && (
                  <>
                    <span className="flex-1">{item.name}</span>
                    {item.badge && (
                      <Badge variant="destructive" className="text-xs">
                        {item.badge}
                      </Badge>
                    )}
                  </>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Quick Actions */}
        {!isCollapsed && quickActions.length > 0 && (
          <div className="border-gray-100 border-t p-4">
            <h3 className="mb-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">
              Quick Actions
            </h3>
            <div className="space-y-2">
              {quickActions.map((action) => {
                const Icon = iconMap[action.icon] || Plus
                return (
                  <Button
                    key={action.name}
                    variant="outline"
                    size="sm"
                    className={cn("w-full justify-start", action.color)}
                    asChild
                  >
                    <Link href={action.href}>
                      <div className="flex items-center">
                        <Icon className="mr-2 h-4 w-4" />
                        {action.name}
                      </div>
                    </Link>
                  </Button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
