"use client"

import {
  RiAwardLine,
  RiBankCardLine,
  RiBarChartLine,
  RiBookOpenLine,
  RiCalendarLine,
  RiClockwiseLine,
  RiCodeSSlashLine,
  RiFileTextLine,
  RiHospitalLine,
  RiLineChartLine,
  RiRocketLine,
  RiSchoolLine,
  RiSettingsLine,
  RiSpeedUpLine,
  RiStethoscopeLine,
  RiTeamLine,
  RiToolsFill,
  RiUserLine,
} from "@remixicon/react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type * as React from "react"
import { NavUser } from "@/components/layout/nav-user"
import React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { site } from "@/config/site"
import type { UserRole } from "@/types"
import { useTheme } from "next-themes"

// Role-based navigation data
const getRoleBasedNavigation = (userRole: UserRole) => {
  const baseItems = [{ title: "Settings", url: "/dashboard/settings", icon: RiSettingsLine }]

  switch (userRole) {
    case "SUPER_ADMIN":
      return {
        navMain: [
          {
            title: "Overview",
            items: [{ title: "Dashboard", url: "/dashboard/admin", icon: RiSpeedUpLine }],
          },
          {
            title: "People Management",
            items: [{ title: "User Management", url: "/dashboard/admin/users", icon: RiUserLine }],
          },
          {
            title: "Institution Management",
            items: [
              { title: "School Management", url: "/dashboard/admin/schools", icon: RiSchoolLine },
              { title: "Clinical Sites", url: "/dashboard/admin/sites", icon: RiHospitalLine },
            ],
          },
          {
            title: "Tools & Configuration",
            items: [
              { title: "Audit Logs", url: "/dashboard/admin/audit", icon: RiFileTextLine },
              ...baseItems,
            ],
          },
        ],
      }
    case "SCHOOL_ADMIN":
      return {
        navMain: [
          {
            title: "Overview",
            items: [
              { title: "Dashboard", url: "/dashboard/school-admin", icon: RiSpeedUpLine },
              {
                title: "Reports & Analytics",
                url: "/dashboard/school-admin/reports",
                icon: RiBarChartLine,
              },
            ],
          },
          {
            title: "People Management",
            items: [
              { title: "Students", url: "/dashboard/school-admin/students", icon: RiUserLine },
              {
                title: "Faculty & Staff",
                url: "/dashboard/school-admin/faculty-staff",
                icon: RiTeamLine,
              },
            ],
          },
          {
            title: "Academic Programs",
            items: [
              { title: "Programs", url: "/dashboard/school-admin/programs", icon: RiSchoolLine },
              {
                title: "Clinical Sites",
                url: "/dashboard/school-admin/sites",
                icon: RiHospitalLine,
              },
              {
                title: "Rotations",
                url: "/dashboard/school-admin/rotations",
                icon: RiCalendarLine,
              },
            ],
          },
          {
            title: "Time Management",
            items: [
              {
                title: "Time Records",
                url: "/dashboard/school-admin/time-records",
                icon: RiClockwiseLine,
              },
            ],
          },
          {
            title: "Competency Management",
            items: [
              {
                title: "Dashboard",
                url: "/dashboard/school-admin/competencies/dashboard",
                icon: RiSpeedUpLine,
              },
              {
                title: "Templates",
                url: "/dashboard/school-admin/competencies/templates",
                icon: RiBookOpenLine,
              },
              {
                title: "Builder",
                url: "/dashboard/school-admin/competencies/builder",
                icon: RiToolsFill,
              },
            ],
          },
          {
            title: "Tools & Configuration",
            items: [
              {
                title: "Templates Builder",
                url: "/dashboard/school-admin/templates-builder",
                icon: RiToolsFill,
              },
              {
                title: "Deployment",
                url: "/dashboard/school-admin/competencies/deployment",
                icon: RiRocketLine,
              },
              {
                title: "Import/Export",
                url: "/dashboard/school-admin/competencies/import-export",
                icon: RiFileTextLine,
              },
              ...baseItems,
            ],
          },
        ],
      }
    case "CLINICAL_PRECEPTOR":
      return {
        navMain: [
          {
            title: "Overview",
            items: [
              { title: "Dashboard", url: "/dashboard/clinical-preceptor", icon: RiSpeedUpLine },
              {
                title: "Reports & Analytics",
                url: "/dashboard/clinical-preceptor/reports",
                icon: RiBarChartLine,
              },
            ],
          },
          {
            title: "People Management",
            items: [
              {
                title: "My Students",
                url: "/dashboard/clinical-preceptor/students",
                icon: RiUserLine,
              },
            ],
          },
          {
            title: "Time Management",
            items: [
              {
                title: "Time Records",
                url: "/dashboard/clinical-preceptor/time-records",
                icon: RiClockwiseLine,
              },
              {
                title: "Schedule",
                url: "/dashboard/clinical-preceptor/schedule",
                icon: RiCalendarLine,
              },
            ],
          },
          {
            title: "Assessment & Evaluation",
            items: [
              {
                title: "Evaluations",
                url: "/dashboard/clinical-preceptor/evaluations",
                icon: RiFileTextLine,
              },
            ],
          },
          {
            title: "Tools & Configuration",
            items: [...baseItems],
          },
        ],
      }
    case "CLINICAL_SUPERVISOR":
      return {
        navMain: [
          {
            title: "Overview",
            items: [
              { title: "Dashboard", url: "/dashboard/clinical-supervisor", icon: RiSpeedUpLine },
              {
                title: "Reports & Analytics",
                url: "/dashboard/clinical-supervisor/reports",
                icon: RiLineChartLine,
              },
              {
                title: "Analytics",
                url: "/dashboard/clinical-supervisor/analytics",
                icon: RiLineChartLine,
              },
            ],
          },
          {
            title: "People Management",
            items: [
              {
                title: "Students",
                url: "/dashboard/clinical-supervisor/students",
                icon: RiUserLine,
              },
              {
                title: "Student Progress",
                url: "/dashboard/clinical-supervisor/progress",
                icon: RiBarChartLine,
              },
            ],
          },
          {
            title: "Competency Management",
            items: [
              {
                title: "Competency Assessments",
                url: "/dashboard/clinical-supervisor/competencies",
                icon: RiAwardLine,
              },
              {
                title: "Skills Validation",
                url: "/dashboard/clinical-supervisor/skills",
                icon: RiStethoscopeLine,
              },
            ],
          },
          {
            title: "Assessment & Evaluation",
            items: [
              {
                title: "Assessments",
                url: "/dashboard/clinical-supervisor/assessments",
                icon: RiFileTextLine,
              },
              {
                title: "Evaluations",
                url: "/dashboard/clinical-supervisor/evaluations",
                icon: RiFileTextLine,
              },
              {
                title: "Quality",
                url: "/dashboard/clinical-supervisor/quality",
                icon: RiAwardLine,
              },
            ],
          },
          {
            title: "Tools & Configuration",
            items: [...baseItems],
          },
        ],
      }
    case "STUDENT":
      return {
        navMain: [
          {
            title: "Overview",
            items: [
              { title: "Dashboard", url: "/dashboard/student", icon: RiSpeedUpLine },
              {
                title: "Progress Reports",
                url: "/dashboard/student/reports",
                icon: RiBarChartLine,
              },
            ],
          },
          {
            title: "Academic Programs",
            items: [
              { title: "Rotations", url: "/dashboard/student/rotations", icon: RiCalendarLine },
            ],
          },
          {
            title: "Time Management",
            items: [
              {
                title: "Time Records",
                url: "/dashboard/student/time-records",
                icon: RiClockwiseLine,
              },
            ],
          },
          {
            title: "Competency Management",
            items: [
              { title: "Competencies", url: "/dashboard/student/competencies", icon: RiAwardLine },
            ],
          },
          {
            title: "Assessment & Evaluation",
            items: [
              { title: "Evaluations", url: "/dashboard/student/evaluations", icon: RiFileTextLine },
            ],
          },
          {
            title: "Tools & Configuration",
            items: [
              {
                title: "Settings",
                url: "/dashboard/student/settings",
                icon: RiSettingsLine,
              },
            ],
          },
        ],
      }
    default:
      return {
        navMain: [
          {
            title: "General",
            items: [
              { title: "Dashboard", url: "/dashboard", icon: RiSpeedUpLine },
              { title: "Analytics", url: "/dashboard/analytics", icon: RiLineChartLine },
              { title: "Integrations", url: "/dashboard/integrations", icon: RiToolsFill },
              { title: "Settings", url: "/dashboard/settings", icon: RiSettingsLine },
              { title: "Billing", url: "/dashboard/billing", icon: RiBankCardLine },
              { title: "API", url: "/dashboard/api", icon: RiCodeSSlashLine },
            ],
          },
        ],
      }
  }
}

