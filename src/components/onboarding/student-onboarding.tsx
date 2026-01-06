// TODO: Add cache invalidation hooks for mutations
"use client"

import { useAuth } from "@clerk/nextjs"
import {
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Globe,
  GraduationCap,
  MapPin,
  School,
  Search,
  User,
  Mail,
  Phone,
  Home,
  IdCard,
  CalendarDays,
  Sparkles,
  ArrowRight,
  Loader2,
} from "lucide-react"
import { logger } from "@/lib/client-logger"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { useFieldIds } from "../../hooks/use-unique-id"
import { SubscriptionStep } from "./subscription-step"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Progress } from "../ui/progress"
import { Textarea } from "../ui/textarea"
import { Separator } from "../ui/separator"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

const validateEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

interface StudentOnboardingProps {
  user: any
  clerkUser: any
  availableSchools: any[]
  availablePrograms: any[]
  availableCohorts: any[]
}

type Step =
  | "welcome"
  | "basic-info"
  | "contact-info"
  | "school-selection"
  | "program-selection"
  | "cohort-selection"
  | "enrollment-confirmation"
  | "subscription"
  | "complete"

interface SchoolInfo {
  id: string
  name: string
  address: string
  website: string
}

interface ProgramInfo {
  id: string
  name: string
  description: string
  duration: number
  classYear: number
  schoolId: string
}

interface CohortInfo {
  id: string
  name: string
  programId: string
  startDate: Date
  endDate: Date
  graduationYear: number | null
  capacity: number
  description: string | null
  status: string
}

