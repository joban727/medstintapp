// TODO: Add cache invalidation hooks for mutations
"use client"

import { useAuth } from "@clerk/nextjs"

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

import {
  Building2,
  CheckCircle,
  GraduationCap,
  School as SchoolIcon,
  User as UserIcon,
  ChevronRight,
  ChevronLeft,
  Stethoscope,
  ClipboardCheck,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useId, useState, useTransition } from "react"
import { toast } from "sonner"
import { ROLE_COLORS, ROLE_DISPLAY_NAMES } from "../../lib/auth"
import type { UserRole } from "../../types"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Progress } from "../ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"

const validateEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

interface UserData {
  id: string
  email: string
  name: string
  role: UserRole | null
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
  | "program-setup"
  | "clinical-site-setup"
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

  // Determine if user was fully set up via invitation (has all required fields)
  const wasFullyInvited = user?.role && user?.schoolId && user?.programId

  // Smart initial step: if user has all fields from invitation, skip to complete
  const getInitialStep = (): OnboardingStep => {
    if (initialStep) return initialStep as OnboardingStep
    if (wasFullyInvited) return "complete"
    if (user?.role) return "welcome"  // Will be routed based on role
    return "welcome"
  }

  const [currentStep, setCurrentStep] = useState<OnboardingStep>(getInitialStep())
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(
    (initialRole as UserRole) || user?.role || null
  )
  const [selectedSchool, setSelectedSchool] = useState<string | null>(user?.schoolId || null)
  const [selectedProgram, setSelectedProgram] = useState<string | null>(user?.programId || null)
  const [schoolName, setSchoolName] = useState(() => {
    if (user?.schoolId) {
      const school = availableSchools.find((s) => s.id === user.schoolId)
      return school?.name || ""
    }
    return ""
  })
  const [schoolAddress, setSchoolAddress] = useState(() => {
    if (user?.schoolId) {
      const school = availableSchools.find((s) => s.id === user.schoolId)
      return school?.address || ""
    }
    return ""
  })

  // Program Setup State
  const [programName, setProgramName] = useState("")
  const [programType, setProgramType] = useState("")
  const [programDuration, setProgramDuration] = useState("4")
  const [programDescription, setProgramDescription] = useState("")

  // Clinical Site Setup State
  const [siteName, setSiteName] = useState("")
  const [siteAddress, setSiteAddress] = useState("")
  const [siteType, setSiteType] = useState("HOSPITAL")
  const [siteCapacity, setSiteCapacity] = useState("10")
  const [siteEmail, setSiteEmail] = useState("")
  const [sitePhone, setSitePhone] = useState("")

