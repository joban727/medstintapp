"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  CheckCircle,
  ChevronRight,
  Users,
  MapPin,
  Calendar,
  ArrowLeft,
  Loader2,
  UserPlus,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CsvUploader } from "@/components/setup/csv-uploader"
import { StudentInviteForm } from "@/components/setup/student-invite-form"
import { StaffInviteForm } from "@/components/setup/staff-invite-form"
import { PendingInvitationsList } from "@/components/setup/pending-invitations-list"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { quickSetup } from "@/app/actions/quick-setup"

export default function SetupWizardPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [currentStep, setCurrentStep] = useState("students")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Quick Setup state
  const [needsQuickSetup, setNeedsQuickSetup] = useState(false)
  const [isRunningQuickSetup, setIsRunningQuickSetup] = useState(false)
  const [quickSetupForm, setQuickSetupForm] = useState({
    schoolName: "",
    programName: "",
  })

  // Step 1: Students
  const [programs, setPrograms] = useState<any[]>([])
  const [cohorts, setCohorts] = useState<any[]>([])
  const [importedStudents, setImportedStudents] = useState(0)

  // Step 2: Staff (Preceptors/Supervisors)
  const [invitedStaff, setInvitedStaff] = useState(0)

  // Step 3: Sites
  const [sitesData, setSitesData] = useState<any[]>([])
  const [importedSites, setImportedSites] = useState(0)

  // Step 4: Rotations
  const [availableStudents, setAvailableStudents] = useState<any[]>([])
  const [availableSites, setAvailableSites] = useState<any[]>([])
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])
  const [rotationForm, setRotationForm] = useState({
    clinicalSiteId: "",
    specialty: "",
    startDate: "",
    endDate: "",
    requiredHours: 160,
  })
  const [isLoadingData, setIsLoadingData] = useState(false)

  // Fetch data when entering rotations step
  useEffect(() => {
    if (currentStep === "rotations") {
      const fetchData = async () => {
        setIsLoadingData(true)
        try {
          // Fetch students
          const studentsRes = await fetch("/api/students?active=true&limit=500")
          const studentsResult = await studentsRes.json()
          if (studentsResult.success) {
            setAvailableStudents(studentsResult.data.students)
            // Auto-select all students by default for convenience
            setSelectedStudents(studentsResult.data.students.map((s: any) => s.id))
          }

          // Fetch sites
          const sitesRes = await fetch("/api/clinical-sites?limit=100")
          const sitesResult = await sitesRes.json()
          if (sitesResult.success) {
            setAvailableSites(sitesResult.data.clinicalSites)
          }
        } catch (error) {
          console.error("Failed to fetch data:", error)
          toast({
            title: "Error loading data",
            description: "Could not load students or sites. Please try again.",
            variant: "destructive",
          })
        } finally {
          setIsLoadingData(false)
        }
      }
      fetchData()
    }
  }, [currentStep, toast])

  // Fetch programs and cohorts
  useEffect(() => {
    const fetchProgramsAndCohorts = async () => {
      try {
        const programsRes = await fetch("/api/programs?limit=100")
        const programsResult = await programsRes.json()
        const programItems = programsResult.data?.items || []
        setPrograms(programItems)

        // If no programs exist, user needs to run quick setup
        if (programItems.length === 0) {
          setNeedsQuickSetup(true)
        } else {
          setNeedsQuickSetup(false)
        }

        const cohortsRes = await fetch("/api/cohorts")
        const cohortsResult = await cohortsRes.json()
        if (cohortsResult.success) {
          setCohorts(cohortsResult.data.cohorts || [])
        }
      } catch (error) {
        console.error("Failed to fetch programs/cohorts:", error)
        setNeedsQuickSetup(true) // If we can't fetch, assume setup is needed
      }
    }
    fetchProgramsAndCohorts()
  }, [])

  const handleInvite = async (emails: string[], programId: string, cohortId: string) => {
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails, programId, cohortId, role: "STUDENT" }),
      })

      const result = await response.json()

      if (!response.ok) throw new Error(result.error || "Failed to send invitations")

      setImportedStudents((prev) => prev + result.data.created)
      toast({
        title: "Invitations Sent",
        description: `Successfully sent ${result.data.created} invitations.`,
      })

      // Optional: Move to next step automatically or let user decide
      // setCurrentStep("staff")
    } catch (error: any) {
      toast({
        title: "Invitation Failed",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleStaffInvite = async (
    emails: string[],
    role: string,
    programId: string,
    cohortId: string
  ) => {
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails, role, programId, cohortId }),
      })

      const result = await response.json()

      if (!response.ok) throw new Error(result.error || "Failed to send invitations")

      setInvitedStaff((prev) => prev + result.data.created)
      toast({
        title: "Invitations Sent",
        description: `Successfully sent ${result.data.created} staff invitations.`,
      })
    } catch (error: any) {
      toast({
        title: "Invitation Failed",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSiteImport = async () => {
    if (sitesData.length === 0) return

    setIsSubmitting(true)
    try {
      const response = await fetch("/api/sites/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sitesData),
      })

      const result = await response.json()

      if (!response.ok) throw new Error(result.error || "Failed to import sites")

      setImportedSites(result.data.created)
      toast({
        title: "Import Successful",
        description: result.message,
      })
      setCurrentStep("rotations")
    } catch (error: any) {
      toast({
        title: "Import Failed",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRotationCreate = async () => {
    if (!rotationForm.clinicalSiteId || !rotationForm.specialty || selectedStudents.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select a site, specialty, and at least one student.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch("/api/rotations/bulk-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIds: selectedStudents,
          clinicalSiteId: rotationForm.clinicalSiteId,
          specialty: rotationForm.specialty,
          startDate: rotationForm.startDate || undefined,
          endDate: rotationForm.endDate || undefined,
          requiredHours: Number(rotationForm.requiredHours),
        }),
      })

      const result = await response.json()

      if (!response.ok) throw new Error(result.error || "Failed to create rotations")

      toast({
        title: "Setup Complete",
        description: `Successfully created ${result.data.created} rotations.`,
      })
      router.push("/dashboard/school-admin/rotations")
    } catch (error: any) {
      toast({
        title: "Creation Failed",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudents((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    )
  }

  const toggleAllStudents = () => {
    if (selectedStudents.length === availableStudents.length) {
      setSelectedStudents([])
    } else {
      setSelectedStudents(availableStudents.map((s) => s.id))
    }
  }

  const handleQuickSetup = async () => {
    if (!quickSetupForm.schoolName.trim()) {
      toast({
        title: "School Name Required",
        description: "Please enter your school name to continue.",
        variant: "destructive",
      })
      return
    }

    setIsRunningQuickSetup(true)
    try {
      const result = await quickSetup(
        quickSetupForm.schoolName,
        quickSetupForm.programName || "Radiology Technology Program"
      )

      if (result.success) {
        toast({
          title: "Setup Complete!",
          description: `Created ${result.data?.schoolName}, ${result.data?.programName}, and ${result.data?.cohortName}. You can now invite students.`,
        })
        setNeedsQuickSetup(false)

        // Refresh programs and cohorts
        const programsRes = await fetch("/api/programs?limit=100")
        const programsResult = await programsRes.json()
        setPrograms(programsResult.data?.items || [])

        const cohortsRes = await fetch("/api/cohorts")
        const cohortsResult = await cohortsRes.json()
        setCohorts(cohortsResult.data?.cohorts || [])

        // Force page refresh to update user context
        router.refresh()
      } else {
        toast({
          title: "Setup Failed",
          description: result.error || "Failed to complete quick setup. Please try again.",
          variant: "destructive",
        })
      }
    } catch (error: any) {
      toast({
        title: "Setup Error",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      })
    } finally {
      setIsRunningQuickSetup(false)
    }
  }

  return (
    <div className="container mx-auto max-w-4xl py-8 stagger-children">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="hover:bg-primary/10 hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              School Setup & Intake
            </h1>
            <p className="text-muted-foreground">Onboard students and clinical sites</p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push("/dashboard/school-admin")}
          className="hidden sm:flex"
        >
          Finish Later
        </Button>
      </div>

      {/* Quick Setup Card - shown when no school/programs exist */}
      {needsQuickSetup && (
        <Card className="mb-8 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-primary">Quick Setup</CardTitle>
                <CardDescription>
                  Before you can invite students, we need to set up your school and program.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="schoolName">School Name *</Label>
                <Input
                  id="schoolName"
                  placeholder="e.g., Northern Medical College"
                  value={quickSetupForm.schoolName}
                  onChange={(e) =>
                    setQuickSetupForm({ ...quickSetupForm, schoolName: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="programName">Program Name (optional)</Label>
                <Input
                  id="programName"
                  placeholder="e.g., Radiology Technology Program"
                  value={quickSetupForm.programName}
                  onChange={(e) =>
                    setQuickSetupForm({ ...quickSetupForm, programName: e.target.value })
                  }
                />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              This will create your school, a default program, and a first cohort. You can customize
              these later from the Programs page.
            </p>
            <Button
              onClick={handleQuickSetup}
              disabled={isRunningQuickSetup}
              className="w-full md:w-auto"
            >
              {isRunningQuickSetup ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Setting up...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Complete Quick Setup
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-8 md:grid-cols-[250px_1fr]">
        <nav className="flex flex-col gap-2">
          <Button
            variant={currentStep === "students" ? "default" : "ghost"}
            className={cn(
              "justify-start transition-all duration-200",
              currentStep === "students" ? "shadow-md" : "hover:bg-primary/10 hover:text-primary"
            )}
            onClick={() => setCurrentStep("students")}
          >
            <Users className="mr-2 h-4 w-4" />
            1. Import Students
            {importedStudents > 0 && <CheckCircle className="ml-auto h-4 w-4 text-green-500" />}
          </Button>
          <Button
            variant={currentStep === "staff" ? "default" : "ghost"}
            className={cn(
              "justify-start transition-all duration-200",
              currentStep === "staff" ? "shadow-md" : "hover:bg-primary/10 hover:text-primary"
            )}
            onClick={() => setCurrentStep("staff")}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            2. Invite Staff
            {invitedStaff > 0 && <CheckCircle className="ml-auto h-4 w-4 text-green-500" />}
          </Button>
          <Button
            variant={currentStep === "sites" ? "default" : "ghost"}
            className={cn(
              "justify-start transition-all duration-200",
              currentStep === "sites" ? "shadow-md" : "hover:bg-primary/10 hover:text-primary"
            )}
            onClick={() => setCurrentStep("sites")}
          >
            <MapPin className="mr-2 h-4 w-4" />
            3. Import Sites
            {importedSites > 0 && <CheckCircle className="ml-auto h-4 w-4 text-green-500" />}
          </Button>
          <Button
            variant={currentStep === "rotations" ? "default" : "ghost"}
            className={cn(
              "justify-start transition-all duration-200",
              currentStep === "rotations" ? "shadow-md" : "hover:bg-primary/10 hover:text-primary"
            )}
            onClick={() => setCurrentStep("rotations")}
          >
            <Calendar className="mr-2 h-4 w-4" />
            4. Create Rotations
          </Button>
        </nav>

        <div className="space-y-6">
          {currentStep === "students" && (
            <Card className="bg-white/5 backdrop-blur-md border border-white/10 shadow-sm card-hover-lift">
              <CardHeader>
                <CardTitle>Import Students</CardTitle>
                <CardDescription>Upload a CSV file containing your student roster.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <StudentInviteForm
                  programs={programs}
                  cohorts={cohorts}
                  onInvite={handleInvite}
                  onSkip={() => setCurrentStep("staff")}
                  isSubmitting={isSubmitting}
                  onCohortCreated={(newCohort: any) => setCohorts([...cohorts, newCohort])}
                />
              </CardContent>
            </Card>
          )}

          {currentStep === "staff" && (
            <Card className="bg-white/5 backdrop-blur-md border border-white/10 shadow-sm card-hover-lift">
              <CardHeader>
                <CardTitle>Invite Clinical Staff</CardTitle>
                <CardDescription>
                  Invite Clinical Preceptors and Supervisors to join.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <StaffInviteForm
                  programs={programs}
                  cohorts={cohorts}
                  onInvite={handleStaffInvite}
                  onSkip={() => setCurrentStep("sites")}
                  isSubmitting={isSubmitting}
                />
              </CardContent>
            </Card>
          )}

          {currentStep === "sites" && (
            <Card className="bg-white/5 backdrop-blur-md border border-white/10 shadow-sm card-hover-lift">
              <CardHeader>
                <CardTitle>Import Clinical Sites</CardTitle>
                <CardDescription>Upload a CSV file containing your clinical sites.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <CsvUploader
                  requiredColumns={["name"]}
                  onDataLoaded={setSitesData}
                  template={{
                    headers: ["name", "address", "type", "capacity"],
                    data: [
                      {
                        name: "General Hospital",
                        address: "123 Main St",
                        type: "HOSPITAL",
                        capacity: 20,
                      },
                      {
                        name: "City Clinic",
                        address: "456 Elm St",
                        type: "CLINIC",
                        capacity: 5,
                      },
                    ],
                  }}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep("rotations")}
                    className="hover:bg-primary/10 hover:text-primary"
                  >
                    Skip
                  </Button>
                  <Button
                    onClick={handleSiteImport}
                    disabled={sitesData.length === 0 || isSubmitting}
                    className="shadow-lg hover:shadow-primary/20 transition-all"
                  >
                    {isSubmitting ? "Importing..." : "Import Sites"}
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === "rotations" && (
            <Card className="bg-white/5 backdrop-blur-md border border-white/10 shadow-sm card-hover-lift">
              <CardHeader>
                <CardTitle>Create Initial Rotations</CardTitle>
                <CardDescription>
                  Assign your students to their first clinical rotation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {isLoadingData ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="site">Clinical Site</Label>
                        <Select
                          value={rotationForm.clinicalSiteId}
                          onValueChange={(value) =>
                            setRotationForm({ ...rotationForm, clinicalSiteId: value })
                          }
                        >
                          <SelectTrigger id="site">
                            <SelectValue placeholder="Select a site" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableSites.map((site) => (
                              <SelectItem key={site.id} value={site.id}>
                                {site.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="specialty">Specialty</Label>
                        <Input
                          id="specialty"
                          placeholder="e.g. General Radiology"
                          value={rotationForm.specialty}
                          onChange={(e) =>
                            setRotationForm({ ...rotationForm, specialty: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="startDate">Start Date</Label>
                        <Input
                          id="startDate"
                          type="date"
                          value={rotationForm.startDate}
                          onChange={(e) =>
                            setRotationForm({ ...rotationForm, startDate: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="endDate">End Date</Label>
                        <Input
                          id="endDate"
                          type="date"
                          value={rotationForm.endDate}
                          onChange={(e) =>
                            setRotationForm({ ...rotationForm, endDate: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Select Students</Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={toggleAllStudents}
                          className="h-auto p-0 text-xs"
                        >
                          {selectedStudents.length === availableStudents.length
                            ? "Deselect All"
                            : "Select All"}
                        </Button>
                      </div>
                      <div className="border rounded-md p-4 max-h-[200px] overflow-y-auto space-y-2">
                        {availableStudents.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No students found.
                          </p>
                        ) : (
                          availableStudents.map((student) => (
                            <div key={student.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`student-${student.id}`}
                                checked={selectedStudents.includes(student.id)}
                                onCheckedChange={() => toggleStudentSelection(student.id)}
                              />
                              <Label
                                htmlFor={`student-${student.id}`}
                                className="text-sm font-normal cursor-pointer"
                              >
                                {student.name}{" "}
                                <span className="text-muted-foreground">({student.email})</span>
                              </Label>
                            </div>
                          ))
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Selected: {selectedStudents.length} students
                      </p>
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => router.push("/dashboard/school-admin/rotations")}
                        className="hover:bg-primary/10 hover:text-primary"
                      >
                        Skip Setup
                      </Button>
                      <Button
                        onClick={handleRotationCreate}
                        disabled={
                          isSubmitting ||
                          selectedStudents.length === 0 ||
                          !rotationForm.clinicalSiteId ||
                          !rotationForm.specialty
                        }
                        className="shadow-lg hover:shadow-primary/20 transition-all"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          <>
                            Create Rotations
                            <ChevronRight className="ml-2 h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      <div className="mt-8">
        <PendingInvitationsList />
      </div>
    </div>
  )
}
