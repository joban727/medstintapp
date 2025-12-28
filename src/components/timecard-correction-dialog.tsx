// TODO: Add cache invalidation hooks for mutations
"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { format } from "date-fns"
import { CalendarIcon, Clock, Edit, MapPin } from "lucide-react"
import { useState, useCallback } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { cn } from "@/lib/utils"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Calendar } from "./ui/calendar"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { Separator } from "./ui/separator"
import { Textarea } from "./ui/textarea"

const correctionSchema = z.object({
  correctionType: z.enum([
    "CLOCK_IN_TIME",
    "CLOCK_OUT_TIME",
    "ACTIVITIES",
    "NOTES",
    "DATE",
    "MULTIPLE",
  ]),
  requestedChanges: z
    .record(z.string(), z.unknown())
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one change must be specified",
    }),
  reason: z.string().min(10, "Reason must be at least 10 characters"),
  studentNotes: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  dueDate: z.date().optional(),
})

type CorrectionFormData = z.infer<typeof correctionSchema>

interface TimeRecord {
  id: string
  date: Date
  clockIn: Date | null
  clockOut: Date | null
  totalHours: string
  activities: string
  notes: string | null
  status: string
  rotation: {
    id: string
    specialty: string
    clinicalSite: string
  }
}

interface TimecardCorrectionDialogProps {
  timeRecord: TimeRecord
  trigger: React.ReactNode
}

