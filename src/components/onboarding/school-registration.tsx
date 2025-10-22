"use client"

import { ArrowLeft, ArrowRight, Award, CheckCircle, Mail, School } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useFieldIds } from "../../hooks/use-unique-id"
import { useSchoolContext } from "../school-selector"
import { Alert, AlertDescription } from "../ui/alert"
import { Button } from "../ui/button"
import { Card, CardContent, CardHeader } from "../ui/card"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { motion } from "../ui/motion"
import { Progress } from "../ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Textarea } from "../ui/textarea"

interface AccreditationOption {
  id: string
  name: string
  abbreviation: string
  description: string | null
  isActive: boolean
  isDefault: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

interface SchoolRegistrationProps {
  onBack: () => void
  onComplete: (schoolData: SchoolFormData) => void
}

interface SchoolFormData {
  schoolName: string
  schoolType: "university" | "college" | "institute" | "hospital" | "other"
  address: string
  city: string
  state: string
  zipCode: string
  country: string
  phone: string
  email: string
  website: string
  accreditationBody: string
  accreditationNumber: string
  accreditationExpiry: string
  adminFirstName: string
  adminLastName: string
  adminEmail: string
  adminPhone: string
  adminTitle: string
  programs: Array<{
    name: string
    description: string
    duration: number
    capacity: number
    requirements: string[]
  }>
}

const _SCHOOL_TYPES = [
  { value: "university", label: "University" },
  { value: "college", label: "College" },
  { value: "institute", label: "Institute" },
  { value: "hospital", label: "Hospital" },
  { value: "other", label: "Other" },
] as const

const COMMON_REQUIREMENTS = [
  "CPR Certification",
  "Background Check",
  "Drug Screening",
  "Immunization Records",
  "Health Insurance",
  "Professional Liability Insurance",
  "HIPAA Training",
  "Clinical Skills Assessment",
]

export function SchoolRegistration({ onBack, onComplete }: SchoolRegistrationProps) {
  const { selectedSchoolId } = useSchoolContext()
  const [currentStep, setCurrentStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [accreditationOptions, setAccreditationOptions] = useState<AccreditationOption[]>([])
  const [loadingAccreditation, setLoadingAccreditation] = useState(true)
  const [previousSchoolId, setPreviousSchoolId] = useState<string | null>(null)

  // Generate unique IDs for form fields
  const fieldIds = useFieldIds([
    "schoolName",
    "address",
    "city",
    "state",
    "zipCode",
    "country",
    "phone",
    "email",
    "website",
    "accreditationNumber",
    "accreditationExpiry",
    "adminFirstName",
    "adminLastName",
    "adminTitle",
    "adminEmail",
    "adminPhone",
  ])
  const [formData, setFormData] = useState<SchoolFormData>({
    schoolName: "",
    schoolType: "university",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    country: "United States",
    phone: "",
    email: "",
    website: "",
    accreditationBody: "",
    accreditationNumber: "",
    accreditationExpiry: "",
    adminFirstName: "",
    adminLastName: "",
    adminEmail: "",
    adminPhone: "",
    adminTitle: "",
    programs: [
      {
        name: "",
        description: "",
        duration: 12,
        capacity: 50,
        requirements: [],
      },
    ],
  })

  const totalSteps = 4
  const progress = (currentStep / totalSteps) * 100

  // Fetch accreditation options on component mount
  useEffect(() => {
    const fetchAccreditationOptions = async () => {
      try {
        setLoadingAccreditation(true)
        const response = await fetch("/api/accreditation-options")
        if (!response.ok) {
          throw new Error("Failed to fetch accreditation options")
        }
        const data = await response.json()
        setAccreditationOptions(data.accreditationOptions || [])
      } catch (_error) {
        // Error fetching accreditation options
        toast.error("Failed to load accreditation options")
        // Fallback to empty array
        setAccreditationOptions([])
      } finally {
        setLoadingAccreditation(false)
      }
    }

    fetchAccreditationOptions()
  }, [])

  // Clear accreditation fields when school selection changes
  useEffect(() => {
    if (selectedSchoolId !== previousSchoolId && previousSchoolId !== null) {
      // Clear accreditation fields when school changes
      setFormData(prev => ({
        ...prev,
        accreditationBody: "",
        accreditationNumber: "",
        accreditationExpiry: ""
      }))
      // Clear any accreditation-related errors
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors.accreditationBody
        delete newErrors.accreditationNumber
        delete newErrors.accreditationExpiry
        return newErrors
      })
      toast.info("Accreditation fields cleared due to school selection change")
    }
    setPreviousSchoolId(selectedSchoolId)
  }, [selectedSchoolId, previousSchoolId])

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {}

