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
  const { getToken } = useAuth()
  const [isPending, startTransition] = useTransition()
  const schoolNameId = useId()
  const schoolAddressId = useId()

  // Enhanced state management
  const {
    currentStep,
    setCurrentStep,
    selectedRole,
    setSelectedRole,
    selectedSchool,
    setSelectedSchool,
    selectedProgram,
    setSelectedProgram,
    schoolName,
    setSchoolName,
    schoolAddress,
    setSchoolAddress,
    completedSteps,
    completeStep,
    isLoading,
    setLoading,
    lastError,
    setError,
    clearValidationErrors,
    resetState,
  } = useOnboardingStore()

  // Analytics and session management hooks
  const analytics = useOnboardingAnalytics()
  const { startTimer, getElapsedTime, resetTimer } = useStepTimer()
  const {
    sessionId,
    isLoading: sessionLoading,
    error: sessionError,
    isExpired,
    timeUntilExpiry,
    saveSession,
    loadSession,
    abandonSession,
    extendSession,
    recoverExpiredSession,
    clearError: clearSessionError,
  } = useOnboardingSession()

  // Auto-save session data
  const currentState = {
    currentStep,
    completedSteps,
    selectedRole,
    selectedSchool,
    selectedProgram,
    schoolName,
    schoolAddress,
  }

  useAutoSaveSession(currentState, enableSessionPersistence)

  const [showTutorial, setShowTutorial] = useState(false)
  const [tutorialEnabled, _setTutorialEnabled] = useState(true)

  // Tutorial initialization
  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem("onboarding-tutorial-seen")
    if (!hasSeenTutorial && currentStep === "welcome") {
      setShowTutorial(true)
    }
  }, [currentStep])

  const _handleTutorialComplete = useCallback(() => {
    localStorage.setItem("onboarding-tutorial-seen", "true")
    setShowTutorial(false)
    if (enableAnalytics) {
      analytics.trackEvent({
        eventType: "step_completed",
        step: currentStep,
        sessionId: sessionId || undefined,
      })
    }
  }, [currentStep, sessionId, enableAnalytics, analytics])

  const _toggleTutorial = useCallback(() => {
    setShowTutorial(!showTutorial)
    if (enableAnalytics) {
      analytics.trackEvent({
        eventType: "user_interaction",
        step: currentStep,
        sessionId: sessionId || undefined,
        metadata: { action: "tutorial_toggled", enabled: !showTutorial },
      })
    }
  }, [showTutorial, currentStep, sessionId, enableAnalytics, analytics])

  // Initialize state from props or session
  useEffect(() => {
    const initializeState = async () => {
      // Try to load existing session first
      if (enableSessionPersistence) {
        const sessionData = await loadSession()
        if (sessionData) {
          // Restore state from session
          setCurrentStep(sessionData.currentStep)
          setSelectedRole((sessionData.formData?.selectedRole as UserRole) || null)
          setSelectedSchool((sessionData.formData?.selectedSchool as string) || null)
          setSelectedProgram((sessionData.formData?.selectedProgram as string) || null)
          setSchoolName((sessionData.formData?.schoolName as string) || "")
          setSchoolAddress((sessionData.formData?.schoolAddress as string) || "")

          if (enableAnalytics) {
            await analytics.trackEvent({
              eventType: "step_started",
              step: sessionData.currentStep,
              sessionId: sessionData.id,
              metadata: { resumed: true },
            })
          }

          toast.success("Resumed your onboarding progress")
          return
        }
      }

      // Initialize from props if no session
      const initialStepValue = (initialStep as OnboardingStep) || "welcome"
      const initialRoleValue = (initialRole as UserRole) || user?.role || null

      setCurrentStep(initialStepValue)
      setSelectedRole(initialRoleValue)
      setSelectedSchool(user?.schoolId || null)
      setSelectedProgram(user?.programId || null)

      // User data is managed through individual store methods

      if (enableAnalytics) {
        await analytics.trackStepStarted(initialStepValue, sessionId || undefined, {
          initialLoad: true,
          userRole: user.role,
        })
      }
    }

    initializeState().catch(console.error)
  }, [
    analytics.trackEvent,
    analytics.trackStepStarted,
    enableAnalytics,
    enableSessionPersistence,
    initialRole,
    initialStep,
    loadSession,
    sessionId,
    setCurrentStep, // Restore state from session
    setCurrentStep,
    setSchoolAddress,
    setSchoolName,
    setSelectedProgram,
    setSelectedRole,
    setSelectedSchool,
    user.role,
    user?.programId,
    user?.schoolId,
  ]) // Only run on mount

  // Track step changes
  useEffect(() => {
    if (enableAnalytics && currentStep) {
      startTimer()
      analytics.trackStepStarted(currentStep, sessionId || undefined)
    }

    return () => {
      if (enableAnalytics) {
        const elapsed = getElapsedTime()
        if (elapsed > 0) {
          analytics.trackStepCompleted(currentStep, sessionId || undefined, elapsed)
        }
        resetTimer()
      }
    }
  }, [
    currentStep,
    enableAnalytics,
    sessionId,
    analytics.trackStepCompleted,
    analytics.trackStepStarted,
    getElapsedTime,
    resetTimer,
    startTimer,
  ])

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
      setLoading(true)
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
        throw new Error(errorMessage)
      }

      const result = await response.json()

      // User data updated through individual store methods

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update user information"
      setError(errorMessage)
      toast.error(errorMessage)

      if (enableAnalytics) {
        await analytics.trackApiError(currentStep, sessionId || undefined, errorMessage, {
          operation: "updateUser",
          updates,
        })
      }

      throw error
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSchool = async (schoolData: { name: string; address: string }) => {
    try {
      setLoading(true)
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
        throw new Error(message)
      }

      return await response.json()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create school"
      setError(errorMessage)
      toast.error(errorMessage)

      if (enableAnalytics) {
        await analytics.trackApiError(currentStep, sessionId || undefined, errorMessage, {
          operation: "createSchool",
          schoolData,
        })
      }

      throw error
    } finally {
      setLoading(false)
    }
  }

  const handleNext = () => {
    startTransition(async () => {
      try {
        clearValidationErrors()
        const stepStartTime = Date.now()

        switch (currentStep) {
          case "welcome":
            if (!user?.role) {
              setCurrentStep("role-selection")
            } else {
              determineNextStep(user.role)
            }
            break

          case "role-selection":
            if (!selectedRole) {
              const errorMsg = "Please select a role"
              setError(errorMsg)
              toast.error(errorMsg)

              if (enableAnalytics) {
                await analytics.trackValidationError(currentStep, sessionId || undefined, {
                  field: "selectedRole",
                  error: errorMsg,
                })
              }
              return
            }

            await handleUpdateUser({ role: selectedRole })
            completeStep(currentStep)
            determineNextStep(selectedRole)
            break

          case "school-selection":
            if (!selectedSchool) {
              const errorMsg = "Please select a school"
              setError(errorMsg)
              toast.error(errorMsg)

              if (enableAnalytics) {
                await analytics.trackValidationError(currentStep, sessionId || undefined, {
                  field: "selectedSchool",
                  error: errorMsg,
                })
              }
              return
            }

            await handleUpdateUser({ schoolId: selectedSchool })
            completeStep(currentStep)

            if (selectedRole === "STUDENT") {
              setCurrentStep("program-selection")
            } else {
              setCurrentStep("complete")
            }
            break

          case "program-selection":
            if (!selectedProgram) {
              const errorMsg = "Please select a program"
              setError(errorMsg)
              toast.error(errorMsg)

              if (enableAnalytics) {
                await analytics.trackValidationError(currentStep, sessionId || undefined, {
                  field: "selectedProgram",
                  error: errorMsg,
                })
              }
              return
            }

            await handleUpdateUser({ programId: selectedProgram })
            completeStep(currentStep)
            setCurrentStep("complete")
            break

          case "school-setup": {
            if (!schoolName.trim()) {
              const errorMsg = "Please enter a school name"
              setError(errorMsg)
              toast.error(errorMsg)

              if (enableAnalytics) {
                await analytics.trackValidationError(currentStep, sessionId || undefined, {
                  field: "schoolName",
                  error: errorMsg,
                })
              }
              return
            }

            const newSchool = await handleCreateSchool({
              name: schoolName,
              address: schoolAddress,
            })

            await handleUpdateUser({ schoolId: newSchool.id })
            completeStep(currentStep)
            setCurrentStep("complete")
            break
          }

          case "affiliation-setup":
            if (!selectedSchool) {
              const errorMsg = "Please select a school affiliation"
              setError(errorMsg)
              toast.error(errorMsg)

              if (enableAnalytics) {
                await analytics.trackValidationError(currentStep, sessionId || undefined, {
                  field: "selectedSchool",
                  error: errorMsg,
                })
              }
              return
            }

            await handleUpdateUser({ schoolId: selectedSchool })
            completeStep(currentStep)
            setCurrentStep("complete")
            break

          case "complete": {
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

            // Track completion
            if (enableAnalytics) {
              const totalTime = Date.now() - stepStartTime
              await analytics.trackOnboardingCompleted(sessionId || undefined, totalTime, {
                completedSteps: completedSteps.length,
                finalRole: selectedRole,
                hasSchool: !!selectedSchool,
                hasProgram: !!selectedProgram,
              })
            }

            // Clean up session
            if (enableSessionPersistence && sessionId) {
              await abandonSession()
            }

            toast.success("Onboarding completed successfully!")
            router.push("/dashboard")
            break
          }
        }

        // Track step completion
        if (enableAnalytics) {
          const elapsed = Date.now() - stepStartTime
          await analytics.trackStepCompleted(currentStep, sessionId || undefined, elapsed)
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An error occurred during onboarding"
        setError(errorMessage)

        if (enableAnalytics) {
          await analytics.trackApiError(currentStep, sessionId || undefined, errorMessage, {
            step: currentStep,
            action: "handleNext",
          })
        }
      }
    })
  }

  const handleBack = () => {
    if (enableAnalytics) {
      analytics.trackEvent({
        eventType: "step_started",
        step: currentStep,
        sessionId: sessionId || undefined,
        metadata: { direction: "back" },
      })
    }

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

  const handleAbandonSession = async () => {
    if (enableSessionPersistence && sessionId) {
      const success = await abandonSession()
      if (success) {
        if (enableAnalytics) {
          await analytics.trackSessionAbandoned(currentStep, sessionId, "user_requested")
        }
        resetState()
        toast.success("Session abandoned. Starting fresh.")
      }
    }
  }

  const getRoleDescription = (role: UserRole | null): string => {
    if (!role) return "user"
    const descriptions = {
      STUDENT: "student",
      SCHOOL_ADMIN: "school administrator",
      CLINICAL_PRECEPTOR: "clinical preceptor",
      CLINICAL_SUPERVISOR: "clinical supervisor",
      SUPER_ADMIN: "system administrator",
    }
    return descriptions[role] || "user"
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case "welcome":
        return (
          <div className="space-y-4 text-center">
            <UserIcon className="mx-auto h-16 w-16 text-blue-500" />
            <h2 className="font-bold text-2xl">Welcome to MedStint!</h2>
            <p className="text-muted-foreground">
              Let&apos;s get you set up with your account. This will only take a few minutes.
            </p>
            {sessionId && enableSessionPersistence && (
              <Alert>
                <Save className="h-4 w-4" />
                <AlertDescription>
                  Your progress is being automatically saved. You can resume anytime.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )

      case "role-selection":
        return (
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="font-bold text-2xl">What&apos;s your role?</h2>
              <p className="text-muted-foreground">This helps us customize your experience</p>
            </div>
            <div className="tutorial-role-selection grid gap-3">
              {Object.entries(ROLE_DISPLAY_NAMES).map(([role, displayName]) => {
                const isSelected = selectedRole === role
                const colorClass = ROLE_COLORS[role as UserRole]
                const roleDescriptions = {
                  STUDENT: "Access courses, track progress, and connect with clinical sites",
                  SCHOOL_ADMIN: "Manage school settings, programs, and student enrollment",
                  CLINICAL_PRECEPTOR:
                    "Guide students during clinical rotations and provide feedback",
                  CLINICAL_SUPERVISOR: "Oversee clinical education and coordinate with schools",
                  SUPER_ADMIN: "Full system access and administrative capabilities",
                }
                return (
                  <InteractiveTooltip
                    key={role}
                    content={{
                      title: displayName,
                      description:
                        roleDescriptions[role as keyof typeof roleDescriptions] ||
                        "Select this role to continue",
                      tips: [
                        "Choose the role that best describes your position",
                        "This will customize your dashboard and features",
                      ],
                    }}
                    position="right"
                  >
                    <Card
                      className={`tutorial-role-card cursor-pointer transition-all hover:shadow-md role-${role.toLowerCase()} ${
                        isSelected ? "ring-2 ring-blue-500" : ""
                      }`}
                      onClick={() => setSelectedRole(role as UserRole)}
                    >
                      <CardContent className="flex items-center justify-between p-4">
                        <div className="flex items-center space-x-3">
                          <div className={`h-3 w-3 rounded-full ${colorClass}`} />
                          <span className="font-medium">{displayName}</span>
                        </div>
                        {isSelected && <CheckCircle className="h-5 w-5 text-blue-500" />}
                      </CardContent>
                    </Card>
                  </InteractiveTooltip>
                )
              })}
            </div>
          </div>
        )

      case "school-selection": {
        const filteredSchools = availableSchools.filter((school) => school.isActive)
        return (
          <div className="space-y-4">
            <div className="text-center">
              <SchoolIcon className="mx-auto h-12 w-12 text-blue-500" />
              <h2 className="font-bold text-xl">Select Your School</h2>
              <p className="text-muted-foreground">Choose the school you&apos;re affiliated with</p>
            </div>
            <div className="tutorial-school-selection space-y-2">
              <InteractiveTooltip
                content={{
                  title: "School Selection",
                  description: "Choose the educational institution you are affiliated with",
                  tips: [
                    "This determines your available programs",
                    "Contact support if your school isn't listed",
                  ],
                  examples: ["Medical schools", "Nursing schools", "Allied health programs"],
                }}
                position="right"
              >
                <Label htmlFor="school-select" className="cursor-help">
                  School *
                </Label>
              </InteractiveTooltip>
              <Select value={selectedSchool || ""} onValueChange={setSelectedSchool}>
                <SelectTrigger id="school-select" className="tutorial-school-select">
                  <SelectValue placeholder="Select a school" />
                </SelectTrigger>
                <SelectContent>
                  {filteredSchools.map((school) => (
                    <SelectItem key={school.id} value={school.id}>
                      <div>
                        <div className="font-medium">{school.name}</div>
                        <div className="text-muted-foreground text-sm">{school.address}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )
      }

      case "program-selection": {
        const schoolPrograms = availablePrograms.filter(
          (program) => program.schoolId === selectedSchool
        )
        return (
          <div className="space-y-4">
            <div className="text-center">
              <GraduationCap className="mx-auto h-12 w-12 text-blue-500" />
              <h2 className="font-bold text-xl">Select Your Program</h2>
              <p className="text-muted-foreground">Choose your academic program</p>
            </div>
            <div className="tutorial-program-selection space-y-2">
              <InteractiveTooltip
                content={{
                  title: "Academic Program",
                  description: "Select your specific academic program or degree track",
                  tips: [
                    "This customizes your curriculum and clinical requirements",
                    "You can change this later in settings",
                  ],
                  examples: ["MD Program", "BSN Nursing", "PA Studies", "Physical Therapy"],
                }}
                position="right"
              >
                <Label htmlFor="program-select" className="cursor-help">
                  Program *
                </Label>
              </InteractiveTooltip>
              <Select value={selectedProgram || ""} onValueChange={setSelectedProgram}>
                <SelectTrigger id="program-select" className="tutorial-program-select">
                  <SelectValue placeholder="Select a program" />
                </SelectTrigger>
                <SelectContent>
                  {schoolPrograms.map((program) => (
                    <SelectItem key={program.id} value={program.id}>
                      <div>
                        <div className="font-medium">{program.name}</div>
                        <div className="text-muted-foreground text-sm">{program.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )
      }

      case "school-setup":
        return (
          <div className="space-y-4">
            <div className="text-center">
              <Building2 className="mx-auto h-12 w-12 text-blue-500" />
              <h2 className="font-bold text-xl">Create Your School</h2>
              <p className="text-muted-foreground">Set up your school&apos;s information</p>
            </div>
            <div className="space-y-4">
              <div className="tutorial-school-name space-y-2">
                <InteractiveTooltip
                  content={{
                    title: "School Name",
                    description: "Enter the official name of your educational institution",
                    tips: [
                      "Use the full, official name",
                      "This will appear on certificates and documents",
                    ],
                    examples: ["Harvard Medical School", "Johns Hopkins School of Nursing"],
                    validation: {
                      rules: ["required", "minLength:3"],
                      errorMessages: ["School name is required", "Must be at least 3 characters"],
                    },
                  }}
                  position="right"
                >
                  <Label htmlFor={schoolNameId} className="cursor-help">
                    School Name *
                  </Label>
                </InteractiveTooltip>
                <Input
                  id={schoolNameId}
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder="Enter school name"
                  required
                  className="tutorial-school-name-input"
                />
              </div>
              <div className="tutorial-school-address space-y-2">
                <InteractiveTooltip
                  content={{
                    title: "School Address",
                    description: "Enter the physical address of your school (optional)",
                    tips: [
                      "This helps with location-based features",
                      "You can add this later if needed",
                    ],
                    examples: ["123 University Ave, Boston, MA 02115"],
                  }}
                  position="right"
                >
                  <Label htmlFor={schoolAddressId} className="cursor-help">
                    School Address
                  </Label>
                </InteractiveTooltip>
                <Input
                  id={schoolAddressId}
                  value={schoolAddress}
                  onChange={(e) => setSchoolAddress(e.target.value)}
                  placeholder="Enter school address (optional)"
                  className="tutorial-school-address-input"
                />
              </div>
            </div>
          </div>
        )

      case "affiliation-setup":
        return (
          <div className="space-y-4">
            <div className="text-center">
              <Building2 className="mx-auto h-12 w-12 text-blue-500" />
              <h2 className="font-bold text-xl">School Affiliation</h2>
              <p className="text-muted-foreground">
                Select the school you&apos;re affiliated with as a{" "}
                {getRoleDescription(selectedRole)}
              </p>
            </div>
            <div className="tutorial-affiliation-selection space-y-2">
              <InteractiveTooltip
                content={{
                  title: "School Affiliation",
                  description: `Select the school you work with as a ${getRoleDescription(selectedRole)}`,
                  tips: [
                    "This connects you with the school's programs",
                    "You can be affiliated with multiple schools",
                  ],
                  examples: ["Teaching hospital partnerships", "Clinical rotation sites"],
                }}
                position="right"
              >
                <Label htmlFor="affiliation-select" className="cursor-help">
                  Affiliated School *
                </Label>
              </InteractiveTooltip>
              <Select value={selectedSchool || ""} onValueChange={setSelectedSchool}>
                <SelectTrigger id="affiliation-select" className="tutorial-affiliation-select">
                  <SelectValue placeholder="Select your affiliated school" />
                </SelectTrigger>
                <SelectContent>
                  {availableSchools
                    .filter((school) => school.isActive)
                    .map((school) => (
                      <SelectItem key={school.id} value={school.id}>
                        <div>
                          <div className="font-medium">{school.name}</div>
                          <div className="text-muted-foreground text-sm">{school.address}</div>
                        </div>
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
            <h2 className="font-bold text-2xl">Setup Complete!</h2>
            <p className="text-muted-foreground">
              Your account has been configured successfully. You&apos;re ready to start using
              MedStint.
            </p>
            <div className="rounded-lg bg-muted p-4 text-left">
              <h3 className="mb-2 font-semibold">Your Profile Summary:</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Role:</span>
                  <Badge variant="secondary">
                    {selectedRole ? ROLE_DISPLAY_NAMES[selectedRole as UserRole] : "Not set"}
                  </Badge>
                </div>
                {selectedSchool && (
                  <div className="flex justify-between">
                    <span>School:</span>
                    <span>
                      {availableSchools.find((s) => s.id === selectedSchool)?.name ||
                        schoolName ||
                        "Custom School"}
                    </span>
                  </div>
                )}
                {selectedProgram && (
                  <div className="flex justify-between">
                    <span>Program:</span>
                    <span>
                      {availablePrograms.find((p) => p.id === selectedProgram)?.name || "Not set"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )

      default:
        return (
          <div className="text-center">
            <p>Unknown step: {currentStep}</p>
          </div>
        )
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Tutorial Integration */}
      {tutorialEnabled && (
        <TutorialIntegration
          userRole={selectedRole as UserRole}
          userId={user.id}
          onboardingStep={currentStep}
          className="tutorial-integration"
        >
          <div />
        </TutorialIntegration>
      )}
      {/* Progress Bar */}
      <div className="tutorial-progress-section space-y-2">
        <div className="flex items-center justify-between text-sm">
          <InteractiveTooltip
            content={{
              title: "Current Step",
              description: "You are currently on this step of the onboarding process",
              tips: ["Complete all required fields", "Use the Next button to continue"],
            }}
            position="right"
          >
            <span className="cursor-help font-medium">
              {steps[currentStep as OnboardingStep]?.title}
            </span>
          </InteractiveTooltip>
          <InteractiveTooltip
            content={{
              title: "Progress Indicator",
              description: "Shows how much of the onboarding process you have completed",
              tips: ["Each step brings you closer to completion"],
            }}
            position="left"
          >
            <span className="cursor-help text-muted-foreground">
              {Math.round(steps[currentStep as OnboardingStep]?.progress || 0)}% complete
            </span>
          </InteractiveTooltip>
        </div>
        <Progress
          value={steps[currentStep as OnboardingStep]?.progress || 0}
          className="tutorial-progress-bar h-2"
        />
      </div>

      {/* Session Status */}
      {enableSessionPersistence && (
        <div className="flex items-center justify-between text-muted-foreground text-sm">
          <div className="flex items-center space-x-2">
            {sessionId ? (
              <>
                <Save className="h-4 w-4 text-green-500" />
                <span>Progress saved</span>
              </>
            ) : (
              <>
                <RotateCcw className="h-4 w-4" />
                <span>Auto-save enabled</span>
              </>
            )}
          </div>
          {sessionId && (
            <Button variant="ghost" size="sm" onClick={handleAbandonSession} className="text-xs">
              Start Fresh
            </Button>
          )}
        </div>
      )}

      {/* Session Expiration Warning */}
      {enableSessionPersistence && sessionId && (
        <SessionExpirationWarning
          timeUntilExpiry={timeUntilExpiry}
          isExpired={isExpired}
          onExtendSession={extendSession}
          onRecoverSession={recoverExpiredSession}
          isLoading={sessionLoading}
        />
      )}

      {/* Error Display */}
      {(lastError || sessionError) && (
        <Alert variant="destructive">
          <AlertDescription>
            {lastError || sessionError}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                clearValidationErrors()
                clearSessionError()
              }}
              className="ml-2 h-auto p-0 text-xs underline"
            >
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Step Content */}
      <Card className={`tutorial-step-card step-${currentStep}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <InteractiveTooltip
              content={{
                title: steps[currentStep as OnboardingStep]?.title || "",
                description: steps[currentStep as OnboardingStep]?.description || "",
                tips: ["Fill out all required information", "Use the help tooltips for guidance"],
              }}
              position="right"
            >
              <span className="cursor-help">{steps[currentStep as OnboardingStep]?.title}</span>
            </InteractiveTooltip>
            <InteractiveTooltip
              content={{
                title: "Need Help?",
                description: "Click the tutorial button above for step-by-step guidance",
                tips: ["Tutorial available for each step", "Contextual help throughout"],
              }}
              position="left"
            >
              <HelpCircle className="h-4 w-4 cursor-help text-muted-foreground" />
            </InteractiveTooltip>
          </CardTitle>
          <p className="tutorial-step-description text-muted-foreground text-sm">
            {steps[currentStep as OnboardingStep]?.description}
          </p>
        </CardHeader>
        <CardContent className="tutorial-step-content">{renderStepContent()}</CardContent>
      </Card>

      {/* Navigation */}
      <div className="tutorial-navigation flex justify-between">
        <InteractiveTooltip
          content={{
            title: "Previous Step",
            description: "Go back to the previous step in the onboarding process",
          }}
          position="top"
          disabled={currentStep === "welcome" || isPending || isLoading || sessionLoading}
        >
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === "welcome" || isPending || isLoading || sessionLoading}
            className="tutorial-back-button"
          >
            Back
          </Button>
        </InteractiveTooltip>
        <InteractiveTooltip
          content={{
            title: currentStep === "complete" ? "Complete Onboarding" : "Next Step",
            description:
              currentStep === "complete"
                ? "Finish the onboarding process and access your dashboard"
                : "Continue to the next step in the setup process",
          }}
          position="top"
          disabled={isPending || isLoading || sessionLoading}
        >
          <Button
            onClick={handleNext}
            disabled={isPending || isLoading || sessionLoading}
            className="tutorial-next-button"
          >
            {isLoading || sessionLoading
              ? "Loading..."
              : currentStep === "complete"
                ? "Finish"
                : "Next"}
          </Button>
        </InteractiveTooltip>
      </div>
    </div>
  )
}
