// TODO: Add cache invalidation hooks for mutations
"use client"

import {
  Activity,
  Calendar,
  CheckCircle,
  Clock,
  FileText,
  MapPin,
  User,
  XCircle,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { safeFetchApi } from "@/lib/safe-fetch"

interface TimecardCorrectionReviewDialogProps {
  children: React.ReactNode
  correction: {
    id: string
    correctionType: string
    requestedChanges: string
    reason: string
    status: string
    createdAt: string
    studentName: string
    studentEmail: string
    studentImage: string | null
    originalRecord: {
      id: string
      date: string
      clockIn: string | null
      clockOut: string | null
      totalHours: string | null
      activities: string | null
      notes: string | null
    }
    rotationName: string | null
    siteName: string | null
  }
}

export function TimecardCorrectionReviewDialog({
  children,
  correction,
}: TimecardCorrectionReviewDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [reviewComments, setReviewComments] = useState("")
  const router = useRouter()

  let requestedChanges: any = {}
  try {
    requestedChanges = JSON.parse(correction.requestedChanges || "{}")
  } catch (error) {
    console.error("Failed to parse requested changes:", error)
    requestedChanges = {}
  }

  const handleApprove = async () => {
    setIsLoading(true)
    try {
      const result = await safeFetchApi<any>(`/api/timecard-corrections/${correction.id}/approve`, {
        method: "POST",
        body: JSON.stringify({
          action: "approve",
          comments: reviewComments,
          applyImmediately: true,
        }),
      })

      if (result.success) {
        toast.success("Timecard correction approved successfully")
        setOpen(false)
        router.refresh()
      } else {
        throw new Error(result.error || "Failed to approve correction")
      }
    } catch (error) {
      // Error approving correction
      toast.error(error instanceof Error ? error.message : "Failed to approve correction")
    } finally {
      setIsLoading(false)
    }
  }

  const handleReject = async () => {
    if (!reviewComments.trim()) {
      toast.error("Please provide a reason for rejection")
      return
    }

    setIsLoading(true)
    try {
      const result = await safeFetchApi<any>(`/api/timecard-corrections/${correction.id}/approve`, {
        method: "POST",
        body: JSON.stringify({
          action: "reject",
          comments: reviewComments,
        }),
      })

      if (result.success) {
        toast.success("Timecard correction rejected")
        setOpen(false)
        router.refresh()
      } else {
        throw new Error(result.error || "Failed to reject correction")
      }
    } catch (error) {
      // Error rejecting correction
      toast.error(error instanceof Error ? error.message : "Failed to reject correction")
    } finally {
      setIsLoading(false)
    }
  }

  const formatTime = (timeString: string | null) => {
    if (!timeString) return "Not recorded"
    return new Date(timeString).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString([], {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        className="max-h-[90vh] max-w-4xl overflow-y-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Timecard Correction Review
          </DialogTitle>
          <DialogDescription>
            Review the requested timecard correction and approve or reject it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Student Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4" />
                Student Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={correction.studentImage || ""} />
                  <AvatarFallback>{correction.studentName?.charAt(0) || "S"}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">{correction.studentName}</div>
                  <div className="text-muted-foreground text-sm">{correction.studentEmail}</div>
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <MapPin className="h-3 w-3" />
                    {correction.rotationName} • {correction.siteName}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Correction Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4" />
                Correction Request
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="font-medium text-sm">Correction Type</Label>
                  <Badge variant="outline" className="mt-1">
                    {correction.correctionType.replace("_", " ").toLowerCase()}
                  </Badge>
                </div>
                <div>
                  <Label className="font-medium text-sm">Submitted</Label>
                  <div className="mt-1 text-muted-foreground text-sm">
                    {formatDate(correction.createdAt)}
                  </div>
                </div>
              </div>
              <div>
                <Label className="font-medium text-sm">Reason for Correction</Label>
                <div className="mt-1 rounded-md bg-muted p-3 text-sm">{correction.reason}</div>
              </div>
            </CardContent>
          </Card>

          {/* Original vs Requested Changes */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Original Record */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Original Record</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{formatDate(correction.originalRecord.date)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {formatTime(correction.originalRecord.clockIn)} -{" "}
                    {formatTime(correction.originalRecord.clockOut)}
                  </span>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Total Hours</Label>
                  <div className="text-sm">
                    {correction.originalRecord.totalHours || "Not calculated"}
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Activities</Label>
                  <div className="text-sm">
                    {correction.originalRecord.activities || "No activities recorded"}
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Notes</Label>
                  <div className="text-sm">{correction.originalRecord.notes || "No notes"}</div>
                </div>
              </CardContent>
            </Card>

            {/* Requested Changes */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-medical-primary">Requested Changes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(correction.correctionType === "CLOCK_IN_TIME" ||
                  correction.correctionType === "CLOCK_OUT_TIME") && (
                    <>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{formatDate(correction.originalRecord.date)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {formatTime(
                            requestedChanges.newClockIn || correction.originalRecord.clockIn
                          )}{" "}
                          -{" "}
                          {formatTime(
                            requestedChanges.newClockOut || correction.originalRecord.clockOut
                          )}
                        </span>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">Total Hours</Label>
                        <div className="text-sm">
                          {requestedChanges.newClockIn && requestedChanges.newClockOut
                            ? (
                              (new Date(requestedChanges.newClockOut).getTime() -
                                new Date(requestedChanges.newClockIn).getTime()) /
                              (1000 * 60 * 60)
                            ).toFixed(2)
                            : correction.originalRecord.totalHours || "Not calculated"}
                        </div>
                      </div>
                    </>
                  )}

                {(correction.correctionType === "ACTIVITIES" ||
                  correction.correctionType === "MULTIPLE") && (
                    <div>
                      <Label className="text-muted-foreground text-xs">Activities</Label>
                      <div className="text-sm">
                        {requestedChanges.newActivities ||
                          correction.originalRecord.activities ||
                          "No activities recorded"}
                      </div>
                    </div>
                  )}

                {(correction.correctionType === "NOTES" ||
                  correction.correctionType === "MULTIPLE") && (
                    <div>
                      <Label className="text-muted-foreground text-xs">Notes</Label>
                      <div className="text-sm">
                        {requestedChanges.newNotes || correction.originalRecord.notes || "No notes"}
                      </div>
                    </div>
                  )}

                {correction.correctionType === "MULTIPLE" && (
                  <>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {formatTime(
                          requestedChanges.newClockIn || correction.originalRecord.clockIn
                        )}{" "}
                        -{" "}
                        {formatTime(
                          requestedChanges.newClockOut || correction.originalRecord.clockOut
                        )}
                      </span>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Total Hours</Label>
                      <div className="text-sm">
                        {requestedChanges.newClockIn && requestedChanges.newClockOut
                          ? (
                            (new Date(requestedChanges.newClockOut).getTime() -
                              new Date(requestedChanges.newClockIn).getTime()) /
                            (1000 * 60 * 60)
                          ).toFixed(2)
                          : correction.originalRecord.totalHours || "Not calculated"}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* Review Comments */}
          <div className="space-y-2">
            <Label htmlFor="reviewComments">Review Comments</Label>
            <Textarea
              id="reviewComments"
              placeholder="Add comments about your decision (required for rejection)..."
              value={reviewComments}
              onChange={(e) => setReviewComments(e.target.value)}
              rows={3}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleReject} disabled={isLoading}>
              <XCircle className="mr-2 h-4 w-4" />
              {isLoading ? "Processing..." : "Reject"}
            </Button>
            <Button type="button" onClick={handleApprove} disabled={isLoading}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Approve & Apply
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
