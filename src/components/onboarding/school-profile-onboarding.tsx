// TODO: Add cache invalidation hooks for mutations
"use client"

import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { motion } from "@/components/ui/motion"

const validateEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

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

interface SchoolProfileOnboardingProps {
  user: User
  clerkUser: ClerkUser
}

interface SchoolFormData {
  name: string
  address: string
  city: string
  state: string
  zipCode: string
  phone: string
  email: string
}

const initialFormData: SchoolFormData = {
  name: "",
  address: "",
  city: "",
  state: "",
  zipCode: "",
  phone: "",
  email: "",
}

export function SchoolProfileOnboarding({ user, clerkUser }: SchoolProfileOnboardingProps) {
  const router = useRouter()
  const [formData, setFormData] = useState<SchoolFormData>(initialFormData)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    loadExistingData()
  }, [])

  const loadExistingData = async () => {
    try {
      const response = await fetch("/api/onboarding/progress")
      if (response.ok) {
        const data = await response.json().catch(() => null)
        if (data?.data?.formData?.schoolProfile) {
          setFormData((prev) => ({ ...prev, ...data.data.formData.schoolProfile }))
        }
      }
    } catch (error) {
      console.error("Failed to load existing data:", error)
    }
  }

  const handleInputChange = (field: keyof SchoolFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      toast.error("Institution name is required")
      return false
    }
    if (!formData.email.trim() || !validateEmail(formData.email)) {
      toast.error("Please enter a valid email address")
      return false
    }
    return true
  }

  const handleNext = async () => {
    if (!validateForm()) return

    setIsLoading(true)
    try {
      const response = await fetch("/api/onboarding/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentStep: 3,
          completedSteps: [1, 2],
          formData: { schoolProfile: formData },
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to save progress")
      }

      router.push("/onboarding/programs")
    } catch (error) {
      toast.error("Failed to save. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const steps = [
    { label: "Welcome", completed: true },
    { label: "School", active: true },
    { label: "Programs", completed: false },
    { label: "Done", completed: false },
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
          <p className="text-sm font-medium text-primary mb-2">Step 2 of 4</p>
          <h1 className="text-2xl md:text-3xl font-semibold text-foreground mb-2">
            School Profile
          </h1>
          <p className="text-muted-foreground">
            Tell us about your institution
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm mb-6">
          <div className="space-y-4">
            {/* Institution Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Institution Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="e.g., City Medical College"
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Contact Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                placeholder="admin@institution.edu"
              />
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => handleInputChange("phone", e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label htmlFor="address">Street Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => handleInputChange("address", e.target.value)}
                placeholder="123 Main Street"
              />
            </div>

            {/* City, State, ZIP */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => handleInputChange("city", e.target.value)}
                  placeholder="City"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) => handleInputChange("state", e.target.value)}
                  placeholder="State"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zipCode">ZIP</Label>
                <Input
                  id="zipCode"
                  value={formData.zipCode}
                  onChange={(e) => handleInputChange("zipCode", e.target.value)}
                  placeholder="12345"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => router.push("/onboarding/welcome")}
            className="text-muted-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button onClick={handleNext} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