export default function StudentOnboarding({
  user,
  clerkUser,
  availableSchools,
  availablePrograms,
  availableCohorts,
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

  const [selectedSchool, setSelectedSchool] = useState<SchoolInfo | null>(() => {
    if (user?.schoolId) {
      return availableSchools.find((s) => s.id === user.schoolId) || null
    }
    return null
  })
  const [selectedProgram, setSelectedProgram] = useState<ProgramInfo | null>(() => {
    if (user?.programId) {
      return availablePrograms.find((p) => p.id === user.programId) || null
    }
    return null
  })
  const [selectedCohort, setSelectedCohort] = useState<CohortInfo | null>(() => {
    if (user?.cohortId) {
      return availableCohorts.find((c: CohortInfo) => c.id === user.cohortId) || null
    }
    return null
  })
  const [enrollmentDate, setEnrollmentDate] = useState("")
  const [searchTerm, setSearchTerm] = useState("")

  const steps: Record<Step, { title: string; description: string; progress: number }> = {
    welcome: { title: "Welcome", description: "Get Started", progress: 10 },
    "basic-info": { title: "Basic Info", description: "Who You Are", progress: 20 },
    "contact-info": { title: "Contact Info", description: "How to Reach You", progress: 35 },
    "school-selection": { title: "School", description: "Choose Institution", progress: 45 },
    "program-selection": { title: "Program", description: "Academic Program", progress: 55 },
    "cohort-selection": { title: "Cohort", description: "Your Class", progress: 70 },
    "enrollment-confirmation": { title: "Review", description: "Confirm Details", progress: 85 },
    subscription: { title: "Subscription", description: "Payment", progress: 95 },
    complete: { title: "Complete", description: "You're Done!", progress: 100 },
  }

  const filteredSchools = availableSchools.filter(
    (school) =>
      school.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      school.address?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const availableProgramsForSchool = selectedSchool
    ? availablePrograms.filter((program) => program.schoolId === selectedSchool.id)
    : []

  // Filter cohorts for the selected program
  const availableCohortsForProgram = selectedProgram
    ? availableCohorts.filter((cohort: CohortInfo) => cohort.programId === selectedProgram.id)
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
          const data = await response.json().catch((err) => {
            console.error("Failed to parse JSON response:", err)
            throw new Error("Invalid response format")
          })
          message = data?.error || data?.message || data?.details || message
        } catch (e) {
          logger.error(e, "Failed to parse error response")
          try {
            const text = await response.text()
            if (text) message = text
          } catch (e) {
            logger.error(e, "Failed to read error text")
          }
        }
        throw new Error(message)
      }

      return await response.json()
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to update user information"
      toast.error(errorMessage)
      throw error
    }
  }

  const handleNext = () => {
    startTransition(async () => {
      try {
        switch (currentStep) {
          case "welcome":
            setCurrentStep("basic-info")
            break

          case "basic-info":
            if (!personalData.name.trim()) {
              toast.error("Please enter your full name")
              return
            }
            setCurrentStep("contact-info")
            break

          case "contact-info":
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
            setCurrentStep("cohort-selection")
            break

          case "cohort-selection":
            if (!selectedCohort) {
              toast.error("Please select your cohort/class")
              return
            }
            setCurrentStep("enrollment-confirmation")
            break

          case "enrollment-confirmation": {
            if (!enrollmentDate) {
              toast.error("Please select an enrollment date")
              return
            }

            const enrollmentDateObj = new Date(enrollmentDate)
            if (Number.isNaN(enrollmentDateObj.getTime())) {
              toast.error("Please select a valid enrollment date")
              return
            }

            await handleUpdateUser({
              name: personalData.name,
              email: personalData.email,
              phone: personalData.phone,
              address: personalData.address,
              studentId: personalData.studentId,
              schoolId: selectedSchool?.id,
              programId: selectedProgram?.id,
              cohortId: selectedCohort?.id,
              enrollmentDate: enrollmentDateObj,
              role: "STUDENT",
            })

            setCurrentStep("subscription")
            break
          }

          case "subscription":
            setCurrentStep("complete")
            break

          case "complete": {
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
              } catch (e) {
                logger.error(e, "Failed to parse completion error")
                try {
                  const text = await completeResponse.text()
                  if (text) message = text
                } catch (e) {
                  logger.error(e, "Failed to read completion error text")
                }
              }
              toast.error(message)
              return
            }

            toast.success("Student registration completed successfully!")
            try {
              router.push("/dashboard")
              router.refresh()
            } catch (e) {
              logger.error(e, "Failed to redirect after onboarding")
            }
            break
          }
        }
      } catch (error) {
        logger.error(error, "Onboarding error")
      }
    })
  }

  const handleBack = () => {
    switch (currentStep) {
      case "basic-info":
        setCurrentStep("welcome")
        break
      case "contact-info":
        setCurrentStep("basic-info")
        break
      case "school-selection":
        setCurrentStep("contact-info")
        break
      case "program-selection":
        setCurrentStep("school-selection")
        break
      case "cohort-selection":
        setCurrentStep("program-selection")
        break
      case "cohort-selection":
        setCurrentStep("program-selection")
        break
      case "enrollment-confirmation":
        setCurrentStep("cohort-selection")
        break
      case "subscription":
        setCurrentStep("enrollment-confirmation")
        break
    }
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case "welcome":
        return (
          <motion.div
            key="welcome"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center text-center space-y-8 py-12"
          >
            <div className="relative group">
              <div className="absolute -inset-4 rounded-full bg-primary/20 opacity-20 blur-xl group-hover:opacity-30 transition-opacity duration-500"></div>
              <div className="relative flex h-32 w-32 items-center justify-center rounded-full bg-background border-2 border-border shadow-sm">
                <Sparkles className="h-16 w-16 text-primary animate-pulse" />
              </div>
            </div>
            <div className="space-y-4 max-w-lg">
              <h3 className="text-3xl font-semibold tracking-tight text-foreground">
                Welcome to MedStint
              </h3>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Your journey to clinical excellence starts here. We'll guide you through setting up
                your profile in just a few simple steps.
              </p>
            </div>
            <Button
              size="lg"
              onClick={handleNext}
              className="w-full max-w-xs text-lg h-14 rounded-full shadow-sm hover:shadow-md transition-all"
            >
              Get Started <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </motion.div>
        )

      case "basic-info":
        return (
          <motion.div
            key="basic-info"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="space-y-1">
              <h3 className="text-2xl font-semibold tracking-tight">Basic Information</h3>
              <p className="text-muted-foreground">Tell us a bit about yourself.</p>
            </div>

            <div className="grid gap-6">
              <div className="space-y-2">
                <Label htmlFor={fieldIds.fullName} className="flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" /> Full Name
                </Label>
                <Input
                  id={fieldIds.fullName}
                  value={personalData.name}
                  onChange={(e) => setPersonalData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Jane Doe"
                  className="h-12 text-lg"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor={fieldIds.dateOfBirth} className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-primary" /> Date of Birth
                  </Label>
                  <Input
                    id={fieldIds.dateOfBirth}
                    type="date"
                    value={personalData.dateOfBirth}
                    onChange={(e) =>
                      setPersonalData((prev) => ({ ...prev, dateOfBirth: e.target.value }))
                    }
                    className="h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={fieldIds.studentId} className="flex items-center gap-2">
                    <IdCard className="h-4 w-4 text-primary" /> Student ID{" "}
                    <span className="text-muted-foreground text-xs font-normal">(Optional)</span>
                  </Label>
                  <Input
                    id={fieldIds.studentId}
                    value={personalData.studentId}
                    onChange={(e) =>
                      setPersonalData((prev) => ({ ...prev, studentId: e.target.value }))
                    }
                    placeholder="e.g. 12345678"
                    className="h-12"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )

      case "contact-info":
        return (
          <motion.div
            key="contact-info"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="space-y-1">
              <h3 className="text-2xl font-semibold tracking-tight">Contact Details</h3>
              <p className="text-muted-foreground">How can we reach you?</p>
            </div>

            <div className="grid gap-6">
              <div className="space-y-2">
                <Label htmlFor={fieldIds.email} className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" /> Email Address
                </Label>
                <Input
                  id={fieldIds.email}
                  type="email"
                  value={personalData.email}
                  onChange={(e) => setPersonalData((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="name@example.com"
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={fieldIds.phone} className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-primary" /> Phone Number
                </Label>
                <Input
                  id={fieldIds.phone}
                  type="tel"
                  value={personalData.phone}
                  onChange={(e) => setPersonalData((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="(555) 123-4567"
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={fieldIds.address} className="flex items-center gap-2">
                  <Home className="h-4 w-4 text-primary" /> Address
                </Label>
                <Textarea
                  id={fieldIds.address}
                  value={personalData.address}
                  onChange={(e) =>
                    setPersonalData((prev) => ({ ...prev, address: e.target.value }))
                  }
                  placeholder="123 Main St, City, State, Zip"
                  className="min-h-[100px] resize-none text-base"
                />
              </div>
            </div>
          </motion.div>
        )

      case "school-selection":
        return (
          <motion.div
            key="school-selection"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="space-y-1">
              <h3 className="text-2xl font-semibold tracking-tight">Select School</h3>
              <p className="text-muted-foreground">Which institution are you attending?</p>
            </div>

            {user?.schoolId && selectedSchool ? (
              <Card className="border-border bg-card">
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <School className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground">Pre-assigned School</h4>
                    <p className="text-muted-foreground">
                      You have been assigned to <strong>{selectedSchool.name}</strong>
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search schools..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-12"
                  />
                </div>
                <div className="grid gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {filteredSchools.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground bg-muted/30 rounded-lg border border-dashed">
                      <School className="mx-auto h-10 w-10 mb-3 opacity-20" />
                      <p>No schools found matching your search.</p>
                    </div>
                  ) : (
                    filteredSchools.map((school) => (
                      <motion.div
                        key={school.id}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        className={cn(
                          "group relative flex cursor-pointer items-start gap-4 rounded-xl border p-4 transition-all hover:shadow-md",
                          selectedSchool?.id === school.id
                            ? "border-blue-500 bg-blue-50/50 ring-1 ring-blue-500 dark:bg-blue-900/20"
                            : "bg-card hover:border-blue-200 dark:hover:border-blue-800"
                        )}
                        onClick={() => setSelectedSchool(school)}
                      >
                        <div
                          className={cn(
                            "mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors",
                            selectedSchool?.id === school.id
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground group-hover:bg-primary/5 group-hover:text-primary"
                          )}
                        >
                          <School className="h-5 w-5" />
                        </div>
                        <div className="flex-1 space-y-1">
                          <h4 className="font-semibold leading-none">{school.name}</h4>
                          {school.address && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> {school.address}
                            </p>
                          )}
                          <div className="flex items-center gap-2 pt-1">
                            {school.website && (
                              <a
                                href={school.website}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-blue-500 hover:underline flex items-center gap-0.5"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Globe className="h-3 w-3" /> Website
                              </a>
                            )}
                          </div>
                        </div>
                        {selectedSchool?.id === school.id && (
                          <div className="absolute right-4 top-4">
                            <CheckCircle className="h-5 w-5 text-primary" />
                          </div>
                        )}
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )

      case "program-selection":
        if (!selectedSchool) return null

        return (
          <motion.div
            key="program-selection"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="space-y-1">
              <h3 className="text-2xl font-semibold tracking-tight">Select Program</h3>
              <p className="text-muted-foreground">
                Choose your academic program at {selectedSchool.name}.
              </p>
            </div>

            {user?.programId && selectedProgram ? (
              <Card className="border-border bg-card">
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <GraduationCap className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground">Pre-assigned Program</h4>
                    <p className="text-muted-foreground">
                      You have been assigned to <strong>{selectedProgram.name}</strong>
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {availableProgramsForSchool.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground bg-muted/30 rounded-lg border border-dashed">
                    <GraduationCap className="mx-auto h-10 w-10 mb-3 opacity-20" />
                    <p>No programs found for this school.</p>
                    <Button variant="link" onClick={() => setCurrentStep("school-selection")}>
                      Choose a different school
                    </Button>
                  </div>
                ) : (
                  availableProgramsForSchool.map((program) => (
                    <motion.div
                      key={program.id}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      className={cn(
                        "group relative flex cursor-pointer items-start gap-4 rounded-xl border p-4 transition-all hover:shadow-md",
                        selectedProgram?.id === program.id
                          ? "border-blue-500 bg-blue-50/50 ring-1 ring-blue-500 dark:bg-blue-900/20"
                          : "bg-card hover:border-blue-200 dark:hover:border-blue-800"
                      )}
                      onClick={() => setSelectedProgram(program)}
                    >
                      <div
                        className={cn(
                          "mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors",
                          selectedProgram?.id === program.id
                            ? "bg-blue-100 text-blue-600"
                            : "bg-muted text-muted-foreground group-hover:bg-blue-50 group-hover:text-blue-500"
                        )}
                      >
                        <GraduationCap className="h-5 w-5" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <h4 className="font-semibold leading-none">{program.name}</h4>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {program.description}
                        </p>
                        <div className="flex items-center gap-4 pt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1 bg-secondary/50 px-2 py-1 rounded-md">
                            <Calendar className="h-3 w-3" /> {program.duration} Months
                          </span>
                          <span className="flex items-center gap-1 bg-secondary/50 px-2 py-1 rounded-md">
                            <User className="h-3 w-3" /> Class of {program.classYear}
                          </span>
                        </div>
                      </div>
                      {selectedProgram?.id === program.id && (
                        <div className="absolute right-4 top-4">
                          <CheckCircle className="h-5 w-5 text-blue-500" />
                        </div>
                      )}
                    </motion.div>
                  ))
                )}
              </div>
            )}
          </motion.div>
        )

      case "cohort-selection":
        if (!selectedProgram) return null

        return (
          <motion.div
            key="cohort-selection"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="space-y-1">
              <h3 className="text-2xl font-semibold tracking-tight">Select Your Class</h3>
              <p className="text-muted-foreground">
                Which cohort are you joining in {selectedProgram.name}?
              </p>
            </div>

            {user?.cohortId && selectedCohort ? (
              <Card className="border-border bg-card">
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <CalendarDays className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground">Pre-assigned Cohort</h4>
                    <p className="text-muted-foreground">
                      You have been assigned to <strong>{selectedCohort.name}</strong>
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {availableCohortsForProgram.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground bg-muted/30 rounded-lg border border-dashed">
                    <CalendarDays className="mx-auto h-10 w-10 mb-3 opacity-20" />
                    <p>No cohorts available for this program yet.</p>
                    <p className="text-sm mt-2">Please contact your school administrator.</p>
                    <Button variant="link" onClick={() => setCurrentStep("program-selection")}>
                      Choose a different program
                    </Button>
                  </div>
                ) : (
                  availableCohortsForProgram.map((cohort: CohortInfo) => (
                    <motion.div
                      key={cohort.id}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      className={cn(
                        "group relative flex cursor-pointer items-start gap-4 rounded-xl border p-4 transition-all hover:shadow-md",
                        selectedCohort?.id === cohort.id
                          ? "border-primary bg-primary/5 ring-1 ring-primary dark:bg-primary/10"
                          : "bg-card hover:border-primary/50 dark:hover:border-primary/50"
                      )}
                      onClick={() => setSelectedCohort(cohort)}
                    >
                      <div
                        className={cn(
                          "mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors",
                          selectedCohort?.id === cohort.id
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground group-hover:bg-primary/5 group-hover:text-primary"
                        )}
                      >
                        <CalendarDays className="h-5 w-5" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <h4 className="font-semibold leading-none">{cohort.name}</h4>
                        {cohort.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {cohort.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 pt-2 text-xs text-muted-foreground">
                          {cohort.graduationYear && (
                            <span className="flex items-center gap-1 bg-secondary/50 px-2 py-1 rounded-md">
                              <GraduationCap className="h-3 w-3" /> Class of {cohort.graduationYear}
                            </span>
                          )}
                          <span className="flex items-center gap-1 bg-secondary/50 px-2 py-1 rounded-md">
                            <User className="h-3 w-3" /> {cohort.capacity} Seats
                          </span>
                        </div>
                      </div>
                      {selectedCohort?.id === cohort.id && (
                        <div className="absolute right-4 top-4">
                          <CheckCircle className="h-5 w-5 text-primary" />
                        </div>
                      )}
                    </motion.div>
                  ))
                )}
              </div>
            )}
          </motion.div>
        )

      case "enrollment-confirmation":
        return (
          <motion.div
            key="enrollment-confirmation"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="space-y-1">
              <h3 className="text-2xl font-semibold tracking-tight">Review & Confirm</h3>
              <p className="text-muted-foreground">
                Please review your information before proceeding.
              </p>
            </div>

            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 text-sm">
                  <div className="grid grid-cols-2 gap-1">
                    <span className="text-muted-foreground">Full Name:</span>
                    <span className="font-medium text-right">{personalData.name}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <span className="text-muted-foreground">Email:</span>
                    <span className="font-medium text-right">{personalData.email}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <span className="text-muted-foreground">Phone:</span>
                    <span className="font-medium text-right">{personalData.phone}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Academic Information</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 text-sm">
                  <div className="grid grid-cols-2 gap-1">
                    <span className="text-muted-foreground">School:</span>
                    <span className="font-medium text-right">{selectedSchool?.name}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <span className="text-muted-foreground">Program:</span>
                    <span className="font-medium text-right">{selectedProgram?.name}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <span className="text-muted-foreground">Cohort:</span>
                    <span className="font-medium text-right">{selectedCohort?.name}</span>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <Label htmlFor={fieldIds.enrollmentDate} className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" /> Enrollment Date
                </Label>
                <Input
                  id={fieldIds.enrollmentDate}
                  type="date"
                  value={enrollmentDate}
                  onChange={(e) => setEnrollmentDate(e.target.value)}
                  className="h-12"
                />
              </div>
            </div>
          </motion.div>
        )

      case "subscription":
        if (!selectedSchool || !user) return null
        return (
          <SubscriptionStep
            schoolId={selectedSchool.id}
            studentId={user.id}
            onComplete={() => handleNext()}
            onBack={handleBack}
          />
        )

      case "complete":
        return (
          <motion.div
            key="complete"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center text-center space-y-6 py-12"
          >
            <div className="h-24 w-24 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-12 w-12 text-green-600" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold">Registration Complete!</h3>
              <p className="text-muted-foreground max-w-md">
                You have successfully registered. You will now be redirected to your dashboard.
              </p>
            </div>
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </motion.div>
        )
    }
  }

  const currentStepInfo = steps[currentStep]
  const stepKeys = Object.keys(steps) as Step[]
  const currentStepIndex = stepKeys.indexOf(currentStep)

  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-8 bg-background">
      <Card className="w-full max-w-3xl shadow-2xl border-0 ring-1 ring-gray-200 dark:ring-gray-800 backdrop-blur-sm bg-background/80">
        <CardHeader className="border-b bg-muted/30 pb-8 pt-8 px-8">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-2xl font-bold">{currentStepInfo.title}</CardTitle>
                <CardDescription className="text-base">
                  {currentStepInfo.description}
                </CardDescription>
              </div>
              <Badge
                variant="secondary"
                className="px-4 py-1.5 text-sm font-medium bg-background/80 backdrop-blur-sm border shadow-sm"
              >
                Step {currentStepIndex + 1} of {stepKeys.length}
              </Badge>
            </div>

            {/* Custom Stepper */}
            <div className="relative">
              <div className="absolute top-1/2 left-0 w-full h-1 bg-muted -translate-y-1/2 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary"
                  initial={{ width: `${(currentStepIndex / (stepKeys.length - 1)) * 100}%` }}
                  animate={{ width: `${(currentStepIndex / (stepKeys.length - 1)) * 100}%` }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                />
              </div>
              <div className="relative flex justify-between">
                {stepKeys.map((step, index) => {
                  const isActive = index <= currentStepIndex
                  const isCurrent = index === currentStepIndex
                  return (
                    <div key={step} className="flex flex-col items-center gap-2">
                      <motion.div
                        className={cn(
                          "w-4 h-4 rounded-full border-2 transition-colors duration-300 z-10",
                          isActive
                            ? "bg-primary border-primary"
                            : "bg-background border-muted-foreground/30",
                          isCurrent && "ring-4 ring-primary/20"
                        )}
                        whileHover={{ scale: 1.2 }}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-8 min-h-[500px] flex flex-col">
          <div className="flex-1">
            <AnimatePresence mode="wait">{renderStepContent()}</AnimatePresence>
          </div>

          {currentStep !== "welcome" && currentStep !== "complete" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between pt-8 mt-8 border-t"
            >
              <Button
                variant="ghost"
                onClick={handleBack}
                disabled={isPending}
                className="gap-2 hover:bg-muted/50"
              >
                <ChevronLeft className="h-4 w-4" /> Back
              </Button>
              <Button
                onClick={handleNext}
                disabled={isPending}
                className="gap-2 min-w-[140px] shadow-lg hover:shadow-xl transition-all"
              >
                {isPending
                  ? "Processing..."
                  : currentStep === "enrollment-confirmation"
                    ? "Complete Setup"
                    : "Continue"}
                {!isPending && <ChevronRight className="h-4 w-4" />}
              </Button>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
