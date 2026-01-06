"use client"

import { format } from "date-fns"
import { AlertCircle, CheckCircle, Clock, Eye, FileText, Loader2, XCircle } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Card, CardContent } from "./ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog"
import { Label } from "./ui/label"
import { Separator } from "./ui/separator"
import { safeFetchApi } from "@/lib/safe-fetch"

interface TimecardCorrection {
  id: string
  correctionType: string
  requestedChanges: Record<string, any>
  reason: string
  studentNotes?: string
  status: "PENDING" | "APPROVED" | "REJECTED" | "APPLIED"
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  dueDate?: Date
  reviewedBy?: string
  reviewedAt?: Date
  reviewerNotes?: string
  createdAt: Date
  updatedAt: Date
  originalTimeRecord: {
    id: string
    date: Date
    clockIn?: Date
    clockOut?: Date
    totalHours: string
    activities: string
    notes?: string
    rotation: {
      specialty: string
      clinicalSite: string
    }
  }
}

interface TimecardCorrectionsListProps {
  studentId?: string
  limit?: number
  showTitle?: boolean
  onRefresh?: () => void
}

export function TimecardCorrectionsList({
  studentId,
  limit = 10,
  showTitle = true,
  onRefresh,
}: TimecardCorrectionsListProps) {
  const [corrections, setCorrections] = useState<TimecardCorrection[]>([])
  const [loading, setLoading] = useState(true)
  const [_selectedCorrection, setSelectedCorrection] = useState<TimecardCorrection | null>(null)

  const fetchCorrections = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (studentId) params.append("studentId", studentId)
      params.append("limit", limit.toString())
      params.append("sortBy", "createdAt")
      params.append("sortOrder", "desc")

      const result = await safeFetchApi<any>(`/api/timecard-corrections?${params}`)

      if (result.success) {
        // Handle standardized API response structure
        // API returns: { success: true, data: { corrections: [], pagination: {} } }
        const data = result.data.data || result.data
        setCorrections(data.corrections || [])
      } else {
        throw new Error(result.error || "Failed to fetch corrections")
      }
    } catch (_error) {
      // Error fetching corrections
      toast.error("Failed to load correction requests")
    } finally {
      setLoading(false)
    }
  }, [studentId, limit])

  useEffect(() => {
    fetchCorrections()
  }, [fetchCorrections])

  // Poll for updates every 30 seconds when the page is focused
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.hasFocus()) {
        fetchCorrections()
      }
    }, 30000) // 30 seconds

    return () => clearInterval(interval)
  }, [fetchCorrections])

  // Call onRefresh callback when corrections change
  useEffect(() => {
    onRefresh?.()
  }, [corrections, onRefresh])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Clock className="h-4 w-4 text-warning" />
      case "APPROVED":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "REJECTED":
        return <XCircle className="h-4 w-4 text-red-500" />
      case "APPLIED":
        return <CheckCircle className="h-4 w-4 text-blue-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "APPROVED":
        return "bg-green-100 text-green-800 border-green-200"
      case "REJECTED":
        return "bg-red-100 text-red-800 border-red-200"
      case "APPLIED":
        return "bg-blue-100 text-blue-800 border-blue-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "URGENT":
        return "bg-red-100 text-red-800 border-red-200"
      case "HIGH":
        return "bg-orange-100 text-orange-800 border-orange-200"
      case "MEDIUM":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "LOW":
        return "bg-gray-100 text-gray-800 border-gray-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const formatCorrectionType = (type: string) => {
    return type
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (l) => l.toUpperCase())
  }

  const formatTime = (date: Date | undefined) => {
    if (!date) return "Not recorded"
    return format(new Date(date), "HH:mm")
  }

  const formatDate = (date: Date) => {
    return format(new Date(date), "PPP")
  }

  const parseActivities = (activities: string): string[] => {
    try {
      try {
        return JSON.parse(activities || "[]")
      } catch (error) {
        console.error("Failed to parse activities:", error)
        return []
      }
    } catch {
      return []
    }
  }

  const renderChangeComparison = (correction: TimecardCorrection) => {
    const { requestedChanges, originalTimeRecord } = correction
    const changes = []
    if (requestedChanges.date) {
      changes.push({
        field: "Date",
        original: formatDate(originalTimeRecord.date),
        requested: formatDate(new Date(requestedChanges.date)),
      })
    }
    if (requestedChanges.clockIn) {
      changes.push({
        field: "Clock In",
        original: formatTime(originalTimeRecord.clockIn),
        requested: formatTime(new Date(requestedChanges.clockIn)),
      })
    }
    if (requestedChanges.clockOut) {
      changes.push({
        field: "Clock Out",
        original: formatTime(originalTimeRecord.clockOut),
        requested: formatTime(new Date(requestedChanges.clockOut)),
      })
    }
    if (requestedChanges.activities) {
      const originalActivities = parseActivities(originalTimeRecord.activities)
      let requestedActivities = []
      try {
        requestedActivities = JSON.parse(requestedChanges.activities)
      } catch (error) {
        console.error("Failed to parse requested activities:", error)
        requestedActivities = []
      }
      changes.push({
        field: "Activities",
        original: originalActivities.join(", ") || "None",
        requested: requestedActivities.join(", ") || "None",
      })
    }
    if (requestedChanges.notes !== undefined) {
      changes.push({
        field: "Notes",
        original: originalTimeRecord.notes || "None",
        requested: requestedChanges.notes || "None",
      })
    }
    return changes
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2">Loading corrections...</span>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="gap-4">
      {showTitle && (
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">Correction Requests</h3>
          <Badge variant="outline">{corrections.length} total</Badge>
        </div>
      )}
      {corrections.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">No correction requests found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="gap-3">
          {corrections.map((correction) => (
            <Card key={correction.id} className="transition-shadow duration-200 hover:shadow-md">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 gap-2">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(correction.status)}
                      <span className="font-medium">
                        {formatCorrectionType(correction.correctionType)}
                      </span>
                      <Badge className={getStatusColor(correction.status)}>
                        {correction.status}
                      </Badge>
                      <Badge className={getPriorityColor(correction.priority)}>
                        {correction.priority}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground text-sm">
                      <div>Record Date: {formatDate(correction.originalTimeRecord.date)}</div>
                      <div>Rotation: {correction.originalTimeRecord.rotation.specialty}</div>
                      <div>Submitted: {format(new Date(correction.createdAt), "PPp")}</div>
                      {correction.reviewedAt && (
                        <div>Reviewed: {format(new Date(correction.reviewedAt), "PPp")}</div>
                      )}
                    </div>
                    <p className="line-clamp-2 text-sm">{correction.reason}</p>
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedCorrection(correction)}
                      >
                        <Eye className="mr-1 h-4 w-4" /> View
                      </Button>
                    </DialogTrigger>
                    <DialogContent
                      className="max-h-[90vh] max-w-4xl overflow-y-auto"
                      onOpenAutoFocus={(e) => e.preventDefault()}
                    >
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          {getStatusIcon(correction.status)} Correction Request Details
                        </DialogTitle>
                        <DialogDescription>
                          {formatCorrectionType(correction.correctionType)} request for{" "}
                          {correction.originalTimeRecord.rotation.specialty}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="gap-6">
                        {/* Status and Priority */}
                        <div className="flex gap-4">
                          <div className="gap-1">
                            <Label className="font-medium text-sm">Status</Label>
                            <Badge className={getStatusColor(correction.status)}>
                              {correction.status}
                            </Badge>
                          </div>
                          <div className="gap-1">
                            <Label className="font-medium text-sm">Priority</Label>
                            <Badge className={getPriorityColor(correction.priority)}>
                              {correction.priority}
                            </Badge>
                          </div>
                          {correction.dueDate && (
                            <div className="gap-1">
                              <Label className="font-medium text-sm">Due Date</Label>
                              <div className="text-sm">{formatDate(correction.dueDate)}</div>
                            </div>
                          )}
                        </div>
                        <Separator />
                        {/* Changes Comparison */}
                        <div className="gap-4">
                          <h4 className="font-semibold">Requested Changes</h4>
                          <div className="grid gap-4">
                            {renderChangeComparison(correction).map((change, index) => (
                              <div
                                key={`change-${change.field.replace(/\s+/g, "-").toLowerCase()}-${index}`}
                                className="grid grid-cols-3 gap-4 rounded-lg bg-muted/50 p-3"
                              >
                                <div>
                                  <Label className="font-medium text-sm">{change.field}</Label>
                                </div>
                                <div>
                                  <Label className="text-muted-foreground text-xs">Original</Label>
                                  <div className="text-sm">{change.original}</div>
                                </div>
                                <div>
                                  <Label className="text-muted-foreground text-xs">Requested</Label>
                                  <div className="font-medium text-medical-primary text-sm">
                                    {change.requested}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <Separator />
                        {/* Reason and Notes */}
                        <div className="gap-4">
                          <div>
                            <Label className="font-medium text-sm">Reason for Correction</Label>
                            <p className="mt-1 rounded-lg bg-muted/50 p-3 text-sm">
                              {correction.reason}
                            </p>
                          </div>
                          {correction.studentNotes && (
                            <div>
                              <Label className="font-medium text-sm">Additional Notes</Label>
                              <p className="mt-1 rounded-lg bg-muted/50 p-3 text-sm">
                                {correction.studentNotes}
                              </p>
                            </div>
                          )}
                        </div>
                        {/* Review Information */}
                        {(correction.reviewedBy || correction.reviewerNotes) && (
                          <>
                            <Separator />
                            <div className="gap-4">
                              <h4 className="font-semibold">Review Information</h4>
                              {correction.reviewedBy && (
                                <div>
                                  <Label className="font-medium text-sm">Reviewed By</Label>
                                  <div className="mt-1 text-sm">{correction.reviewedBy}</div>
                                </div>
                              )}
                              {correction.reviewedAt && (
                                <div>
                                  <Label className="font-medium text-sm">Reviewed At</Label>
                                  <div className="mt-1 text-sm">
                                    {format(new Date(correction.reviewedAt), "PPp")}
                                  </div>
                                </div>
                              )}
                              {correction.reviewerNotes && (
                                <div>
                                  <Label className="font-medium text-sm">Reviewer Notes</Label>
                                  <p className="mt-1 rounded-lg bg-muted/50 p-3 text-sm">
                                    {correction.reviewerNotes}
                                  </p>
                                </div>
                              )}
                            </div>
                          </>
                        )}
                        {/* Timeline */}
                        <Separator />
                        <div className="gap-4">
                          <h4 className="font-semibold">Timeline</h4>
                          <div className="gap-2 text-sm">
                            <div className="flex justify-between">
                              <span>Submitted:</span>
                              <span>{format(new Date(correction.createdAt), "PPp")}</span>
                            </div>
                            {correction.updatedAt !== correction.createdAt && (
                              <div className="flex justify-between">
                                <span>Last Updated:</span>
                                <span>{format(new Date(correction.updatedAt), "PPp")}</span>
                              </div>
                            )}
                            {correction.reviewedAt && (
                              <div className="flex justify-between">
                                <span>Reviewed:</span>
                                <span>{format(new Date(correction.reviewedAt), "PPp")}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