export function TimecardCorrectionDialog({ timeRecord, trigger }: TimecardCorrectionDialogProps) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedChanges, setSelectedChanges] = useState<Record<string, unknown>>({})

  const form = useForm<CorrectionFormData>({
    resolver: zodResolver(correctionSchema),
    defaultValues: {
      correctionType: "MULTIPLE",
      requestedChanges: {},
      reason: "",
      studentNotes: "",
      priority: "MEDIUM",
    },
  })

  const formatTime = (date: Date | null) => {
    if (!date) return "Not recorded"
    return format(new Date(date), "HH:mm")
  }

  const formatDate = (date: Date) => {
    return format(new Date(date), "PPP")
  }

  const parseActivities = (activities: string): string[] => {
    try {
      return JSON.parse(activities || "[]")
    } catch (error) {
      console.error("Failed to parse activities:", error)
      return []
    }
  }

  const handleFieldChange = (field: string, value: unknown) => {
    const newChanges = { ...selectedChanges }
    if (value === null || value === undefined || value === "") {
      delete newChanges[field]
    } else {
      newChanges[field] = value
    }
    setSelectedChanges(newChanges)
    form.setValue("requestedChanges", newChanges)

    // Auto-detect correction type
    const changeKeys = Object.keys(newChanges)
    if (changeKeys.length === 0) {
      form.setValue("correctionType", "MULTIPLE")
    } else if (changeKeys.length === 1) {
      const singleKey = changeKeys[0]
      if (singleKey === "clockIn") form.setValue("correctionType", "CLOCK_IN_TIME")
      else if (singleKey === "clockOut") form.setValue("correctionType", "CLOCK_OUT_TIME")
      else if (singleKey === "activities") form.setValue("correctionType", "ACTIVITIES")
      else if (singleKey === "notes") form.setValue("correctionType", "NOTES")
      else if (singleKey === "date") form.setValue("correctionType", "DATE")
      else form.setValue("correctionType", "MULTIPLE")
    } else {
      form.setValue("correctionType", "MULTIPLE")
    }
  }

  const onSubmit = async (data: CorrectionFormData) => {
    if (Object.keys(data.requestedChanges).length === 0) {
      toast.error("Please specify at least one change")
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch("/api/timecard-corrections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          originalTimeRecordId: timeRecord.id,
          ...data,
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch((err) => {
          console.error("Failed to parse JSON response:", err)
          throw new Error("Invalid response format")
        })
        throw new Error(error.message || "Failed to submit correction request")
      }

      toast.success("Correction request submitted successfully")
      setOpen(false)
      form.reset()
      setSelectedChanges({})
      // Refresh the page to show updated data
      window.location.reload()
    } catch (error) {
      // Error submitting correction
      toast.error(error instanceof Error ? error.message : "Failed to submit correction request")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        className="max-h-[90vh] max-w-4xl overflow-y-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Request Timecard Correction
          </DialogTitle>
          <DialogDescription>
            Submit a request to correct your time record. Your preceptor will review and approve the
            changes.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Current Record Display */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Current Record</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="font-medium text-sm">Date</Label>
                <div className="flex items-center gap-2 text-sm">
                  <CalendarIcon className="h-4 w-4" />
                  {formatDate(timeRecord.date)}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="font-medium text-sm">Rotation</Label>
                <div className="text-sm">
                  <div className="font-medium">{timeRecord.rotation.specialty}</div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {timeRecord.rotation.clinicalSite}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-medium text-sm">Clock In</Label>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4" />
                    {formatTime(timeRecord.clockIn)}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="font-medium text-sm">Clock Out</Label>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4" />
                    {formatTime(timeRecord.clockOut)}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="font-medium text-sm">Total Hours</Label>
                <div className="font-medium text-sm">{timeRecord.totalHours}h</div>
              </div>

              <div className="space-y-2">
                <Label className="font-medium text-sm">Activities</Label>
                <div className="flex flex-wrap gap-1">
                  {parseActivities(timeRecord.activities).map((activity, index) => (
                    <Badge
                      key={`activity-${activity}-${index}`}
                      variant="outline"
                      className="text-xs"
                    >
                      {activity}
                    </Badge>
                  ))}
                  {parseActivities(timeRecord.activities).length === 0 && (
                    <span className="text-muted-foreground text-sm">No activities recorded</span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="font-medium text-sm">Notes</Label>
                <div className="text-sm">
                  {timeRecord.notes || (
                    <span className="text-muted-foreground">No notes recorded</span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="font-medium text-sm">Status</Label>
                <Badge variant="outline" className="w-fit">
                  {timeRecord.status}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Correction Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Requested Changes</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
                  {/* Date Correction */}
                  <div className="space-y-2">
                    <Label className="font-medium text-sm">Correct Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !selectedChanges.date && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {selectedChanges.date ? (
                            format(selectedChanges.date as Date, "PPP")
                          ) : (
                            <span>Select new date</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={selectedChanges.date as Date}
                          onSelect={(date) => handleFieldChange("date", date)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Time Corrections */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="font-medium text-sm">Correct Clock In</Label>
                      <Input
                        type="time"
                        value={(selectedChanges.clockIn as string) || ""}
                        onChange={(e) => handleFieldChange("clockIn", e.target.value)}
                        placeholder="HH:MM"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-sm">Correct Clock Out</Label>
                      <Input
                        type="time"
                        value={(selectedChanges.clockOut as string) || ""}
                        onChange={(e) => handleFieldChange("clockOut", e.target.value)}
                        placeholder="HH:MM"
                      />
                    </div>
                  </div>

                  {/* Activities Correction */}
                  <div className="space-y-2">
                    <Label className="font-medium text-sm">Correct Activities</Label>
                    <Textarea
                      placeholder="Enter activities (one per line)"
                      value={(selectedChanges.activities as string) || ""}
                      onChange={(e) => {
                        const activities = e.target.value.split("\n").filter((a) => a.trim())
                        handleFieldChange("activities", JSON.stringify(activities))
                      }}
                      rows={3}
                    />
                  </div>

                  {/* Notes Correction */}
                  <div className="space-y-2">
                    <Label className="font-medium text-sm">Correct Notes</Label>
                    <Textarea
                      placeholder="Enter corrected notes"
                      value={(selectedChanges.notes as string) || ""}
                      onChange={(e) => handleFieldChange("notes", e.target.value)}
                      rows={3}
                    />
                  </div>

                  <Separator />

                  {/* Reason and Priority */}
                  <FormField
                    control={form.control}
                    name="reason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reason for Correction *</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Explain why this correction is needed..."
                            aria-label="Explain why this correction is needed..."
                            {...field}
                            rows={3}
                          />
                        </FormControl>
                        <FormDescription>
                          Provide a clear explanation for why this correction is necessary.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="studentNotes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Additional Notes</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Any additional information for your preceptor..."
                            aria-label="Any additional information for your preceptor..."
                            {...field}
                            rows={2}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <Select
                          aria-label="Select priority"
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select priority" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="LOW">Low</SelectItem>
                            <SelectItem value="MEDIUM">Medium</SelectItem>
                            <SelectItem value="HIGH">High</SelectItem>
                            <SelectItem value="URGENT">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setOpen(false)}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? "Submitting..." : "Submit Correction Request"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  )
}
