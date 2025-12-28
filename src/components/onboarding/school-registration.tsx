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

const validateEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
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
  // Component implementation would continue here...
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-100 p-4">
      <div className="mx-auto max-w-4xl">
        <Card className="shadow-xl">
          <CardHeader className="text-center">
            <School className="mx-auto mb-4 h-12 w-12 text-healthcare-green" />
            <h1 className="text-2xl font-bold text-gray-900">School Registration</h1>
            <p className="text-gray-600">Register your educational institution</p>
          </CardHeader>
          <CardContent className="p-8">
            <Alert>
              <AlertDescription>
                This is a placeholder component. Full implementation would include form steps for
                school information, administrator details, and program setup.
              </AlertDescription>
            </Alert>
            <div className="mt-8 flex justify-between">
              <Button variant="outline" onClick={onBack} className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={() => onComplete({} as SchoolFormData)}
                className="flex items-center gap-2 bg-healthcare-green text-white hover:bg-green-700"
              >
                Complete Registration
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
