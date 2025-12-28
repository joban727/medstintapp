// TODO: Add cache invalidation hooks for mutations
"use client"

import { useAuth } from "@clerk/nextjs"
import {
  Building2,
  CheckCircle,
  GraduationCap,
  HelpCircle,
  RotateCcw,
  Save,
  School as SchoolIcon,
  User as UserIcon,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useId, useState, useTransition } from "react"
import { toast } from "sonner"
import { useOnboardingAnalytics, useStepTimer } from "../../hooks/use-onboarding-analytics"
import { useAutoSaveSession, useOnboardingSession } from "../../hooks/use-onboarding-session"
import { ROLE_COLORS, ROLE_DISPLAY_NAMES } from "../../lib/auth"
import { useOnboardingStore } from "../../stores/onboarding-store"
import type { UserRole } from "../../types"
import type { OnboardingStep } from "../../types/onboarding"
import { SessionExpirationWarning } from "../session-expiration-warning"
import { InteractiveTooltip } from "../tutorial/interactive-tooltip"
import { TutorialIntegration } from "../tutorial/tutorial-integration"
import { Alert, AlertDescription } from "../ui/alert"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Progress } from "../ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"

// Role validation utilities
const hasRole = (userRole: UserRole, allowedRoles: UserRole[]): boolean => {
  return allowedRoles.includes(userRole)
}

const isAdmin = (userRole: UserRole): boolean => {
  return hasRole(userRole, ["ADMIN" as UserRole, "SUPER_ADMIN" as UserRole])
}

const isSchoolAdmin = (userRole: UserRole): boolean => {
  return hasRole(userRole, [
    "SCHOOL_ADMIN" as UserRole,
    "ADMIN" as UserRole,
    "SUPER_ADMIN" as UserRole,
  ])
}

const validateEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

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
    linkedTo: string[]
  }[]
}

interface EnhancedOnboardingFlowProps {
  user: UserData
  clerkUser: ClerkUser
  availableSchools: School[]
  availablePrograms: Program[]
  initialStep?: string
  initialRole?: string
  enableAnalytics?: boolean
  enableSessionPersistence?: boolean
}

