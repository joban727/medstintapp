// TODO: Add cache invalidation hooks for mutations
"use client"

import { ArrowLeft, BookOpen, GraduationCap, Plus, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "../ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
import { Checkbox } from "../ui/checkbox"
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

interface ProgramsOnboardingProps {
  user: User
  clerkUser: ClerkUser
}

interface Program {
  id: string
  name: string
  description: string
  type: string
  duration: string
  durationUnit: string
  capacity: string
  requirements: string[]
  classYears: ClassYear[]
  isActive: boolean
}

interface ClassYear {
  id: string
  year: number
  name: string
  description: string
  capacity: string
  requirements: string[]
}

const programTypes = [
  "Medical Doctor (MD)",
  "Doctor of Osteopathic Medicine (DO)",
  "Bachelor of Science in Nursing (BSN)",
  "Master of Science in Nursing (MSN)",
  "Doctor of Pharmacy (PharmD)",
  "Physical Therapy (DPT)",
  "Physician Assistant (PA)",
  "Other",
]

const durationUnits = ["Years", "Months", "Semesters", "Quarters"]

const commonRequirements = [
  "MCAT Score",
  "GPA Minimum",
  "Bachelor's Degree",
  "Prerequisites Completed",
  "Clinical Experience",
  "Research Experience",
  "Letters of Recommendation",
  "Personal Statement",
  "Interview",
  "Background Check",
  "Immunizations",
]

export function ProgramsOnboarding({ user, clerkUser }: ProgramsOnboardingProps) {
  const router = useRouter()
  const [programs, setPrograms] = useState<Program[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const currentStep = 3
  const progressPercentage = (currentStep / 6) * 100

  const loadSavedProgress = async () => {
    try {
      const response = await fetch("/api/onboarding/progress")
      if (response.ok) {
        const data = await response.json()
        if (data.formData?.programs) {
          setPrograms(data.formData.programs)
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

  const createNewProgram = (): Program => ({
    id: Date.now().toString(),
    name: "",
    description: "",
    type: "",
    duration: "",
    durationUnit: "Years",
    capacity: "",
    requirements: [],
    classYears: [],
    isActive: true,
  })

  const createNewClassYear = (year: number): ClassYear => ({
    id: Date.now().toString() + year,
    year,
    name: `Year ${year}`,
    description: "",
    capacity: "",
    requirements: [],
  })

  const addProgram = () => {
    setPrograms((prev) => [...prev, createNewProgram()])
  }

  const removeProgram = (programId: string) => {
    setPrograms((prev) => prev.filter((p) => p.id !== programId))
  }

  const updateProgram = (programId: string, field: keyof Program, value: any) => {
    setPrograms((prev) => prev.map((p) => (p.id === programId ? { ...p, [field]: value } : p)))
    // Clear error for this field
    const errorKey = `${programId}.${field}`
    if (errors[errorKey]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[errorKey]
        return newErrors
      })
    }
  }

  const addClassYear = (programId: string) => {
    const program = programs.find((p) => p.id === programId)
    if (program) {
      const nextYear = program.classYears.length + 1
      const newClassYear = createNewClassYear(nextYear)
      updateProgram(programId, "classYears", [...program.classYears, newClassYear])
    }
  }

  const removeClassYear = (programId: string, classYearId: string) => {
    const program = programs.find((p) => p.id === programId)
    if (program) {
      const updatedClassYears = program.classYears
        .filter((cy) => cy.id !== classYearId)
        .map((cy, index) => ({ ...cy, year: index + 1, name: `Year ${index + 1}` }))
      updateProgram(programId, "classYears", updatedClassYears)
    }
  }

  const updateClassYear = (
    programId: string,
    classYearId: string,
    field: keyof ClassYear,
    value: any
  ) => {
    const program = programs.find((p) => p.id === programId)
    if (program) {
      const updatedClassYears = program.classYears.map((cy) =>
        cy.id === classYearId ? { ...cy, [field]: value } : cy
      )
      updateProgram(programId, "classYears", updatedClassYears)
    }
  }

  const toggleRequirement = (programId: string, requirement: string) => {
    const program = programs.find((p) => p.id === programId)
    if (program) {
      const updatedRequirements = program.requirements.includes(requirement)
        ? program.requirements.filter((r) => r !== requirement)
        : [...program.requirements, requirement]
      updateProgram(programId, "requirements", updatedRequirements)
    }
  }

  const toggleClassYearRequirement = (
    programId: string,
    classYearId: string,
    requirement: string
  ) => {
    const program = programs.find((p) => p.id === programId)
    const classYear = program?.classYears.find((cy) => cy.id === classYearId)
    if (program && classYear) {
      const updatedRequirements = classYear.requirements.includes(requirement)
        ? classYear.requirements.filter((r) => r !== requirement)
        : [...classYear.requirements, requirement]
      updateClassYear(programId, classYearId, "requirements", updatedRequirements)
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (programs.length === 0) {
      newErrors.general = "At least one program is required"
    }

    programs.forEach((program) => {
      if (!program.name.trim()) {
        newErrors[`${program.id}.name`] = "Program name is required"
      }
      if (!program.description.trim()) {
        newErrors[`${program.id}.description`] = "Program description is required"
      }
      if (!program.type) {
        newErrors[`${program.id}.type`] = "Program type is required"
      }
      if (!program.duration.trim()) {
        newErrors[`${program.id}.duration`] = "Program duration is required"
      }
      if (!program.capacity.trim()) {
        newErrors[`${program.id}.capacity`] = "Program capacity is required"
      }
    })

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleBack = () => {
    router.push("/onboarding/school-profile")
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
          currentStep: 4,
          completedSteps: [1, 2, 3],
          formData: {
            programs: programs,
          },
          isCompleted: false,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to save progress")
      }

      router.push("/onboarding/rotations")
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
      <div className="space-y-4 text-center">
        <h1 className="font-bold text-3xl text-gray-900 dark:text-white">
          Academic Programs Setup
        </h1>
        <p className="text-gray-600 text-lg dark:text-gray-300">
          Configure your educational programs and class year structures.
        </p>
        <div className="mx-auto max-w-md space-y-2">
          <div className="flex justify-between text-gray-600 text-sm dark:text-gray-400">
            <span>Step {currentStep} of 6</span>
            <span>{Math.round(progressPercentage)}% Complete</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </div>

      {/* Error Display */}
      {errors.general && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-red-600 dark:text-red-400">{errors.general}</p>
        </div>
      )}

      {/* Programs List */}
      <div className="space-y-6">
        {programs.map((program, programIndex) => (
          <Card key={program.id} className="relative">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-blue-600" />
                    Program {programIndex + 1}
                  </CardTitle>
                  <CardDescription>
                    Configure the details for this academic program.
                  </CardDescription>
                </div>
                {programs.length > 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeProgram(program.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Basic Program Information */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`program-name-${program.id}`}>Program Name *</Label>
                  <Input
                    id={`program-name-${program.id}`}
                    value={program.name}
                    onChange={(e) => updateProgram(program.id, "name", e.target.value)}
                    placeholder="e.g., Doctor of Medicine"
                    className={errors[`${program.id}.name`] ? "border-red-500" : ""}
                  />
                  {errors[`${program.id}.name`] && (
                    <p className="text-red-500 text-sm">{errors[`${program.id}.name`]}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`program-type-${program.id}`}>Program Type *</Label>
                  <Select
                    value={program.type}
                    onValueChange={(value) => updateProgram(program.id, "type", value)}
                  >
                    <SelectTrigger className={errors[`${program.id}.type`] ? "border-red-500" : ""}>
                      <SelectValue placeholder="Select program type" />
                    </SelectTrigger>
                    <SelectContent>
                      {programTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors[`${program.id}.type`] && (
                    <p className="text-red-500 text-sm">{errors[`${program.id}.type`]}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`program-description-${program.id}`}>Description *</Label>
                <Textarea
                  id={`program-description-${program.id}`}
                  value={program.description}
                  onChange={(e) => updateProgram(program.id, "description", e.target.value)}
                  placeholder="Provide a detailed description of this program"
                  rows={3}
                  className={errors[`${program.id}.description`] ? "border-red-500" : ""}
                />
                {errors[`${program.id}.description`] && (
                  <p className="text-red-500 text-sm">{errors[`${program.id}.description`]}</p>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor={`program-duration-${program.id}`}>Duration *</Label>
                  <Input
                    id={`program-duration-${program.id}`}
                    type="number"
                    value={program.duration}
                    onChange={(e) => updateProgram(program.id, "duration", e.target.value)}
                    placeholder="e.g., 4"
                    min="1"
                    className={errors[`${program.id}.duration`] ? "border-red-500" : ""}
                  />
                  {errors[`${program.id}.duration`] && (
                    <p className="text-red-500 text-sm">{errors[`${program.id}.duration`]}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`program-duration-unit-${program.id}`}>Duration Unit</Label>
                  <Select
                    value={program.durationUnit}
                    onValueChange={(value) => updateProgram(program.id, "durationUnit", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {durationUnits.map((unit) => (
                        <SelectItem key={unit} value={unit}>
                          {unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`program-capacity-${program.id}`}>Student Capacity *</Label>
                  <Input
                    id={`program-capacity-${program.id}`}
                    type="number"
                    value={program.capacity}
                    onChange={(e) => updateProgram(program.id, "capacity", e.target.value)}
                    placeholder="e.g., 100"
                    min="1"
                    className={errors[`${program.id}.capacity`] ? "border-red-500" : ""}
                  />
                  {errors[`${program.id}.capacity`] && (
                    <p className="text-red-500 text-sm">{errors[`${program.id}.capacity`]}</p>
                  )}
                </div>
              </div>

              {/* Program Requirements */}
              <div className="space-y-3">
                <Label>Admission Requirements</Label>
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {commonRequirements.map((requirement) => (
                    <div key={requirement} className="flex items-center space-x-2">
                      <Checkbox
                        id={`${program.id}-req-${requirement}`}
                        checked={program.requirements.includes(requirement)}
                        onCheckedChange={() => toggleRequirement(program.id, requirement)}
                      />
                      <Label
                        htmlFor={`${program.id}-req-${requirement}`}
                        className="cursor-pointer font-normal text-sm"
                      >
                        {requirement}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Class Years Configuration */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold text-base">Class Years Configuration</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addClassYear(program.id)}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Year
                  </Button>
                </div>

                {program.classYears.length === 0 ? (
                  <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                    <GraduationCap className="mx-auto mb-4 h-12 w-12 opacity-50" />
                    <p>No class years configured yet.</p>
                    <p className="text-sm">Click "Add Year" to create your first class year.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {program.classYears.map((classYear) => (
                      <Card key={classYear.id} className="bg-gray-50 dark:bg-gray-800/50">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2 text-lg">
                              <GraduationCap className="h-4 w-4" />
                              {classYear.name}
                            </CardTitle>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeClassYear(program.id, classYear.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor={`class-year-name-${classYear.id}`}>Year Name</Label>
                              <Input
                                id={`class-year-name-${classYear.id}`}
                                value={classYear.name}
                                onChange={(e) =>
                                  updateClassYear(program.id, classYear.id, "name", e.target.value)
                                }
                                placeholder="e.g., First Year, Pre-Clinical"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`class-year-capacity-${classYear.id}`}>
                                Capacity
                              </Label>
                              <Input
                                id={`class-year-capacity-${classYear.id}`}
                                type="number"
                                value={classYear.capacity}
                                onChange={(e) =>
                                  updateClassYear(
                                    program.id,
                                    classYear.id,
                                    "capacity",
                                    e.target.value
                                  )
                                }
                                placeholder="e.g., 25"
                                min="1"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`class-year-description-${classYear.id}`}>
                              Description
                            </Label>
                            <Textarea
                              id={`class-year-description-${classYear.id}`}
                              value={classYear.description}
                              onChange={(e) =>
                                updateClassYear(
                                  program.id,
                                  classYear.id,
                                  "description",
                                  e.target.value
                                )
                              }
                              placeholder="Describe the focus and objectives for this year"
                              rows={2}
                            />
                          </div>

                          <div className="space-y-3">
                            <Label>Year-Specific Requirements</Label>
                            <div className="grid gap-2 md:grid-cols-2">
                              {commonRequirements.slice(0, 6).map((requirement) => (
                                <div key={requirement} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`${classYear.id}-req-${requirement}`}
                                    checked={classYear.requirements.includes(requirement)}
                                    onCheckedChange={() =>
                                      toggleClassYearRequirement(
                                        program.id,
                                        classYear.id,
                                        requirement
                                      )
                                    }
                                  />
                                  <Label
                                    htmlFor={`${classYear.id}-req-${requirement}`}
                                    className="cursor-pointer font-normal text-sm"
                                  >
                                    {requirement}
                                  </Label>
                                </div>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Add Program Button */}
        <Card className="border-2 border-gray-300 border-dashed dark:border-gray-600">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="mb-4 h-12 w-12 text-gray-400" />
            <h3 className="mb-2 font-semibold text-gray-900 text-lg dark:text-white">
              Add Another Program
            </h3>
            <p className="mb-4 text-center text-gray-600 dark:text-gray-400">
              Create additional academic programs for your institution.
            </p>
            <Button onClick={addProgram} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Program
            </Button>
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
          disabled={isLoading || programs.length === 0}
          size="lg"
          className="px-8"
        >
          {isLoading ? "Saving..." : "Continue to Rotations"}
        </Button>
      </div>
    </div>
  )
}
