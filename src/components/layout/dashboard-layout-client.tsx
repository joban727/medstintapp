"use client"

import { RiArrowLeftLine } from "@remixicon/react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import { HelpCircle } from "lucide-react"
import { ROLE_DISPLAY_NAMES } from "../../lib/auth"
import type { UserRole } from "../../types"
import { AppSidebar } from "./app-sidebar"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "../ui/sidebar"
import { ModeToggle } from "./mode-toggle"
import { NavUser } from "./nav-user"
import { SimpleTutorial } from "../tutorial/simple-tutorial"
import { CommandMenu } from "@/components/dashboard/command-menu"
import { PageTransition } from "@/components/ui/page-transition"

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

// Get navigation tabs based on role and current path
function getNavTabs(userRole: UserRole, basePath: string) {
    switch (userRole) {
        case "SCHOOL_ADMIN":
            return [
                { label: "Dashboard", href: "/dashboard/school-admin" },
                { label: "Students", href: "/dashboard/school-admin/students" },
                { label: "Programs", href: "/dashboard/school-admin/programs" },
                { label: "Reports", href: "/dashboard/school-admin/reports" },
            ]
        case "SUPER_ADMIN":
            return [
                { label: "Dashboard", href: "/dashboard/admin" },
                { label: "Users", href: "/dashboard/admin/users" },
                { label: "Schools", href: "/dashboard/admin/schools" },
            ]
        case "CLINICAL_PRECEPTOR":
            return [
                { label: "Dashboard", href: "/dashboard/clinical-preceptor" },
                { label: "Students", href: "/dashboard/clinical-preceptor/students" },
                { label: "Schedule", href: "/dashboard/clinical-preceptor/schedule" },
            ]
        case "CLINICAL_SUPERVISOR":
            return [
                { label: "Dashboard", href: "/dashboard/clinical-supervisor" },
                { label: "Students", href: "/dashboard/clinical-supervisor/students" },
                { label: "Assessments", href: "/dashboard/clinical-supervisor/assessments" },
            ]
        case "STUDENT":
            return [
                { label: "Dashboard", href: "/dashboard/student" },
                { label: "Rotations", href: "/dashboard/student/rotations" },
                { label: "Time Records", href: "/dashboard/student/time-records" },
            ]
        default:
            return [
                { label: "Dashboard", href: "/dashboard" },
            ]
    }
}

export function DashboardLayoutClient({ children, user }: DashboardLayoutClientProps) {
    const pathname = usePathname()
    const router = useRouter()
    const roleDisplayName = ROLE_DISPLAY_NAMES[user.role] || user.role
    const [tutorialOpen, setTutorialOpen] = useState(false)

    // Get the base dashboard path for the role
    const basePath = pathname.split("/").slice(0, 3).join("/")
    const navTabs = getNavTabs(user.role, basePath)

    // Check if we can go back (not on the main dashboard)
    const canGoBack = pathname !== basePath && pathname.split("/").length > 3

    // Map role to badge variant
    const getRoleBadgeVariant = (role: UserRole) => {
        switch (role) {
            case "SUPER_ADMIN":
                return "destructive"
            case "SCHOOL_ADMIN":
                return "teal"
            case "CLINICAL_SUPERVISOR":
                return "info"
            case "CLINICAL_PRECEPTOR":
                return "success"
            case "STUDENT":
                return "default"
            default:
                return "secondary"
        }
    }

    // Only show tutorial button for school admin
    const showTutorialButton = user.role === "SCHOOL_ADMIN"

    return (
        <SidebarProvider defaultOpen={true}>
            <AppSidebar user={user} />
            <SidebarInset>
                <div className="@container">
                    <div className="mx-auto w-full">
                        {/* Redesigned Header - Reference Design Style */}
                        <header
                            className="sticky top-0 z-40 flex items-center gap-4 bg-background border-b border-border/50 px-4 py-3 transition-all duration-200 md:rounded-t-[2rem] md:border-b-0"
                            data-tutorial="dashboard-header"
                        >
                            {/* Left - Back Button & Sidebar Trigger */}
                            <div className="flex items-center gap-2">
                                <SidebarTrigger className="rounded-xl hover:bg-muted transition-colors" />
                                {canGoBack && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => router.back()}
                                        className="gap-1.5 text-muted-foreground hover:text-foreground rounded-xl"
                                    >
                                        <RiArrowLeftLine size={18} />
                                        <span className="hidden sm:inline">Back</span>
                                    </Button>
                                )}
                            </div>

                            {/* Center - Tab Navigation */}
                            <nav className="flex-1 flex justify-center">
                                <div
                                    className="hidden md:flex items-center gap-1 bg-muted/80 rounded-xl p-1"
                                    data-tutorial="nav-tabs"
                                >
                                    {navTabs.map((tab) => {
                                        const isActive = pathname === tab.href ||
                                            (tab.href !== basePath && pathname.startsWith(tab.href))
                                        return (
                                            <Link
                                                key={tab.href}
                                                href={tab.href}
                                                className={`
                                                    px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200
                                                    ${isActive
                                                        ? "bg-primary text-primary-foreground shadow-sm"
                                                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                                    }
                                                `}
                                            >
                                                {tab.label}
                                            </Link>
                                        )
                                    })}
                                </div>
                            </nav>

                            {/* Right - User Info & Actions */}
                            <div className="flex items-center gap-3" data-tutorial="user-profile">
                                <Badge
                                    variant={getRoleBadgeVariant(user.role) as any}
                                    className="text-xs hidden sm:flex"
                                >
                                    {roleDisplayName}
                                </Badge>
                                <ModeToggle />
                                <NavUser user={user} />
                            </div>
                        </header>

                        {/* Main Content Area */}
                        <div>
                            <div className="container max-w-7xl mx-auto p-4 sm:p-6">
                                <PageTransition>
                                    {children}
                                </PageTransition>
                            </div>
                        </div>
                    </div>
                </div>
            </SidebarInset>

            <CommandMenu />

            {/* Simple Tutorial Button */}
            {showTutorialButton && (
                <Button
                    onClick={() => setTutorialOpen(true)}
                    size="sm"
                    variant="outline"
                    className="fixed bottom-4 left-4 z-40 h-10 w-10 p-0 rounded-full shadow-lg bg-background hover:bg-muted"
                >
                    <HelpCircle className="h-5 w-5" />
                </Button>
            )}

            {/* Simple Tutorial Modal */}
            <SimpleTutorial
                isOpen={tutorialOpen}
                onClose={() => setTutorialOpen(false)}
                onComplete={() => setTutorialOpen(false)}
                storageKey={`tutorial-${user.id}`}
                steps={[
                    {
                        id: "welcome",
                        title: "Welcome to MedStintClerk!",
                        description: "Let's get you started with setting up your school dashboard. This quick guide will show you the key areas to explore.",
                    },
                    {
                        id: "students",
                        title: "Step 1: Add Your Students",
                        description: "Click 'Students' in the sidebar to add and manage enrolled students. You can add them individually or import from a CSV file.",
                    },
                    {
                        id: "programs",
                        title: "Step 2: Set Up Programs",
                        description: "Click 'Programs' to create your medical education programs. Define requirements, rotations, and competencies.",
                    },
                    {
                        id: "sites",
                        title: "Step 3: Add Clinical Sites",
                        description: "Click 'Clinical Sites' to add hospitals and clinics where students will complete their rotations.",
                    },
                    {
                        id: "rotations",
                        title: "Step 4: Schedule Rotations",
                        description: "Click 'Rotations' to assign students to sites and manage schedules. You're all set to go!",
                    },
                ]}
            />
        </SidebarProvider>
    )
}
