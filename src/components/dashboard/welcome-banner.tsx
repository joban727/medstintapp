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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
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
    <div className="mb-6">
      <Card className="border border-blue-200 bg-gradient-to-r from-blue-50 via-white to-green-50 shadow-sm">
        <CardHeader className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="absolute top-4 right-4 h-8 w-8 p-0 hover:bg-white/50"
          >
            <X className="h-4 w-4" />
          </Button>

          <div className="flex items-center space-x-3">
            <div>
              <CardTitle className="font-bold text-gray-900 text-xl">
                {welcomeSteps[currentStep].title}
              </CardTitle>
              <CardDescription className="mt-1 text-gray-600">
                {welcomeSteps[currentStep].description}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        {currentStep === 2 && (
          <CardContent>
            <div className="space-y-4">
              <h4 className="mb-3 font-semibold text-gray-900">Get Started:</h4>
              <div className="grid gap-3 md:grid-cols-2">
                {highPriorityActions.map((action) => (
                  <Button
                    key={`action-${action.title.replace(/\s+/g, "-").toLowerCase()}`}
                    variant="outline"
                    className="h-auto w-full justify-start p-4 hover:border-blue-300 hover:bg-blue-50"
                    onClick={() => router.push(action.href)}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="text-blue-600">
                        <action.icon className="h-5 w-5" />
                      </div>
                      <div className="text-left">
                        <div className="font-medium text-gray-900">{action.title}</div>
                        <div className="text-gray-500 text-sm">{action.description}</div>
                      </div>
                      <ArrowRight className="ml-auto h-4 w-4 text-gray-400" />
                    </div>
                  </Button>
                ))}
              </div>

              <div className="flex items-center justify-between border-t pt-4">
                <div className="flex space-x-1">
                  {welcomeSteps.map((step, index) => (
                    <div
                      key={`step-${step.title.replace(/\s+/g, "-").toLowerCase()}`}
                      className={`h-2 w-2 rounded-full ${
                        index <= currentStep ? "bg-blue-500" : "bg-gray-300"
                      }`}
                    />
                  ))}
                </div>
                <Button onClick={handleDismiss} className="bg-blue-600 hover:bg-blue-700">
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  )
}