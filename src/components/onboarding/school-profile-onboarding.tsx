// TODO: Add cache invalidation hooks for mutations
"use client"

import { ArrowLeft, Building, MapPin, Phone, Users } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useSchoolContext } from "../school-selector"
import { Button } from "../ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Progress } from "../ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Textarea } from "../ui/textarea"

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

interface SchoolProfileOnboardingProps {
  user: User
  clerkUser: ClerkUser
}

interface SchoolFormData {
  name: string
  description: string
  address: string
  city: string
  state: string
  zipCode: string
  country: string
  phone: string
  email: string
  website: string
  accreditation: string
  establishedYear: string
  studentCapacity: string
  contactPersonName: string
  contactPersonTitle: string
  contactPersonEmail: string
  contactPersonPhone: string
}

const initialFormData: SchoolFormData = {
  name: "",
  description: "",
  address: "",
  city: "",
  state: "",
  zipCode: "",
  country: "United States",
  phone: "",
  email: "",
  website: "",
  accreditation: "",
  establishedYear: "",
  studentCapacity: "",
  contactPersonName: "",
  contactPersonTitle: "",
  contactPersonEmail: "",
  contactPersonPhone: "",
}

const accreditationOptions = [
  "LCME (Liaison Committee on Medical Education)",
  "COCA (Commission on Osteopathic College Accreditation)",
  "ACPE (Accreditation Council for Pharmacy Education)",
  "CCNE (Commission on Collegiate Nursing Education)",
  "CAPTE (Commission on Accreditation in Physical Therapy Education)",
  "Other",
  "Not Accredited",
]

