"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Settings,
  FileText,
  Calendar,
  Clock,
  Award,
  Activity,
  Building2,
  GraduationCap,
  ClipboardCheck,
  BarChart3,
} from "lucide-react"
import { Sidebar, type SidebarItem } from "./sidebar"
import { Header } from "./header"
import type { UserRole } from "../../types"

interface DashboardLayoutClientProps {
  children: React.ReactNode
  user: {
    id: string
    email: string
    name: string
    role: UserRole
    schoolId: string | null
    programId: string | null
  }
}

// Map roles to navigation items using Lucide icons
function getNavItems(role: UserRole): SidebarItem[] {
  const baseItems = [{ name: "Settings", href: "/dashboard/settings", icon: Settings }]

  switch (role) {
    case "SUPER_ADMIN":
      return [
        { name: "Dashboard", href: "/dashboard/admin", icon: LayoutDashboard },
        { name: "Reports", href: "/dashboard/admin/reports", icon: BarChart3 },
        { name: "Users", href: "/dashboard/admin/users", icon: Users },
        { name: "Schools", href: "/dashboard/admin/schools", icon: Building2 },
        { name: "Clinical Sites", href: "/dashboard/admin/sites", icon: Building2 },
        { name: "Audit Logs", href: "/dashboard/admin/audit", icon: FileText },
        ...baseItems,
      ]
    case "SCHOOL_ADMIN":
      return [
        { name: "Dashboard", href: "/dashboard/school-admin", icon: LayoutDashboard },
        { name: "Students", href: "/dashboard/school-admin/students", icon: GraduationCap },
        { name: "Faculty & Staff", href: "/dashboard/school-admin/faculty-staff", icon: Users },
        { name: "Programs", href: "/dashboard/school-admin/programs", icon: BookOpen },
        { name: "Clinical Sites", href: "/dashboard/school-admin/sites", icon: Building2 },
        { name: "Rotations", href: "/dashboard/school-admin/rotations", icon: Calendar },
        { name: "Time Records", href: "/dashboard/school-admin/time-records", icon: Clock },
        { name: "Competencies", href: "/dashboard/school-admin/competencies", icon: Award },
        { name: "Reports", href: "/dashboard/school-admin/reports", icon: BarChart3 },
        ...baseItems,
      ]
    case "CLINICAL_PRECEPTOR":
      return [
        { name: "Dashboard", href: "/dashboard/clinical-preceptor", icon: LayoutDashboard },
        { name: "My Students", href: "/dashboard/clinical-preceptor/students", icon: Users },
        { name: "Schedule", href: "/dashboard/clinical-preceptor/schedule", icon: Calendar },
        {
          name: "Evaluations",
          href: "/dashboard/clinical-preceptor/evaluations",
          icon: ClipboardCheck,
        },
        { name: "Time Records", href: "/dashboard/clinical-preceptor/time-records", icon: Clock },
        ...baseItems,
      ]
    case "CLINICAL_SUPERVISOR":
      return [
        { name: "Dashboard", href: "/dashboard/clinical-supervisor", icon: LayoutDashboard },
        { name: "Students", href: "/dashboard/clinical-supervisor/students", icon: Users },
        {
          name: "Assessments",
          href: "/dashboard/clinical-supervisor/assessments",
          icon: ClipboardCheck,
        },
        { name: "Evaluations", href: "/dashboard/clinical-supervisor/evaluations", icon: FileText },
        { name: "Progress", href: "/dashboard/clinical-supervisor/progress", icon: Activity },
        ...baseItems,
      ]
    case "STUDENT":
      return [
        { name: "Dashboard", href: "/dashboard/student", icon: LayoutDashboard },
        { name: "Rotations", href: "/dashboard/student/rotations", icon: Calendar },
        { name: "Time Records", href: "/dashboard/student/time-records", icon: Clock },
        { name: "Clinical Sites", href: "/dashboard/student/clinical-sites", icon: Building2 },
        ...baseItems,
      ]
    default:
      return [{ name: "Dashboard", href: "/dashboard", icon: LayoutDashboard }, ...baseItems]
  }
}

// Get header tabs based on current path and role
function getHeaderTabs(role: UserRole, pathname: string) {
  // This can be customized to show sub-navigation as tabs in the header
  // For now, we'll return empty or specific tabs for complex pages
  return []
}

export function DashboardLayoutClient({ children, user }: DashboardLayoutClientProps) {
  const pathname = usePathname()
  const navItems = getNavItems(user.role)
  const headerTabs = getHeaderTabs(user.role, pathname)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  // Determine title based on current path
  const currentItem = navItems.find(
    (item) =>
      item.href === pathname || (item.href !== "/dashboard" && pathname.startsWith(item.href))
  )
  const title = currentItem?.name || "Dashboard"

  return (
    <div className="dashboard-outer-frame">
      <div className="dashboard-unified-container flex flex-1">
        <Sidebar
          items={navItems}
          user={user}
          unified
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />

        <main className="dashboard-content-area">
          <Header
            title={title}
            tabs={headerTabs}
            isSidebarCollapsed={isSidebarCollapsed}
            onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          />

          <div className="dashboard-content-scroll p-4 sm:p-6 lg:p-8 animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
