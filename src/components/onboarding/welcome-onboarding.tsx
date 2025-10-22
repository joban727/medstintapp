// TODO: Add cache invalidation hooks for mutations
"use client"

import { BookOpen, Calendar, CheckCircle, Clock, Play, Shield, Users } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { TutorialIntegration } from "../tutorial/tutorial-integration"
import type { UserRole } from "@/types"
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

interface WelcomeOnboardingProps {
  user: User
  clerkUser: ClerkUser
}

const onboardingSteps = [
  {
    id: 1,
    title: "Welcome & Orientation",
    icon: CheckCircle,
    description: "Get started with your onboarding journey",
  },
  {
    id: 2,
    title: "School Profile Setup",
    icon: Shield,
    description: "Configure your institution details",
  },
  {
    id: 3,
    title: "Academic Programs",
    icon: BookOpen,
    description: "Set up your educational programs",
  },
  { id: 4, title: "Class Rotations", icon: Calendar, description: "Configure rotation schedules" },
  {
    id: 5,
    title: "Validation & Review",
    icon: Users,
    description: "Review and validate your setup",
  },
  {
    id: 6,
    title: "Completion & Summary",
    icon: CheckCircle,
    description: "Finalize your onboarding",
  },
]

const quickStartItems = [
  {
    title: "System Overview",
    description: "Learn about MedstintClerk's core features and capabilities",
    estimatedTime: "5 min",
  },
  {
    title: "Setup Checklist",
    description: "Complete essential configuration steps for your institution",
    estimatedTime: "15-20 min",
  },
  {
    title: "Best Practices",
    description: "Discover recommended workflows and optimization tips",
    estimatedTime: "10 min",
  },
]

