"use client"

import {
  ArrowRight,
  Award,
  BookOpen,
  Calendar,
  CheckCircle,
  Clock,
  Sparkles,
  Stethoscope,
  Target,
  Users,
  X,
} from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import type { UserRole } from "../../types"
import { Button } from "../ui/button"
import { CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
import { DashboardCard } from "@/components/dashboard/shared/dashboard-card"
import { AnimatePresence, motion } from "../ui/motion"

interface WelcomeBannerProps {
  userRole: UserRole
  userName: string
  onDismiss?: () => void
}

interface QuickAction {
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  href: string
  priority: "high" | "medium" | "low"
}

export function WelcomeBanner({ userRole, userName, onDismiss }: WelcomeBannerProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const router = useRouter()
  const searchParams = useSearchParams()
  const isWelcome = searchParams?.get("welcome") === "true"

  useEffect(() => {
    if (isWelcome) {
      setIsVisible(true)
    }
  }, [isWelcome])

  const handleDismiss = () => {
    setIsVisible(false)
    // Remove welcome parameter from URL
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href)
      url.searchParams.delete("welcome")
      router.replace(url.pathname + url.search)
    }
    onDismiss?.()
  }

  const getQuickActions = (): QuickAction[] => {
    switch (userRole) {
      case "STUDENT":
        return [
          {
            title: "View Your Schedule",
            description: "Check upcoming rotations and clinical hours",
            icon: Calendar,
            href: "/dashboard/student/schedule",
            priority: "high",
          },
          {
            title: "Track Progress",
            description: "Monitor your competencies and evaluations",
            icon: Target,
            href: "/dashboard/student/progress",
            priority: "high",
          },
          {
            title: "Log Clinical Hours",
            description: "Record your daily clinical activities",
            icon: Clock,
            href: "/dashboard/student/time-records",
            priority: "medium",
          },
        ]
      case "CLINICAL_PRECEPTOR":
        return [
          {
            title: "Review Time Records",
            description: "Approve student clinical hour submissions",
            icon: CheckCircle,
            href: "/dashboard/clinical-preceptor/time-records",
            priority: "high",
          },
          {
            title: "Manage Students",
            description: "View and guide your assigned students",
            icon: Users,
            href: "/dashboard/clinical-preceptor/students",
            priority: "high",
          },
          {
            title: "Conduct Evaluations",
            description: "Assess student performance and competencies",
            icon: Award,
            href: "/dashboard/clinical-preceptor/evaluations",
            priority: "medium",
          },
        ]
      case "CLINICAL_SUPERVISOR":
        return [
          {
            title: "Student Oversight",
            description: "Monitor student progress across rotations",
            icon: Users,
            href: "/dashboard/clinical-supervisor/students",
            priority: "high",
          },
          {
            title: "Competency Validation",
            description: "Review and validate student competencies",
            icon: Award,
            href: "/dashboard/clinical-supervisor/competencies",
            priority: "high",
          },
          {
            title: "Generate Reports",
            description: "Create progress and assessment reports",
            icon: BookOpen,
            href: "/dashboard/clinical-supervisor/reports",
            priority: "medium",
          },
        ]
      case "SCHOOL_ADMIN":
        return [
          {
            title: "Manage Students",
            description: "Oversee student enrollment and progress",
            icon: Users,
            href: "/dashboard/school-admin/students",
            priority: "high",
          },
          {
            title: "Program Management",
            description: "Configure curricula and requirements",
            icon: BookOpen,
            href: "/dashboard/school-admin/programs",
            priority: "high",
          },
          {
            title: "Rotation Scheduling",
            description: "Plan and assign clinical rotations",
            icon: Calendar,
            href: "/dashboard/school-admin/rotations",
            priority: "medium",
          },
        ]
      default:
        return []
    }
  }

  const quickActions = getQuickActions()
  const highPriorityActions = quickActions.filter((action) => action.priority === "high")

  const welcomeSteps = [
    {
      title: `Welcome to MedStint, ${userName}!`,
      description: "Let's get you started with your clinical education journey.",
      icon: Sparkles,
    },
    {
      title: "Your Dashboard is Ready",
      description:
        "Everything you need to manage your clinical education is now at your fingertips.",
      icon: Stethoscope,
    },
    {
      title: "Quick Actions Available",
      description: "Here are the most important tasks you can start with right away.",
      icon: Target,
    },
  ]

  if (!isVisible) return null

  return (
    /* Design Language: Monochrome styling with subtle gradient */
    <DashboardCard className="border border-foreground/10 bg-gradient-to-r from-foreground/[0.02] via-background to-foreground/[0.02] shadow-sm backdrop-blur-sm relative overflow-hidden hover:border-foreground/20 transition-all duration-300">
      <div className="absolute top-0 right-0 p-12 bg-foreground/[0.02] rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 left-0 p-12 bg-foreground/[0.02] rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2" />

      <CardHeader className="relative z-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          className="absolute top-4 right-4 h-8 w-8 p-0 hover:bg-white/50 rounded-full transition-colors"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </Button>
        <div className="flex items-center gap-4">
          <div className="p-3 bg-foreground/5 rounded-xl shadow-sm border border-foreground/10">
            {(() => {
              const Icon = welcomeSteps[currentStep].icon
              return <Icon className="h-6 w-6 text-foreground/70" />
            })()}
          </div>
          <div>
            <CardTitle className="font-bold text-foreground text-xl tracking-tight">
              {welcomeSteps[currentStep].title}
            </CardTitle>
            <CardDescription className="mt-1 text-muted-foreground text-base">
              {welcomeSteps[currentStep].description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      {currentStep === 2 && (
        <CardContent className="relative z-10">
          <div className="gap-6">
            <h4 className="mb-4 font-semibold text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-foreground/60" />
              Get Started
            </h4>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {highPriorityActions.map((action) => (
                <Button
                  key={`action-${action.title.replace(/\s+/g, "-").toLowerCase()}`}
                  variant="outline"
                  className="h-auto w-full justify-start p-4 hover:border-foreground/20 hover:bg-foreground/[0.02] bg-background border-foreground/10 transition-all duration-300 group"
                  onClick={() => router.push(action.href)}
                >
                  <div className="flex items-center gap-3 w-full">
                    <div className="p-2 rounded-lg bg-foreground/5 text-foreground/70 group-hover:bg-foreground/10 transition-colors duration-300">
                      <action.icon className="h-5 w-5" />
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <div className="font-medium text-foreground truncate">{action.title}</div>
                      <div className="text-muted-foreground text-xs line-clamp-1">
                        {action.description}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-foreground/40 group-hover:text-foreground/70 group-hover:translate-x-1 transition-all" />
                  </div>
                </Button>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-foreground/10 pt-6 mt-6">
              <div className="flex gap-2">
                {welcomeSteps.map((step, index) => (
                  <div
                    key={`step-${step.title.replace(/\s+/g, "-").toLowerCase()}`}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      index <= currentStep ? "w-6 bg-foreground/60" : "w-2 bg-foreground/20"
                    }`}
                  />
                ))}
              </div>
              <Button onClick={handleDismiss}>
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      )}
    </DashboardCard>
  )
}
