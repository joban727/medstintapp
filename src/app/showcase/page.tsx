"use client"

import { DemoBanner } from "@/components/showcase/demo-banner"
import { motion } from "@/components/ui/motion"
import { SchoolAdminDashboardClient } from "@/components/dashboard/school-admin-dashboard-client"
import type { UserRole } from "@/types"

// Mock User Data
const mockUser = {
    id: "showcase-user",
    name: "Dr. Sarah Chen, DNP",
    email: "dean.chen@metro-university.edu",
    role: "SCHOOL_ADMIN" as UserRole,
    schoolId: "demo-school-id",
    onboardingCompleted: true,
    isActive: true,
}

// Mock Dashboard Data
const mockDashboardData = {
    pendingTasks: [
        {
            id: "task-1",
            title: "Review Flagged Timecards",
            description: "15 timecards flagged for geo-fencing mismatches",
            count: 15,
            priority: "high" as const,
            type: "approval" as const,
        },
        {
            id: "task-2",
            title: "Final Competency Sign-offs",
            description: "28 graduating students awaiting final clinical verification",
            count: 28,
            priority: "medium" as const,
            type: "evaluation" as const,
        },
        {
            id: "task-3",
            title: "New Site Agreements",
            description: "3 new clinical site affiliation agreements require approval",
            count: 3,
            priority: "medium" as const,
            type: "setup" as const,
        },
    ],
    recentActivities: [
        {
            action: "System Automation",
            details: "Auto-verified 142 timecards matching schedule & location",
            timestamp: new Date().toISOString(),
        },
        {
            action: "Site Affiliation",
            details: "Mercy General Hospital renewed affiliation agreement",
            timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        },
        {
            action: "Student Success",
            details: "Alex Rivera completed 'Advanced Pediatrics' rotation",
            timestamp: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
        },
        {
            action: "Compliance Alert",
            details: "Upcoming expiration: 5 Preceptor licenses expiring in 30 days",
            timestamp: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        },
    ],
    schoolStats: {
        totalStudents: 842,
        totalPrograms: 12,
        pendingEvaluations: 45,
        avgCompetencyProgress: 92,
    },
    analytics: {
        enrollmentTrend: [
            { month: "Aug", students: 45 },
            { month: "Sep", students: 128 },
            { month: "Oct", students: 156 },
            { month: "Nov", students: 189 },
            { month: "Dec", students: 201 },
            { month: "Jan", students: 123 },
        ],
        siteCapacity: [
            { name: "Mercy General", capacity: 50, used: 42 },
            { name: "St. Luke's Medical", capacity: 35, used: 28 },
            { name: "Children's Hospital", capacity: 25, used: 22 },
            { name: "Metro Urgent Care", capacity: 15, used: 12 },
            { name: "Central Clinic", capacity: 20, used: 15 },
        ],
        competencyOverview: [
            { subject: "Clinical Skills", A: 128, fullMark: 150 },
            { subject: "Communication", A: 135, fullMark: 150 },
            { subject: "Professionalism", A: 142, fullMark: 150 },
            { subject: "Critical Thinking", A: 118, fullMark: 150 },
            { subject: "Patient Care", A: 125, fullMark: 150 },
            { subject: "Systems-Based", A: 110, fullMark: 150 },
        ],
    },
}

export default function ShowcasePage() {
    return (
        <div className="relative min-h-screen bg-background">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
            >
                {/* Dashboard Content */}
                <SchoolAdminDashboardClient user={mockUser} dashboardData={mockDashboardData} />
                {/* <div className="p-10 text-center">Dashboard Placeholder</div> */}
            </motion.div>

            {/* Floating Demo Banner */}
            <DemoBanner />
        </div>
    )
}