export function WelcomeOnboarding({ user, clerkUser }: WelcomeOnboardingProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [_showTutorial, setShowTutorial] = useState(false)

  const userName = user.name || clerkUser.firstName || "Administrator"
  const currentStep = 1
  const progressPercentage = (currentStep / 6) * 100

  useEffect(() => {
    setProgress(progressPercentage)

    // Check if this is the user's first time and auto-start tutorial
    const hasSeenWelcomeTutorial = localStorage.getItem(`welcome-tutorial-seen-${user.id}`)

    if (!hasSeenWelcomeTutorial && user.role === "SCHOOL_ADMIN") {
      // Delay tutorial start to allow page to render
      setTimeout(() => {
        setShowTutorial(true)
      }, 1500)
    }
  }, [progressPercentage, user.id, user.role])

  const handleContinue = async () => {
    setIsLoading(true)
    try {
      // Mark tutorial as seen
      localStorage.setItem(`welcome-tutorial-seen-${user.id}`, "true")

      // Save progress
      const response = await fetch("/api/onboarding/progress", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentStep: 2,
          completedSteps: [1],
          formData: {
            welcomeCompleted: true,
            startedAt: new Date().toISOString(),
          },
          isCompleted: false,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to save progress")
      }

      router.push("/onboarding/school-profile")
    } catch (error) {
      console.error("Error saving progress:", error)
      toast.error("Failed to save progress. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleStartTutorial = () => {
    setShowTutorial(true)
  }

  return (
    <TutorialIntegration userRole={user.role as UserRole} userId={user.id} onboardingStep="welcome">
      <div className="space-y-8">
        {/* Progress Header */}
        <header className="space-y-4 text-center" data-tutorial="welcome-header">
          <h1 className="font-bold text-3xl text-gray-900 dark:text-white">
            Welcome to MedstintClerk, {userName}!
          </h1>
          <p className="text-gray-600 text-lg dark:text-gray-300">
            Let's get your school administration system set up in just a few steps.
          </p>
          <div
            className="mx-auto max-w-md space-y-2"
            role="region"
            aria-label="Onboarding progress"
            data-tutorial="progress-tracker"
          >
            <div className="flex justify-between text-gray-600 text-sm dark:text-gray-400">
              <span aria-label={`Current step: ${currentStep} of 6`}>Step {currentStep} of 6</span>
              <span aria-label={`Progress: ${Math.round(progressPercentage)} percent complete`}>
                {Math.round(progressPercentage)}% Complete
              </span>
            </div>
            <Progress
              value={progress}
              className="h-2"
              aria-label={`Onboarding progress: ${Math.round(progressPercentage)}% complete`}
            />
          </div>
        </header>

        {/* Tutorial Start Button */}
        <div className="mb-6 flex justify-center">
          <Button
            onClick={handleStartTutorial}
            variant="outline"
            size="sm"
            className="flex items-center gap-2 border-blue-200 text-blue-600 hover:bg-blue-50"
            data-tutorial="start-tutorial-btn"
          >
            <Play className="h-4 w-4" />
            Start Interactive Tutorial
          </Button>
        </div>

        {/* Quick Start Guide */}
        <section aria-labelledby="quick-start-title" data-tutorial="quick-start-guide">
          <Card>
            <CardHeader>
              <CardTitle id="quick-start-title" className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-600" aria-hidden="true" />
                Quick Start Guide
              </CardTitle>
              <CardDescription>
                Get familiar with the onboarding process and what to expect.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3" role="list">
                {quickStartItems.map((item, index) => (
                  <div
                    key={`quick-start-${item.title.replace(/\s+/g, '-').toLowerCase()}-${item.estimatedTime.replace(/\s+/g, '')}`}
                    className="rounded-lg border p-4 transition-colors focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 hover:bg-gray-50 dark:hover:bg-gray-800"
                    role="listitem"
                  >
                    <h3 className="mb-2 font-semibold text-gray-900 dark:text-white">
                      {item.title}
                    </h3>
                    <p className="mb-2 text-gray-600 text-sm dark:text-gray-400">
                      {item.description}
                    </p>
                    <span
                      className="font-medium text-blue-600 text-xs dark:text-blue-400"
                      aria-label={`Estimated time: ${item.estimatedTime}`}
                    >
                      {item.estimatedTime}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Onboarding Steps Overview */}
        <section aria-labelledby="onboarding-steps-title" data-tutorial="onboarding-steps">
          <Card>
            <CardHeader>
              <CardTitle id="onboarding-steps-title">Your Onboarding Journey</CardTitle>
              <CardDescription>
                Here's what we'll accomplish together during the setup process.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" role="list">
                {onboardingSteps.map((step) => {
                  const Icon = step.icon
                  const isActive = step.id === currentStep
                  const isCompleted = step.id < currentStep

                  return (
                    <div
                      key={step.id}
                      className={`rounded-lg border p-4 transition-all focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 ${
                        isActive
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : isCompleted
                            ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                            : "border-gray-200 dark:border-gray-700"
                      }`}
                      role="listitem"
                      aria-label={`Step ${step.id}: ${step.title}. ${isActive ? "Current step" : isCompleted ? "Completed" : "Upcoming step"}`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`rounded-full p-2 ${
                            isActive
                              ? "bg-blue-100 text-blue-600 dark:bg-blue-800 dark:text-blue-300"
                              : isCompleted
                                ? "bg-green-100 text-green-600 dark:bg-green-800 dark:text-green-300"
                                : "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500"
                          }`}
                          aria-hidden="true"
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <h3 className="mb-1 font-semibold text-gray-900 dark:text-white">
                            {step.title}
                          </h3>
                          <p className="text-gray-600 text-sm dark:text-gray-400">
                            {step.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* System Overview */}
        <section aria-labelledby="system-overview-title" data-tutorial="system-overview">
          <Card>
            <CardHeader>
              <CardTitle id="system-overview-title">System Overview</CardTitle>
              <CardDescription>
                MedstintClerk helps you manage your medical education programs efficiently.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">Key Features</h3>
                  <ul className="space-y-2 text-gray-600 text-sm dark:text-gray-400">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" aria-hidden="true" />
                      Student enrollment and management
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" aria-hidden="true" />
                      Clinical rotation scheduling
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" aria-hidden="true" />
                      Competency tracking and assessment
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" aria-hidden="true" />
                      Reporting and analytics
                    </li>
                  </ul>
                </div>
                <div>
                  <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">
                    What You'll Set Up
                  </h3>
                  <ul className="space-y-2 text-gray-600 text-sm dark:text-gray-400">
                    <li className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-blue-500" aria-hidden="true" />
                      Your school profile and settings
                    </li>
                    <li className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-blue-500" aria-hidden="true" />
                      Academic programs and curricula
                    </li>
                    <li className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-blue-500" aria-hidden="true" />
                      Clinical rotation schedules
                    </li>
                    <li className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-blue-500" aria-hidden="true" />
                      User roles and permissions
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Action Buttons */}
        <footer
          className="flex flex-col items-center justify-between gap-4 pt-6 sm:flex-row"
          role="contentinfo"
          data-tutorial="action-buttons"
        >
          <div
            className="text-gray-500 text-sm dark:text-gray-400"
            aria-label="Estimated completion time"
          >
            Estimated completion time: 15-20 minutes
          </div>
          <Button
            onClick={handleContinue}
            disabled={isLoading}
            size="lg"
            className="min-w-[160px] px-8"
            aria-describedby="onboarding-progress"
            aria-label={isLoading ? "Starting onboarding process" : "Begin school profile setup"}
            data-tutorial="continue-btn"
          >
            {isLoading ? "Starting..." : "Let's Get Started"}
          </Button>
        </footer>
      </div>
    </TutorialIntegration>
  )
}
