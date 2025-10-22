// TODO: Add cache invalidation hooks for mutations
"use client"

import { ArrowLeft, Calendar, Clock, Plus, Stethoscope, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Badge } from "../ui/badge"
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

interface RotationsOnboardingProps {
  user: User
  clerkUser: ClerkUser
}

interface Rotation {
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
  schedule: RotationSchedule
}

interface RotationSchedule {
  startDate: string
  endDate: string
  frequency: string
  timeSlots: TimeSlot[]
}

interface TimeSlot {
  id: string
  dayOfWeek: string
  startTime: string
  endTime: string
  maxStudents: string
}

const specialties = [
  "Internal Medicine",
  "Surgery",
  "Pediatrics",
  "Obstetrics & Gynecology",
  "Psychiatry",
  "Emergency Medicine",
  "Family Medicine",
  "Radiology",
  "Anesthesiology",
  "Pathology",
  "Dermatology",
  "Ophthalmology",
  "Orthopedics",
  "Cardiology",
  "Neurology",
  "Other",
]

const durationUnits = ["Weeks", "Months", "Days"]

const yearLevels = ["Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "Year 6"]

const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

const commonRequirements = [
  "Basic Clinical Skills",
  "Physical Examination",
  "Medical History Taking",
  "Documentation Skills",
  "Professional Behavior",
  "Patient Communication",
  "Infection Control",
  "HIPAA Compliance",
  "CPR Certification",
  "Immunizations Current",
]

const learningObjectives = [
  "Patient Assessment",
  "Diagnostic Reasoning",
  "Treatment Planning",
  "Procedural Skills",
  "Clinical Decision Making",
  "Interprofessional Collaboration",
  "Quality Improvement",
  "Patient Safety",
  "Evidence-Based Practice",
  "Professional Development",
]

const assessmentMethods = [
  "Direct Observation",
  "Case Presentations",
  "Written Examinations",
  "Practical Assessments",
  "Portfolio Review",
  "Peer Evaluation",
  "Self-Assessment",
  "Patient Feedback",
  "Supervisor Evaluation",
  "Reflection Papers",
]

export function RotationsOnboarding({ user, clerkUser }: RotationsOnboardingProps) {
  const router = useRouter()
  const [rotations, setRotations] = useState<Rotation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const currentStep = 4
  const progressPercentage = (currentStep / 6) * 100

  const loadSavedProgress = async () => {
    try {
      const response = await fetch("/api/onboarding/progress")
      if (response.ok) {
        const data = await response.json()
        if (data.formData?.rotations) {
          setRotations(data.formData.rotations)
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

  const createNewRotation = (): Rotation => ({
    id: Date.now().toString(),
    name: "",
    description: "",
    specialty: "",
    duration: "",
    durationUnit: "Weeks",
    capacity: "",
    location: "",
    requirements: [],
    objectives: [],
    assessmentMethods: [],
    isRequired: true,
    yearLevel: [],
    schedule: {
      startDate: "",
      endDate: "",
      frequency: "Weekly",
      timeSlots: [],
    },
  })

  const createNewTimeSlot = (): TimeSlot => ({
    id: Date.now().toString(),
    dayOfWeek: "Monday",
    startTime: "08:00",
    endTime: "17:00",
    maxStudents: "4",
  })

  const addRotation = () => {
    setRotations((prev) => [...prev, createNewRotation()])
  }

  const removeRotation = (rotationId: string) => {
    setRotations((prev) => prev.filter((r) => r.id !== rotationId))
  }

  const updateRotation = (rotationId: string, field: keyof Rotation, value: any) => {
    setRotations((prev) => prev.map((r) => (r.id === rotationId ? { ...r, [field]: value } : r)))
    // Clear error for this field
    const errorKey = `${rotationId}.${field}`
    if (errors[errorKey]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[errorKey]
        return newErrors
      })
    }
  }

  const updateRotationSchedule = (
    rotationId: string,
    field: keyof RotationSchedule,
    value: any
  ) => {
    const rotation = rotations.find((r) => r.id === rotationId)
    if (rotation) {
      const updatedSchedule = { ...rotation.schedule, [field]: value }
      updateRotation(rotationId, "schedule", updatedSchedule)
    }
  }

  const addTimeSlot = (rotationId: string) => {
    const rotation = rotations.find((r) => r.id === rotationId)
    if (rotation) {
      const newTimeSlot = createNewTimeSlot()
      const updatedTimeSlots = [...rotation.schedule.timeSlots, newTimeSlot]
      updateRotationSchedule(rotationId, "timeSlots", updatedTimeSlots)
    }
  }

  const removeTimeSlot = (rotationId: string, timeSlotId: string) => {
    const rotation = rotations.find((r) => r.id === rotationId)
    if (rotation) {
      const updatedTimeSlots = rotation.schedule.timeSlots.filter((ts) => ts.id !== timeSlotId)
      updateRotationSchedule(rotationId, "timeSlots", updatedTimeSlots)
    }
  }

  const updateTimeSlot = (
    rotationId: string,
    timeSlotId: string,
    field: keyof TimeSlot,
    value: any
  ) => {
    const rotation = rotations.find((r) => r.id === rotationId)
    if (rotation) {
      const updatedTimeSlots = rotation.schedule.timeSlots.map((ts) =>
        ts.id === timeSlotId ? { ...ts, [field]: value } : ts
      )
      updateRotationSchedule(rotationId, "timeSlots", updatedTimeSlots)
    }
  }

  const toggleArrayItem = (rotationId: string, field: keyof Rotation, item: string) => {
    const rotation = rotations.find((r) => r.id === rotationId)
    if (rotation) {
      const currentArray = rotation[field] as string[]
      const updatedArray = currentArray.includes(item)
        ? currentArray.filter((i) => i !== item)
        : [...currentArray, item]
      updateRotation(rotationId, field, updatedArray)
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (rotations.length === 0) {
      newErrors.general = "At least one rotation is required"
    }

    rotations.forEach((rotation) => {
      if (!rotation.name.trim()) {
        newErrors[`${rotation.id}.name`] = "Rotation name is required"
      }
      if (!rotation.description.trim()) {
        newErrors[`${rotation.id}.description`] = "Rotation description is required"
      }
      if (!rotation.specialty) {
        newErrors[`${rotation.id}.specialty`] = "Specialty is required"
      }
      if (!rotation.duration.trim()) {
        newErrors[`${rotation.id}.duration`] = "Duration is required"
      }
      if (!rotation.capacity.trim()) {
        newErrors[`${rotation.id}.capacity`] = "Capacity is required"
      }
      if (!rotation.location.trim()) {
        newErrors[`${rotation.id}.location`] = "Location is required"
      }
      if (rotation.yearLevel.length === 0) {
        newErrors[`${rotation.id}.yearLevel`] = "At least one year level is required"
      }
    })

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleBack = () => {
    router.push("/onboarding/programs")
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
          currentStep: 5,
          completedSteps: [1, 2, 3, 4],
          formData: {
            rotations: rotations,
          },
          isCompleted: false,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to save progress")
      }

      router.push("/onboarding/review")
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
          Clinical Rotations Setup
        </h1>
        <p className="text-gray-600 text-lg dark:text-gray-300">
          Configure clinical rotations, scheduling, and resource allocation.
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

      {/* Rotations List */}
      <div className="space-y-6">
        {rotations.map((rotation, rotationIndex) => (
          <Card key={rotation.id} className="relative">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Stethoscope className="h-5 w-5 text-blue-600" />
                    Rotation {rotationIndex + 1}
                    {rotation.isRequired && (
                      <Badge variant="secondary" className="ml-2">
                        Required
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Configure the details for this clinical rotation.
                  </CardDescription>
                </div>
                {rotations.length > 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeRotation(rotation.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Basic Rotation Information */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`rotation-name-${rotation.id}`}>Rotation Name *</Label>
                  <Input
                    id={`rotation-name-${rotation.id}`}
                    value={rotation.name}
                    onChange={(e) => updateRotation(rotation.id, "name", e.target.value)}
                    placeholder="e.g., Internal Medicine Clerkship"
                    className={errors[`${rotation.id}.name`] ? "border-red-500" : ""}
                  />
                  {errors[`${rotation.id}.name`] && (
                    <p className="text-red-500 text-sm">{errors[`${rotation.id}.name`]}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`rotation-specialty-${rotation.id}`}>Specialty *</Label>
                  <Select
                    value={rotation.specialty}
                    onValueChange={(value) => updateRotation(rotation.id, "specialty", value)}
                  >
                    <SelectTrigger
                      className={errors[`${rotation.id}.specialty`] ? "border-red-500" : ""}
                    >
                      <SelectValue placeholder="Select specialty" />
                    </SelectTrigger>
                    <SelectContent>
                      {specialties.map((specialty) => (
                        <SelectItem key={specialty} value={specialty}>
                          {specialty}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors[`${rotation.id}.specialty`] && (
                    <p className="text-red-500 text-sm">{errors[`${rotation.id}.specialty`]}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`rotation-description-${rotation.id}`}>Description *</Label>
                <Textarea
                  id={`rotation-description-${rotation.id}`}
                  value={rotation.description}
                  onChange={(e) => updateRotation(rotation.id, "description", e.target.value)}
                  placeholder="Provide a detailed description of this rotation"
                  rows={3}
                  className={errors[`${rotation.id}.description`] ? "border-red-500" : ""}
                />
                {errors[`${rotation.id}.description`] && (
                  <p className="text-red-500 text-sm">{errors[`${rotation.id}.description`]}</p>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor={`rotation-duration-${rotation.id}`}>Duration *</Label>
                  <Input
                    id={`rotation-duration-${rotation.id}`}
                    type="number"
                    value={rotation.duration}
                    onChange={(e) => updateRotation(rotation.id, "duration", e.target.value)}
                    placeholder="e.g., 4"
                    min="1"
                    className={errors[`${rotation.id}.duration`] ? "border-red-500" : ""}
                  />
                  {errors[`${rotation.id}.duration`] && (
                    <p className="text-red-500 text-sm">{errors[`${rotation.id}.duration`]}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`rotation-duration-unit-${rotation.id}`}>Unit</Label>
                  <Select
                    value={rotation.durationUnit}
                    onValueChange={(value) => updateRotation(rotation.id, "durationUnit", value)}
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
                  <Label htmlFor={`rotation-capacity-${rotation.id}`}>Capacity *</Label>
                  <Input
                    id={`rotation-capacity-${rotation.id}`}
                    type="number"
                    value={rotation.capacity}
                    onChange={(e) => updateRotation(rotation.id, "capacity", e.target.value)}
                    placeholder="e.g., 8"
                    min="1"
                    className={errors[`${rotation.id}.capacity`] ? "border-red-500" : ""}
                  />
                  {errors[`${rotation.id}.capacity`] && (
                    <p className="text-red-500 text-sm">{errors[`${rotation.id}.capacity`]}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Checkbox
                      checked={rotation.isRequired}
                      onCheckedChange={(checked) =>
                        updateRotation(rotation.id, "isRequired", checked)
                      }
                    />
                    Required Rotation
                  </Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`rotation-location-${rotation.id}`}>Location *</Label>
                <Input
                  id={`rotation-location-${rotation.id}`}
                  value={rotation.location}
                  onChange={(e) => updateRotation(rotation.id, "location", e.target.value)}
                  placeholder="e.g., General Hospital - Internal Medicine Ward"
                  className={errors[`${rotation.id}.location`] ? "border-red-500" : ""}
                />
                {errors[`${rotation.id}.location`] && (
                  <p className="text-red-500 text-sm">{errors[`${rotation.id}.location`]}</p>
                )}
              </div>

              {/* Year Level Selection */}
              <div className="space-y-3">
                <Label>Applicable Year Levels *</Label>
                <div className="grid gap-2 md:grid-cols-3">
                  {yearLevels.map((year) => (
                    <div key={year} className="flex items-center space-x-2">
                      <Checkbox
                        id={`${rotation.id}-year-${year}`}
                        checked={rotation.yearLevel.includes(year)}
                        onCheckedChange={() => toggleArrayItem(rotation.id, "yearLevel", year)}
                      />
                      <Label
                        htmlFor={`${rotation.id}-year-${year}`}
                        className="cursor-pointer font-normal text-sm"
                      >
                        {year}
                      </Label>
                    </div>
                  ))}
                </div>
                {errors[`${rotation.id}.yearLevel`] && (
                  <p className="text-red-500 text-sm">{errors[`${rotation.id}.yearLevel`]}</p>
                )}
              </div>

              {/* Requirements */}
              <div className="space-y-3">
                <Label>Prerequisites & Requirements</Label>
                <div className="grid gap-2 md:grid-cols-2">
                  {commonRequirements.map((requirement) => (
                    <div key={requirement} className="flex items-center space-x-2">
                      <Checkbox
                        id={`${rotation.id}-req-${requirement}`}
                        checked={rotation.requirements.includes(requirement)}
                        onCheckedChange={() =>
                          toggleArrayItem(rotation.id, "requirements", requirement)
                        }
                      />
                      <Label
                        htmlFor={`${rotation.id}-req-${requirement}`}
                        className="cursor-pointer font-normal text-sm"
                      >
                        {requirement}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Learning Objectives */}
              <div className="space-y-3">
                <Label>Learning Objectives</Label>
                <div className="grid gap-2 md:grid-cols-2">
                  {learningObjectives.map((objective) => (
                    <div key={objective} className="flex items-center space-x-2">
                      <Checkbox
                        id={`${rotation.id}-obj-${objective}`}
                        checked={rotation.objectives.includes(objective)}
                        onCheckedChange={() =>
                          toggleArrayItem(rotation.id, "objectives", objective)
                        }
                      />
                      <Label
                        htmlFor={`${rotation.id}-obj-${objective}`}
                        className="cursor-pointer font-normal text-sm"
                      >
                        {objective}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Assessment Methods */}
              <div className="space-y-3">
                <Label>Assessment Methods</Label>
                <div className="grid gap-2 md:grid-cols-2">
                  {assessmentMethods.map((method) => (
                    <div key={method} className="flex items-center space-x-2">
                      <Checkbox
                        id={`${rotation.id}-assess-${method}`}
                        checked={rotation.assessmentMethods.includes(method)}
                        onCheckedChange={() =>
                          toggleArrayItem(rotation.id, "assessmentMethods", method)
                        }
                      />
                      <Label
                        htmlFor={`${rotation.id}-assess-${method}`}
                        className="cursor-pointer font-normal text-sm"
                      >
                        {method}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Schedule Configuration */}
              <div className="space-y-4">
                <Label className="flex items-center gap-2 font-semibold text-base">
                  <Calendar className="h-4 w-4" />
                  Schedule Configuration
                </Label>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor={`rotation-start-date-${rotation.id}`}>Start Date</Label>
                    <Input
                      id={`rotation-start-date-${rotation.id}`}
                      type="date"
                      value={rotation.schedule.startDate}
                      onChange={(e) =>
                        updateRotationSchedule(rotation.id, "startDate", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`rotation-end-date-${rotation.id}`}>End Date</Label>
                    <Input
                      id={`rotation-end-date-${rotation.id}`}
                      type="date"
                      value={rotation.schedule.endDate}
                      onChange={(e) =>
                        updateRotationSchedule(rotation.id, "endDate", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`rotation-frequency-${rotation.id}`}>Frequency</Label>
                    <Select
                      value={rotation.schedule.frequency}
                      onValueChange={(value) =>
                        updateRotationSchedule(rotation.id, "frequency", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Daily">Daily</SelectItem>
                        <SelectItem value="Weekly">Weekly</SelectItem>
                        <SelectItem value="Bi-weekly">Bi-weekly</SelectItem>
                        <SelectItem value="Monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Time Slots */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="font-medium text-sm">Time Slots</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addTimeSlot(rotation.id)}
                      className="flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Add Time Slot
                    </Button>
                  </div>

                  {rotation.schedule.timeSlots.length === 0 ? (
                    <div className="rounded-lg bg-gray-50 py-4 text-center text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
                      <Clock className="mx-auto mb-2 h-8 w-8 opacity-50" />
                      <p className="text-sm">No time slots configured yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {rotation.schedule.timeSlots.map((timeSlot) => (
                        <Card key={timeSlot.id} className="bg-gray-50 dark:bg-gray-800/50">
                          <CardContent className="p-4">
                            <div className="grid items-end gap-4 md:grid-cols-5">
                              <div className="space-y-2">
                                <Label>Day</Label>
                                <Select
                                  value={timeSlot.dayOfWeek}
                                  onValueChange={(value) =>
                                    updateTimeSlot(rotation.id, timeSlot.id, "dayOfWeek", value)
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {daysOfWeek.map((day) => (
                                      <SelectItem key={day} value={day}>
                                        {day}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>Start Time</Label>
                                <Input
                                  type="time"
                                  value={timeSlot.startTime}
                                  onChange={(e) =>
                                    updateTimeSlot(
                                      rotation.id,
                                      timeSlot.id,
                                      "startTime",
                                      e.target.value
                                    )
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>End Time</Label>
                                <Input
                                  type="time"
                                  value={timeSlot.endTime}
                                  onChange={(e) =>
                                    updateTimeSlot(
                                      rotation.id,
                                      timeSlot.id,
                                      "endTime",
                                      e.target.value
                                    )
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Max Students</Label>
                                <Input
                                  type="number"
                                  value={timeSlot.maxStudents}
                                  onChange={(e) =>
                                    updateTimeSlot(
                                      rotation.id,
                                      timeSlot.id,
                                      "maxStudents",
                                      e.target.value
                                    )
                                  }
                                  min="1"
                                />
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => removeTimeSlot(rotation.id, timeSlot.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Add Rotation Button */}
        <Card className="border-2 border-gray-300 border-dashed dark:border-gray-600">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Stethoscope className="mb-4 h-12 w-12 text-gray-400" />
            <h3 className="mb-2 font-semibold text-gray-900 text-lg dark:text-white">
              Add Another Rotation
            </h3>
            <p className="mb-4 text-center text-gray-600 dark:text-gray-400">
              Create additional clinical rotations for your programs.
            </p>
            <Button onClick={addRotation} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Rotation
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
          disabled={isLoading || rotations.length === 0}
          size="lg"
          className="px-8"
        >
          {isLoading ? "Saving..." : "Continue to Review"}
        </Button>
      </div>
    </div>
  )
}
