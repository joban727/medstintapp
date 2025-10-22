// TODO: Add cache invalidation hooks for mutations
"use client"

import { useAuth } from "@clerk/nextjs"
import { Building2, CheckCircle, GraduationCap, Plus, School, Trash2, Users } from "lucide-react"
import { useRouter } from "next/navigation"
import { useId, useState, useTransition } from "react"
import { toast } from "sonner"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Progress } from "../ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Textarea } from "../ui/textarea"

interface SchoolOnboardingProps {
  user: any
  clerkUser: any
  existingSchools: any[]
}

type Step = "welcome" | "role-selection" | "school-info" | "programs" | "admin-setup" | "complete"

interface Program {
  id: string
  name: string
  description: string
  duration: number
  classYear: number
}

export function SchoolOnboarding({ user, clerkUser, existingSchools }: SchoolOnboardingProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [currentStep, setCurrentStep] = useState<Step>("welcome")
  const [selectedRole, setSelectedRole] = useState<string>("")

  // Generate unique IDs for form fields
  const schoolNameId = useId()
  const schoolAddressId = useId()
  const schoolPhoneId = useId()
  const schoolEmailId = useId()
  const schoolWebsiteId = useId()
  const adminNameId = useId()
  const adminEmailId = useId()
  const adminPhoneId = useId()
  const adminTitleId = useId()

  const { getToken } = useAuth()

  // Form data
  const [schoolData, setSchoolData] = useState({
    name: "",
    address: "",
    phone: "",
    email: user?.email || clerkUser.emailAddresses?.[0]?.emailAddress || "",
    website: "",
    accreditation: "LCME",
  })

  const [programs, setPrograms] = useState<Program[]>([])

  const [adminData, setAdminData] = useState({
    name: user?.name || `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() || "",
    email: user?.email || clerkUser.emailAddresses?.[0]?.emailAddress || "",
    phone: "",
    title: "Administrator",
  })

  const steps: Record<Step, { title: string; description: string; progress: number }> = {
    welcome: { title: "Welcome", description: "Getting Started", progress: 15 },
    "role-selection": { title: "Account Type", description: "Select Your Role", progress: 25 },
    "school-info": {
      title: "School Information",
      description: "Institution Details",
      progress: 45,
    },
    programs: { title: "Academic Programs", description: "Program Setup", progress: 65 },
    "admin-setup": { title: "Administrator", description: "Admin Account", progress: 85 },
    complete: { title: "Complete", description: "Registration Complete", progress: 100 },
  }

  const accreditationOptions = [
    { value: "LCME", label: "LCME (Liaison Committee on Medical Education)" },
    { value: "COCA", label: "COCA (Commission on Osteopathic College Accreditation)" },
    { value: "ACGME", label: "ACGME (Accreditation Council for Graduate Medical Education)" },
    { value: "Other", label: "Other Accreditation" },
  ]

  const handleCreateSchool = async () => {
    try {
      const token = await getToken()
      const response = await fetch("/api/schools/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          ...schoolData,
          programs: programs.map((p) => ({
            name: p.name,
            description: p.description,
            duration: p.duration,
          })),
        }),
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
      // Error creating school
      const errorMessage = error instanceof Error ? error.message : "Failed to create school"
      toast.error(errorMessage)
      throw error
    }
  }

  const handleUpdateUser = async (updates: any) => {
    try {
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
        let message = "Failed to update user information"
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
      const errorMessage = error instanceof Error ? error.message : "Failed to update user information"
      toast.error(errorMessage)
      throw error
    }
  }

  const addProgram = () => {
    const newProgram: Program = {
      id: Date.now().toString(),
      name: "",
      description: "",
      duration: 48,
      classYear: new Date().getFullYear() + 4,
    }
    setPrograms([...programs, newProgram])
  }

  const removeProgram = (id: string) => {
    if (programs.length > 1) {
      setPrograms(programs.filter((p) => p.id !== id))
    }
  }

  const updateProgram = (id: string, field: keyof Program, value: string | number) => {
    setPrograms(programs.map((p) => (p.id === id ? { ...p, [field]: value } : p)))
  }

  const handleNext = () => {
    startTransition(async () => {
      try {
        switch (currentStep) {
          case "welcome":
            setCurrentStep("role-selection")
            break

          case "role-selection":
            if (!selectedRole) {
              toast.error("Please select your account type")
              return
            }

            // If user selected student or clinical preceptor, redirect to appropriate flow
            if (selectedRole === "STUDENT") {
              // Update user role and redirect to student onboarding
              await handleUpdateUser({ role: "STUDENT" })
              router.push("/onboarding/student")
              return
            }
            if (selectedRole === "CLINICAL_PRECEPTOR") {
              // Update user role and redirect to clinical preceptor flow
              await handleUpdateUser({ role: "CLINICAL_PRECEPTOR" })
              router.push("/dashboard/clinical-preceptor")
              return
            }
            if (selectedRole === "CLINICAL_SUPERVISOR") {
              // Update user role and redirect to clinical supervisor flow
              await handleUpdateUser({ role: "CLINICAL_SUPERVISOR" })
              router.push("/dashboard/clinical-supervisor")
              return
            }

            // For school admin, continue with school setup
            setCurrentStep("school-info")
            break

          case "school-info":
            if (!schoolData.name.trim()) {
              toast.error("Please enter the school name")
              return
            }
            if (!schoolData.email.trim()) {
              toast.error("Please enter the school email")
              return
            }
            setCurrentStep("programs")
            break

          case "programs": {
            const validPrograms = programs.filter((p) => p.name.trim())
            if (validPrograms.length === 0) {
              toast.error("Please add at least one program")
              return
            }
            setCurrentStep("admin-setup")
            break
          }

          case "admin-setup": {
            if (!adminData.name.trim()) {
              toast.error("Please enter your name")
              return
            }

            // Create school and update user
            const school = await handleCreateSchool()

            await handleUpdateUser({
              name: adminData.name,
              email: adminData.email,
              phone: adminData.phone,
              department: adminData.title,
              schoolId: school.id,
              role: "SCHOOL_ADMIN",
            })

            setCurrentStep("complete")
            break
          }

          case "complete": {
            // Mark onboarding as complete using the proper API endpoint
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
              toast.error(errorData.error || "Failed to complete onboarding")
              return
            }

            toast.success("School registration completed successfully!")
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
      case "school-info":
        setCurrentStep("role-selection")
        break
      case "programs":
        setCurrentStep("school-info")
        break
      case "admin-setup":
        setCurrentStep("programs")
        break
      default:
        break
    }
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case "welcome":
        return (
          <div className="space-y-6 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
              <School className="h-10 w-10 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="mb-3 font-semibold text-2xl">Welcome to School Registration!</h3>
              <p className="mb-4 text-gray-600 dark:text-gray-300">
                Let's set up your educational institution on the MedStint platform.
              </p>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
                <p className="text-blue-800 text-sm dark:text-blue-200">
                  You'll be able to manage academic programs, track student progress, and coordinate
                  clinical partnerships.
                </p>
              </div>
            </div>
          </div>
        )

      case "role-selection":
        return (
          <div className="space-y-6">
            <div className="mb-6 text-center">
              <Users className="mx-auto mb-4 h-12 w-12 text-green-500" />
              <h3 className="mb-2 font-semibold text-xl">Select Your Account Type</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Choose the option that best describes your role in medical education.
              </p>
            </div>

            <div className="grid gap-4">
              <Card
                className={`cursor-pointer border-2 transition-all hover:shadow-md ${
                  selectedRole === "STUDENT"
                    ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                onClick={() => setSelectedRole("STUDENT")}
              >
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20">
                      <GraduationCap className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-lg">Medical Student</h4>
                      <p className="text-gray-600 text-sm dark:text-gray-300">
                        I'm a medical student looking to track my clinical rotations, log hours, and
                        manage my medical education progress.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card
                className={`cursor-pointer border-2 transition-all hover:shadow-md ${
                  selectedRole === "CLINICAL_PRECEPTOR"
                    ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                onClick={() => setSelectedRole("CLINICAL_PRECEPTOR")}
              >
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/20">
                      <Users className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-lg">Clinical Preceptor</h4>
                      <p className="text-gray-600 text-sm dark:text-gray-300">
                        I'm a healthcare professional who supervises and mentors medical students
                        during their clinical rotations.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card
                className={`cursor-pointer border-2 transition-all hover:shadow-md ${
                  selectedRole === "CLINICAL_SUPERVISOR"
                    ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                onClick={() => setSelectedRole("CLINICAL_SUPERVISOR")}
              >
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/20">
                      <Building2 className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-lg">Clinical Supervisor</h4>
                      <p className="text-gray-600 text-sm dark:text-gray-300">
                        I'm a clinical supervisor who oversees medical education programs and
                        manages clinical training sites.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card
                className={`cursor-pointer border-2 transition-all hover:shadow-md ${
                  selectedRole === "SCHOOL_ADMIN"
                    ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                onClick={() => setSelectedRole("SCHOOL_ADMIN")}
              >
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
                      <School className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-lg">School Administrator</h4>
                      <p className="text-gray-600 text-sm dark:text-gray-300">
                        I'm setting up a medical school or educational institution to manage
                        students, programs, and clinical partnerships.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )

      case "school-info":
        return (
          <div className="space-y-6">
            <div className="mb-6 text-center">
              <Building2 className="mx-auto mb-4 h-12 w-12 text-green-500" />
              <h3 className="mb-2 font-semibold text-xl">School Information</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Provide details about your educational institution.
              </p>
            </div>

            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor={schoolNameId}>School Name *</Label>
                <Input
                  id={schoolNameId}
                  value={schoolData.name}
                  onChange={(e) => setSchoolData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter school name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={schoolAddressId}>Address</Label>
                <Textarea
                  id={schoolAddressId}
                  value={schoolData.address}
                  onChange={(e) => setSchoolData((prev) => ({ ...prev, address: e.target.value }))}
                  placeholder="Enter school address"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={schoolPhoneId}>Phone Number</Label>
                  <Input
                    id={schoolPhoneId}
                    value={schoolData.phone}
                    onChange={(e) => setSchoolData((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="School phone number"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={schoolEmailId}>Email Address *</Label>
                  <Input
                    id={schoolEmailId}
                    type="email"
                    value={schoolData.email}
                    onChange={(e) => setSchoolData((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="School email address"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={schoolWebsiteId}>Website</Label>
                  <Input
                    id={schoolWebsiteId}
                    value={schoolData.website}
                    onChange={(e) =>
                      setSchoolData((prev) => ({ ...prev, website: e.target.value }))
                    }
                    placeholder="https://school-website.edu"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accreditation">Accreditation</Label>
                  <Select
                    value={schoolData.accreditation}
                    onValueChange={(value) =>
                      setSchoolData((prev) => ({ ...prev, accreditation: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {accreditationOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        )

      case "programs":
        return (
          <div className="space-y-6">
            <div className="mb-6 text-center">
              <GraduationCap className="mx-auto mb-4 h-12 w-12 text-green-500" />
              <h3 className="mb-2 font-semibold text-xl">Academic Programs</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Set up the academic programs offered by your institution.
              </p>
            </div>

            <div className="space-y-4">
              {programs.map((program, index) => (
                <Card key={program.id} className="p-4">
                  <div className="mb-4 flex items-start justify-between">
                    <h4 className="font-medium">Program {index + 1}</h4>
                    {programs.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeProgram(program.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Program Name</Label>
                        <Input
                          value={program.name}
                          onChange={(e) => updateProgram(program.id, "name", e.target.value)}
                          placeholder="e.g., Doctor of Medicine (MD)"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Duration (months)</Label>
                        <Input
                          type="number"
                          value={program.duration}
                          onChange={(e) =>
                            updateProgram(
                              program.id,
                              "duration",
                              Number.parseInt(e.target.value) || 0
                            )
                          }
                          placeholder="48"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Input
                        value={program.description}
                        onChange={(e) => updateProgram(program.id, "description", e.target.value)}
                        placeholder="Brief description of the program"
                      />
                    </div>

                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
                      <p className="text-blue-800 text-sm dark:text-blue-200">
                        Class years will be automatically generated based on the program duration
                        (e.g., "Doctor of Medicine (MD) - Class of 2028").
                      </p>
                    </div>
                  </div>
                </Card>
              ))}

              <Button type="button" variant="outline" onClick={addProgram} className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                Add Another Program
              </Button>
            </div>
          </div>
        )

      case "admin-setup":
        return (
          <div className="space-y-6">
            <div className="mb-6 text-center">
              <Users className="mx-auto mb-4 h-12 w-12 text-green-500" />
              <h3 className="mb-2 font-semibold text-xl">Administrator Account</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Set up your administrator account for managing the school.
              </p>
            </div>

            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={adminNameId}>Full Name *</Label>
                  <Input
                    id={adminNameId}
                    value={adminData.name}
                    onChange={(e) => setAdminData((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Your full name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={adminEmailId}>Email Address</Label>
                  <Input
                    id={adminEmailId}
                    type="email"
                    value={adminData.email}
                    onChange={(e) => setAdminData((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="Your email address"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={adminPhoneId}>Phone Number</Label>
                  <Input
                    id={adminPhoneId}
                    value={adminData.phone}
                    onChange={(e) => setAdminData((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="Your phone number"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={adminTitleId}>Title/Position</Label>
                  <Input
                    id={adminTitleId}
                    value={adminData.title}
                    onChange={(e) => setAdminData((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g., Dean, Administrator"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
                <div className="mb-2 flex items-center space-x-2">
                  <Badge variant="secondary">SCHOOL_ADMIN</Badge>
                  <span className="text-green-800 text-sm dark:text-green-200">
                    Role Assignment
                  </span>
                </div>
                <p className="text-green-700 text-sm dark:text-green-300">
                  You will be assigned the School Administrator role with permissions to manage
                  programs, students, and school settings.
                </p>
              </div>
            </div>
          </div>
        )

      case "complete":
        return (
          <div className="space-y-6 text-center">
            <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
            <div>
              <h3 className="mb-3 font-semibold text-2xl text-green-900 dark:text-green-100">
                School Registration Complete!
              </h3>
              <p className="mb-4 text-gray-600 dark:text-gray-300">
                Your school has been successfully registered on the MedStint platform.
              </p>
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
                <p className="text-green-800 text-sm dark:text-green-200">
                  You can now manage your academic programs, invite students, and coordinate
                  clinical partnerships from your dashboard.
                </p>
              </div>
            </div>
          </div>
        )

      default:
        return null
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
        <CardTitle className="flex items-center space-x-2">
          <School className="h-5 w-5 text-green-500" />
          <span>{currentStepInfo.title}</span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {renderStepContent()}

        <div className="flex justify-between">
          {currentStep !== "welcome" && currentStep !== "complete" && (
            <Button type="button" variant="outline" onClick={handleBack} disabled={isPending}>
              Back
            </Button>
          )}
          <div className={currentStep === "welcome" || currentStep === "complete" ? "ml-auto" : ""}>
            <Button
              onClick={handleNext}
              disabled={isPending || (currentStep === "role-selection" && !selectedRole)}
              className="min-w-32 bg-green-600 hover:bg-green-700"
            >
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