export function SchoolProfileOnboarding({ user, clerkUser }: SchoolProfileOnboardingProps) {
  const router = useRouter()
  const { selectedSchoolId } = useSchoolContext()
  const [formData, setFormData] = useState<SchoolFormData>(initialFormData)
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [errors, setErrors] = useState<Partial<SchoolFormData>>({})
  const [previousSchoolId, setPreviousSchoolId] = useState<string | null>(null)

  const currentStep = 2
  const progressPercentage = (currentStep / 6) * 100

  const loadSavedProgress = async () => {
    try {
      const response = await fetch("/api/onboarding/progress")
      if (response.ok) {
        const data = await response.json()
        if (data.formData?.schoolProfile) {
          setFormData({ ...initialFormData, ...data.formData.schoolProfile })
        }
      }
    } catch (error) {
      console.error("Error loading saved progress:", error)
    }
  }

  useEffect(() => {
    setProgress(progressPercentage)
    loadSavedProgress()
  }, [progressPercentage, loadSavedProgress])

  // Clear accreditation when school selection changes
  useEffect(() => {
    if (selectedSchoolId !== previousSchoolId && previousSchoolId !== null) {
      // Clear accreditation field when school changes
      setFormData(prev => ({ ...prev, accreditation: "" }))
      // Clear any accreditation-related errors
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors.accreditation
        return newErrors
      })
      toast.info("Accreditation field cleared due to school selection change")
    }
    setPreviousSchoolId(selectedSchoolId)
  }, [selectedSchoolId, previousSchoolId])

  const validateForm = (): boolean => {
    const newErrors: Partial<SchoolFormData> = {}

    if (!formData.name.trim()) newErrors.name = "School name is required"
    if (!formData.description.trim()) newErrors.description = "Description is required"
    if (!formData.address.trim()) newErrors.address = "Address is required"
    if (!formData.city.trim()) newErrors.city = "City is required"
    if (!formData.state.trim()) newErrors.state = "State is required"
    if (!formData.zipCode.trim()) newErrors.zipCode = "ZIP code is required"
    if (!formData.phone.trim()) newErrors.phone = "Phone number is required"
    if (!formData.email.trim()) newErrors.email = "Email is required"
    if (!formData.contactPersonName.trim())
      newErrors.contactPersonName = "Contact person name is required"
    if (!formData.contactPersonEmail.trim())
      newErrors.contactPersonEmail = "Contact person email is required"

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (formData.email && !emailRegex.test(formData.email)) {
      newErrors.email = "Please enter a valid email address"
    }
    if (formData.contactPersonEmail && !emailRegex.test(formData.contactPersonEmail)) {
      newErrors.contactPersonEmail = "Please enter a valid email address"
    }

    // Phone validation
    const phoneRegex = /^[+]?[1-9][\d\s\-()]{7,15}$/
    if (formData.phone && !phoneRegex.test(formData.phone.replace(/\s/g, ""))) {
      newErrors.phone = "Please enter a valid phone number"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleInputChange = (field: keyof SchoolFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const handleBack = () => {
    router.push("/onboarding/welcome")
  }

  const handleContinue = async () => {
    if (!validateForm()) {
      toast.error("Please fix the errors before continuing")
      return
    }

    setIsLoading(true)
    try {
      // Save progress
      const response = await fetch("/api/onboarding/progress", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentStep: 3,
          completedSteps: [1, 2],
          formData: {
            schoolProfile: formData,
          },
          isCompleted: false,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to save progress")
      }

      router.push("/onboarding/programs")
    } catch (error) {
      console.error("Error saving progress:", error)
      toast.error("Failed to save progress. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Progress Header */}
      <header className="space-y-4 text-center">
        <h1 className="font-bold text-3xl text-gray-900 dark:text-white">School Profile Setup</h1>
        <p className="text-gray-600 text-lg dark:text-gray-300">
          Tell us about your institution to customize your experience.
        </p>
        <div className="mx-auto max-w-md space-y-2" role="region" aria-label="Onboarding progress">
          <div className="flex justify-between text-gray-600 text-sm dark:text-gray-400">
            <span aria-label={`Current step: ${currentStep} of 6`}>Step {currentStep} of 6</span>
            <span aria-label={`Progress: ${Math.round(progressPercentage)} percent complete`}>
              {Math.round(progressPercentage)}% Complete
            </span>
          </div>
          <Progress
            value={progress}
            className="h-2"
            aria-label={`Onboarding progress: ${Math.round(progressPercentage)}% complete`}
          />
        </div>
      </header>

      {/* School Information Form */}
      <section aria-labelledby="institution-details-title">
        <Card>
          <CardHeader>
            <CardTitle id="institution-details-title" className="flex items-center gap-2">
              <Building className="h-5 w-5 text-blue-600" aria-hidden="true" />
              Institution Details
            </CardTitle>
            <CardDescription>
              Provide basic information about your educational institution.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form aria-labelledby="institution-details-title">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">School Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    placeholder="Enter your school name"
                    className={errors.name ? "border-red-500" : ""}
                    aria-required="true"
                    aria-invalid={errors.name ? "true" : "false"}
                    aria-describedby={errors.name ? "name-error" : undefined}
                  />
                  {errors.name && (
                    <p id="name-error" className="text-red-500 text-sm" role="alert">
                      {errors.name}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="establishedYear">Established Year</Label>
                  <Input
                    id="establishedYear"
                    type="number"
                    value={formData.establishedYear}
                    onChange={(e) => handleInputChange("establishedYear", e.target.value)}
                    placeholder="e.g., 1985"
                    min="1800"
                    max={new Date().getFullYear()}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                  placeholder="Provide a brief description of your institution"
                  rows={3}
                  className={errors.description ? "border-red-500" : ""}
                  aria-required="true"
                  aria-invalid={errors.description ? "true" : "false"}
                  aria-describedby={errors.description ? "description-error" : undefined}
                />
                {errors.description && (
                  <p id="description-error" className="text-red-500 text-sm" role="alert">
                    {errors.description}
                  </p>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="accreditation">Accreditation</Label>
                  <Select
                    value={formData.accreditation}
                    onValueChange={(value) => handleInputChange("accreditation", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select accreditation" />
                    </SelectTrigger>
                    <SelectContent>
                      {accreditationOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="studentCapacity">Student Capacity</Label>
                  <Input
                    id="studentCapacity"
                    type="number"
                    value={formData.studentCapacity}
                    onChange={(e) => handleInputChange("studentCapacity", e.target.value)}
                    placeholder="e.g., 500"
                    min="1"
                  />
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </section>

      {/* Address Information */}
      <section aria-labelledby="address-info-title">
        <Card>
          <CardHeader>
            <CardTitle id="address-info-title" className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-600" aria-hidden="true" />
              Address Information
            </CardTitle>
            <CardDescription>Provide the physical address of your institution.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="address">Street Address *</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => handleInputChange("address", e.target.value)}
                placeholder="Enter street address"
                className={errors.address ? "border-red-500" : ""}
                aria-required="true"
                aria-invalid={errors.address ? "true" : "false"}
                aria-describedby={errors.address ? "address-error" : undefined}
              />
              {errors.address && (
                <p id="address-error" className="text-red-500 text-sm" role="alert">
                  {errors.address}
                </p>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => handleInputChange("city", e.target.value)}
                  placeholder="Enter city"
                  className={errors.city ? "border-red-500" : ""}
                  aria-required="true"
                  aria-invalid={errors.city ? "true" : "false"}
                  aria-describedby={errors.city ? "city-error" : undefined}
                />
                {errors.city && (
                  <p id="city-error" className="text-red-500 text-sm" role="alert">
                    {errors.city}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State/Province *</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) => handleInputChange("state", e.target.value)}
                  placeholder="Enter state"
                  className={errors.state ? "border-red-500" : ""}
                  aria-required="true"
                  aria-invalid={errors.state ? "true" : "false"}
                  aria-describedby={errors.state ? "state-error" : undefined}
                />
                {errors.state && (
                  <p id="state-error" className="text-red-500 text-sm" role="alert">
                    {errors.state}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="zipCode">ZIP/Postal Code *</Label>
                <Input
                  id="zipCode"
                  value={formData.zipCode}
                  onChange={(e) => handleInputChange("zipCode", e.target.value)}
                  placeholder="Enter ZIP code"
                  className={errors.zipCode ? "border-red-500" : ""}
                  aria-required="true"
                  aria-invalid={errors.zipCode ? "true" : "false"}
                  aria-describedby={errors.zipCode ? "zipCode-error" : undefined}
                />
                {errors.zipCode && (
                  <p id="zipCode-error" className="text-red-500 text-sm" role="alert">
                    {errors.zipCode}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={formData.country}
                onChange={(e) => handleInputChange("country", e.target.value)}
                placeholder="Enter country"
              />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Contact Information */}
      <section aria-labelledby="contact-info-title">
        <Card>
          <CardHeader>
            <CardTitle id="contact-info-title" className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-blue-600" aria-hidden="true" />
              Contact Information
            </CardTitle>
            <CardDescription>Provide contact details for your institution.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  placeholder="Enter phone number"
                  className={errors.phone ? "border-red-500" : ""}
                  aria-required="true"
                  aria-invalid={errors.phone ? "true" : "false"}
                  aria-describedby={errors.phone ? "phone-error" : undefined}
                />
                {errors.phone && (
                  <p id="phone-error" className="text-red-500 text-sm" role="alert">
                    {errors.phone}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  placeholder="Enter email address"
                  className={errors.email ? "border-red-500" : ""}
                  aria-required="true"
                  aria-invalid={errors.email ? "true" : "false"}
                  aria-describedby={errors.email ? "email-error" : undefined}
                />
                {errors.email && (
                  <p id="email-error" className="text-red-500 text-sm" role="alert">
                    {errors.email}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                value={formData.website}
                onChange={(e) => handleInputChange("website", e.target.value)}
                placeholder="https://www.yourschool.edu"
              />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Primary Contact Person */}
      <section aria-labelledby="primary-contact-title">
        <Card>
          <CardHeader>
            <CardTitle id="primary-contact-title" className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" aria-hidden="true" />
              Primary Contact Person
            </CardTitle>
            <CardDescription>
              Designate a primary contact for administrative matters.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contactPersonName">Full Name *</Label>
                <Input
                  id="contactPersonName"
                  value={formData.contactPersonName}
                  onChange={(e) => handleInputChange("contactPersonName", e.target.value)}
                  placeholder="Enter contact person name"
                  className={errors.contactPersonName ? "border-red-500" : ""}
                  aria-required="true"
                  aria-invalid={errors.contactPersonName ? "true" : "false"}
                  aria-describedby={
                    errors.contactPersonName ? "contactPersonName-error" : undefined
                  }
                />
                {errors.contactPersonName && (
                  <p id="contactPersonName-error" className="text-red-500 text-sm" role="alert">
                    {errors.contactPersonName}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPersonTitle">Title/Position</Label>
                <Input
                  id="contactPersonTitle"
                  value={formData.contactPersonTitle}
                  onChange={(e) => handleInputChange("contactPersonTitle", e.target.value)}
                  placeholder="e.g., Dean, Administrator"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contactPersonEmail">Email Address *</Label>
                <Input
                  id="contactPersonEmail"
                  type="email"
                  value={formData.contactPersonEmail}
                  onChange={(e) => handleInputChange("contactPersonEmail", e.target.value)}
                  placeholder="Enter contact email"
                  className={errors.contactPersonEmail ? "border-red-500" : ""}
                  aria-required="true"
                  aria-invalid={errors.contactPersonEmail ? "true" : "false"}
                  aria-describedby={
                    errors.contactPersonEmail ? "contactPersonEmail-error" : undefined
                  }
                />
                {errors.contactPersonEmail && (
                  <p id="contactPersonEmail-error" className="text-red-500 text-sm" role="alert">
                    {errors.contactPersonEmail}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPersonPhone">Phone Number</Label>
                <Input
                  id="contactPersonPhone"
                  value={formData.contactPersonPhone}
                  onChange={(e) => handleInputChange("contactPersonPhone", e.target.value)}
                  placeholder="Enter contact phone"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Action Buttons */}
      <footer className="flex items-center justify-between pt-6" role="contentinfo">
        <Button
          variant="outline"
          onClick={handleBack}
          className="flex min-w-[100px] items-center gap-2"
          aria-label="Go back to previous step"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </Button>
        <Button
          onClick={handleContinue}
          disabled={isLoading}
          size="lg"
          className="min-w-[180px] px-8"
          aria-label="Continue to programs setup"
          aria-describedby="continue-help"
        >
          {isLoading ? "Saving..." : "Continue to Programs"}
        </Button>
        <div id="continue-help" className="sr-only">
          Proceed to the next step to configure academic programs
        </div>
      </footer>
    </div>
  )
}
