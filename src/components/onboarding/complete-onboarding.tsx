// TODO: Add cache invalidation hooks for mutations
"use client"

import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Calendar,
  CheckCircle,
  ExternalLink,
  FileText,
  Settings,
  Sparkles,
  Users,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "../ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
import { Progress } from "../ui/progress"

interface User {
  id: string
  email: string | null
  name: string | null
  role: string | null
  schoolId: string | null
  onboardingCompleted: boolean | null
}

interface ClerkUser {
  id: string
  firstName: string | null
  lastName: string | null
  emailAddresses: { emailAddress: string }[]
}

interface CompleteOnboardingProps {
  user: User
  clerkUser: ClerkUser
}

interface OnboardingStats {
  schoolsConfigured: number
  programsCreated: number
  rotationsSetup: number
  totalSteps: number
}

export function CompleteOnboarding({ user, clerkUser }: CompleteOnboardingProps) {
  const router = useRouter()
  const [isCompleting, setIsCompleting] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)
  const [stats, setStats] = useState<OnboardingStats>({
    schoolsConfigured: 0,
    programsCreated: 0,
    rotationsSetup: 0,
    totalSteps: 6,
  })
  const [progress, setProgress] = useState(0)

  const currentStep = 6
  const progressPercentage = 100

  const loadOnboardingStats = useCallback(async () => {
    try {
      const response = await fetch("/api/onboarding/progress")
      if (response.ok) {
        const data = await response.json()
        const formData = data.formData || {}

        setStats({
          schoolsConfigured: formData.schoolProfile ? 1 : 0,
          programsCreated: formData.programs?.length || 0,
          rotationsSetup: formData.rotations?.length || 0,
          totalSteps: 6,
        })
      }
    } catch (error) {
      console.error("Error loading onboarding stats:", error)
    }
  }, [])

  const completeOnboarding = async () => {
    if (isCompleted) return

    setIsCompleting(true)
    try {
      // Mark onboarding as completed
      const response = await fetch("/api/onboarding/progress", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentStep: 6,
          completedSteps: [1, 2, 3, 4, 5, 6],
          isCompleted: true,
          completedAt: new Date().toISOString(),
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to complete onboarding")
      }

      setIsCompleted(true)
      toast.success("Onboarding completed successfully!")
    } catch (error) {
      console.error("Error completing onboarding:", error)
      toast.error("Failed to complete onboarding. Please try again.")
    } finally {
      setIsCompleting(false)
    }
  }

  useEffect(() => {
    setProgress(progressPercentage)
    loadOnboardingStats()
    completeOnboarding()
  }, [completeOnboarding, loadOnboardingStats])

  const handleGoToDashboard = () => {
    router.push("/dashboard")
  }

  const handleViewDocumentation = () => {
    // Open documentation in new tab
    window.open("/docs", "_blank")
  }

  const quickActions = [
    {
      title: "Manage Students",
      description: "Add and organize student enrollments",
      icon: Users,
      href: "/students",
      color: "text-blue-600",
    },
    {
      title: "Schedule Rotations",
      description: "Assign students to clinical rotations",
      icon: Calendar,
      href: "/rotations",
      color: "text-green-600",
    },
    {
      title: "View Analytics",
      description: "Monitor program performance and metrics",
      icon: BarChart3,
      href: "/analytics",
      color: "text-purple-600",
    },
    {
      title: "System Settings",
      description: "Configure advanced system preferences",
      icon: Settings,
      href: "/settings",
      color: "text-gray-600",
    },
  ]

  const resources = [
    {
      title: "Getting Started Guide",
      description: "Learn the basics of managing your medical school",
      icon: BookOpen,
      href: "/docs/getting-started",
    },
    {
      title: "User Manual",
      description: "Comprehensive guide to all platform features",
      icon: FileText,
      href: "/docs/user-manual",
    },
    {
      title: "Best Practices",
      description: "Tips and recommendations from education experts",
      icon: Sparkles,
      href: "/docs/best-practices",
    },
  ]

  return (
    <div className="space-y-8">
      {/* Success Header */}
      <div className="space-y-6 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
          <CheckCircle className="h-12 w-12 text-green-600" />
        </div>
        <div className="space-y-2">
          <h1 className="font-bold text-4xl text-gray-900 dark:text-white">Setup Complete!</h1>
          <p className="text-gray-600 text-xl dark:text-gray-300">
            Welcome to your medical school management platform, {clerkUser.firstName}!
          </p>
        </div>
        <div className="mx-auto max-w-md space-y-2">
          <div className="flex justify-between text-gray-600 text-sm dark:text-gray-400">
            <span>Step {currentStep} of 6</span>
            <span>100% Complete</span>
          </div>
          <Progress value={progress} className="h-3" />
        </div>
      </div>

      {/* Completion Summary */}
      <Card className="border-2 border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-800 dark:text-green-200">
            <CheckCircle className="h-5 w-5" />
            Onboarding Summary
          </CardTitle>
          <CardDescription>
            Here's what you've accomplished during the setup process.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            <div className="text-center">
              <div className="font-bold text-2xl text-green-600 dark:text-green-400">
                {stats.totalSteps}
              </div>
              <div className="text-gray-600 text-sm dark:text-gray-400">Steps Completed</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-2xl text-blue-600 dark:text-blue-400">
                {stats.schoolsConfigured}
              </div>
              <div className="text-gray-600 text-sm dark:text-gray-400">School Configured</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-2xl text-purple-600 dark:text-purple-400">
                {stats.programsCreated}
              </div>
              <div className="text-gray-600 text-sm dark:text-gray-400">Programs Created</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-2xl text-orange-600 dark:text-orange-400">
                {stats.rotationsSetup}
              </div>
              <div className="text-gray-600 text-sm dark:text-gray-400">Rotations Setup</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Next Steps */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Get started with these essential tasks to manage your school effectively.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {quickActions.map((action, index) => {
              const Icon = action.icon
              return (
                <button
                  key={`quick-action-${action.title.replace(/\s+/g, '-').toLowerCase()}-${index}`}
                  type="button"
                  className="flex w-full cursor-pointer items-center gap-4 rounded-lg border border-gray-200 p-3 text-left transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                  onClick={() => router.push(action.href)}
                  aria-label={`Navigate to ${action.title}`}
                >
                    <div className={"rounded-lg bg-gray-100 p-2 dark:bg-gray-800"}>
                      <Icon className={`h-5 w-5 ${action.color}`} />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 dark:text-white">{action.title}</h4>
                      <p className="text-gray-600 text-sm dark:text-gray-400">{action.description}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-400" />
                  </button>
              )
            })}
          </CardContent>
        </Card>

        {/* Resources */}
        <Card>
          <CardHeader>
            <CardTitle>Learning Resources</CardTitle>
            <CardDescription>
              Explore these resources to make the most of your platform.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {resources.map((resource, index) => {
              const Icon = resource.icon
              return (
                <button
                  key={`resource-${resource.title.replace(/\s+/g, '-').toLowerCase()}-${index}`}
                  type="button"
                  className="flex w-full cursor-pointer items-center gap-4 rounded-lg border border-gray-200 p-3 text-left transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                  onClick={() => window.open(resource.href, "_blank")}
                  aria-label={`Open ${resource.title} in new tab`}
                >
                    <div className="rounded-lg bg-gray-100 p-2 dark:bg-gray-800">
                      <Icon className="h-5 w-5 text-gray-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 dark:text-white">
                        {resource.title}
                      </h4>
                      <p className="text-gray-600 text-sm dark:text-gray-400">
                        {resource.description}
                      </p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-gray-400" />
                  </button>
              )
            })}
          </CardContent>
        </Card>
      </div>

      {/* Support Information */}
      <Card>
        <CardHeader>
          <CardTitle>Need Help?</CardTitle>
          <CardDescription>Our support team is here to help you succeed.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 text-center">
              <div className="mb-2 font-semibold text-gray-900 text-lg dark:text-white">
                Email Support
              </div>
              <p className="mb-3 text-gray-600 text-sm dark:text-gray-400">
                Get help via email within 24 hours
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open("mailto:support@medstint.com")}
              >
                Contact Support
              </Button>
            </div>
            <div className="p-4 text-center">
              <div className="mb-2 font-semibold text-gray-900 text-lg dark:text-white">
                Live Chat
              </div>
              <p className="mb-3 text-gray-600 text-sm dark:text-gray-400">
                Chat with our team in real-time
              </p>
              <Button variant="outline" size="sm">
                Start Chat
              </Button>
            </div>
            <div className="p-4 text-center">
              <div className="mb-2 font-semibold text-gray-900 text-lg dark:text-white">
                Knowledge Base
              </div>
              <p className="mb-3 text-gray-600 text-sm dark:text-gray-400">
                Browse our comprehensive help articles
              </p>
              <Button variant="outline" size="sm" onClick={handleViewDocumentation}>
                View Docs
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Button */}
      <div className="pt-6 text-center">
        <Button
          onClick={handleGoToDashboard}
          size="lg"
          className="px-12 py-3 text-lg"
          disabled={isCompleting}
        >
          {isCompleting ? "Finalizing Setup..." : "Go to Dashboard"}
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </div>
    </div>
  )
}
