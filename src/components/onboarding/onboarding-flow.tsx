// TODO: Add cache invalidation hooks for mutations
"use client"

import { useAuth } from "@clerk/nextjs"
import {
  Building2,
  CheckCircle,
  GraduationCap,
  School as SchoolIcon,
  User as UserIcon,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useId, useState, useTransition } from "react"
import { toast } from "sonner"
import { ROLE_COLORS, ROLE_DISPLAY_NAMES } from "../../lib/auth"
import type { UserRole } from "../../types"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Progress } from "../ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"

interface UserData {
  id: string
  email: string
  name: string
  role: UserRole
  schoolId: string | null
  programId: string | null
}

interface School {
  id: string
  name: string
  address: string
  email: string
  isActive: boolean
}

interface Program {
  id: string
  name: string
  description: string
  schoolId: string
}

interface ClerkUser {
  id: string
  firstName: string | null
  lastName: string | null
  emailAddresses: {
    id: string
    emailAddress: string
    verification: { status: string; strategy: string } | null
    linkedTo: unknown[]
  }[]
}

interface OnboardingFlowProps {
  user: UserData
  clerkUser: ClerkUser
  availableSchools: School[]
  availablePrograms: Program[]
  initialStep?: string
  initialRole?: string
}

type OnboardingStep =
  | "welcome"
  | "role-selection"
  | "school-selection"
  | "program-selection"
  | "school-setup"
  | "affiliation-setup"
  | "complete"

