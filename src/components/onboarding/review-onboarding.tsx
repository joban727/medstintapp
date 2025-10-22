// TODO: Add cache invalidation hooks for mutations
"use client"

import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Building,
  Calendar,
  CheckCircle,
  Clock,
  MapPin,
  Stethoscope,
  Users,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
import { Progress } from "../ui/progress"
import { Separator } from "../ui/separator"

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
    institutionName: string
    institutionType: string
    address: {
      street: string
      city: string
      state: string
      zipCode: string
      country: string
    }
    contact: {
      phone: string
      email: string
      website: string
    }
    primaryContact: {
      name: string
      title: string
      email: string
      phone: string
    }
    accreditation: {
      body: string
      status: string
      expiryDate: string
    }
    establishedYear: string
    studentCapacity: string
  }
  programs?: Array<{
    id: string
    name: string
    description: string
    type: string
    duration: string
    durationUnit: string
    capacity: string
    requirements: string[]
    classYears: Array<{
      id: string
      year: number
      name: string
      description: string
      capacity: string
      requirements: string[]
    }>
    isActive: boolean
  }>
  rotations?: Array<{
    id: string
    name: string
    description: string
    specialty: string
    duration: string
    durationUnit: string
    capacity: string
    location: string
    requirements: string[]
    objectives: string[]
    assessmentMethods: string[]
    isRequired: boolean
    yearLevel: string[]
    schedule: {
      startDate: string
      endDate: string
      frequency: string
      timeSlots: Array<{
        id: string
        dayOfWeek: string
        startTime: string
        endTime: string
        maxStudents: string
      }>
    }
  }>
}

interface ValidationIssue {
  type: "error" | "warning"
  section: string
  message: string
  field?: string
}

