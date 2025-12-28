"use client"

import {
    RiAwardLine,
    RiBarChartLine,
    RiCalendarLine,
    RiClockwiseLine,
    RiFileTextLine,
    RiHospitalLine,
    RiLineChartLine,
    RiMagicLine,
    RiSchoolLine,
    RiSettingsLine,
    RiSpeedUpLine,
    RiStethoscopeLine,
    RiTeamLine,
    RiUserLine,
} from "@remixicon/react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import * as React from "react"
import { NavUser } from "@/components/layout/nav-user"
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarSeparator,
} from "@/components/ui/sidebar"
import { site } from "@/config/site"
import type { UserRole } from "@/types"
import { useTheme } from "next-themes"

const validateEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// Role validation utilities
const hasRole = (userRole: UserRole, allowedRoles: UserRole[]): boolean => {
    return allowedRoles.includes(userRole)
}

const isAdmin = (userRole: UserRole): boolean => {
    return hasRole(userRole, ["ADMIN" as UserRole, "SUPER_ADMIN" as UserRole])
}

const isSchoolAdmin = (userRole: UserRole): boolean => {
    return hasRole(userRole, [
        "SCHOOL_ADMIN" as UserRole,
        "ADMIN" as UserRole,
        "SUPER_ADMIN" as UserRole,
    ])
}

// Role-based navigation data
const getRoleBasedNavigation = (userRole: UserRole) => {
    const baseItems = [{ title: "Settings", url: "/dashboard/settings", icon: RiSettingsLine }]

    switch (userRole) {
        case "SUPER_ADMIN":
            return {
                navMain: [
                    {
                        title: "",
                        items: [
                            { title: "Dashboard", url: "/dashboard/admin", icon: RiSpeedUpLine },
                            { title: "Reports", url: "/dashboard/admin/reports", icon: RiBarChartLine },
                            { title: "Users", url: "/dashboard/admin/users", icon: RiUserLine },
                            { title: "Schools", url: "/dashboard/admin/schools", icon: RiSchoolLine },
                            { title: "Clinical Sites", url: "/dashboard/admin/sites", icon: RiHospitalLine },
                            { title: "Audit Logs", url: "/dashboard/admin/audit", icon: RiFileTextLine },
                        ],
                    },
                    {
                        title: "",
                        items: baseItems,
                    },
                ],
            }

        case "SCHOOL_ADMIN":
            return {
                navMain: [
                    {
                        title: "",
                        items: [
                            { title: "Dashboard", url: "/dashboard/school-admin", icon: RiSpeedUpLine },
                            { title: "Reports", url: "/dashboard/school-admin/reports", icon: RiBarChartLine },
                            { title: "Students", url: "/dashboard/school-admin/students", icon: RiUserLine },
                            { title: "Faculty & Staff", url: "/dashboard/school-admin/faculty-staff", icon: RiTeamLine },
                            { title: "Programs", url: "/dashboard/school-admin/programs", icon: RiSchoolLine },
                            { title: "Clinical Sites", url: "/dashboard/school-admin/sites", icon: RiHospitalLine },
                            { title: "Rotations", url: "/dashboard/school-admin/rotations", icon: RiCalendarLine },
                            { title: "Time Records", url: "/dashboard/school-admin/time-records", icon: RiClockwiseLine },
                            { title: "Competencies", url: "/dashboard/school-admin/competencies", icon: RiAwardLine },
                        ],
                    },
                    {
                        title: "",
                        items: [
                            { title: "School Setup", url: "/dashboard/school-admin/setup", icon: RiMagicLine },
                            ...baseItems,
                        ],
                    },
                ],
            }

        case "CLINICAL_PRECEPTOR":
            return {
                navMain: [
                    {
                        title: "",
                        items: [
                            { title: "Dashboard", url: "/dashboard/clinical-preceptor", icon: RiSpeedUpLine },
                            { title: "Reports", url: "/dashboard/clinical-preceptor/reports", icon: RiBarChartLine },
                            { title: "My Students", url: "/dashboard/clinical-preceptor/students", icon: RiUserLine },
                            { title: "Time Records", url: "/dashboard/clinical-preceptor/time-records", icon: RiClockwiseLine },
                            { title: "Schedule", url: "/dashboard/clinical-preceptor/schedule", icon: RiCalendarLine },
                            { title: "Evaluations", url: "/dashboard/clinical-preceptor/evaluations", icon: RiFileTextLine },
                            { title: "Competencies", url: "/dashboard/clinical-preceptor/competencies", icon: RiAwardLine },
                        ],
                    },
                    {
                        title: "",
                        items: baseItems,
                    },
                ],
            }

        case "CLINICAL_SUPERVISOR":
            return {
                navMain: [
                    {
                        title: "",
                        items: [
                            { title: "Dashboard", url: "/dashboard/clinical-supervisor", icon: RiSpeedUpLine },
                            { title: "Reports", url: "/dashboard/clinical-supervisor/reports", icon: RiLineChartLine },
                            { title: "Analytics", url: "/dashboard/clinical-supervisor/analytics", icon: RiBarChartLine },
                            { title: "Students", url: "/dashboard/clinical-supervisor/students", icon: RiUserLine },
                            { title: "Progress", url: "/dashboard/clinical-supervisor/progress", icon: RiBarChartLine },
                            { title: "Competencies", url: "/dashboard/clinical-supervisor/competencies", icon: RiAwardLine },
                            { title: "Skills", url: "/dashboard/clinical-supervisor/skills", icon: RiStethoscopeLine },
                            { title: "Assessments", url: "/dashboard/clinical-supervisor/assessments", icon: RiFileTextLine },
                            { title: "Evaluations", url: "/dashboard/clinical-supervisor/evaluations", icon: RiFileTextLine },
                            { title: "Quality", url: "/dashboard/clinical-supervisor/quality", icon: RiAwardLine },
                        ],
                    },
                    {
                        title: "",
                        items: baseItems,
                    },
                ],
            }

        case "STUDENT":
            return {
                navMain: [
                    {
                        title: "",
                        items: [
                            { title: "Dashboard", url: "/dashboard/student", icon: RiSpeedUpLine },
                            { title: "Rotations", url: "/dashboard/student/rotations", icon: RiCalendarLine },
                            { title: "Clinical Sites", url: "/dashboard/student/clinical-sites", icon: RiHospitalLine },
                            { title: "Time Records", url: "/dashboard/student/time-records", icon: RiClockwiseLine },
                        ],
                    },
                    {
                        title: "",
                        items: baseItems,
                    },
                ],
            }

        default:
            return {
                navMain: [
                    {
                        title: "",
                        items: [
                            { title: "Dashboard", url: "/dashboard", icon: RiSpeedUpLine },
                            { title: "Settings", url: "/dashboard/settings", icon: RiSettingsLine },
                        ],
                    },
                ],
            }
    }
}

