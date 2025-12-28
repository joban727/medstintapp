"use client"

import { ArrowLeft, Check, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
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

interface ReviewOnboardingProps {
  user: User
  clerkUser: ClerkUser
}

interface OnboardingData {
  schoolProfile?: {
    name?: string
    email?: string
    phone?: string
    address?: string
    city?: string
    state?: string
  }
  programs?: Array<{
    id: string
    name: string
    type: string
    duration: string
  }>
}

export function ReviewOnboarding({ user, clerkUser }: ReviewOnboardingProps) {
  const router = useRouter()
  const [data, setData] = useState<OnboardingData>({})
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const response = await fetch("/api/onboarding/progress")
      if (response.ok) {
        const result = await response.json().catch(() => null)
        if (result?.data?.formData) {
          setData(result.data.formData)
        }
      }
    } catch (error) {
      console.error("Failed to load data:", error)
    }
  }

  const handleComplete = async () => {
    setIsLoading(true)
    try {
      // Mark onboarding as complete
      const response = await fetch("/api/onboarding/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentStep: 5,
          completedSteps: [1, 2, 3, 4],
          formData: data,
          isCompleted: true,
        }),
      })

      if (!response.ok) throw new Error("Failed to complete")
      router.push("/onboarding/complete")
    } catch (error) {
      toast.error("Failed to complete. Please try again.")
    } finally {
      setIsLoading(false)
    }
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
        className="w-full max-w-lg"
      >
        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((step, index) => (
            <div key={step.label} className="flex items-center">
              <div
                className={`h-2 w-2 rounded-full ${step.active
                  ? "bg-primary"
                  : step.completed
                    ? "bg-primary/40"
                    : "bg-muted"
                  }`}
              />
              {index < steps.length - 1 && (
                <div className={`w-8 h-px ${step.completed ? "bg-primary/40" : "bg-muted"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-sm font-medium text-primary mb-2">Final Step</p>
          <h1 className="text-2xl md:text-3xl font-semibold text-foreground mb-2">
            Ready to go!
          </h1>
          <p className="text-muted-foreground">
            Review your setup and complete onboarding
          </p>
        </div>

        {/* Summary Card */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm mb-6">
          {/* School Summary */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-muted-foreground">School</h3>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 text-primary"
                onClick={() => router.push("/onboarding/school-profile")}
              >
                Edit
              </Button>
            </div>
            <p className="font-medium text-foreground">
              {data.schoolProfile?.name || "Not specified"}
            </p>
            {data.schoolProfile?.city && data.schoolProfile?.state && (
              <p className="text-sm text-muted-foreground">
                {data.schoolProfile.city}, {data.schoolProfile.state}
              </p>
            )}
          </div>

          <div className="h-px bg-border mb-6" />

          {/* Programs Summary */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-muted-foreground">Programs</h3>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 text-primary"
                onClick={() => router.push("/onboarding/programs")}
              >
                Edit
              </Button>
            </div>
            {data.programs && data.programs.length > 0 ? (
              <ul className="space-y-2">
                {data.programs.map((program) => (
                  <li key={program.id} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-foreground">{program.name || program.type}</span>
                    <span className="text-sm text-muted-foreground">
                      ({program.duration} years)
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">No programs added</p>
            )}
          </div>
        </div>

        {/* Complete Button */}
        <Button
          onClick={handleComplete}
          disabled={isLoading}
          size="lg"
          className="w-full h-12 text-base font-medium"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Completing...
            </>
          ) : (
            <>
              Complete Setup
              <Check className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>

        {/* Back Link */}
        <div className="text-center mt-4">
          <Button
            variant="ghost"
            onClick={() => router.push("/onboarding/programs")}
            className="text-muted-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Programs
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