export function EnhancedOnboardingFlow({
  user,
  clerkUser,
  availableSchools,
  availablePrograms,
  initialStep,
  initialRole,
  enableAnalytics = true,
  enableSessionPersistence = true,
}: EnhancedOnboardingFlowProps) {
  const router = useRouter()
  const { userId } = useAuth()
  const [isPending, startTransition] = useTransition()
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(
    (initialStep as OnboardingStep) || "role-selection"
  )
  const [selectedRole, setSelectedRole] = useState<UserRole>((initialRole as UserRole) || user.role)
  const [selectedSchool, setSelectedSchool] = useState<string>(user.schoolId || "")
  const [selectedProgram, setSelectedProgram] = useState<string>(user.programId || "")
  const [schoolProfile, setSchoolProfile] = useState({
    name: "",
    address: "",
    email: "",
    phone: "",
    website: "",
    description: "",
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showTutorial, setShowTutorial] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)

  // Analytics hooks
  const { trackStepStarted, trackStepCompleted, trackValidationError } = useOnboardingAnalytics()
  const { startTimer, resetTimer } = useStepTimer()

  // Session management hooks
  const { saveSession, loadSession, abandonSession, sessionId, timeUntilExpiry, isExpired, extendSession, recoverExpiredSession, isLoading: isSessionLoading } = useOnboardingSession()
  // Auto-save session
  useAutoSaveSession({
    currentStep,
    selectedRole,
    selectedSchool,
    selectedProgram,
    schoolName: schoolProfile.name,
    schoolAddress: schoolProfile.address,
  }, enableSessionPersistence)

  // Store hooks
  const { progress, resetState, completeStep, completedSteps } = useOnboardingStore()

  const formId = useId()

  // Load saved session on mount
  useEffect(() => {
    if (enableSessionPersistence) {
      loadSession().then((savedSession) => {
        if (savedSession) {
          setCurrentStep(savedSession.currentStep)
          // Map other fields if needed, assuming savedSession structure matches
        }
      })
    }
  }, [])

  // Auto-save effect removed as it is handled by the hook directly

  // Track step start
  useEffect(() => {
    if (enableAnalytics) {
      trackStepStarted(currentStep, sessionId || undefined)
      startTimer()
    }

    return () => {
      if (enableAnalytics) {
        resetTimer()
      }
    }
  }, [currentStep, enableAnalytics])

  // Define onboarding steps
  const onboardingSteps: OnboardingStep[] = [
    "role-selection",
    "school-selection",
    "program-selection",
    "school-profile",
    "profile-completion",
    "tutorial",
    "completion",
  ]

  // Get current step index
  const currentStepIndex = onboardingSteps.indexOf(currentStep)
  const progressPercentage = progress || ((currentStepIndex + 1) / onboardingSteps.length) * 100

  // Validate current step
  const validateCurrentStep = (): boolean => {
    const newErrors: Record<string, string> = {}

    switch (currentStep) {
      case "role-selection":
        if (!selectedRole) {
          newErrors.role = "Please select a role"
        }
        break

      case "school-selection":
        if (!selectedSchool) {
          newErrors.school = "Please select a school"
        }
        break

      case "program-selection":
        if (!selectedProgram) {
          newErrors.program = "Please select a program"
        }
        break

      case "school-profile":
        if (!schoolProfile.name) {
          newErrors.name = "School name is required"
        }
        if (!schoolProfile.address) {
          newErrors.address = "School address is required"
        }
        if (!schoolProfile.email || !validateEmail(schoolProfile.email)) {
          newErrors.email = "Valid email is required"
        }
        break

      case "profile-completion":
        if (!clerkUser.firstName || !clerkUser.lastName) {
          newErrors.name = "Please provide your full name"
        }
        break
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle next step
  const handleNext = useCallback(() => {
    if (!validateCurrentStep()) {
      if (enableAnalytics) {
        trackValidationError(currentStep, sessionId || undefined, { error: "Validation failed" })
      }
      return
    }

    if (enableAnalytics) {
      trackStepCompleted(currentStep, sessionId || undefined)
    }

    completeStep(currentStep)

    const nextStepIndex = currentStepIndex + 1
    if (nextStepIndex < onboardingSteps.length) {
      setCurrentStep(onboardingSteps[nextStepIndex])
    } else {
      setIsCompleted(true)
    }
  }, [currentStep, currentStepIndex, validateCurrentStep, enableAnalytics, completeStep])

  // Handle previous step
  const handlePrevious = useCallback(() => {
    const prevStepIndex = currentStepIndex - 1
    if (prevStepIndex >= 0) {
      setCurrentStep(onboardingSteps[prevStepIndex])
    }
  }, [currentStepIndex])

  // Handle save progress
  const handleSaveProgress = useCallback(async () => {
    setIsSaving(true)
    try {
      // Save to backend
      await saveSession({
        currentStep,
        selectedRole,
        selectedSchool,
        selectedProgram,
        schoolName: schoolProfile.name,
        schoolAddress: schoolProfile.address,
      })

      toast.success("Progress saved successfully")
    } catch (error) {
      console.error("Failed to save progress:", error)
      toast.error("Failed to save progress")
    } finally {
      setIsSaving(false)
    }
  }, [currentStep, selectedRole, selectedSchool, selectedProgram, schoolProfile, saveSession])

  // Handle reset
  const handleReset = useCallback(() => {
    resetState()
    abandonSession()
    setCurrentStep("role-selection")
    setSelectedRole(user.role)
    setSelectedSchool(user.schoolId || "")
    setSelectedProgram(user.programId || "")
    setSchoolProfile({
      name: "",
      address: "",
      email: "",
      phone: "",
      website: "",
      description: "",
    })
    setErrors({})
    toast.info("Onboarding reset")
  }, [resetState, abandonSession, user.role, user.schoolId, user.programId])

  // Handle completion
  const handleComplete = useCallback(() => {
    startTransition(() => {
      try {
        window.location.assign("/dashboard")
      } catch { }
    })
  }, [])

  // Render role selection step
  const renderRoleSelection = () => (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserIcon className="h-5 w-5" />
          Select Your Role
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3">
          {Object.entries(ROLE_DISPLAY_NAMES).map(([role, displayName]) => (
            <Button
              key={role}
              variant={selectedRole === role ? "default" : "outline"}
              className="justify-start h-auto p-4"
              onClick={() => setSelectedRole(role as UserRole)}
            >
              <div className="flex items-center gap-3">
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center text-white"
                  style={{ backgroundColor: ROLE_COLORS[role as UserRole] }}
                >
                  {role === "SCHOOL_ADMIN" && <SchoolIcon className="h-5 w-5" />}
                  {role === "PROGRAM_DIRECTOR" && <GraduationCap className="h-5 w-5" />}
                  {role === "CLINICAL_COORDINATOR" && <UserIcon className="h-5 w-5" />}
                  {role === "ADMIN" && <Building2 className="h-5 w-5" />}
                </div>
                <div className="text-left">
                  <div className="font-medium">{displayName}</div>
                </div>
              </div>
            </Button>
          ))}
        </div>
        {errors.role && (
          <Alert variant="destructive">
            <AlertDescription>{errors.role}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )

  // Render school selection step
  const renderSchoolSelection = () => (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SchoolIcon className="h-5 w-5" />
          Select Your School
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="school">School</Label>
          <Select value={selectedSchool} onValueChange={setSelectedSchool}>
            <SelectTrigger id="school">
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
        {errors.school && (
          <Alert variant="destructive">
            <AlertDescription>{errors.school}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )

  // Render program selection step
  const renderProgramSelection = () => {
    const filteredPrograms = availablePrograms.filter(
      (program) => program.schoolId === selectedSchool
    )

    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Select Your Program
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="program">Program</Label>
            <Select value={selectedProgram} onValueChange={setSelectedProgram}>
              <SelectTrigger id="program">
                <SelectValue placeholder="Select a program" />
              </SelectTrigger>
              <SelectContent>
                {filteredPrograms.map((program) => (
                  <SelectItem key={program.id} value={program.id}>
                    {program.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {errors.program && (
            <Alert variant="destructive">
              <AlertDescription>{errors.program}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    )
  }

  // Render school profile step
  const renderSchoolProfile = () => (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          School Profile
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="school-name">School Name</Label>
          <Input
            id="school-name"
            value={schoolProfile.name}
            onChange={(e) => setSchoolProfile({ ...schoolProfile, name: e.target.value })}
            placeholder="Enter school name"
          />
          {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="school-address">Address</Label>
          <Input
            id="school-address"
            value={schoolProfile.address}
            onChange={(e) => setSchoolProfile({ ...schoolProfile, address: e.target.value })}
            placeholder="Enter school address"
          />
          {errors.address && <p className="text-sm text-red-500">{errors.address}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="school-email">Email</Label>
          <Input
            id="school-email"
            type="email"
            value={schoolProfile.email}
            onChange={(e) => setSchoolProfile({ ...schoolProfile, email: e.target.value })}
            placeholder="Enter school email"
          />
          {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="school-phone">Phone (Optional)</Label>
          <Input
            id="school-phone"
            value={schoolProfile.phone}
            onChange={(e) => setSchoolProfile({ ...schoolProfile, phone: e.target.value })}
            placeholder="Enter school phone"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="school-website">Website (Optional)</Label>
          <Input
            id="school-website"
            value={schoolProfile.website}
            onChange={(e) => setSchoolProfile({ ...schoolProfile, website: e.target.value })}
            placeholder="Enter school website"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="school-description">Description (Optional)</Label>
          <Input
            id="school-description"
            value={schoolProfile.description}
            onChange={(e) => setSchoolProfile({ ...schoolProfile, description: e.target.value })}
            placeholder="Enter school description"
          />
        </div>
      </CardContent>
    </Card>
  )

  // Render profile completion step
  const renderProfileCompletion = () => (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserIcon className="h-5 w-5" />
          Complete Your Profile
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Full Name</Label>
          <Input
            id="name"
            value={`${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`}
            readOnly
            className="bg-muted"
          />
          {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={user.email} readOnly className="bg-muted" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="role">Role</Label>
          <Badge variant="outline" className="text-sm">
            {ROLE_DISPLAY_NAMES[selectedRole]}
          </Badge>
        </div>

        {selectedSchool && (
          <div className="space-y-2">
            <Label htmlFor="school">School</Label>
            <Badge variant="outline" className="text-sm">
              {availableSchools.find((s) => s.id === selectedSchool)?.name}
            </Badge>
          </div>
        )}

        {selectedProgram && (
          <div className="space-y-2">
            <Label htmlFor="program">Program</Label>
            <Badge variant="outline" className="text-sm">
              {availablePrograms.find((p) => p.id === selectedProgram)?.name}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  )

  // Render tutorial step
  const renderTutorial = () => (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5" />
          Tutorial
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Would you like to take a quick tutorial to learn how to use the platform?
        </p>

        <div className="flex gap-2">
          <Button variant="default" onClick={() => setShowTutorial(true)} className="flex-1">
            Yes, Show Tutorial
          </Button>
          <Button variant="outline" onClick={() => setCurrentStep("completion")} className="flex-1">
            Skip Tutorial
          </Button>
        </div>
      </CardContent>
    </Card>
  )

  // Render completion step
  const renderCompletion = () => (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-500" />
          Onboarding Complete
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Congratulations! You have successfully completed the onboarding process.
        </p>

        <Button onClick={handleComplete} disabled={isPending} className="w-full">
          {isPending ? "Loading..." : "Go to Dashboard"}
        </Button>
      </CardContent>
    </Card>
  )

  // Render current step
  const renderCurrentStep = () => {
    switch (currentStep) {
      case "role-selection":
        return renderRoleSelection()
      case "school-selection":
        return renderSchoolSelection()
      case "program-selection":
        return renderProgramSelection()
      case "school-profile":
        return renderSchoolProfile()
      case "profile-completion":
        return renderProfileCompletion()
      case "tutorial":
        return renderTutorial()
      case "completion":
        return renderCompletion()
      default:
        return renderRoleSelection()
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <SessionExpirationWarning
        timeUntilExpiry={timeUntilExpiry}
        isExpired={isExpired}
        onExtendSession={extendSession}
        onRecoverSession={recoverExpiredSession}
        isLoading={isSessionLoading}
      />

      <div className="flex-1 container max-w-4xl mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">Welcome to MedStint Clerk</h1>
          <p className="text-muted-foreground">
            Let's get your account set up in just a few steps.
          </p>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              Step {currentStepIndex + 1} of {onboardingSteps.length}
            </span>
            <span className="text-sm text-muted-foreground">
              {Math.round(progressPercentage)}% Complete
            </span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>

        <div className="mb-8">{renderCurrentStep()}</div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={handlePrevious} disabled={currentStepIndex === 0}>
            Previous
          </Button>

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSaveProgress} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Progress"}
            </Button>

            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>

            {currentStep !== "completion" && (
              <Button onClick={handleNext}>{currentStep === "tutorial" ? "Skip" : "Next"}</Button>
            )}
          </div>
        </div>
      </div>

      {showTutorial && (
        <TutorialIntegration
          userRole={user.role}
          onClose={() => {
            setShowTutorial(false)
            setCurrentStep("completion")
          }}
        >
          <></>
        </TutorialIntegration>
      )}

      {enableAnalytics && (
        <InteractiveTooltip
          content={{ description: "This is an interactive tooltip to help you navigate the onboarding process." }}
          position="bottom"
        >
          <div className="fixed bottom-4 right-4 z-50">
            <HelpCircle className="h-6 w-6 text-muted-foreground" />
          </div>
        </InteractiveTooltip>
      )}
    </div>
  )
}