export function OnboardingFlow({
  user,
  clerkUser,
  availableSchools,
  availablePrograms,
  initialStep,
  initialRole,
}: OnboardingFlowProps) {
  const router = useRouter()
  const { getToken } = useAuth()
  const [isPending, startTransition] = useTransition()
  const schoolNameId = useId()
  const schoolAddressId = useId()

  const [currentStep, setCurrentStep] = useState<OnboardingStep>(
    (initialStep as OnboardingStep) || "welcome"
  )
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(
    (initialRole as UserRole) || user?.role || null
  )
  const [selectedSchool, setSelectedSchool] = useState<string | null>(user?.schoolId || null)
  const [selectedProgram, setSelectedProgram] = useState<string | null>(user?.programId || null)
  const [schoolName, setSchoolName] = useState("")
  const [schoolAddress, setSchoolAddress] = useState("")

  const steps: Record<OnboardingStep, { title: string; description: string; progress: number }> = {
    welcome: { title: "Welcome", description: "Getting started", progress: 10 },
    "role-selection": { title: "Select Role", description: "Choose your role", progress: 25 },
    "school-selection": { title: "Select School", description: "Choose your school", progress: 50 },
    "program-selection": {
      title: "Select Program",
      description: "Choose your program",
      progress: 75,
    },
    "school-setup": { title: "School Setup", description: "Create your school", progress: 50 },
    "affiliation-setup": { title: "Affiliation", description: "Set up affiliation", progress: 75 },
    complete: { title: "Complete", description: "Setup complete", progress: 100 },
  }

  const handleUpdateUser = async (
    updates: Partial<Pick<UserData, "role" | "schoolId" | "programId">>
  ) => {
    try {
      // Get the Clerk authentication token (optional)
      const token = await getToken()

      const response = await fetch("/api/user/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        // Try to parse JSON error first, fallback to text
        let errorMessage = "Failed to update user information"
        try {
          const data = await response.json()
          errorMessage = data?.error || data?.message || errorMessage
        } catch {
          try {
            const text = await response.text()
            if (text) errorMessage = text
          } catch {}
        }
        // API Error Response
        throw new Error(errorMessage)
      }

      return await response.json()
    } catch (error) {
      // Error updating user
      const errorMessage = error instanceof Error ? error.message : "Failed to update user information"
      toast.error(errorMessage)
      throw error
    }
  }

  const handleCreateSchool = async (schoolData: { name: string; address: string }) => {
    try {
      // Get the Clerk authentication token
      const token = await getToken()
      if (!token) {
        throw new Error("No authentication token available")
      }

      const response = await fetch("/api/schools/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(schoolData),
      })

      if (!response.ok) {
        let message = "Failed to create school"
        try {
          const data = await response.json()
          message = data?.error || data?.message || message
        } catch {
          try {
            const text = await response.text()
            if (text) message = text
          } catch {}
        }
        // API Error Response
        throw new Error(message)
      }

      return await response.json()
    } catch (error) {
      // Error creating school
      const errorMessage = error instanceof Error ? error.message : "Failed to create school"
      toast.error(errorMessage)
      throw error
    }
  }

  const handleNext = () => {
    startTransition(async () => {
      try {
        switch (currentStep) {
          case "welcome":
            if (!user?.role) {
              setCurrentStep("role-selection")
            } else {
              // User already has a role, determine next step
              determineNextStep(user.role)
            }
            break

          case "role-selection":
            if (!selectedRole) {
              toast.error("Please select a role")
              return
            }

            await handleUpdateUser({ role: selectedRole })
            determineNextStep(selectedRole)
            break

          case "school-selection":
            if (!selectedSchool) {
              toast.error("Please select a school")
              return
            }

            await handleUpdateUser({ schoolId: selectedSchool })

            if (selectedRole === "STUDENT") {
              setCurrentStep("program-selection")
            } else {
              setCurrentStep("complete")
            }
            break

          case "program-selection":
            if (!selectedProgram) {
              toast.error("Please select a program")
              return
            }

            await handleUpdateUser({ programId: selectedProgram })
            setCurrentStep("complete")
            break

          case "school-setup": {
            if (!schoolName.trim()) {
              toast.error("Please enter a school name")
              return
            }

            const newSchool = await handleCreateSchool({
              name: schoolName,
              address: schoolAddress,
            })

            await handleUpdateUser({ schoolId: newSchool.id })
            setCurrentStep("complete")
            break
          }

          case "affiliation-setup":
            if (!selectedSchool) {
              toast.error("Please select a school affiliation")
              return
            }

            await handleUpdateUser({ schoolId: selectedSchool })
            setCurrentStep("complete")
            break

          case "complete": {
            // Mark onboarding as complete before redirecting
            const token = await getToken()
            const completeResponse = await fetch("/api/user/onboarding-complete", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
            })

            if (!completeResponse.ok) {
              const errorData = await completeResponse.json()
              throw new Error(errorData.error || "Failed to complete onboarding")
            }

            toast.success("Onboarding completed successfully!")
            router.push("/dashboard")
            break
          }
        }
      } catch (_error) {
        // Onboarding error
      }
    })
  }

  const handleBack = () => {
    switch (currentStep) {
      case "role-selection":
        setCurrentStep("welcome")
        break
      case "school-selection":
        if (selectedRole) {
          setCurrentStep("role-selection")
        } else {
          setCurrentStep("welcome")
        }
        break
      case "program-selection":
        setCurrentStep("school-selection")
        break
      case "school-setup":
        setCurrentStep("role-selection")
        break
      case "affiliation-setup":
        setCurrentStep("role-selection")
        break
      default:
        break
    }
  }

  const determineNextStep = (role: UserRole) => {
    switch (role) {
      case "SCHOOL_ADMIN":
        setCurrentStep("school-setup")
        break
      case "STUDENT":
        setCurrentStep("school-selection")
        break
      case "CLINICAL_PRECEPTOR":
      case "CLINICAL_SUPERVISOR":
        setCurrentStep("affiliation-setup")
        break
      case "SUPER_ADMIN":
        setCurrentStep("complete")
        break
      default:
        setCurrentStep("school-selection")
    }
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case "welcome":
        return (
          <div className="space-y-4 text-center">
            <UserIcon className="mx-auto h-16 w-16 text-blue-500" />
            <div>
              <h3 className="mb-2 font-semibold text-xl">
                Welcome, {clerkUser.firstName || "there"}!
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Let's get your account set up so you can start using MedStint.
              </p>
            </div>
          </div>
        )

      case "role-selection":
        return (
          <div className="space-y-4">
            <div className="mb-6 text-center">
              <h3 className="mb-2 font-semibold text-xl">Select Your Role</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Choose the role that best describes your position.
              </p>
            </div>

            <div className="grid gap-3">
              {(
                [
                  "STUDENT",
                  "CLINICAL_SUPERVISOR",
                  "CLINICAL_PRECEPTOR",
                  "SCHOOL_ADMIN",
                ] as UserRole[]
              ).map((role) => (
                <button
                  key={role}
                  onClick={() => setSelectedRole(role)}
                  className={`rounded-lg border p-4 text-left transition-all ${
                    selectedRole === role
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : "border-gray-200 hover:border-gray-300 dark:border-gray-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{ROLE_DISPLAY_NAMES[role]}</div>
                      <div className="mt-1 text-gray-500 text-sm">{getRoleDescription(role)}</div>
                    </div>
                    <Badge className={ROLE_COLORS[role]}>{role}</Badge>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )

      case "school-selection":
        return (
          <div className="space-y-4">
            <div className="mb-6 text-center">
              <SchoolIcon className="mx-auto mb-4 h-12 w-12 text-blue-500" />
              <h3 className="mb-2 font-semibold text-xl">Select Your School</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Choose the educational institution you're affiliated with.
              </p>
            </div>

            <div className="space-y-3">
              <Label htmlFor="school">School</Label>
              <Select value={selectedSchool || ""} onValueChange={setSelectedSchool}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a school" />
                </SelectTrigger>
                <SelectContent>
                  {availableSchools.map((school) => (
                    <SelectItem key={school.id} value={school.id}>
                      {school.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )

      case "program-selection":
        return (
          <div className="space-y-4">
            <div className="mb-6 text-center">
              <GraduationCap className="mx-auto mb-4 h-12 w-12 text-blue-500" />
              <h3 className="mb-2 font-semibold text-xl">Select Your Program</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Choose your academic program or field of study.
              </p>
            </div>

            <div className="space-y-3">
              <Label htmlFor="program">Program</Label>
              <Select value={selectedProgram || ""} onValueChange={setSelectedProgram}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a program" />
                </SelectTrigger>
                <SelectContent>
                  {availablePrograms
                    .filter((program) => program.schoolId === selectedSchool)
                    .map((program) => (
                      <SelectItem key={program.id} value={program.id}>
                        {program.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )

      case "school-setup":
        return (
          <div className="space-y-4">
            <div className="mb-6 text-center">
              <Building2 className="mx-auto mb-4 h-12 w-12 text-blue-500" />
              <h3 className="mb-2 font-semibold text-xl">Create Your School</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Set up your educational institution in the system.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor={schoolNameId}>School Name</Label>
                <Input
                  id={schoolNameId}
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder="Enter school name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={schoolAddressId}>Address (Optional)</Label>
                <Input
                  id={schoolAddressId}
                  value={schoolAddress}
                  onChange={(e) => setSchoolAddress(e.target.value)}
                  placeholder="Enter school address"
                />
              </div>
            </div>
          </div>
        )

      case "affiliation-setup":
        return (
          <div className="space-y-4">
            <div className="mb-6 text-center">
              <Building2 className="mx-auto mb-4 h-12 w-12 text-blue-500" />
              <h3 className="mb-2 font-semibold text-xl">School Affiliation</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Select the school you're affiliated with as a clinical supervisor.
              </p>
            </div>

            <div className="space-y-3">
              <Label htmlFor="affiliation">Affiliated School</Label>
              <Select value={selectedSchool || ""} onValueChange={setSelectedSchool}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a school" />
                </SelectTrigger>
                <SelectContent>
                  {availableSchools.map((school) => (
                    <SelectItem key={school.id} value={school.id}>
                      {school.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )

      case "complete":
        return (
          <div className="space-y-4 text-center">
            <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
            <div>
              <h3 className="mb-2 font-semibold text-xl">Setup Complete!</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Your account has been successfully configured. You can now access your dashboard.
              </p>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  const getRoleDescription = (role: UserRole): string => {
    switch (role) {
      case "STUDENT":
        return "Track your clinical rotations, competencies, and progress"
      case "CLINICAL_SUPERVISOR":
        return "Assess student competencies and provide specialized oversight"
      case "CLINICAL_PRECEPTOR":
        return "Supervise students, approve time records, and conduct evaluations"
      case "SCHOOL_ADMIN":
        return "Manage school programs, students, and clinical partnerships"
      default:
        return ""
    }
  }

  const currentStepInfo = steps[currentStep]

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="space-y-2">
          <Progress value={currentStepInfo.progress} className="w-full" />
          <div className="flex justify-between text-gray-500 text-sm">
            <span>{currentStepInfo.description}</span>
            <span>{currentStepInfo.progress}%</span>
          </div>
        </div>
        <CardTitle>{currentStepInfo.title}</CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {renderStepContent()}

        <div className="flex justify-between">
          {currentStep !== "welcome" && currentStep !== "complete" && (
            <Button variant="outline" onClick={handleBack} disabled={isPending}>
              Back
            </Button>
          )}
          <div className={currentStep === "welcome" || currentStep === "complete" ? "ml-auto" : ""}>
            <Button onClick={handleNext} disabled={isPending} className="min-w-24">
              {isPending
                ? "Processing..."
                : currentStep === "complete"
                  ? "Go to Dashboard"
                  : "Continue"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
