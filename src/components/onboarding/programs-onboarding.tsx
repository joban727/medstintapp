// TODO: Add cache invalidation hooks for mutations
"use client"

import { ArrowLeft, ArrowRight, Loader2, Plus, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
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

interface ProgramsOnboardingProps {
  user: User
  clerkUser: ClerkUser
}

interface Program {
  id: string
  name: string
  type: string
  duration: string
}

const programTypes = [
  "Radiologic Technology (Rad Tech)",
  "Magnetic Resonance Imaging (MRI)",
  "Diagnostic Medical Sonography (Ultrasound)",
  "Nuclear Medicine Technology",
  "Radiation Therapy",
  "Computed Tomography (CT)",
  "Other",
]

export function ProgramsOnboarding({ user, clerkUser }: ProgramsOnboardingProps) {
  const router = useRouter()
  const [programs, setPrograms] = useState<Program[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    loadSavedProgress()
  }, [])

  const loadSavedProgress = async () => {
    try {
      const response = await fetch("/api/onboarding/progress")
      if (response.ok) {
        const data = await response.json().catch(() => null)
        if (data?.data?.formData?.programs && Array.isArray(data.data.formData.programs)) {
          setPrograms(data.data.formData.programs)
        }
      }
    } catch (error) {
      console.error("Failed to load progress:", error)
    }
  }

  const addProgram = () => {
    setPrograms([
      ...programs,
      {
        id: Date.now().toString(),
        name: "",
        type: "",
        duration: "2",
      },
    ])
  }

  const removeProgram = (id: string) => {
    setPrograms(programs.filter((p) => p.id !== id))
  }

  const updateProgram = (id: string, field: keyof Program, value: string) => {
    setPrograms(programs.map((p) => (p.id === id ? { ...p, [field]: value } : p)))
  }

  const handleContinue = async () => {
    if (programs.length === 0) {
      toast.error("Please add at least one program")
      return
    }

    const hasIncomplete = programs.some((p) => !p.name.trim() || !p.type)
    if (hasIncomplete) {
      toast.error("Please complete all program details")
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch("/api/onboarding/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentStep: 4,
          completedSteps: [1, 2, 3],
          formData: { programs },
          isCompleted: false,
        }),
      })

      if (!response.ok) throw new Error("Failed to save")
      router.push("/onboarding/review")
    } catch (error) {
      toast.error("Failed to save. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const steps = [
    { label: "Welcome", completed: true },
    { label: "School", completed: true },
    { label: "Programs", active: true },
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
                className={`h-2 w-2 rounded-full ${
                  step.active ? "bg-primary" : step.completed ? "bg-primary/40" : "bg-muted"
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
          <p className="text-sm font-medium text-primary mb-2">Step 3 of 4</p>
          <h1 className="text-2xl md:text-3xl font-semibold text-foreground mb-2">Programs</h1>
          <p className="text-muted-foreground">Add your academic programs</p>
        </div>

        {/* Programs List */}
        <div className="space-y-4 mb-6">
          {programs.map((program, index) => (
            <motion.div
              key={program.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-xl p-4 shadow-sm"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-muted-foreground">
                  Program {index + 1}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeProgram(program.id)}
                  className="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`name-${program.id}`} className="text-sm">
                    Program Name
                  </Label>
                  <Input
                    id={`name-${program.id}`}
                    value={program.name}
                    onChange={(e) => updateProgram(program.id, "name", e.target.value)}
                    placeholder="e.g., Radiologic Technology"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor={`type-${program.id}`} className="text-sm">
                      Type
                    </Label>
                    <Select
                      value={program.type}
                      onValueChange={(value) => updateProgram(program.id, "type", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {programTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor={`duration-${program.id}`} className="text-sm">
                      Duration (years)
                    </Label>
                    <Input
                      id={`duration-${program.id}`}
                      type="number"
                      min="1"
                      max="6"
                      value={program.duration}
                      onChange={(e) => updateProgram(program.id, "duration", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}

          {/* Add Program Button */}
          <button
            onClick={addProgram}
            className="w-full border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/50 hover:bg-muted/30 transition-colors"
          >
            <Plus className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Add Program</span>
          </button>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => router.push("/onboarding/school-profile")}
            className="text-muted-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button onClick={handleContinue} disabled={isLoading || programs.length === 0}>
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
