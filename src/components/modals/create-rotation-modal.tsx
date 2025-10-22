// TODO: Add cache invalidation hooks for mutations
"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
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

const createRotationSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  specialty: z.string().min(1, "Specialty is required"),
  clinicalSiteId: z.string().min(1, "Clinical site is required"),
  preceptorId: z.string().min(1, "Preceptor is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  maxStudents: z.string().min(1, "Max students is required"),
  requirements: z.string().optional(),
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

interface CreateRotationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function CreateRotationModal({ open, onOpenChange, onSuccess }: CreateRotationModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [preceptors, setPreceptors] = useState<Preceptor[]>([])
  const [clinicalSites, setClinicalSites] = useState<ClinicalSite[]>([])
  const [dataError, setDataError] = useState<string | null>(null)

  const form = useForm<CreateRotationFormData>({
    resolver: zodResolver(createRotationSchema),
    defaultValues: {
      title: "",
      description: "",
      specialty: "",
      clinicalSiteId: "",
      preceptorId: "",
      startDate: "",
      endDate: "",
      maxStudents: "",
      requirements: "",
    },
  })

  // Fetch preceptors and clinical sites when modal opens
  const fetchData = useCallback(async () => {
    setIsLoadingData(true)
    setDataError(null)

    try {
      // Fetch preceptors
      const preceptorsResponse = await fetch("/api/preceptors")
      if (!preceptorsResponse.ok) {
        throw new Error("Failed to fetch preceptors")
      }
      const preceptorsData = await preceptorsResponse.json()
      setPreceptors(preceptorsData.preceptors || [])

      // Fetch clinical sites from competencies endpoint
      const sitesResponse = await fetch("/api/competencies")
      if (!sitesResponse.ok) {
        throw new Error("Failed to fetch clinical sites")
      }
      const sitesData = await sitesResponse.json()
      setClinicalSites(sitesData.clinicalSites || [])
    } catch (error) {
      console.error("Error fetching data:", error)
      setDataError(error instanceof Error ? error.message : "Failed to load data")
      toast.error("Failed to load preceptors and clinical sites")
    } finally {
      setIsLoadingData(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      fetchData()
    }
  }, [open, fetchData])

  const onSubmit = async (data: CreateRotationFormData) => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/rotations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          maxStudents: Number.parseInt(data.maxStudents),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Failed to create rotation")
      }

      toast.success("Rotation created successfully!")
      form.reset()
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      console.error("Error creating rotation:", error)
      toast.error(error instanceof Error ? error.message : "Failed to create rotation")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create New Rotation</DialogTitle>
          <DialogDescription>
            Add a new clinical rotation to your program. Fill in all required information below.
          </DialogDescription>
          {dataError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-600 text-sm">
              {dataError}
            </div>
          )}
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Internal Medicine Rotation" {...field} />
                    </FormControl>
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select specialty" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="internal-medicine">Internal Medicine</SelectItem>
                        <SelectItem value="surgery">Surgery</SelectItem>
                        <SelectItem value="pediatrics">Pediatrics</SelectItem>
                        <SelectItem value="emergency-medicine">Emergency Medicine</SelectItem>
                        <SelectItem value="family-medicine">Family Medicine</SelectItem>
                        <SelectItem value="psychiatry">Psychiatry</SelectItem>
                        <SelectItem value="obstetrics-gynecology">
                          Obstetrics & Gynecology
                        </SelectItem>
                        <SelectItem value="radiology">Radiology</SelectItem>
                        <SelectItem value="anesthesiology">Anesthesiology</SelectItem>
                        <SelectItem value="pathology">Pathology</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the rotation objectives and activities..."
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
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
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="maxStudents"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Students</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" max="20" placeholder="e.g., 4" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="requirements"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Requirements (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Any specific requirements or prerequisites..."
                      className="min-h-[60px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
