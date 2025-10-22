// TODO: Add cache invalidation hooks for mutations
"use client"

import { useAuth } from "@clerk/nextjs"
import {
  Calendar,
  CheckCircle,
  Globe,
  GraduationCap,
  MapPin,
  School,
  Search,
  User,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { useFieldIds } from "../../hooks/use-unique-id"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Progress } from "../ui/progress"
import { Textarea } from "../ui/textarea"

interface StudentOnboardingProps {
  user: any
  clerkUser: any
  availableSchools: any[]
  availablePrograms: any[]
}

type Step =
  | "welcome"
  | "personal-info"
  | "school-selection"
  | "program-selection"
  | "enrollment-confirmation"
  | "complete"

interface SchoolInfo {
  id: string
  name: string
  address: string
  website: string
  accreditation: string
}

interface ProgramInfo {
  id: string
  name: string
  description: string
  duration: number
  classYear: number
  schoolId: string
}

export function StudentOnboarding({
  user,
  clerkUser,
  availableSchools,
  availablePrograms,
}: StudentOnboardingProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [currentStep, setCurrentStep] = useState<Step>("welcome")

  // Generate unique IDs for form fields
  const fieldIds = useFieldIds([
    "fullName",
    "email",
    "phone",
    "address",
    "studentId",
    "dateOfBirth",
    "enrollmentDate",
  ])
  const { getToken } = useAuth()

  // Form data
  const [personalData, setPersonalData] = useState({
    name: user?.name || `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() || "",
    email: user?.email || clerkUser.emailAddresses?.[0]?.emailAddress || "",
    phone: user?.phone || "",
    address: "",
    studentId: "",
    dateOfBirth: "",
  })

  const [selectedSchool, setSelectedSchool] = useState<SchoolInfo | null>(null)
  const [selectedProgram, setSelectedProgram] = useState<ProgramInfo | null>(null)
  const [enrollmentDate, setEnrollmentDate] = useState("")
  const [searchTerm, setSearchTerm] = useState("")

  const steps: Record<Step, { title: string; description: string; progress: number }> = {
    welcome: { title: "Welcome", description: "Student Registration", progress: 16 },
    "personal-info": { title: "Personal Information", description: "Your Details", progress: 33 },
    "school-selection": {
      title: "School Selection",
      description: "Choose Institution",
      progress: 50,
    },
    "program-selection": {
      title: "Program Selection",
      description: "Academic Program",
      progress: 66,
    },
    "enrollment-confirmation": {
      title: "Enrollment",
      description: "Confirm Details",
      progress: 83,
    },
    complete: { title: "Complete", description: "Registration Complete", progress: 100 },
  }

  const filteredSchools = availableSchools.filter(
    (school) =>
      school.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      school.address?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const availableProgramsForSchool = selectedSchool
    ? availablePrograms.filter((program) => program.schoolId === selectedSchool.id)
    : []

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
          message = data?.error || data?.message || data?.details || message
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
      // Error updating user
      const errorMessage = error instanceof Error ? error.message : "Failed to update user information"
      toast.error(errorMessage)
      throw error
    }
  }

  const handleNext = () => {
    startTransition(async () => {
      try {
        switch (currentStep) {
          case "welcome":
            setCurrentStep("personal-info")
            break

          case "personal-info":
            if (!personalData.name.trim()) {
              toast.error("Please enter your full name")
              return
            }
            if (!personalData.email.trim()) {
              toast.error("Please enter your email address")
              return
            }
            setCurrentStep("school-selection")
            break

          case "school-selection":
            if (!selectedSchool) {
              toast.error("Please select a school")
              return
            }
            setCurrentStep("program-selection")
            break

          case "program-selection":
            if (!selectedProgram) {
              toast.error("Please select a program")
              return
            }
            setCurrentStep("enrollment-confirmation")
            break

          case "enrollment-confirmation": {
            if (!enrollmentDate) {
              toast.error("Please select an enrollment date")
              return
            }

            // Validate and format enrollment date
            const enrollmentDateObj = new Date(enrollmentDate)
            if (Number.isNaN(enrollmentDateObj.getTime())) {
              toast.error("Please select a valid enrollment date")
              return
            }

            // Update user with all information
            await handleUpdateUser({
              name: personalData.name,
              email: personalData.email,
              phone: personalData.phone,
              address: personalData.address,
              studentId: personalData.studentId,
              // dateOfBirth is currently not stored in users schema; omit to avoid backend errors
              schoolId: selectedSchool?.id,
              programId: selectedProgram?.id,
              enrollmentDate: enrollmentDateObj,
              role: "STUDENT",
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
              let message = "Failed to complete onboarding"
              try {
                const data = await completeResponse.json()
                message = data?.error || data?.message || message
              } catch {
                try {
                  const text = await completeResponse.text()
                  if (text) message = text
                } catch {}
              }
              toast.error(message)
              return
            }

            toast.success("Student registration completed successfully!")
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
      case "personal-info":
        setCurrentStep("welcome")
        break
      case "school-selection":
        setCurrentStep("personal-info")
        break
      case "program-selection":
        setCurrentStep("school-selection")
        break
      case "enrollment-confirmation":
        setCurrentStep("program-selection")
        break
    }
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case "welcome":
        return (
          <div className="space-y-6 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20">
              <GraduationCap className="h-10 w-10 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="mb-3 font-semibold text-2xl">Welcome to Student Registration!</h3>
              <p className="mb-4 text-gray-600 dark:text-gray-300">
                Let's get you enrolled in your medical education program.
              </p>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
                <p className="text-blue-800 text-sm dark:text-blue-200">
                  You'll be able to track your clinical rotations, log hours, and access educational
                  resources.
                </p>
              </div>
            </div>
          </div>
        )

      case "personal-info":
        return (
          <div className="space-y-6">
            <div className="mb-6 text-center">
              <User className="mx-auto mb-4 h-12 w-12 text-blue-500" />
              <h3 className="mb-2 font-semibold text-xl">Personal Information</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Please provide your personal details for registration.
              </p>
            </div>

            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor={fieldIds.fullName}>Full Name *</Label>
                <Input
                  id={fieldIds.fullName}
                  value={personalData.name}
                  onChange={(e) => setPersonalData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter your full name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={fieldIds.email}>Email Address *</Label>
                  <Input
                    id={fieldIds.email}
                    type="email"
                    value={personalData.email}
                    onChange={(e) =>
                      setPersonalData((prev) => ({ ...prev, email: e.target.value }))
                    }
                    placeholder="your.email@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={fieldIds.phone}>Phone Number</Label>
                  <Input
                    id={fieldIds.phone}
                    value={personalData.phone}
                    onChange={(e) =>
                      setPersonalData((prev) => ({ ...prev, phone: e.target.value }))
                    }
                    placeholder="Your phone number"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor={fieldIds.address}>Address</Label>
                <Textarea
                  id={fieldIds.address}
                  value={personalData.address}
                  onChange={(e) =>
                    setPersonalData((prev) => ({ ...prev, address: e.target.value }))
                  }
                  placeholder="Your home address"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={fieldIds.studentId}>Student ID (Optional)</Label>
                  <Input
                    id={fieldIds.studentId}
                    value={personalData.studentId}
                    onChange={(e) =>
                      setPersonalData((prev) => ({ ...prev, studentId: e.target.value }))
                    }
                    placeholder="Your student ID"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={fieldIds.dateOfBirth}>Date of Birth</Label>
                  <Input
                    id={fieldIds.dateOfBirth}
                    type="date"
                    value={personalData.dateOfBirth}
                    onChange={(e) =>
                      setPersonalData((prev) => ({ ...prev, dateOfBirth: e.target.value }))
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        )

      case "school-selection":
        return (
          <div className="space-y-6">
            <div className="mb-6 text-center">
              <School className="mx-auto mb-4 h-12 w-12 text-blue-500" />
              <h3 className="mb-2 font-semibold text-xl">Select Your School</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Choose the educational institution you'll be attending.
              </p>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 transform text-gray-400" />
                <Input
                  placeholder="Search schools..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="max-h-96 space-y-3 overflow-y-auto">
                {filteredSchools.length === 0 ? (
                  <div className="py-8 text-center text-gray-500">
                    {availableSchools.length === 0 ? (
                      <p>No schools are currently available. Please contact support.</p>
                    ) : (
                      <p>No schools found matching your search.</p>
                    )}
                  </div>
                ) : (
                  filteredSchools.map((school) => (
                    <Card
                      key={school.id}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        selectedSchool?.id === school.id
                          ? "bg-blue-50 ring-2 ring-blue-500 dark:bg-blue-900/20"
                          : "hover:bg-gray-50 dark:hover:bg-gray-800"
                      }`}
                      onClick={() => setSelectedSchool(school)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="mb-2 font-semibold text-lg">{school.name}</h4>
                            {school.address && (
                              <div className="mb-1 flex items-center text-gray-600 text-sm dark:text-gray-300">
                                <MapPin className="mr-1 h-4 w-4" />
                                {school.address}
                              </div>
                            )}
                            {school.website && (
                              <div className="mb-2 flex items-center text-gray-600 text-sm dark:text-gray-300">
                                <Globe className="mr-1 h-4 w-4" />
                                <a
                                  href={school.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:underline"
                                >
                                  {school.website}
                                </a>
                              </div>
                            )}
                            <Badge variant="secondary">{school.accreditation}</Badge>
                          </div>
                          {selectedSchool?.id === school.id && (
                            <CheckCircle className="h-6 w-6 flex-shrink-0 text-blue-500" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </div>
        )

      case "program-selection":
        return (
          <div className="space-y-6">
            <div className="mb-6 text-center">
              <GraduationCap className="mx-auto mb-4 h-12 w-12 text-blue-500" />
              <h3 className="mb-2 font-semibold text-xl">Select Your Program</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Choose the academic program at {selectedSchool?.name}.
              </p>
            </div>

            <div className="space-y-4">
              {availableProgramsForSchool.length === 0 ? (
                <div className="py-8 text-center text-gray-500">
                  <p>No programs are currently available at this school.</p>
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep("school-selection")}
                    className="mt-4"
                  >
                    Choose Different School
                  </Button>
                </div>
              ) : (
                availableProgramsForSchool.map((program) => (
                  <Card
                    key={program.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedProgram?.id === program.id
                        ? "bg-blue-50 ring-2 ring-blue-500 dark:bg-blue-900/20"
                        : "hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                    onClick={() => setSelectedProgram(program)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="mb-2 font-semibold text-lg">{program.name}</h4>
                          <p className="mb-3 text-gray-600 dark:text-gray-300">
                            {program.description}
                          </p>

                          <div className="mb-2 flex items-center text-gray-600 text-sm dark:text-gray-300">
                            <Calendar className="mr-1 h-4 w-4" />
                            Duration: {program.duration} months
                          </div>

                          <div className="text-gray-600 text-sm dark:text-gray-300">
                            <strong>Class Year:</strong> {program.classYear}
                          </div>
                        </div>
                        {selectedProgram?.id === program.id && (
                          <CheckCircle className="h-6 w-6 flex-shrink-0 text-blue-500" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        )

      case "enrollment-confirmation":
        return (
          <div className="space-y-6">
            <div className="mb-6 text-center">
              <CheckCircle className="mx-auto mb-4 h-12 w-12 text-blue-500" />
              <h3 className="mb-2 font-semibold text-xl">Confirm Enrollment</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Please review your information and confirm your enrollment.
              </p>
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Personal Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <strong>Name:</strong> {personalData.name}
                  </div>
                  <div>
                    <strong>Email:</strong> {personalData.email}
                  </div>
                  {personalData.phone && (
                    <div>
                      <strong>Phone:</strong> {personalData.phone}
                    </div>
                  )}
                  {personalData.studentId && (
                    <div>
                      <strong>Student ID:</strong> {personalData.studentId}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Academic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <strong>School:</strong> {selectedSchool?.name}
                  </div>
                  <div>
                    <strong>Program:</strong> {selectedProgram?.name}
                  </div>
                  <div>
                    <strong>Class Year:</strong> {selectedProgram?.classYear}
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <Label htmlFor={fieldIds.enrollmentDate}>Enrollment Date *</Label>
                <Input
                  id={fieldIds.enrollmentDate}
                  type="date"
                  value={enrollmentDate}
                  onChange={(e) => setEnrollmentDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>

              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
                <div className="mb-2 flex items-center space-x-2">
                  <Badge variant="secondary">STUDENT</Badge>
                  <span className="text-blue-800 text-sm dark:text-blue-200">Role Assignment</span>
                </div>
                <p className="text-blue-700 text-sm dark:text-blue-300">
                  You will be assigned the Student role with access to rotation tracking, time
                  logging, and educational resources.
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
                Student Registration Complete!
              </h3>
              <p className="mb-4 text-gray-600 dark:text-gray-300">
                Welcome to {selectedSchool?.name}! You're now enrolled in the{" "}
                {selectedProgram?.name} program.
              </p>
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
                <p className="text-green-800 text-sm dark:text-green-200">
                  You can now access your student dashboard to view rotations, track clinical hours,
                  and manage your academic progress.
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
          <GraduationCap className="h-5 w-5 text-blue-500" />
          <span>{currentStepInfo.title}</span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {renderStepContent()}

        <div className="flex justify-between">
          {currentStep !== "welcome" && currentStep !== "complete" && (
            <Button variant="outline" onClick={handleBack} disabled={isPending}>
              Back
            </Button>
          )}

          <div className="flex-1" />

          <Button
            onClick={handleNext}
            disabled={isPending}
            className="min-w-32 bg-blue-600 hover:bg-blue-700"
          >
            {isPending
              ? "Processing..."
              : currentStep === "complete"
                ? "Go to Dashboard"
                : "Continue"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
