// TODO: Add cache invalidation hooks for mutations
"use client"

import { useAuth } from "@clerk/nextjs"
import {
  Building2,
  CheckCircle,
  GraduationCap,
  Plus,
  School,
  Trash2,
  Users,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Mail,
  Phone,
  Globe,
  CalendarDays,
  User,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useId, useState, useTransition } from "react"
import { toast } from "sonner"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Progress } from "../ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Textarea } from "../ui/textarea"
import { Separator } from "../ui/separator"

const validateEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

interface SchoolOnboardingProps {
  user: any
  clerkUser: any
  existingSchools: any[]
}

type Step =
  | "welcome"
  | "role-selection"
  | "institution-details"
  | "contact-location"
  | "programs"
  | "admin-setup"
  | "complete"

interface Program {
  id: string
  name: string
  description: string
  duration: number
  classYear: number
}

interface SchoolData {
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
  establishedYear: string
  studentCapacity: string
  contactPersonName: string
  contactPersonTitle: string
  contactPersonEmail: string
  contactPersonPhone: string
}

const initialSchoolData: SchoolData = {
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
  establishedYear: "",
  studentCapacity: "",
  contactPersonName: "",
  contactPersonTitle: "",
  contactPersonEmail: "",
  contactPersonPhone: "",
}

export function SchoolOnboarding({ user, clerkUser, existingSchools }: SchoolOnboardingProps) {
  const router = useRouter()
  const { userId } = useAuth()
  const [currentStep, setCurrentStep] = useState<Step>("welcome")
  const [schoolData, setSchoolData] = useState<SchoolData>(initialSchoolData)
  const [programs, setPrograms] = useState<Program[]>([])
  const [selectedSchool, setSelectedSchool] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const [isPending, startTransition] = useTransition()
  const formId = useId()

  const steps: Step[] = [
    "welcome",
    "role-selection",
    "institution-details",
    "contact-location",
    "programs",
    "admin-setup",
    "complete",
  ]
  const currentStepIndex = steps.indexOf(currentStep)
  const progress = ((currentStepIndex + 1) / steps.length) * 100

  const handleInputChange = (field: keyof SchoolData, value: string) => {
    setSchoolData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const validateInstitutionDetails = (): boolean => {
    if (!schoolData.name.trim()) {
      toast.error("School Name is required")
      return false
    }
    return true
  }

  const validateContactLocation = (): boolean => {
    const requiredFields: (keyof SchoolData)[] = [
      "address",
      "city",
      "state",
      "zipCode",
      "phone",
      "email",
      "contactPersonName",
      "contactPersonEmail",
    ]

    for (const field of requiredFields) {
      if (!schoolData[field].trim()) {
        toast.error(`${field.charAt(0).toUpperCase() + field.slice(1)} is required`)
        return false
      }
    }

    if (!validateEmail(schoolData.email)) {
      toast.error("Please enter a valid email address")
      return false
    }

    if (!validateEmail(schoolData.contactPersonEmail)) {
      toast.error("Please enter a valid contact person email address")
      return false
    }

    return true
  }

  const handleNext = () => {
    if (currentStep === "institution-details" && !validateInstitutionDetails()) {
      return
    }
    if (currentStep === "contact-location" && !validateContactLocation()) {
      return
    }

    const nextIndex = currentStepIndex + 1
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex])
    }
  }

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex])
    }
  }

  const handleComplete = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          schoolData,
          programs,
          userId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to complete onboarding")
      }

      toast.success("Onboarding completed successfully!")
      try {
        window.location.assign("/dashboard")
      } catch {}
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred"
      console.error("[SchoolOnboarding] Operation failed:", error)
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const addProgram = () => {
    const newProgram: Program = {
      id: Date.now().toString(),
      name: "",
      description: "",
      duration: 4,
      classYear: 1,
    }
    setPrograms((prev) => [...prev, newProgram])
  }

  const removeProgram = (id: string) => {
    setPrograms((prev) => prev.filter((p) => p.id !== id))
  }

  const updateProgram = (id: string, field: keyof Program, value: string | number) => {
    setPrograms((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)))
  }

  const renderWelcomeStep = () => (
    <div className="flex flex-col items-center text-center space-y-6 py-8">
      <div className="relative">
        <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 opacity-75 blur"></div>
        <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-background">
          <School className="h-12 w-12 text-blue-600" />
        </div>
      </div>
      <div className="space-y-2 max-w-md">
        <h3 className="text-3xl font-bold tracking-tight">Welcome to School Setup</h3>
        <p className="text-muted-foreground text-lg">
          Let's set up your medical school or institution. This process will help us customize the
          platform for your specific needs.
        </p>
      </div>
      <Button size="lg" onClick={handleNext} className="w-full max-w-xs text-lg h-12">
        Get Started <ChevronRight className="ml-2 h-5 w-5" />
      </Button>
    </div>
  )

  const renderRoleSelectionStep = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="space-y-1">
        <h3 className="text-2xl font-semibold tracking-tight">Select Your Role</h3>
        <p className="text-muted-foreground">What is your primary responsibility?</p>
      </div>
      <div className="grid gap-4">
        <div
          className="group relative flex cursor-pointer items-start gap-4 rounded-xl border p-6 transition-all hover:shadow-md hover:border-blue-200 dark:hover:border-blue-800"
          onClick={handleNext}
        >
          <div className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400">
            <School className="h-6 w-6" />
          </div>
          <div className="flex-1 space-y-1">
            <h4 className="font-semibold text-lg">School Administrator</h4>
            <p className="text-muted-foreground">
              Manage school settings, programs, faculty, and student body. Full access to
              institution configuration.
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-blue-500" />
        </div>

        <div
          className="group relative flex cursor-pointer items-start gap-4 rounded-xl border p-6 transition-all hover:shadow-md hover:border-blue-200 dark:hover:border-blue-800"
          onClick={handleNext}
        >
          <div className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-400">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div className="flex-1 space-y-1">
            <h4 className="font-semibold text-lg">Program Director</h4>
            <p className="text-muted-foreground">
              Oversee specific academic programs, curriculum, and student progress within a
              department.
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-purple-500" />
        </div>
      </div>
    </div>
  )

  const renderInstitutionDetailsStep = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="space-y-1">
        <h3 className="text-2xl font-semibold tracking-tight">Institution Details</h3>
        <p className="text-muted-foreground">Tell us about your school.</p>
      </div>

      <div className="grid gap-6">
        <div className="space-y-2">
          <Label htmlFor="name" className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-blue-500" /> School Name *
          </Label>
          <Input
            id="name"
            value={schoolData.name}
            onChange={(e) => handleInputChange("name", e.target.value)}
            placeholder="e.g. University of Medicine"
            className="h-11"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="establishedYear" className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-blue-500" /> Established Year
            </Label>
            <Input
              id="establishedYear"
              value={schoolData.establishedYear}
              onChange={(e) => handleInputChange("establishedYear", e.target.value)}
              placeholder="e.g. 1985"
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="website" className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-blue-500" /> Website
            </Label>
            <Input
              id="website"
              value={schoolData.website}
              onChange={(e) => handleInputChange("website", e.target.value)}
              placeholder="e.g. www.university.edu"
              className="h-11"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={schoolData.description}
            onChange={(e) => handleInputChange("description", e.target.value)}
            placeholder="Brief description of your institution..."
            className="min-h-[100px] resize-none"
          />
        </div>
      </div>
    </div>
  )

  const renderContactLocationStep = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="space-y-1">
        <h3 className="text-2xl font-semibold tracking-tight">Contact & Location</h3>
        <p className="text-muted-foreground">Where are you located and how can we reach you?</p>
      </div>

      <div className="grid gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-blue-500" /> General Email *
            </Label>
            <Input
              id="email"
              type="email"
              value={schoolData.email}
              onChange={(e) => handleInputChange("email", e.target.value)}
              placeholder="admin@university.edu"
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone" className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-blue-500" /> General Phone *
            </Label>
            <Input
              id="phone"
              value={schoolData.phone}
              onChange={(e) => handleInputChange("phone", e.target.value)}
              placeholder="(555) 123-4567"
              className="h-11"
            />
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <Label htmlFor="address" className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-blue-500" /> Address *
          </Label>
          <Input
            id="address"
            value={schoolData.address}
            onChange={(e) => handleInputChange("address", e.target.value)}
            placeholder="123 University Ave"
            className="h-11"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <Label htmlFor="city">City *</Label>
            <Input
              id="city"
              value={schoolData.city}
              onChange={(e) => handleInputChange("city", e.target.value)}
              placeholder="City"
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">State *</Label>
            <Input
              id="state"
              value={schoolData.state}
              onChange={(e) => handleInputChange("state", e.target.value)}
              placeholder="State"
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="zipCode">ZIP Code *</Label>
            <Input
              id="zipCode"
              value={schoolData.zipCode}
              onChange={(e) => handleInputChange("zipCode", e.target.value)}
              placeholder="12345"
              className="h-11"
            />
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="contactPersonName" className="flex items-center gap-2">
              <User className="h-4 w-4 text-blue-500" /> Contact Person *
            </Label>
            <Input
              id="contactPersonName"
              value={schoolData.contactPersonName}
              onChange={(e) => handleInputChange("contactPersonName", e.target.value)}
              placeholder="Full Name"
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contactPersonEmail" className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-blue-500" /> Contact Email *
            </Label>
            <Input
              id="contactPersonEmail"
              type="email"
              value={schoolData.contactPersonEmail}
              onChange={(e) => handleInputChange("contactPersonEmail", e.target.value)}
              placeholder="person@university.edu"
              className="h-11"
            />
          </div>
        </div>
      </div>
    </div>
  )

  const renderProgramsStep = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-2xl font-semibold tracking-tight">Academic Programs</h3>
          <p className="text-muted-foreground">Add programs offered by your institution.</p>
        </div>
        <Button onClick={addProgram} size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Add Program
        </Button>
      </div>

      {programs.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground bg-muted/30 rounded-lg border border-dashed">
          <GraduationCap className="mx-auto h-10 w-10 mb-3 opacity-20" />
          <p>No programs added yet.</p>
          <Button variant="link" onClick={addProgram}>
            Add your first program
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {programs.map((program, index) => (
            <Card
              key={program.id}
              className="relative overflow-hidden transition-all hover:shadow-md border-l-4 border-l-blue-500"
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg font-medium">Program {index + 1}</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeProgram(program.id)}
                    className="text-muted-foreground hover:text-red-600 -mr-2 -mt-2"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Program Name</Label>
                  <Input
                    value={program.name}
                    onChange={(e) => updateProgram(program.id, "name", e.target.value)}
                    placeholder="e.g. Doctor of Medicine"
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Duration (years)</Label>
                  <Input
                    type="number"
                    value={program.duration}
                    onChange={(e) =>
                      updateProgram(program.id, "duration", parseInt(e.target.value) || 0)
                    }
                    placeholder="4"
                    min="1"
                    max="10"
                    className="h-10"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={program.description}
                    onChange={(e) => updateProgram(program.id, "description", e.target.value)}
                    placeholder="Brief description..."
                    rows={2}
                    className="resize-none"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )

  const renderAdminSetupStep = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="space-y-1">
        <h3 className="text-2xl font-semibold tracking-tight">Administrator Setup</h3>
        <p className="text-muted-foreground">Review administrative settings.</p>
      </div>

      <div className="space-y-4">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <h4 className="font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-green-600" /> User Management
              </h4>
              <p className="text-sm text-muted-foreground">Manage users and their roles</p>
            </div>
            <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100">
              Enabled
            </Badge>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <h4 className="font-semibold flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-blue-600" /> Program Management
              </h4>
              <p className="text-sm text-muted-foreground">Manage academic programs</p>
            </div>
            <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100">
              Enabled
            </Badge>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <h4 className="font-semibold flex items-center gap-2">
                <School className="h-4 w-4 text-purple-600" /> Analytics & Reporting
              </h4>
              <p className="text-sm text-muted-foreground">Access to analytics dashboard</p>
            </div>
            <Badge
              variant="secondary"
              className="bg-purple-100 text-purple-700 hover:bg-purple-100"
            >
              Enabled
            </Badge>
          </CardContent>
        </Card>
      </div>
    </div>
  )

  const renderCompleteStep = () => (
    <div className="flex flex-col items-center text-center space-y-6 py-8 animate-in zoom-in-95 duration-500">
      <div className="rounded-full bg-green-100 p-6 dark:bg-green-900/30">
        <CheckCircle className="h-16 w-16 text-green-600 dark:text-green-400" />
      </div>
      <div className="space-y-2 max-w-md">
        <h3 className="text-3xl font-bold tracking-tight">Setup Complete!</h3>
        <p className="text-muted-foreground text-lg">
          Your school has been successfully configured. You can now start using the platform.
        </p>
      </div>
      <Button
        onClick={handleComplete}
        disabled={isLoading}
        size="lg"
        className="w-full max-w-xs text-lg h-12"
      >
        {isLoading ? "Completing..." : "Go to Dashboard"}
      </Button>
    </div>
  )

  const renderCurrentStep = () => {
    switch (currentStep) {
      case "welcome":
        return renderWelcomeStep()
      case "role-selection":
        return renderRoleSelectionStep()
      case "institution-details":
        return renderInstitutionDetailsStep()
      case "contact-location":
        return renderContactLocationStep()
      case "programs":
        return renderProgramsStep()
      case "admin-setup":
        return renderAdminSetupStep()
      case "complete":
        return renderCompleteStep()
      default:
        return renderWelcomeStep()
    }
  }

  const getStepTitle = () => {
    switch (currentStep) {
      case "welcome":
        return "Welcome"
      case "role-selection":
        return "Role Selection"
      case "institution-details":
        return "Institution Info"
      case "contact-location":
        return "Contact & Location"
      case "programs":
        return "Programs"
      case "admin-setup":
        return "Admin Setup"
      case "complete":
        return "Complete"
      default:
        return ""
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-8">
      <Card className="w-full max-w-3xl shadow-xl border-0 ring-1 ring-gray-200 dark:ring-gray-800">
        <CardHeader className="border-b bg-muted/30 pb-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-xl">{getStepTitle()}</CardTitle>
                <CardDescription>
                  Step {currentStepIndex + 1} of {steps.length}
                </CardDescription>
              </div>
              <div className="text-sm font-medium text-muted-foreground">
                {Math.round(progress)}% Complete
              </div>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </CardHeader>

        <CardContent className="p-6 md:p-8 min-h-[400px] flex flex-col">
          <div className="flex-1">{renderCurrentStep()}</div>

          {currentStep !== "welcome" && currentStep !== "complete" && (
            <div className="flex items-center justify-between pt-8 mt-4 border-t">
              <Button variant="ghost" onClick={handleBack} disabled={isPending} className="gap-2">
                <ChevronLeft className="h-4 w-4" /> Back
              </Button>
              <Button onClick={handleNext} disabled={isPending} className="gap-2 min-w-[120px]">
                {currentStep === "admin-setup" ? "Complete Setup" : "Continue"}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