function SidebarLogo() {
    return (
        <div className="flex justify-center gap-2 px-2 transition-[padding] duration-300 ease-out group-data-[collapsible=icon]:px-0">
            <Link
                className="group/logo inline-flex items-center gap-2.5 transition-all duration-300 ease-out"
                href="/dashboard"
            >
                <span className="sr-only">{site.name}</span>
                <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm transition-transform duration-300 ease-out group-data-[collapsible=icon]:scale-110">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-5 w-5"
                    >
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                    </svg>
                </div>
                <span
                    className="group-data-[collapsible=icon]:-ml-2 truncate font-bold text-xl text-sidebar-foreground transition-[margin,opacity,transform,width] duration-300 ease-out group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:scale-95 group-data-[collapsible=icon]:opacity-0"
                >
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
    const hasComplexNavigation = ["SCHOOL_ADMIN", "SUPER_ADMIN", "CLINICAL_SUPERVISOR"].includes(
        user.role
    )

    return (
        <Sidebar collapsible="icon" variant="inset" {...props}>
            <SidebarHeader className="mb-4 h-13 justify-center max-md:mt-2">
                <SidebarLogo />
            </SidebarHeader>
            <SidebarContent className="-mt-2" data-tutorial="sidebar-nav">
                {navigationData.navMain.map((item, index) => (
                    <React.Fragment key={`${item.title}-${index}`}>
                        <SidebarGroup>
                            {/* Only show section title if there are more than 2 items */}
                            {item.items.length > 2 && (
                                <SidebarGroupLabel className="text-sidebar-foreground/60 uppercase">
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
                                                    className="group/menu-button group-data-[collapsible=icon]:!px-[5px] h-9 gap-3 font-medium transition-all duration-300 ease-out [&>svg]:size-auto hover:bg-sidebar-accent"
                                                    tooltip={item.title}
                                                    isActive={isActive}
                                                >
                                                    <Link href={item.url} className="flex items-center gap-3">
                                                        {item.icon && (
                                                            <item.icon
                                                                className="text-sidebar-foreground/70 group-data-[active=true]/menu-button:text-sidebar-accent-foreground"
                                                                size={22}
                                                                aria-hidden="true"
                                                            />
                                                        )}
                                                        <span className="text-sidebar-foreground group-data-[active=true]/menu-button:text-sidebar-accent-foreground">{item.title}</span>
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