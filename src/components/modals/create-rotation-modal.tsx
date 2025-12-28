// TODO: Add cache invalidation hooks for mutations
"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { safeFetchApi } from "@/lib/safe-fetch"

const validateEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

const createRotationSchema = z.object({
  studentId: z.string().min(1, "Student is required"),
  specialty: z.string().min(1, "Specialty is required"),
  clinicalSiteId: z.string().min(1, "Clinical site is required"),
  preceptorId: z.string().optional(), // Made optional to simplify onboarding
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  requiredHours: z.string().optional(),
})

type CreateRotationFormData = z.infer<typeof createRotationSchema>

interface Preceptor {
  id: string
  firstName: string
  lastName: string
  email: string
  specialty?: string
}

interface ClinicalSite {
  id: string
  name: string
  type?: string
  specialty?: string
}

interface Student {
  id: string
  name: string
  email?: string
  studentId?: string
}

interface CreateRotationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function CreateRotationModal({ open, onOpenChange, onSuccess }: CreateRotationModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [preceptors, setPreceptors] = useState<Preceptor[]>([])
  const [clinicalSites, setClinicalSites] = useState<ClinicalSite[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [dataError, setDataError] = useState<string | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  const form = useForm<CreateRotationFormData>({
    resolver: zodResolver(createRotationSchema),
    defaultValues: {
      studentId: "",
      specialty: "",
      clinicalSiteId: "",
      preceptorId: "",
      startDate: "",
      endDate: "",
      requiredHours: "",
    },
  })

  // Fetch preceptors and clinical sites when modal opens
  const fetchData = useCallback(async () => {
    setIsLoadingData(true)
    setDataError(null)

    try {
      // Fetch preceptors
      const preceptorsResult = await safeFetchApi<{ preceptors: Preceptor[] }>("/api/preceptors")
      if (!preceptorsResult.success) {
        throw new Error(preceptorsResult.error || "Failed to fetch preceptors")
      }
      setPreceptors(preceptorsResult.data?.preceptors || [])

      // Fetch clinical sites from the dedicated clinical sites endpoint
      const sitesResult = await safeFetchApi<{ clinicalSites: any[] }>(
        "/api/clinical-sites?isActive=true&limit=200"
      )
      if (!sitesResult.success) {
        throw new Error(sitesResult.error || "Failed to fetch clinical sites")
      }
      const rawSites = sitesResult.data?.clinicalSites ?? []
      const normalizedSites: ClinicalSite[] = Array.isArray(rawSites)
        ? rawSites.map((s: any) => ({
          id: String(s?.id ?? s?.siteId ?? s?.value ?? ""),
          name: String(s?.name ?? s?.title ?? s?.label ?? "Unnamed Site"),
          type: s?.type ?? s?.siteType ?? undefined,
          specialty: Array.isArray(s?.specialties)
            ? s.specialties.join(", ")
            : (s?.specialty ?? undefined),
        }))
        : []
      setClinicalSites(normalizedSites)

      // Fetch students (school-scoped)
      const studentsResult = await safeFetchApi<{ students: Student[] }>(
        "/api/students?active=true&limit=200"
      )
      if (!studentsResult.success) {
        throw new Error(studentsResult.error || "Failed to fetch students")
      }
      setStudents(Array.isArray(studentsResult.data?.students) ? studentsResult.data!.students : [])
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred"
      console.error("[CreateRotationModal] Operation failed:", error)
      setDataError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setIsLoadingData(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      fetchData()
      setShowDetails(false)
    }
  }, [open, fetchData])

  // Auto-expand if there are errors in hidden fields
  const { errors } = form.formState
  useEffect(() => {
    if (errors.startDate || errors.endDate || errors.requiredHours) {
      setShowDetails(true)
    }
  }, [errors.startDate, errors.endDate, errors.requiredHours])

  const onSubmit = async (data: CreateRotationFormData) => {
    setIsSubmitting(true)
    setIsLoading(true)

    try {
      const response = await fetch("/api/rotations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentId: data.studentId,
          specialty: data.specialty,
          clinicalSiteId: data.clinicalSiteId,
          preceptorId: data.preceptorId,
          startDate: data.startDate ? new Date(data.startDate).toISOString() : undefined,
          endDate: data.endDate ? new Date(data.endDate).toISOString() : undefined,
          requiredHours: data.requiredHours ? Number.parseFloat(data.requiredHours) : undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch((err) => {
          console.error("Failed to parse JSON response:", err)
          throw new Error("Invalid response format")
        })
        throw new Error(error.message || "Failed to create rotation")
      }

      toast.success("Rotation created successfully!")
      form.reset()
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred"
      console.error("[CreateRotationModal] Operation failed:", error)
      toast.error(errorMessage)
    } finally {
      setIsSubmitting(false)
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Create New Rotation</DialogTitle>
          <DialogDescription>
            Create a clinical rotation with essential details only.
          </DialogDescription>
          {dataError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-error text-sm">
              {dataError}
            </div>
          )}
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="gap-4" noValidate>
            {/* Essential Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="studentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Student</FormLabel>
                    <Select
                      aria-label="Select student"
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={isLoadingData}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={isLoadingData ? "Loading students..." : "Select student"}
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {students.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} {s.studentId ? `(${s.studentId})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="specialty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Specialty</FormLabel>
                    <Select
                      aria-label="Select specialty"
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select specialty" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="General Radiology">General Radiology</SelectItem>
                        <SelectItem value="MRI">MRI</SelectItem>
                        <SelectItem value="Ultrasound / Sonography">Ultrasound / Sonography</SelectItem>
                        <SelectItem value="CT Scan">CT Scan</SelectItem>
                        <SelectItem value="Nuclear Medicine">Nuclear Medicine</SelectItem>
                        <SelectItem value="Mammography">Mammography</SelectItem>
                        <SelectItem value="Interventional Radiology">Interventional Radiology</SelectItem>
                        <SelectItem value="Fluoroscopy">Fluoroscopy</SelectItem>
                        <SelectItem value="Mobile Radiography">Mobile Radiography</SelectItem>
                        <SelectItem value="Surgical Radiography">Surgical Radiography</SelectItem>
                        <SelectItem value="Trauma Radiography">Trauma Radiography</SelectItem>
                        <SelectItem value="Pediatric Radiology">Pediatric Radiology</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="clinicalSiteId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Clinical Site</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={isLoadingData}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              isLoadingData ? "Loading sites..." : "Select clinical site"
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {clinicalSites.map((site) => (
                          <SelectItem key={site.id} value={site.id}>
                            {site.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="preceptorId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preceptor</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={isLoadingData}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              isLoadingData ? "Loading preceptors..." : "Select preceptor"
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {preceptors.map((preceptor) => (
                          <SelectItem key={preceptor.id} value={preceptor.id}>
                            Dr. {preceptor.firstName} {preceptor.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {/* Optional Details Toggle */}
            <div className="flex items-center">
              <Button
                type="button"
                variant="ghost"
                className="p-0 h-auto font-medium text-primary hover:text-primary/80 hover:bg-transparent"
                onClick={() => setShowDetails(!showDetails)}
              >
                {showDetails ? (
                  <ChevronDown className="mr-2 h-4 w-4" />
                ) : (
                  <ChevronRight className="mr-2 h-4 w-4" />
                )}
                {showDetails ? "Hide Schedule & Hours" : "Add Schedule & Hours (Optional)"}
              </Button>
            </div>

            {showDetails && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="requiredHours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Required Hours</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.5"
                          placeholder="e.g., 160"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading || isLoadingData}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading || isLoadingData}>
                {(isLoading || isLoadingData) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLoadingData ? "Loading..." : "Create Rotation"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
