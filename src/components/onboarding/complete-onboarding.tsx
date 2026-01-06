// TODO: Add cache invalidation hooks for mutations
"use client"

import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle,
  FileText,
  LayoutDashboard,
  Loader2,
  Settings,
  Sparkles,
  Users,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "../ui/button"
import { motion } from "@/components/ui/motion"

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

export function CompleteOnboarding({ user, clerkUser }: CompleteOnboardingProps) {
  const router = useRouter()
  const [isCompleting, setIsCompleting] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)

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

      if (!response.ok) throw new Error("Failed to complete onboarding")

      setIsCompleted(true)

      // Persist data
      try {
        await fetch("/api/user/onboarding-complete", { method: "POST" })
      } catch (e) {
        console.error("Error calling onboarding-complete:", e)
      }

      // Quick setup
      try {
        await fetch("/api/quick-setup", { method: "POST" })
      } catch (e) {
        console.warn("Quick setup warning:", e)
      }

      toast.success("Setup complete!")
    } catch (error) {
      console.error("Completion failed:", error)
      toast.error("Something went wrong completing setup")
    } finally {
      setIsCompleting(false)
    }
  }

  useEffect(() => {
    completeOnboarding()
  }, [])

  const handleGoToDashboard = () => {
    window.location.assign("/dashboard")
  }

  const steps = [
    { label: "Welcome", completed: true },
    { label: "School", completed: true },
    { label: "Programs", completed: true },
    { label: "Done", active: true },
  ]

  return (
    <div className="flex flex-col items-center justify-center min-h-[85vh] px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-lg text-center"
      >
        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 mb-12">
          {steps.map((step, index) => (
            <div key={step.label} className="flex items-center">
              <div
                className={`h-2 w-2 rounded-full ${
                  step.active || step.completed ? "bg-primary" : "bg-muted"
                }`}
              />
              {index < steps.length - 1 && (
                <div className={`w-8 h-px ${step.completed ? "bg-primary" : "bg-muted"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Success Icon */}
        <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
          <Check className="h-12 w-12 text-primary" />
        </div>

        {/* Header */}
        <h1 className="text-3xl font-semibold text-foreground mb-4">
          All set, {clerkUser.firstName}!
        </h1>
        <p className="text-muted-foreground text-lg mb-12 max-w-md mx-auto">
          Your workspace has been created and configured. You're ready to start managing your
          clinical education program.
        </p>

        {/* Action Button */}
        <Button
          onClick={handleGoToDashboard}
          size="lg"
          className="w-full h-12 text-base font-medium mb-8"
          disabled={isCompleting}
        >
          {isCompleting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Finalizing...
            </>
          ) : (
            <>
              Go to Dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>

        {/* Quick Links */}
        <div className="grid grid-cols-2 gap-4 text-left">
          <a
            href="/docs/getting-started"
            target="_blank"
            className="group flex flex-col p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-muted/30 transition-all"
          >
            <BookOpen className="h-5 w-5 text-muted-foreground group-hover:text-primary mb-2" />
            <span className="font-medium text-sm text-foreground">Getting Started</span>
            <span className="text-xs text-muted-foreground">Read the guide</span>
          </a>
          <a
            href="/settings"
            className="group flex flex-col p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-muted/30 transition-all"
          >
            <Settings className="h-5 w-5 text-muted-foreground group-hover:text-primary mb-2" />
            <span className="font-medium text-sm text-foreground">Settings</span>
            <span className="text-xs text-muted-foreground">Configure details</span>
          </a>
        </div>
      </motion.div>
    </div>
  )
}
