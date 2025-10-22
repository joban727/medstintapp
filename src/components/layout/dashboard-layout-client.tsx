"use client"

import { ROLE_COLORS, ROLE_DISPLAY_NAMES } from "../../lib/auth"
import type { UserRole } from "../../types"
import { AppSidebar } from "../landing/medstint-features"
import { Badge } from "../ui/badge"
import { Separator } from "../ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "../ui/sidebar"
import { DynamicBreadcrumb } from "./dynamic-breadcrumb"
import { ModeToggle } from "./mode-toggle"
import { NavUser } from "./nav-user"
import { SchoolNameDisplay } from "./school-name-display"

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

export function DashboardLayoutClient({ children, user }: DashboardLayoutClientProps) {
  const roleColor = ROLE_COLORS[user.role] || "default"
  const roleDisplayName = ROLE_DISPLAY_NAMES[user.role] || user.role

  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar user={user} />
      <SidebarInset>
        <div className="@container">
          <div className="mx-auto w-full">
            <header className="flex flex-wrap items-center gap-3 border-b p-3 transition-all ease-linear">
              <div className="flex flex-1 items-center gap-2">
                <SidebarTrigger className="rounded-full" />
                <div className="max-lg:hidden lg:contents">
                  <Separator
                    orientation="vertical"
                    className="me-2 data-[orientation=vertical]:h-4"
                  />
                  <DynamicBreadcrumb />
                </div>
              </div>

              {/* Center - School Name and Role Badge */}
              <div className="flex items-center gap-3">
                <SchoolNameDisplay user={user} />
                <Separator orientation="vertical" className="h-4" />
                <Badge variant="secondary" className={`text-xs ${roleColor}`}>
                  {roleDisplayName}
                </Badge>
              </div>

              {/* Right side */}
              <div className="flex items-center gap-2">
                <ModeToggle />
                <NavUser user={user} />
              </div>
            </header>
            <div className="overflow-hidden">
              <div className="container p-6">{children}</div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