  const steps: Record<OnboardingStep, { title: string; description: string; progress: number }> = {
    welcome: { title: "Welcome", description: "Getting started", progress: 10 },
    "role-selection": { title: "Select Role", description: "Choose your role", progress: 25 },
    "school-selection": { title: "Select School", description: "Choose your school", progress: 50 },
    "program-selection": {
      title: "Select Program",
      description: "Choose your program",
      progress: 75,
    },
    "school-setup": { title: "School Setup", description: "Create your school", progress: 40 },
    "program-setup": {
      title: "Program Setup",
      description: "Add an academic program",
      progress: 60,
    },
    "clinical-site-setup": {
      title: "Clinical Site",
      description: "Add a clinical site",
      progress: 80,
    },
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
          const data = await response.json().catch((err) => {
            console.error("Failed to parse JSON response:", err)
            throw new Error("Invalid response format")
          })
          errorMessage = data?.error || data?.message || errorMessage
        } catch {
          try {
            const text = await response.text()
            if (text) errorMessage = text
          } catch { }
        }
        // API Error Response
        throw new Error(errorMessage)
      }

      return await response.json()
    } catch (error) {
      // Error updating user
      const errorMessage =
        error instanceof Error ? error.message : "Failed to update user information"
      toast.error(errorMessage)
      throw error
    }
  }

  const handleCreateSchool = async (schoolData: { name: string; address: string }) => {
    try {
      const token = await getToken()
      if (!token) throw new Error("No authentication token available")

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
        } catch { }
        throw new Error(message)
      }

      return await response.json()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create school"
      toast.error(errorMessage)
      throw error
    }
  }

  const handleCreateProgram = async () => {
    try {
      const token = await getToken()
      if (!token) throw new Error("No authentication token available")

      const response = await fetch("/api/programs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: programName,
          description: programDescription || `${programName} Program`,
          duration: parseInt(programDuration),
          schoolId: selectedSchool, // Should be set after school creation
          type: programType,
        }),
      })

      if (!response.ok) {
        let message = "Failed to create program"
        try {
          const data = await response.json()
          message = data?.error || data?.message || message
        } catch { }
        throw new Error(message)
      }

      return await response.json()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create program"
      toast.error(errorMessage)
      throw error
    }
  }

  const handleCreateClinicalSite = async () => {
    try {
      const token = await getToken()
      if (!token) throw new Error("No authentication token available")

      const response = await fetch("/api/clinical-sites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: siteName,
          address: siteAddress,
          phone: sitePhone || "555-0123", // Default if empty
          email: siteEmail || `contact@${siteName.replace(/\s+/g, "").toLowerCase()}.com`, // Default if empty
          type: siteType,
          capacity: parseInt(siteCapacity),
        }),
      })

      if (!response.ok) {
        let message = "Failed to create clinical site"
        try {
          const data = await response.json()
          message = data?.error || data?.message || message
        } catch { }
        throw new Error(message)
      }

      return await response.json()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create clinical site"
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
            // Update local state and DB
            setSelectedSchool(newSchool.id)
            await handleUpdateUser({ schoolId: newSchool.id })
            setCurrentStep("program-setup")
            break
          }

          case "program-setup": {
            if (!programName.trim()) {
              toast.error("Please enter a program name")
              return
            }
            // Create program
            await handleCreateProgram()
            setCurrentStep("clinical-site-setup")
            break
          }

          case "clinical-site-setup": {
            if (!siteName.trim()) {
              toast.error("Please enter a site name")
              return
            }
            if (!siteAddress.trim()) {
              toast.error("Please enter a site address")
              return
            }
            // Create clinical site
            await handleCreateClinicalSite()
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
            try {
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
              // Use window.location.href for more reliable navigation
              try {
                window.location.href = "/dashboard"
              } catch (error) {
                console.error("Failed to navigate to dashboard:", error)
              }
            } catch (error) {
              const errorMessage =
                error instanceof Error ? error.message : "An unexpected error occurred"
              console.error("[OnboardingFlow] Operation failed:", error)
              toast.error(errorMessage)
            }
            break
          }
        }
      } catch (error) {
        console.error("Onboarding error:", error)
        toast.error("An error occurred during onboarding. Please try again.")
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
      case "program-setup":
        setCurrentStep("school-setup")
        break
      case "clinical-site-setup":
        setCurrentStep("program-setup")
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
        if (selectedSchool) {
          if (selectedProgram) {
            setCurrentStep("clinical-site-setup")
          } else {
            setCurrentStep("program-setup")
          }
        } else {
          setCurrentStep("school-setup")
        }
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

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case "STUDENT":
        return <GraduationCap className="h-6 w-6" />
      case "SCHOOL_ADMIN":
        return <SchoolIcon className="h-6 w-6" />
      case "CLINICAL_PRECEPTOR":
        return <ClipboardCheck className="h-6 w-6" />
      case "CLINICAL_SUPERVISOR":
        return <Stethoscope className="h-6 w-6" />
      default:
        return <UserIcon className="h-6 w-6" />
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

  const renderStepContent = () => {
    switch (currentStep) {
      case "welcome":
        return (
          <div className="flex flex-col items-center text-center space-y-6 py-8">
            <div className="relative">
              <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 opacity-75 blur"></div>
              <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-white dark:bg-slate-900">
                <UserIcon className="h-12 w-12 text-teal-600" />
              </div>
            </div>
            <div className="space-y-2 max-w-md">
              <h3 className="text-3xl font-bold tracking-tight">
                Welcome to MedStint{clerkUser.firstName || "there"}!
              </h3>
              <p className="text-muted-foreground text-lg">
                Let's get your account set up so you can start using MedStint.
              </p>
            </div>
            <Button size="lg" onClick={handleNext} className="w-full max-w-xs text-lg h-12">
              Get Started <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        )

      case "role-selection":
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="space-y-1">
              <h3 className="text-2xl font-semibold tracking-tight">Select Your Role</h3>
              <p className="text-muted-foreground">
                Choose the role that best describes your position.
              </p>
            </div>
            <div className="grid gap-4">
              {(
                [
                  "STUDENT",
                  "CLINICAL_SUPERVISOR",
                  "CLINICAL_PRECEPTOR",
                  "SCHOOL_ADMIN",
                ] as UserRole[]
              ).map((role) => (
                <div
                  key={role}
                  onClick={() => setSelectedRole(role)}
                  className={`group relative flex cursor-pointer items-start gap-4 rounded-2xl border p-5 transition-all hover:shadow-md ${selectedRole === role
                    ? "border-teal-500 bg-teal-50/50 ring-2 ring-teal-500 dark:bg-teal-900/20"
                    : "bg-card hover:border-teal-200 dark:hover:border-teal-800"
                    }`}
                >
                  <div
                    className={`mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors ${selectedRole === role
                      ? "bg-teal-100 text-teal-600 dark:bg-teal-900/50 dark:text-teal-400"
                      : "bg-muted text-muted-foreground group-hover:bg-teal-50 group-hover:text-teal-500 dark:group-hover:bg-teal-900/30"
                      }`}
                  >
                    {getRoleIcon(role)}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-lg">{ROLE_DISPLAY_NAMES[role]}</h4>
                      {selectedRole === role && <CheckCircle className="h-5 w-5 text-teal-500" />}
                    </div>
                    <p className="text-sm text-muted-foreground">{getRoleDescription(role)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )

      case "school-selection":
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="space-y-1">
              <h3 className="text-2xl font-semibold tracking-tight">Select School</h3>
              <p className="text-muted-foreground">
                Choose the educational institution you're affiliated with.
              </p>
            </div>
            <div className="space-y-4">
              <Label htmlFor="school">School</Label>
              <Select value={selectedSchool || ""} onValueChange={setSelectedSchool}>
                <SelectTrigger className="h-11">
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
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="space-y-1">
              <h3 className="text-2xl font-semibold tracking-tight">Select Program</h3>
              <p className="text-muted-foreground">
                Choose your academic program or field of study.
              </p>
            </div>
            <div className="space-y-4">
              <Label htmlFor="program">Program</Label>
              <Select value={selectedProgram || ""} onValueChange={setSelectedProgram}>
                <SelectTrigger className="h-11">
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
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="space-y-1">
              <h3 className="text-2xl font-semibold tracking-tight">Create Your School</h3>
              <p className="text-muted-foreground">
                Set up your educational institution in the system.
              </p>
            </div>
            <div className="grid gap-6">
              <div className="space-y-2">
                <Label htmlFor={schoolNameId}>School Name</Label>
                <Input
                  id={schoolNameId}
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder="Enter school name"
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={schoolAddressId}>Address (Optional)</Label>
                <Input
                  id={schoolAddressId}
                  value={schoolAddress}
                  onChange={(e) => setSchoolAddress(e.target.value)}
                  placeholder="Enter school address"
                  className="h-11"
                />
              </div>
            </div>
          </div>
        )

      case "program-setup":
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="space-y-1">
              <h3 className="text-2xl font-semibold tracking-tight">Add Academic Program</h3>
              <p className="text-muted-foreground">Create the first program for your school.</p>
            </div>
            <div className="grid gap-6">
              <div className="space-y-2">
                <Label htmlFor="programName">Program Name</Label>
                <Input
                  id="programName"
                  value={programName}
                  onChange={(e) => setProgramName(e.target.value)}
                  placeholder="e.g. Doctor of Medicine"
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="programType">Program Type</Label>
                <Select value={programType} onValueChange={setProgramType}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Radiologic Technology (Rad Tech)">
                      Radiologic Technology (Rad Tech)
                    </SelectItem>
                    <SelectItem value="Magnetic Resonance Imaging (MRI)">
                      Magnetic Resonance Imaging (MRI)
                    </SelectItem>
                    <SelectItem value="Diagnostic Medical Sonography (Ultrasound)">
                      Diagnostic Medical Sonography (Ultrasound)
                    </SelectItem>
                    <SelectItem value="Nuclear Medicine Technology">
                      Nuclear Medicine Technology
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="programDuration">Duration (Years)</Label>
                <Input
                  id="programDuration"
                  type="number"
                  value={programDuration}
                  onChange={(e) => setProgramDuration(e.target.value)}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="programDescription">Description</Label>
                <Input
                  id="programDescription"
                  value={programDescription}
                  onChange={(e) => setProgramDescription(e.target.value)}
                  placeholder="Brief description"
                  className="h-11"
                />
              </div>
            </div>
          </div>
        )

      case "clinical-site-setup":
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="space-y-1">
              <h3 className="text-2xl font-semibold tracking-tight">Add Clinical Site</h3>
              <p className="text-muted-foreground">Add a clinical site for rotations.</p>
            </div>
            <div className="grid gap-6">
              <div className="space-y-2">
                <Label htmlFor="siteName">Site Name</Label>
                <Input
                  id="siteName"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  placeholder="e.g. General Hospital"
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="siteAddress">Address</Label>
                <Input
                  id="siteAddress"
                  value={siteAddress}
                  onChange={(e) => setSiteAddress(e.target.value)}
                  placeholder="Full address"
                  className="h-11"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="siteType">Type</Label>
                  <Select value={siteType} onValueChange={setSiteType}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HOSPITAL">Hospital</SelectItem>
                      <SelectItem value="CLINIC">Clinic</SelectItem>
                      <SelectItem value="OUTPATIENT">Outpatient</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="siteCapacity">Capacity</Label>
                  <Input
                    id="siteCapacity"
                    type="number"
                    value={siteCapacity}
                    onChange={(e) => setSiteCapacity(e.target.value)}
                    className="h-11"
                  />
                </div>
              </div>
            </div>
          </div>
        )

      case "affiliation-setup":
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="space-y-1">
              <h3 className="text-2xl font-semibold tracking-tight">School Affiliation</h3>
              <p className="text-muted-foreground">Select the school you're affiliated with.</p>
            </div>
            <div className="space-y-4">
              <Label htmlFor="affiliation">Affiliated School</Label>
              <Select value={selectedSchool || ""} onValueChange={setSelectedSchool}>
                <SelectTrigger className="h-11">
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
          <div className="flex flex-col items-center text-center space-y-6 py-8 animate-in zoom-in-95 duration-500">
            <div className="rounded-full bg-teal-100 p-6 dark:bg-teal-900/30">
              <CheckCircle className="h-16 w-16 text-teal-600 dark:text-teal-400" />
            </div>
            <div className="space-y-2 max-w-md">
              <h3 className="text-3xl font-bold tracking-tight">Setup Complete!</h3>
              <p className="text-muted-foreground text-lg">
                Your account has been successfully configured. You can now access your dashboard.
              </p>
            </div>
            <Button
              onClick={handleNext}
              disabled={isPending}
              size="lg"
              className="w-full max-w-xs text-lg h-12"
            >
              {isPending ? "Processing..." : "Go to Dashboard"}
            </Button>
          </div>
        )

      default:
        return null
    }
  }

  const currentStepInfo = steps[currentStep]

  return (
    <div className="w-full max-w-2xl mx-auto">
      <Card className="shadow-2xl shadow-slate-200/50 dark:shadow-slate-950/50 border-slate-200/80 dark:border-slate-700/50">
        <CardHeader className="border-b border-slate-200 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/30 pb-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-xl font-semibold text-slate-900 dark:text-white">{currentStepInfo.title}</CardTitle>
                <CardDescription className="text-slate-500 dark:text-slate-400">{currentStepInfo.description}</CardDescription>
              </div>
              <Badge variant="pill" className="px-3 py-1.5">
                Step {Object.keys(steps).indexOf(currentStep) + 1} of {Object.keys(steps).length}
              </Badge>
            </div>
            <Progress value={currentStepInfo.progress} className="h-2" />
          </div>
        </CardHeader>

        <CardContent className="p-6 md:p-8 min-h-[400px] flex flex-col">
          <div className="flex-1">{renderStepContent()}</div>

          {currentStep !== "welcome" && currentStep !== "complete" && (
            <div className="flex items-center justify-between pt-8 mt-4 border-t border-slate-200 dark:border-slate-700">
              <Button variant="ghost" onClick={handleBack} disabled={isPending} className="gap-2 text-slate-600 dark:text-slate-400">
                <ChevronLeft className="h-4 w-4" /> Back
              </Button>
              <div className="ml-auto">
                <Button onClick={handleNext} disabled={isPending} className="gap-2 min-w-[120px]">
                  {isPending ? "Processing..." : "Continue"}
                  {!isPending && <ChevronRight className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