    if (step === 1) {
      if (!formData.schoolName.trim()) newErrors.schoolName = "School name is required"
      if (!formData.schoolType) newErrors.schoolType = "School type is required"
      // Address is now optional - no validation required
      if (!formData.city.trim()) newErrors.city = "City is required"
      if (!formData.state.trim()) newErrors.state = "State is required"
      if (!formData.zipCode.trim()) newErrors.zipCode = "ZIP code is required"
      if (!formData.country.trim()) newErrors.country = "Country is required"
      if (!formData.phone.trim()) newErrors.phone = "Phone number is required"
      // Email is optional - validate format only if provided
      if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = "Please enter a valid email address"
      }
    }

    if (step === 2) {
      if (!formData.accreditationBody.trim())
        newErrors.accreditationBody = "Accreditation body is required"
      if (!formData.accreditationNumber.trim())
        newErrors.accreditationNumber = "Accreditation number is required"
      if (!formData.accreditationExpiry)
        newErrors.accreditationExpiry = "Accreditation expiry date is required"
    }

    if (step === 3) {
      if (!formData.adminFirstName.trim())
        newErrors.adminFirstName = "Administrator first name is required"
      if (!formData.adminLastName.trim())
        newErrors.adminLastName = "Administrator last name is required"
      if (!formData.adminEmail.trim()) newErrors.adminEmail = "Administrator email is required"
      if (formData.adminEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.adminEmail)) {
        newErrors.adminEmail = "Please enter a valid email address"
      }
      if (!formData.adminPhone.trim()) newErrors.adminPhone = "Administrator phone is required"
      if (!formData.adminTitle.trim()) newErrors.adminTitle = "Administrator title is required"
    }

    if (step === 4) {
      formData.programs.forEach((program, index) => {
        if (!program.name.trim()) newErrors[`program_${index}_name`] = "Program name is required"
        if (!program.description.trim())
          newErrors[`program_${index}_description`] = "Program description is required"
        if (program.duration < 1)
          newErrors[`program_${index}_duration`] = "Duration must be at least 1 month"
        if (program.capacity < 1)
          newErrors[`program_${index}_capacity`] = "Capacity must be at least 1"
        if (program.requirements.length === 0)
          newErrors[`program_${index}_requirements`] = "At least one requirement is needed"
      })
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
    if (!validateStep(4)) return

    setIsLoading(true)
    try {
      // Prepare data for API submission
      const _submissionData = {
        school: {
          name: formData.schoolName,
          type: formData.schoolType,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          zipCode: formData.zipCode,
          country: formData.country,
          phone: formData.phone,
          email: formData.email,
          website: formData.website || undefined,
        },
        accreditation: {
          body: formData.accreditationBody,
          number: formData.accreditationNumber,
          expiryDate: formData.accreditationExpiry,
        },
        administrator: {
          firstName: formData.adminFirstName,
          lastName: formData.adminLastName,
          email: formData.adminEmail,
          phone: formData.adminPhone,
          title: formData.adminTitle,
        },
        programs: formData.programs,
      }

      // Call the onComplete callback with the form data
      onComplete(formData)
    } catch (_error) {
      toast.error("Registration failed. Please try again.")
      // Registration failed
    } finally {
      setIsLoading(false)
    }
  }

  const updateFormData = (field: keyof SchoolFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }))
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
              <School className="mx-auto mb-4 h-12 w-12 text-blue-600" />
              <h2 className="font-bold text-2xl text-gray-900">School Information</h2>
              <p className="text-gray-600">Tell us about your educational institution</p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor={fieldIds.schoolName}>School Name *</Label>
                <Input
                  id={fieldIds.schoolName}
                  value={formData.schoolName}
                  onChange={(e) => updateFormData("schoolName", e.target.value)}
                  placeholder="Enter your school's full name"
                  className={errors.schoolName ? "border-red-500" : ""}
                />
                {errors.schoolName && (
                  <p className="mt-1 text-red-500 text-sm">{errors.schoolName}</p>
                )}
              </div>

              <div>
                <Label htmlFor="schoolType">School Type *</Label>
                <Select
                  value={formData.schoolType}
                  onValueChange={(value) => updateFormData("schoolType", value as SchoolFormData["schoolType"])}
                >
                  <SelectTrigger className={errors.schoolType ? "border-red-500" : ""}>
                    <SelectValue placeholder="Select school type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="university">University</SelectItem>
                    <SelectItem value="college">College</SelectItem>
                    <SelectItem value="institute">Institute</SelectItem>
                    <SelectItem value="hospital">Hospital</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {errors.schoolType && (
                  <p className="mt-1 text-red-500 text-sm">{errors.schoolType}</p>
                )}
              </div>

              <div>
                <Label htmlFor={fieldIds.address}>Address (Optional)</Label>
                <Textarea
                  id={fieldIds.address}
                  value={formData.address}
                  onChange={(e) => updateFormData("address", e.target.value)}
                  placeholder="Enter your school's street address"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <Label htmlFor={fieldIds.city}>City *</Label>
                  <Input
                    id={fieldIds.city}
                    value={formData.city}
                    onChange={(e) => updateFormData("city", e.target.value)}
                    placeholder="City"
                    className={errors.city ? "border-red-500" : ""}
                  />
                  {errors.city && <p className="mt-1 text-red-500 text-sm">{errors.city}</p>}
                </div>

                <div>
                  <Label htmlFor={fieldIds.state}>State *</Label>
                  <Input
                    id={fieldIds.state}
                    value={formData.state}
                    onChange={(e) => updateFormData("state", e.target.value)}
                    placeholder="State"
                    className={errors.state ? "border-red-500" : ""}
                  />
                  {errors.state && <p className="mt-1 text-red-500 text-sm">{errors.state}</p>}
                </div>

                <div>
                  <Label htmlFor={fieldIds.zipCode}>ZIP Code *</Label>
                  <Input
                    id={fieldIds.zipCode}
                    value={formData.zipCode}
                    onChange={(e) => updateFormData("zipCode", e.target.value)}
                    placeholder="ZIP Code"
                    className={errors.zipCode ? "border-red-500" : ""}
                  />
                  {errors.zipCode && <p className="mt-1 text-red-500 text-sm">{errors.zipCode}</p>}
                </div>
              </div>

              <div>
                <Label htmlFor={fieldIds.country}>Country *</Label>
                <Input
                  id={fieldIds.country}
                  value={formData.country}
                  onChange={(e) => updateFormData("country", e.target.value)}
                  placeholder="Country"
                  className={errors.country ? "border-red-500" : ""}
                />
                {errors.country && <p className="mt-1 text-red-500 text-sm">{errors.country}</p>}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor={fieldIds.phone}>Phone Number *</Label>
                  <Input
                    id={fieldIds.phone}
                    value={formData.phone}
                    onChange={(e) => updateFormData("phone", e.target.value)}
                    placeholder="(555) 123-4567"
                    className={errors.phone ? "border-red-500" : ""}
                  />
                  {errors.phone && <p className="mt-1 text-red-500 text-sm">{errors.phone}</p>}
                </div>

                <div>
                  <Label htmlFor={fieldIds.email}>Email Address (Optional)</Label>
                  <Input
                    id={fieldIds.email}
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateFormData("email", e.target.value)}
                    placeholder="contact@school.edu"
                    className={errors.email ? "border-red-500" : ""}
                  />
                  {errors.email && <p className="mt-1 text-red-500 text-sm">{errors.email}</p>}
                </div>
              </div>

              <div>
                <Label htmlFor={fieldIds.website}>Website (Optional)</Label>
                <Input
                  id={fieldIds.website}
                  value={formData.website}
                  onChange={(e) => updateFormData("website", e.target.value)}
                  placeholder="https://www.school.edu"
                />
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
              <Award className="mx-auto mb-4 h-12 w-12 text-blue-600" />
              <h2 className="font-bold text-2xl text-gray-900">Accreditation</h2>
              <p className="text-gray-600">Select your institution's accreditation</p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="accreditationBody">Accreditation Body *</Label>
                <Select
                  value={formData.accreditationBody}
                  onValueChange={(value) => updateFormData("accreditationBody", value)}
                  disabled={loadingAccreditation}
                >
                  <SelectTrigger className={errors.accreditationBody ? "border-red-500" : ""}>
                    <SelectValue
                      placeholder={
                        loadingAccreditation ? "Loading..." : "Select your accreditation"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {accreditationOptions
                      .filter((option) => option.isActive)
                      .sort((a, b) => a.sortOrder - b.sortOrder)
                      .map((option) => (
                        <SelectItem key={option.id} value={option.name}>
                          {option.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {errors.accreditationBody && (
                  <p className="mt-1 text-red-500 text-sm">{errors.accreditationBody}</p>
                )}
              </div>

              <div>
                <Label htmlFor={fieldIds.accreditationNumber}>Accreditation Number *</Label>
                <Input
                  id={fieldIds.accreditationNumber}
                  value={formData.accreditationNumber}
                  onChange={(e) => updateFormData("accreditationNumber", e.target.value)}
                  placeholder="Enter accreditation number"
                  className={errors.accreditationNumber ? "border-red-500" : ""}
                />
                {errors.accreditationNumber && (
                  <p className="mt-1 text-red-500 text-sm">{errors.accreditationNumber}</p>
                )}
              </div>

              <div>
                <Label htmlFor={fieldIds.accreditationExpiry}>Accreditation Expiry Date *</Label>
                <Input
                  id={fieldIds.accreditationExpiry}
                  type="date"
                  value={formData.accreditationExpiry}
                  onChange={(e) => updateFormData("accreditationExpiry", e.target.value)}
                  className={errors.accreditationExpiry ? "border-red-500" : ""}
                />
                {errors.accreditationExpiry && (
                  <p className="mt-1 text-red-500 text-sm">{errors.accreditationExpiry}</p>
                )}
              </div>
            </div>

            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Your accreditation information helps us ensure compliance with educational standards
                and enables proper integration with clinical partners.
              </AlertDescription>
            </Alert>
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
              <Mail className="mx-auto mb-4 h-12 w-12 text-blue-600" />
              <h2 className="font-bold text-2xl text-gray-900">Administrator Account</h2>
              <p className="text-gray-600">Set up the primary administrator for your school</p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor={fieldIds.adminFirstName}>First Name *</Label>
                  <Input
                    id={fieldIds.adminFirstName}
                    value={formData.adminFirstName}
                    onChange={(e) => updateFormData("adminFirstName", e.target.value)}
                    placeholder="Enter first name"
                    className={errors.adminFirstName ? "border-red-500" : ""}
                  />
                  {errors.adminFirstName && (
                    <p className="mt-1 text-red-500 text-sm">{errors.adminFirstName}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor={fieldIds.adminLastName}>Last Name *</Label>
                  <Input
                    id={fieldIds.adminLastName}
                    value={formData.adminLastName}
                    onChange={(e) => updateFormData("adminLastName", e.target.value)}
                    placeholder="Enter last name"
                    className={errors.adminLastName ? "border-red-500" : ""}
                  />
                  {errors.adminLastName && (
                    <p className="mt-1 text-red-500 text-sm">{errors.adminLastName}</p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor={fieldIds.adminTitle}>Title/Position *</Label>
                <Input
                  id={fieldIds.adminTitle}
                  value={formData.adminTitle}
                  onChange={(e) => updateFormData("adminTitle", e.target.value)}
                  placeholder="e.g., Dean, Director, Administrator"
                  className={errors.adminTitle ? "border-red-500" : ""}
                />
                {errors.adminTitle && (
                  <p className="mt-1 text-red-500 text-sm">{errors.adminTitle}</p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor={fieldIds.adminEmail}>Email Address *</Label>
                  <Input
                    id={fieldIds.adminEmail}
                    type="email"
                    value={formData.adminEmail}
                    onChange={(e) => updateFormData("adminEmail", e.target.value)}
                    placeholder="admin@school.edu"
                    className={errors.adminEmail ? "border-red-500" : ""}
                  />
                  {errors.adminEmail && (
                    <p className="mt-1 text-red-500 text-sm">{errors.adminEmail}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor={fieldIds.adminPhone}>Phone Number *</Label>
                  <Input
                    id={fieldIds.adminPhone}
                    value={formData.adminPhone}
                    onChange={(e) => updateFormData("adminPhone", e.target.value)}
                    placeholder="(555) 123-4567"
                    className={errors.adminPhone ? "border-red-500" : ""}
                  />
                  {errors.adminPhone && (
                    <p className="mt-1 text-red-500 text-sm">{errors.adminPhone}</p>
                  )}
                </div>
              </div>
            </div>

            <Alert>
              <Mail className="h-4 w-4" />
              <AlertDescription>
                A verification email will be sent to the administrator's email address. They will
                need to verify their email before accessing the school dashboard.
              </AlertDescription>
            </Alert>
          </motion.div>
        )

      case 4:
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="mb-6 text-center">
              <School className="mx-auto mb-4 h-12 w-12 text-blue-600" />
              <h2 className="font-bold text-2xl text-gray-900">Programs</h2>
              <p className="text-gray-600">Set up your clinical programs</p>
            </div>

            <div className="space-y-6">
              {formData.programs.map((program, index) => (
                <div
                  key={`program-${index}-${program.name || "new"}`}
                  className="space-y-4 rounded-lg border p-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg">Program {index + 1}</h3>
                    {formData.programs.length > 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const newPrograms = formData.programs.filter((_, i) => i !== index)
                          setFormData((prev) => ({ ...prev, programs: newPrograms }))
                        }}
                      >
                        Remove
                      </Button>
                    )}
                  </div>

                  <div>
                    <Label htmlFor={`program_${index}_name`}>Program Name *</Label>
                    <Input
                      id={`program_${index}_name`}
                      value={program.name}
                      onChange={(e) => {
                        const newPrograms = [...formData.programs]
                        newPrograms[index].name = e.target.value
                        setFormData((prev) => ({ ...prev, programs: newPrograms }))
                      }}
                      placeholder="e.g., Nursing Clinical Rotation"
                      className={errors[`program_${index}_name`] ? "border-red-500" : ""}
                    />
                    {errors[`program_${index}_name`] && (
                      <p className="mt-1 text-red-500 text-sm">{errors[`program_${index}_name`]}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor={`program_${index}_description`}>Description *</Label>
                    <Textarea
                      id={`program_${index}_description`}
                      value={program.description}
                      onChange={(e) => {
                        const newPrograms = [...formData.programs]
                        newPrograms[index].description = e.target.value
                        setFormData((prev) => ({ ...prev, programs: newPrograms }))
                      }}
                      placeholder="Describe the program objectives and activities"
                      className={errors[`program_${index}_description`] ? "border-red-500" : ""}
                      rows={3}
                    />
                    {errors[`program_${index}_description`] && (
                      <p className="mt-1 text-red-500 text-sm">
                        {errors[`program_${index}_description`]}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor={`program_${index}_duration`}>Duration (weeks) *</Label>
                      <Input
                        id={`program_${index}_duration`}
                        type="number"
                        min="1"
                        value={program.duration}
                        onChange={(e) => {
                          const newPrograms = [...formData.programs]
                          newPrograms[index].duration = Number.parseInt(e.target.value) || 1
                          setFormData((prev) => ({ ...prev, programs: newPrograms }))
                        }}
                        className={errors[`program_${index}_duration`] ? "border-red-500" : ""}
                      />
                      {errors[`program_${index}_duration`] && (
                        <p className="mt-1 text-red-500 text-sm">
                          {errors[`program_${index}_duration`]}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor={`program_${index}_capacity`}>Student Capacity *</Label>
                      <Input
                        id={`program_${index}_capacity`}
                        type="number"
                        min="1"
                        value={program.capacity}
                        onChange={(e) => {
                          const newPrograms = [...formData.programs]
                          newPrograms[index].capacity = Number.parseInt(e.target.value) || 1
                          setFormData((prev) => ({ ...prev, programs: newPrograms }))
                        }}
                        className={errors[`program_${index}_capacity`] ? "border-red-500" : ""}
                      />
                      {errors[`program_${index}_capacity`] && (
                        <p className="mt-1 text-red-500 text-sm">
                          {errors[`program_${index}_capacity`]}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label>Requirements *</Label>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {COMMON_REQUIREMENTS.map((req) => (
                        <label key={req} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={program.requirements.includes(req)}
                            onChange={(e) => {
                              const newPrograms = [...formData.programs]
                              if (e.target.checked) {
                                newPrograms[index].requirements.push(req)
                              } else {
                                newPrograms[index].requirements = newPrograms[
                                  index
                                ].requirements.filter((r) => r !== req)
                              }
                              setFormData((prev) => ({ ...prev, programs: newPrograms }))
                            }}
                            className="rounded"
                          />
                          <span className="text-sm">{req}</span>
                        </label>
                      ))}
                    </div>
                    {errors[`program_${index}_requirements`] && (
                      <p className="mt-1 text-red-500 text-sm">
                        {errors[`program_${index}_requirements`]}
                      </p>
                    )}
                  </div>
                </div>
              ))}

              <Button
                variant="outline"
                onClick={() => {
                  const newProgram = {
                    name: "",
                    description: "",
                    duration: 12,
                    capacity: 50,
                    requirements: [],
                  }
                  setFormData((prev) => ({ ...prev, programs: [...prev.programs, newProgram] }))
                }}
                className="w-full"
              >
                Add Another Program
              </Button>
            </div>
          </motion.div>
        )

      default:
        return null
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-100 p-4">
      <div className="w-full max-w-2xl">
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
                className="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700"
              >
                {isLoading ? (
                  "Processing..."
                ) : currentStep === 4 ? (
                  "Complete Registration"
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
