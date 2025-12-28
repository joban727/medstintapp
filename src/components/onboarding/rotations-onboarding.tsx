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

const validateEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

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

interface TimeSlot {
  id: string
  dayOfWeek: string
  startTime: string
  endTime: string
  maxStudents: string
}

interface RotationSchedule {
  startDate: string
  endDate: string
  frequency: string
  timeSlots: TimeSlot[]
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

export function RotationsOnboarding({ user, clerkUser }: RotationsOnboardingProps) {
  const router = useRouter()
  const [rotations, setRotations] = useState<Rotation[]>([])
  const [currentRotation, setCurrentRotation] = useState<Partial<Rotation>>({
    name: "",
    description: "",
    specialty: "",
    duration: "",
    durationUnit: "weeks",
    capacity: "",
    location: "",
    requirements: [],
    objectives: [],
    assessmentMethods: [],
    isRequired: false,
    yearLevel: [],
    schedule: {
      startDate: "",
      endDate: "",
      frequency: "weekly",
      timeSlots: [],
    },
  })

  const specialties = [
    "General Radiology",
    "MRI",
    "Ultrasound / Sonography",
    "CT Scan",
    "Nuclear Medicine",
    "Mammography",
    "Interventional Radiology",
    "Fluoroscopy",
    "Mobile Radiography",
    "Surgical Radiography",
    "Trauma Radiography",
    "Pediatric Radiology",
    "Other",
  ]

  const durationUnits = ["weeks", "months"]
  const frequencies = ["daily", "weekly", "monthly"]
  const yearLevels = ["Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "Year 6"]
  const assessmentMethods = [
    "Written Exam",
    "Practical Exam",
    "Case Presentation",
    "Portfolio",
    "Peer Assessment",
    "Self Assessment",
    "Supervisor Evaluation",
    "Patient Feedback",
  ]

  const addRotation = () => {
    if (!currentRotation.name || !currentRotation.specialty) {
      toast.error("Please fill in required fields")
      return
    }

    const newRotation: Rotation = {
      id: Date.now().toString(),
      name: currentRotation.name || "",
      description: currentRotation.description || "",
      specialty: currentRotation.specialty || "",
      duration: currentRotation.duration || "",
      durationUnit: currentRotation.durationUnit || "weeks",
      capacity: currentRotation.capacity || "",
      location: currentRotation.location || "",
      requirements: currentRotation.requirements || [],
      objectives: currentRotation.objectives || [],
      assessmentMethods: currentRotation.assessmentMethods || [],
      isRequired: currentRotation.isRequired || false,
      yearLevel: currentRotation.yearLevel || [],
      schedule: currentRotation.schedule || {
        startDate: "",
        endDate: "",
        frequency: "weekly",
        timeSlots: [],
      },
    }

    setRotations([...rotations, newRotation])
    setCurrentRotation({
      name: "",
      description: "",
      specialty: "",
      duration: "",
      durationUnit: "weeks",
      capacity: "",
      location: "",
      requirements: [],
      objectives: [],
      assessmentMethods: [],
      isRequired: false,
      yearLevel: [],
      schedule: {
        startDate: "",
        endDate: "",
        frequency: "weekly",
        timeSlots: [],
      },
    })
    toast.success("Rotation added successfully")
  }

  const removeRotation = (id: string) => {
    setRotations(rotations.filter((rotation) => rotation.id !== id))
    toast.success("Rotation removed")
  }

  const handleSubmit = async () => {
    if (rotations.length === 0) {
      toast.error("Please add at least one rotation")
      return
    }

    try {
      // Here you would typically save the rotations to your backend
      console.log("Saving rotations:", rotations)
      toast.success("Rotations saved successfully!")
      router.push("/onboarding/complete")
    } catch (error) {
      toast.error("Failed to save rotations")
    }
  }

  return (
    <div className="container mx-auto max-w-4xl p-6">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div className="mb-4">
          <Progress value={80} className="w-full" />
          <p className="mt-2 text-center text-sm text-gray-600">Step 4 of 5: Clinical Rotations</p>
        </div>
        <h1 className="mb-2 text-3xl font-bold">Clinical Rotations Setup</h1>
        <p className="text-gray-600">
          Configure the clinical rotations available at your institution.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Add Rotation Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Add New Rotation
            </CardTitle>
            <CardDescription>Create a new clinical rotation program</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="rotation-name">Rotation Name *</Label>
                <Input
                  id="rotation-name"
                  value={currentRotation.name || ""}
                  onChange={(e) => setCurrentRotation({ ...currentRotation, name: e.target.value })}
                  placeholder="e.g., General Radiology Rotation"
                />
              </div>
              <div>
                <Label htmlFor="specialty">Specialty *</Label>
                <Select
                  value={currentRotation.specialty || ""}
                  onValueChange={(value) =>
                    setCurrentRotation({ ...currentRotation, specialty: value })
                  }
                >
                  <SelectTrigger>
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
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={currentRotation.description || ""}
                onChange={(e) =>
                  setCurrentRotation({ ...currentRotation, description: e.target.value })
                }
                placeholder="Describe the rotation objectives and activities"
                rows={3}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="duration">Duration</Label>
                <Input
                  id="duration"
                  type="number"
                  value={currentRotation.duration || ""}
                  onChange={(e) =>
                    setCurrentRotation({ ...currentRotation, duration: e.target.value })
                  }
                  placeholder="e.g., 4"
                />
              </div>
              <div>
                <Label htmlFor="duration-unit">Unit</Label>
                <Select
                  value={currentRotation.durationUnit || "weeks"}
                  onValueChange={(value) =>
                    setCurrentRotation({ ...currentRotation, durationUnit: value })
                  }
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
              <div>
                <Label htmlFor="capacity">Capacity</Label>
                <Input
                  id="capacity"
                  type="number"
                  value={currentRotation.capacity || ""}
                  onChange={(e) =>
                    setCurrentRotation({ ...currentRotation, capacity: e.target.value })
                  }
                  placeholder="Max students"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={currentRotation.location || ""}
                onChange={(e) =>
                  setCurrentRotation({ ...currentRotation, location: e.target.value })
                }
                placeholder="Hospital or clinic name"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="required"
                checked={currentRotation.isRequired || false}
                onCheckedChange={(checked) =>
                  setCurrentRotation({ ...currentRotation, isRequired: checked as boolean })
                }
              />
              <Label htmlFor="required">Required rotation</Label>
            </div>

            <Button onClick={addRotation} className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              Add Rotation
            </Button>
          </CardContent>
        </Card>

        {/* Rotations List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5" />
              Configured Rotations ({rotations.length})
            </CardTitle>
            <CardDescription>Review and manage your clinical rotations</CardDescription>
          </CardHeader>
          <CardContent>
            {rotations.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                <Stethoscope className="mx-auto mb-4 h-12 w-12 text-gray-300" />
                <p>No rotations configured yet</p>
                <p className="text-sm">Add your first rotation to get started</p>
              </div>
            ) : (
              <div className="space-y-4">
                {rotations.map((rotation) => (
                  <div
                    key={rotation.id}
                    className="rounded-lg border p-4 transition-colors hover:bg-gray-50"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{rotation.name}</h3>
                          {rotation.isRequired && (
                            <Badge variant="secondary" className="text-xs">
                              Required
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">{rotation.specialty}</p>
                        {rotation.description && (
                          <p className="mt-1 text-sm text-gray-500">{rotation.description}</p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                          {rotation.duration && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {rotation.duration} {rotation.durationUnit}
                            </span>
                          )}
                          {rotation.capacity && <span>Max: {rotation.capacity} students</span>}
                          {rotation.location && <span>📍 {rotation.location}</span>}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeRotation(rotation.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 flex justify-between">
        <Button variant="outline" onClick={() => router.back()}>
          Previous Step
        </Button>
        <Button onClick={handleSubmit} disabled={rotations.length === 0}>
          Continue to Review
        </Button>
      </div>
    </div>
  )
}