function SidebarLogo() {
  return (
    <div className="flex gap-2 px-2 transition-[padding] duration-300 ease-out group-data-[collapsible=icon]:px-0">
      <Link
        className="group/logo inline-flex items-center gap-2 transition-all duration-300 ease-out"
        href="/dashboard"
      >
        <span className="sr-only">{site.name}</span>
        <Image
          src="/logo-medstint.svg"
          alt={site.name}
          width={30}
          height={30}
          className="transition-transform duration-300 ease-out group-data-[collapsible=icon]:scale-110"
        />
        <span className="group-data-[collapsible=icon]:-ml-2 truncate font-bold text-lg transition-[margin,opacity,transform,width] duration-300 ease-out group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:scale-95 group-data-[collapsible=icon]:opacity-0">
          {site.name}
        </span>
      </Link>
    </div>
  )
}

interface User {
  id: string
  email: string
  name: string
  role: UserRole
  schoolId: string | null
  programId: string | null
}

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user: User
}

export function AppSidebar({ user, ...props }: AppSidebarProps) {
  const pathname = usePathname()
  const navigationData = getRoleBasedNavigation(user.role)
  
  // Determine if this role has complex navigation (multiple links per category)
  const hasComplexNavigation = ["SCHOOL_ADMIN", "SUPER_ADMIN", "CLINICAL_SUPERVISOR"].includes(user.role)

  return (
    <Sidebar collapsible="icon" variant="inset" {...props}>
      <SidebarHeader className="mb-4 h-13 justify-center max-md:mt-2">
        <SidebarLogo />
      </SidebarHeader>
      <SidebarContent className="-mt-2">
        {navigationData.navMain.map((item, index) => (
          <React.Fragment key={item.title}>
            <SidebarGroup>
              {/* Only show section title if there are more than 2 items */}
              {item.items.length > 2 && (
                <SidebarGroupLabel className="text-muted-foreground/65 uppercase">
                  {item.title}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {item.items.map((item) => {
                    const isActive = pathname === item.url

                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          className="group/menu-button group-data-[collapsible=icon]:!px-[5px] h-9 gap-3 font-medium transition-all duration-300 ease-out [&>svg]:size-auto"
                          tooltip={item.title}
                          isActive={isActive}
                        >
                          <Link href={item.url} className="flex items-center gap-3">
                            {item.icon && (
                              <item.icon
                                className="text-muted-foreground/65 group-data-[active=true]/menu-button:text-primary"
                                size={22}
                                aria-hidden="true"
                              />
                            )}
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            {/* Add separator between groups for complex navigation, but not after the last group */}
            {hasComplexNavigation && index < navigationData.navMain.length - 1 && (
              <SidebarSeparator className="my-2" />
            )}
          </React.Fragment>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
