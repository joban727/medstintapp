// TODO: Add cache invalidation hooks for mutations
"use client"

import { useAuth } from "@clerk/nextjs"
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle,
  GraduationCap,
  Loader2,
  MapPin,
  Search,
} from "lucide-react"
import { useEffect, useId, useState } from "react"
import { toast } from "sonner"
import { Alert, AlertDescription } from "../ui/alert"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Card, CardContent, CardHeader } from "../ui/card"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { motion } from "../ui/motion"
import { Progress } from "../ui/progress"

const validateEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

interface StudentRegistrationProps {
  onBack: () => void
  onComplete: (studentData: StudentFormData) => void
}

interface StudentFormData {
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  studentId: string
  schoolId: string
  programId: string
  enrollmentDate: string
  expectedGraduation: string
}

interface School {
  id: string
  name: string
  address: string
  programs: Program[]
}

interface Program {
  id: string
  name: string
  description: string
  duration: number
  requirements: string[]
}

// API functions for fetching schools and programs
const fetchSchools = async (token: string, searchTerm = ""): Promise<School[]> => {
  try {
    const params = new URLSearchParams({
      includePrograms: "true",
      activeOnly: "true",
    })

    if (searchTerm.trim()) {
      params.append("search", searchTerm.trim())
    }

    const response = await fetch(`/api/schools?${params.toString()}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch((err) => {
          console.error("Failed to parse JSON response:", err)
          throw new Error("Invalid response format")
        })
        .catch(() => ({}))
      throw new Error(errorData.error || errorData.message || "Failed to fetch schools")
    }

    const result = await response.json().catch((err) => {
      console.error("Failed to parse JSON response:", err)
      throw new Error("Invalid response format")
    })

    return result.data?.schools || []
  } catch (_error) {
    // Error fetching schools
    return []
  }
}

export function StudentRegistration({ onBack, onComplete }: StudentRegistrationProps) {
  const { getToken } = useAuth()

  // Generate unique IDs for form elements
  const firstNameId = useId()
  const lastNameId = useId()
  const emailId = useId()
  const phoneId = useId()
  const studentIdId = useId()
  const addressId = useId()
  const schoolSearchId = useId()
  const enrollmentDateId = useId()
  const expectedGraduationId = useId()

  const [currentStep, setCurrentStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingSchools, setIsLoadingSchools] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [schools, setSchools] = useState<School[]>([])
  const [filteredSchools, setFilteredSchools] = useState<School[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null)
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null)
  const [formData, setFormData] = useState<StudentFormData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    studentId: "",
    schoolId: "",
    programId: "",
    enrollmentDate: "",
    expectedGraduation: "",
  })

  const totalSteps = 3
  const progress = (currentStep / totalSteps) * 100

  const loadSchools = async (search = "") => {
    setIsLoadingSchools(true)
    try {
      const token = await getToken()
      const schoolsData = await fetchSchools(token || "", search)
      if (search === "") {
        setSchools(schoolsData)
        setFilteredSchools(schoolsData)
      } else {
        setFilteredSchools(schoolsData)
      }
    } catch (_error) {
      // Failed to load schools
      toast.error("Failed to load schools. Please try again.")
    } finally {
      setIsLoadingSchools(false)
    }
  }

  // Load schools on component mount
  useEffect(() => {
    loadSchools()
  }, [])

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm !== "") {
        loadSchools(searchTerm)
      } else {
        setFilteredSchools(schools)
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchTerm, schools])

  // Update filtered schools when schools change
  useEffect(() => {
    if (searchTerm === "") {
      setFilteredSchools(schools)
    }
  }, [schools, searchTerm])

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {}

    if (step === 1) {
      if (!formData.firstName.trim()) newErrors.firstName = "First name is required"
      if (!formData.lastName.trim()) newErrors.lastName = "Last name is required"
      if (!formData.email.trim()) newErrors.email = "Email is required"
      if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = "Please enter a valid email address"
      }
      if (!formData.phone.trim()) newErrors.phone = "Phone number is required"
      if (!formData.address.trim()) newErrors.address = "Address is required"
      if (!formData.studentId.trim()) newErrors.studentId = "Student ID is required"
    }

    if (step === 2) {
      if (!formData.schoolId) newErrors.schoolId = "Please select a school"
      if (!formData.programId) newErrors.programId = "Please select a program"
    }

    if (step === 3) {
      if (!formData.enrollmentDate) newErrors.enrollmentDate = "Enrollment date is required"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < totalSteps) {
        setCurrentStep(currentStep + 1)
      } else {
        handleSubmit()
      }
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    } else {
      onBack()
    }
  }

  const handleSubmit = async () => {
    if (!validateStep(3)) return

    setIsLoading(true)
    try {
      const token = await getToken()

      // Submit to actual API endpoint
      const response = await fetch("/api/onboarding/student", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json().catch((err) => {
          console.error("Failed to parse JSON response:", err)
          throw new Error("Invalid response format")
        })
        throw new Error(errorData.error || "Registration failed")
      }

      const _result = await response.json().catch((err) => {
        console.error("Failed to parse JSON response:", err)
        throw new Error("Invalid response format")
      })

      toast.success("Student registration completed successfully!")
      onComplete(formData)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Registration failed. Please try again."
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const updateFormData = (field: keyof StudentFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }))
    }
  }

  const handleSchoolSelect = (schoolId: string) => {
    const school = schools.find((s) => s.id === schoolId)
    setSelectedSchool(school || null)
    setSelectedProgram(null)
    updateFormData("schoolId", schoolId)
    updateFormData("programId", "")

    // Clear any existing errors
    if (errors.schoolId) {
      setErrors((prev) => ({ ...prev, schoolId: "", programId: "" }))
    }
  }

  const handleProgramSelect = (programId: string) => {
    if (!selectedSchool?.programs) {
      return
    }

    const program = selectedSchool.programs.find((p) => p.id === programId)
    if (!program) {
      return
    }

    setSelectedProgram(program)
    updateFormData("programId", programId)

    // Calculate expected graduation date
    if (program && formData.enrollmentDate) {
      try {
        const enrollmentDate = new Date(formData.enrollmentDate)
        const graduationDate = new Date(enrollmentDate)
        graduationDate.setMonth(graduationDate.getMonth() + (program.duration || 0))
        updateFormData("expectedGraduation", graduationDate.toISOString().split("T")[0])
      } catch (_error) {
        // Error calculating graduation date
      }
    }

    // Clear any existing errors
    if (errors.programId) {
      setErrors((prev) => ({ ...prev, programId: "" }))
    }
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="mb-6 text-center">
              <GraduationCap className="mx-auto mb-4 h-12 w-12 text-healthcare-green" />
              <h2 className="font-bold text-2xl text-gray-900">Personal Information</h2>
              <p className="text-gray-600">Tell us about yourself</p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor={firstNameId}>First Name *</Label>
                  <Input
                    id={firstNameId}
                    value={formData.firstName}
                    onChange={(e) => updateFormData("firstName", e.target.value)}
                    placeholder="Enter your first name"
                    className={errors.firstName ? "border-red-500" : ""}
                  />
                  {errors.firstName && (
                    <p className="mt-1 text-red-500 text-sm">{errors.firstName}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor={lastNameId}>Last Name *</Label>
                  <Input
                    id={lastNameId}
                    value={formData.lastName}
                    onChange={(e) => updateFormData("lastName", e.target.value)}
                    placeholder="Enter your last name"
                    className={errors.lastName ? "border-red-500" : ""}
                  />
                  {errors.lastName && (
                    <p className="mt-1 text-red-500 text-sm">{errors.lastName}</p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor={emailId}>Email Address *</Label>
                <Input
                  id={emailId}
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateFormData("email", e.target.value)}
                  placeholder="your.email@example.com"
                  className={errors.email ? "border-red-500" : ""}
                />
                {errors.email && <p className="mt-1 text-red-500 text-sm">{errors.email}</p>}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor={phoneId}>Phone Number *</Label>
                  <Input
                    id={phoneId}
                    value={formData.phone}
                    onChange={(e) => updateFormData("phone", e.target.value)}
                    placeholder="(555) 123-4567"
                    className={errors.phone ? "border-red-500" : ""}
                  />
                  {errors.phone && <p className="mt-1 text-red-500 text-sm">{errors.phone}</p>}
                </div>

                <div>
                  <Label htmlFor={studentIdId}>Student ID *</Label>
                  <Input
                    id={studentIdId}
                    value={formData.studentId}
                    onChange={(e) => updateFormData("studentId", e.target.value)}
                    placeholder="Your student ID number"
                    className={errors.studentId ? "border-red-500" : ""}
                  />
                  {errors.studentId && (
                    <p className="mt-1 text-red-500 text-sm">{errors.studentId}</p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor={addressId}>Address *</Label>
                <Input
                  id={addressId}
                  value={formData.address}
                  onChange={(e) => updateFormData("address", e.target.value)}
                  placeholder="Your current address"
                  className={errors.address ? "border-red-500" : ""}
                />
                {errors.address && <p className="mt-1 text-red-500 text-sm">{errors.address}</p>}
              </div>
            </div>
          </motion.div>
        )

      case 2:
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="mb-6 text-center">
              <Search className="mx-auto mb-4 h-12 w-12 text-healthcare-green" />
              <h2 className="font-bold text-2xl text-gray-900">School & Program Selection</h2>
              <p className="text-gray-600">Find and select your educational institution</p>
            </div>

            <div className="space-y-6">
              <div>
                <Label htmlFor={schoolSearchId}>Search Schools</Label>
                <div className="relative">
                  <Search className="absolute top-3 left-3 h-4 w-4 text-gray-400" />
                  <Input
                    id={schoolSearchId}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by school name or location..."
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <Label>Select Your School *</Label>
                {isLoadingSchools ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-healthcare-green" />
                    <span className="ml-2 text-gray-600">Loading schools...</span>
                  </div>
                ) : filteredSchools.length === 0 ? (
                  <div className="py-8 text-center text-gray-500">
                    {searchTerm
                      ? "No schools found matching your search."
                      : "No schools available."}
                  </div>
                ) : (
                  <div className="max-h-60 space-y-3 overflow-y-auto">
                    {filteredSchools.map((school) => (
                      <Card
                        key={school.id}
                        className={`cursor-pointer transition-all duration-200 ${
                          formData.schoolId === school.id
                            ? "bg-green-50 ring-2 ring-green-500"
                            : "hover:border-green-300 hover:shadow-md transition-all duration-200"
                        }`}
                        onClick={() => handleSchoolSelect(school.id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-semibold text-gray-900">{school.name}</h3>
                              <p className="mt-1 flex items-center gap-1 text-gray-600 text-sm">
                                <MapPin className="h-3 w-3" />
                                {school.address}
                              </p>
                              <p className="mt-1 text-gray-500 text-sm">
                                {Array.isArray(school.programs) ? school.programs.length : 0}{" "}
                                program
                                {(Array.isArray(school.programs) ? school.programs.length : 0) !== 1
                                  ? "s"
                                  : ""}{" "}
                                available
                              </p>
                            </div>
                            {formData.schoolId === school.id && (
                              <CheckCircle className="h-5 w-5 text-healthcare-green" />
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
                {errors.schoolId && <p className="mt-1 text-red-500 text-sm">{errors.schoolId}</p>}
              </div>

              {selectedSchool &&
                Array.isArray(selectedSchool.programs) &&
                selectedSchool.programs.length > 0 && (
                  <div>
                    <Label>Select Your Program *</Label>
                    <div className="space-y-3">
                      {selectedSchool.programs.map((program) => (
                        <Card
                          key={program.id}
                          className={`cursor-pointer transition-all duration-200 ${
                            formData.programId === program.id
                              ? "bg-green-50 ring-2 ring-green-500"
                              : "hover:border-green-300 hover:shadow-md transition-all duration-200"
                          }`}
                          onClick={() => handleProgramSelect(program.id)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="mb-2 flex items-center gap-2">
                                  <h3 className="font-semibold text-gray-900">{program.name}</h3>
                                  <Badge variant="secondary" className="text-xs">
                                    <GraduationCap className="mr-1 h-3 w-3" />
                                    {program.duration} months
                                  </Badge>
                                </div>
                                <p className="mb-2 text-gray-600 text-sm">{program.description}</p>
                              </div>
                              {formData.programId === program.id && (
                                <CheckCircle className="ml-2 h-5 w-5 text-healthcare-green" />
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    {errors.programId && (
                      <p className="mt-1 text-red-500 text-sm">{errors.programId}</p>
                    )}
                  </div>
                )}
            </div>
          </motion.div>
        )

      case 3:
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="mb-6 text-center">
              <Calendar className="mx-auto mb-4 h-12 w-12 text-healthcare-green" />
              <h2 className="font-bold text-2xl text-gray-900">Enrollment Confirmation</h2>
              <p className="text-gray-600">Confirm your enrollment details</p>
            </div>

            <div className="space-y-6">
              {selectedSchool && selectedProgram && (
                <Card className="border-green-200 bg-green-50">
                  <CardContent className="p-6">
                    <h3 className="mb-4 font-semibold text-gray-900">Selected Program</h3>
                    <div className="space-y-2">
                      <p>
                        <span className="font-medium">School:</span> {selectedSchool.name}
                      </p>
                      <p>
                        <span className="font-medium">Program:</span> {selectedProgram.name}
                      </p>
                      <p>
                        <span className="font-medium">Duration:</span> {selectedProgram.duration}{" "}
                        months
                      </p>
                      <p>
                        <span className="font-medium">Location:</span> {selectedSchool.address}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor={enrollmentDateId}>Enrollment Date *</Label>
                  <Input
                    id={enrollmentDateId}
                    type="date"
                    value={formData.enrollmentDate}
                    onChange={(e) => {
                      updateFormData("enrollmentDate", e.target.value)
                      // Auto-calculate graduation date
                      if (selectedProgram && e.target.value) {
                        const enrollmentDate = new Date(e.target.value)
                        const graduationDate = new Date(enrollmentDate)
                        graduationDate.setMonth(
                          graduationDate.getMonth() + selectedProgram.duration
                        )
                        updateFormData(
                          "expectedGraduation",
                          graduationDate.toISOString().split("T")[0]
                        )
                      }
                    }}
                    className={errors.enrollmentDate ? "border-red-500" : ""}
                  />
                  {errors.enrollmentDate && (
                    <p className="mt-1 text-red-500 text-sm">{errors.enrollmentDate}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor={expectedGraduationId}>Expected Graduation</Label>
                  <Input
                    id={expectedGraduationId}
                    type="date"
                    value={formData.expectedGraduation}
                    onChange={(e) => updateFormData("expectedGraduation", e.target.value)}
                    disabled
                    className="bg-gray-50"
                  />
                  <p className="mt-1 text-gray-500 text-xs">
                    Automatically calculated based on program duration
                  </p>
                </div>
              </div>

              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  By completing this registration, you'll be enrolled in the selected program and
                  gain access to your student dashboard with course materials, schedules, and
                  clinical rotation information.
                </AlertDescription>
              </Alert>
            </div>
          </motion.div>
        )

      default:
        return null
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 via-white to-green-100 p-4">
      <div className="w-full max-w-3xl">
        <Card className="shadow-xl">
          <CardHeader className="text-center">
            <div className="mb-4">
              <Progress value={progress} className="w-full" />
              <p className="mt-2 text-gray-500 text-sm">
                Step {currentStep} of {totalSteps}
              </p>
            </div>
          </CardHeader>

          <CardContent className="p-8">
            {renderStep()}

            <div className="mt-8 flex justify-between">
              <Button variant="outline" onClick={handleBack} className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>

              <Button
                onClick={handleNext}
                disabled={isLoading}
                className="flex items-center gap-2 bg-healthcare-green text-white hover:bg-green-700 transition-colors duration-200"
              >
                {isLoading ? (
                  "Processing..."
                ) : currentStep === totalSteps ? (
                  "Complete Enrollment"
                ) : (
                  <>
                    Next
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