export function ReviewOnboarding({ user, clerkUser }: ReviewOnboardingProps) {
  const router = useRouter()
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({})
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)

  const currentStep = 5
  const progressPercentage = (currentStep / 6) * 100

  const loadOnboardingData = async () => {
    try {
      const response = await fetch("/api/onboarding/progress")
      if (response.ok) {
        const data = await response.json()
        setOnboardingData(data.formData || {})
        validateData(data.formData || {})
      }
    } catch (error) {
      console.error("Error loading onboarding data:", error)
      toast.error("Failed to load onboarding data")
    }
  }

  useEffect(() => {
    setProgress(progressPercentage)
    loadOnboardingData()
  }, [progressPercentage, loadOnboardingData])

  const validateData = (data: OnboardingData) => {
    const issues: ValidationIssue[] = []

    // Validate School Profile
    if (!data.schoolProfile) {
      issues.push({
        type: "error",
        section: "School Profile",
        message: "School profile information is missing",
      })
    } else {
      const profile = data.schoolProfile
      if (!profile.institutionName?.trim()) {
        issues.push({
          type: "error",
          section: "School Profile",
          message: "Institution name is required",
          field: "institutionName",
        })
      }
      if (!profile.contact?.email?.trim()) {
        issues.push({
          type: "error",
          section: "School Profile",
          message: "Contact email is required",
          field: "contact.email",
        })
      }
      if (!profile.primaryContact?.name?.trim()) {
        issues.push({
          type: "error",
          section: "School Profile",
          message: "Primary contact name is required",
          field: "primaryContact.name",
        })
      }
    }

    // Validate Programs
    if (!data.programs || data.programs.length === 0) {
      issues.push({
        type: "error",
        section: "Academic Programs",
        message: "At least one academic program is required",
      })
    } else {
      data.programs.forEach((program, index) => {
        if (!program.name?.trim()) {
          issues.push({
            type: "error",
            section: "Academic Programs",
            message: `Program ${index + 1}: Name is required`,
            field: `programs[${index}].name`,
          })
        }
        if (!program.type?.trim()) {
          issues.push({
            type: "error",
            section: "Academic Programs",
            message: `Program ${index + 1}: Type is required`,
            field: `programs[${index}].type`,
          })
        }
        if (program.classYears.length === 0) {
          issues.push({
            type: "warning",
            section: "Academic Programs",
            message: `Program ${index + 1}: No class years configured`,
            field: `programs[${index}].classYears`,
          })
        }
      })
    }

    // Validate Rotations
    if (!data.rotations || data.rotations.length === 0) {
      issues.push({
        type: "warning",
        section: "Clinical Rotations",
        message: "No clinical rotations configured",
      })
    } else {
      data.rotations.forEach((rotation, index) => {
        if (!rotation.name?.trim()) {
          issues.push({
            type: "error",
            section: "Clinical Rotations",
            message: `Rotation ${index + 1}: Name is required`,
            field: `rotations[${index}].name`,
          })
        }
        if (!rotation.specialty?.trim()) {
          issues.push({
            type: "error",
            section: "Clinical Rotations",
            message: `Rotation ${index + 1}: Specialty is required`,
            field: `rotations[${index}].specialty`,
          })
        }
        if (rotation.yearLevel.length === 0) {
          issues.push({
            type: "error",
            section: "Clinical Rotations",
            message: `Rotation ${index + 1}: At least one year level must be selected`,
            field: `rotations[${index}].yearLevel`,
          })
        }
      })
    }

    setValidationIssues(issues)
  }

  const handleBack = () => {
    router.push("/onboarding/rotations")
  }

  const handleContinue = async () => {
    const errors = validationIssues.filter((issue) => issue.type === "error")
    if (errors.length > 0) {
      toast.error("Please resolve all errors before continuing")
      return
    }

    setIsLoading(true)
    try {
      // Save progress and mark as ready for completion
      const response = await fetch("/api/onboarding/progress", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentStep: 6,
          completedSteps: [1, 2, 3, 4, 5],
          formData: onboardingData,
          isCompleted: false,
          validationPassed: true,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to save progress")
      }

      router.push("/onboarding/complete")
    } catch (error) {
      console.error("Error saving progress:", error)
      toast.error("Failed to save progress. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const errorCount = validationIssues.filter((issue) => issue.type === "error").length
  const warningCount = validationIssues.filter((issue) => issue.type === "warning").length

  return (
    <div className="space-y-8">
      {/* Progress Header */}
      <div className="space-y-4 text-center">
        <h1 className="font-bold text-3xl text-gray-900 dark:text-white">
          Review &amp; Validation
        </h1>
        <p className="text-gray-600 text-lg dark:text-gray-300">
          Review your configuration and resolve any issues before completion.
        </p>
        <div className="mx-auto max-w-md space-y-2">
          <div className="flex justify-between text-gray-600 text-sm dark:text-gray-400">
            <span>Step {currentStep} of 6</span>
            <span>{Math.round(progressPercentage)}% Complete</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </div>

      {/* Validation Summary */}
      <Card
        className={`border-2 ${
          errorCount > 0
            ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/10"
            : warningCount > 0
              ? "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/10"
              : "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/10"
        }`}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {errorCount > 0 ? (
              <AlertCircle className="h-5 w-5 text-red-600" />
            ) : (
              <CheckCircle className="h-5 w-5 text-green-600" />
            )}
            Validation Summary
          </CardTitle>
          <CardDescription>
            {errorCount === 0 &&
              warningCount === 0 &&
              "All validations passed! Your configuration is ready."}
            {errorCount > 0 &&
              `${errorCount} error${errorCount > 1 ? "s" : ""} found that must be resolved.`}
            {errorCount === 0 &&
              warningCount > 0 &&
              `${warningCount} warning${warningCount > 1 ? "s" : ""} found. Review recommended but not required.`}
          </CardDescription>
        </CardHeader>
        {validationIssues.length > 0 && (
          <CardContent>
            <div className="space-y-3">
              {validationIssues.map((issue, index) => (
                <div
                  key={`validation-issue-${issue.section.replace(/\s+/g, '-').toLowerCase()}-${issue.type}-${index}`}
                  className={`flex items-start gap-3 rounded-lg p-3 ${
                    issue.type === "error"
                      ? "border border-red-200 bg-red-100 dark:border-red-800 dark:bg-red-900/20"
                      : "border border-yellow-200 bg-yellow-100 dark:border-yellow-800 dark:bg-yellow-900/20"
                  }`}
                >
                  <AlertCircle
                    className={`mt-0.5 h-4 w-4 flex-shrink-0 ${
                      issue.type === "error" ? "text-red-600" : "text-yellow-600"
                    }`}
                  />
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <Badge
                        variant={issue.type === "error" ? "destructive" : "secondary"}
                        className="text-xs"
                      >
                        {issue.type.toUpperCase()}
                      </Badge>
                      <span className="font-medium text-gray-900 text-sm dark:text-white">
                        {issue.section}
                      </span>
                    </div>
                    <p
                      className={`text-sm ${
                        issue.type === "error"
                          ? "text-red-700 dark:text-red-300"
                          : "text-yellow-700 dark:text-yellow-300"
                      }`}
                    >
                      {issue.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Configuration Summary */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* School Profile Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5 text-blue-600" />
              School Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {onboardingData.schoolProfile ? (
              <>
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white">
                    {onboardingData.schoolProfile.institutionName || "Not specified"}
                  </h4>
                  <p className="text-gray-600 text-sm dark:text-gray-400">
                    {onboardingData.schoolProfile.institutionType || "Type not specified"}
                  </p>
                </div>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">
                      {onboardingData.schoolProfile.address
                        ? `${onboardingData.schoolProfile.address.city}, ${onboardingData.schoolProfile.address.state}`
                        : "Address not specified"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">
                      Capacity: {onboardingData.schoolProfile.studentCapacity || "Not specified"}{" "}
                      students
                    </span>
                  </div>
                </div>
                <Separator />
                <div>
                  <h5 className="mb-1 font-medium text-gray-900 dark:text-white">
                    Primary Contact
                  </h5>
                  <p className="text-gray-600 text-sm dark:text-gray-400">
                    {onboardingData.schoolProfile.primaryContact?.name || "Not specified"}
                  </p>
                  <p className="text-gray-600 text-sm dark:text-gray-400">
                    {onboardingData.schoolProfile.primaryContact?.title || "Title not specified"}
                  </p>
                </div>
              </>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">No school profile data available</p>
            )}
          </CardContent>
        </Card>

        {/* Programs Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-green-600" />
              Academic Programs
              <Badge variant="secondary" className="ml-auto">
                {onboardingData.programs?.length || 0}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {onboardingData.programs && onboardingData.programs.length > 0 ? (
              onboardingData.programs.map((program, index) => (
                <div key={program.id} className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white">
                        {program.name || `Program ${index + 1}`}
                      </h4>
                      <p className="text-gray-600 text-sm dark:text-gray-400">
                        {program.type || "Type not specified"}
                      </p>
                    </div>
                    {program.isActive && (
                      <Badge variant="secondary" className="text-xs">
                        Active
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-gray-600 text-sm dark:text-gray-400">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {program.duration} {program.durationUnit}
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {program.capacity} students
                    </div>
                  </div>
                  <div className="text-gray-500 text-xs dark:text-gray-400">
                    {program.classYears.length} class year
                    {program.classYears.length !== 1 ? "s" : ""} configured
                  </div>
                  {index < (onboardingData.programs?.length ?? 0) - 1 && <Separator />}
                </div>
              ))
            ) : (
              <p className="text-gray-500 dark:text-gray-400">No programs configured</p>
            )}
          </CardContent>
        </Card>

        {/* Rotations Summary */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-purple-600" />
              Clinical Rotations
              <Badge variant="secondary" className="ml-auto">
                {onboardingData.rotations?.length || 0}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {onboardingData.rotations && onboardingData.rotations.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {onboardingData.rotations.map((rotation, index) => (
                  <div
                    key={rotation.id}
                    className="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white">
                          {rotation.name || `Rotation ${index + 1}`}
                        </h4>
                        <p className="text-gray-600 text-sm dark:text-gray-400">
                          {rotation.specialty || "Specialty not specified"}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        {rotation.isRequired && (
                          <Badge variant="secondary" className="text-xs">
                            Required
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2 text-gray-600 text-sm dark:text-gray-400">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        {rotation.duration} {rotation.durationUnit}
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3 w-3" />
                        {rotation.location || "Location not specified"}
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-3 w-3" />
                        {rotation.capacity} students, {rotation.yearLevel.length} year level
                        {rotation.yearLevel.length !== 1 ? "s" : ""}
                      </div>
                      {rotation.schedule.timeSlots.length > 0 && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3" />
                          {rotation.schedule.timeSlots.length} time slot
                          {rotation.schedule.timeSlots.length !== 1 ? "s" : ""} configured
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">No rotations configured</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-6">
        <Button variant="outline" onClick={handleBack} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={handleContinue}
          disabled={isLoading || errorCount > 0}
          size="lg"
          className="px-8"
        >
          {isLoading ? "Processing..." : "Complete Setup"}
        </Button>
      </div>
    </div>
  )
}
