"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { format } from "date-fns"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getCohorts, createCohort, deleteCohort } from "@/app/actions/cohorts"

const cohortSchema = z.object({
  name: z.string().min(1, "Name is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  capacity: z.coerce.number().min(1, "Capacity must be at least 1"),
})

interface ManageCohortsModalProps {
  programId: string | null
  programName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ManageCohortsModal({
  programId,
  programName,
  open,
  onOpenChange,
}: ManageCohortsModalProps) {
  const [cohorts, setCohorts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  const form = useForm<z.infer<typeof cohortSchema>>({
    resolver: zodResolver(cohortSchema) as any,
    defaultValues: {
      name: "",
      startDate: "",
      endDate: "",
      capacity: 50,
    },
  })

  const fetchCohorts = async () => {
    if (!programId) return
    setIsLoading(true)
    const result = await getCohorts(programId)
    if (result.success) {
      setCohorts(result.data || [])
    } else {
      toast.error("Failed to load cohorts")
    }
    setIsLoading(false)
  }

  useEffect(() => {
    if (open && programId) {
      fetchCohorts()
    }
  }, [open, programId])

  const onSubmit = async (data: z.infer<typeof cohortSchema>) => {
    if (!programId) return
    setIsCreating(true)
    const result = await createCohort({ ...data, programId })
    if (result.success) {
      toast.success("Cohort created successfully")
      form.reset()
      fetchCohorts()
    } else {
      toast.error("Failed to create cohort")
    }
    setIsCreating(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this cohort?")) return
    const result = await deleteCohort(id)
    if (result.success) {
      toast.success("Cohort deleted")
      fetchCohorts()
    } else {
      toast.error("Failed to delete cohort")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Manage Cohorts - {programName}</DialogTitle>
          <DialogDescription>Create and manage cohorts for this program.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Create New Cohort Form */}
          <div className="rounded-lg border p-4 bg-muted/50">
            <h3 className="mb-4 font-semibold flex items-center gap-2">
              <Plus className="h-4 w-4" /> Create New Cohort
            </h3>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="grid gap-4 md:grid-cols-5 items-end"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Class of 2025" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                  name="capacity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Capacity</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isCreating}>
                  {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                </Button>
              </form>
            </Form>
          </div>

          {/* Cohorts List */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : cohorts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No cohorts found. Create one above.
                    </TableCell>
                  </TableRow>
                ) : (
                  cohorts.map((cohort) => (
                    <TableRow key={cohort.id}>
                      <TableCell className="font-medium">{cohort.name}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {format(new Date(cohort.startDate), "MMM yyyy")} -{" "}
                          {format(new Date(cohort.endDate), "MMM yyyy")}
                        </div>
                      </TableCell>
                      <TableCell>{cohort.capacity}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-800">
                          {cohort.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(cohort.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
