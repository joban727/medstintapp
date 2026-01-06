"use client"

import { format } from "date-fns"
import { AlertCircle, CheckCircle, Clock, Edit, FileText, User, XCircle } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

const validateEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

interface AuditLogEntry {
  id: string
  action: string
  details: Record<string, string | number | boolean | null>
  performedBy: {
    id: string
    name: string | null
    email: string
    role: string
  }
  performedAt: Date
  ipAddress: string | null
}

interface TimecardCorrectionAudit {
  id: string
  correctionType: string
  status: string
  requestedChanges: Record<string, string | number | Date | null>
  reason: string
  createdAt: Date
  reviewedAt: Date | null
  appliedAt: Date | null
  student: {
    name: string | null
    email: string
  }
  reviewedBy: {
    name: string | null
    email: string
  } | null
  appliedBy: {
    name: string | null
    email: string
  } | null
}

interface TimecardAuditData {
  timeRecord: {
    id: string
    clockInTime: Date
    clockOutTime: Date | null
    totalHours: number | null
    activities: string | null
    notes: string | null
    status: string
    createdAt: Date
    updatedAt: Date
    student: {
      name: string | null
      email: string
    }
    rotation: {
      name: string
    }
  }
  auditLogs: AuditLogEntry[]
  corrections: TimecardCorrectionAudit[]
}

interface TimecardAuditDialogProps {
  timeRecordId: string
  children: React.ReactNode
}

export function TimecardAuditDialog({ timeRecordId, children }: TimecardAuditDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [auditData, setAuditData] = useState<TimecardAuditData | null>(null)

  const fetchAuditData = async () => {
    if (!timeRecordId) return

    setLoading(true)
    try {
      const response = await fetch(`/api/timecard-audit/${timeRecordId}`)
      if (!response.ok) {
        const errorData = await response
          .json()
          .catch((err) => {
            console.error("Failed to parse JSON response:", err)
            throw new Error("Invalid response format")
          })
          .catch(() => ({}))
        throw new Error(errorData.error || errorData.message || "Failed to fetch audit data")
      }
      const data = await response.json().catch((err) => {
        console.error("Failed to parse JSON response:", err)
        throw new Error("Invalid response format")
      })
      setAuditData(data)
    } catch (_error) {
      toast.error("Failed to load audit trail")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && timeRecordId) {
      fetchAuditData()
    }
  }, [open, timeRecordId])

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case "create":
      case "created":
        return <Clock className="h-4 w-4 text-blue-500" />
      case "approve":
      case "approved":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "reject":
      case "rejected":
        return <XCircle className="h-4 w-4 text-red-500" />
      case "update":
      case "updated":
      case "edit":
      case "edited":
        return <Edit className="h-4 w-4 text-orange-500" />
      case "correction_requested":
        return <AlertCircle className="h-4 w-4 text-warning" />
      default:
        return <FileText className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case "approved":
        return "default"
      case "rejected":
        return "destructive"
      case "pending":
        return "secondary"
      case "applied":
        return "default"
      default:
        return "outline"
    }
  }

  const formatChangeDetails = (
    details: Record<string, string | number | boolean | Date | null>
  ) => {
    if (!details || typeof details !== "object") return "No details available"

    return Object.entries(details)
      .map(([key, value]) => {
        if (key === "clockInTime" || key === "clockOutTime") {
          return `${key}: ${value ? format(new Date(value as string | number), "MMM dd, yyyy HH:mm") : "Not set"}`
        }
        return `${key}: ${value || "Not set"}`
      })
      .join(", ")
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[80vh] max-w-4xl" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Timecard Audit Trail</DialogTitle>
          <DialogDescription>
            Complete history of changes and corrections for this timecard record
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-primary border-b-2" />
              <p className="text-muted-foreground text-sm">Loading audit trail...</p>
            </div>
          </div>
        ) : auditData ? (
          <ScrollArea className="max-h-[60vh]">
            <div className="gap-6">
              {/* Time Record Summary */}
              <div className="rounded-lg bg-muted/50 p-4">
                <h3 className="mb-2 flex items-center gap-2 font-semibold">
                  <Clock className="h-4 w-4" />
                  Time Record Details
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Student:</span>{" "}
                    {auditData.timeRecord.student.name} ({auditData.timeRecord.student.email})
                  </div>
                  <div>
                    <span className="font-medium">Rotation:</span>{" "}
                    {auditData.timeRecord.rotation.name}
                  </div>
                  <div>
                    <span className="font-medium">Clock In:</span>{" "}
                    {format(auditData.timeRecord.clockInTime, "MMM dd, yyyy HH:mm")}
                  </div>
                  <div>
                    <span className="font-medium">Clock Out:</span>{" "}
                    {auditData.timeRecord.clockOutTime
                      ? format(auditData.timeRecord.clockOutTime, "MMM dd, yyyy HH:mm")
                      : "Active"}
                  </div>
                  <div>
                    <span className="font-medium">Total Hours:</span>{" "}
                    {auditData.timeRecord.totalHours != null
                      ? `${Number(auditData.timeRecord.totalHours).toFixed(1)}h`
                      : "--"}
                  </div>
                  <div>
                    <span className="font-medium">Status:</span>
                    <Badge
                      className="ml-2"
                      variant={getStatusBadgeVariant(auditData.timeRecord.status)}
                    >
                      {auditData.timeRecord.status}
                    </Badge>
                  </div>
                </div>

                {auditData.timeRecord.activities && (
                  <div className="mt-2">
                    <span className="font-medium">Activities:</span>
                    <p className="mt-1 text-muted-foreground text-sm">
                      {auditData.timeRecord.activities}
                    </p>
                  </div>
                )}

                {auditData.timeRecord.notes && (
                  <div className="mt-2">
                    <span className="font-medium">Notes:</span>
                    <p className="mt-1 text-muted-foreground text-sm">
                      {auditData.timeRecord.notes}
                    </p>
                  </div>
                )}
              </div>

              {/* Corrections History */}
              {auditData.corrections.length > 0 && (
                <div>
                  <h3 className="mb-3 flex items-center gap-2 font-semibold">
                    <FileText className="h-4 w-4" />
                    Correction Requests ({auditData.corrections.length})
                  </h3>
                  <div className="gap-3">
                    {auditData.corrections.map((correction) => (
                      <div key={correction.id} className="rounded-lg border p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{correction.correctionType}</Badge>
                            <Badge variant={getStatusBadgeVariant(correction.status)}>
                              {correction.status}
                            </Badge>
                          </div>
                          <span className="text-muted-foreground text-xs">
                            {format(correction.createdAt, "MMM dd, yyyy HH:mm")}
                          </span>
                        </div>
                        <div className="gap-1 text-sm">
                          <div>
                            <span className="font-medium">Requested by:</span>{" "}
                            {correction.student.name} ({correction.student.email})
                          </div>
                          <div>
                            <span className="font-medium">Reason:</span> {correction.reason}
                          </div>
                          <div>
                            <span className="font-medium">Changes:</span>{" "}
                            {formatChangeDetails(correction.requestedChanges)}
                          </div>
                          {correction.reviewedBy && (
                            <div>
                              <span className="font-medium">Reviewed by:</span>{" "}
                              {correction.reviewedBy.name} ({correction.reviewedBy.email})
                              {correction.reviewedAt && (
                                <span className="ml-2 text-muted-foreground">
                                  on {format(correction.reviewedAt, "MMM dd, yyyy HH:mm")}
                                </span>
                              )}
                            </div>
                          )}
                          {correction.appliedBy && (
                            <div>
                              <span className="font-medium">Applied by:</span>{" "}
                              {correction.appliedBy.name} ({correction.appliedBy.email})
                              {correction.appliedAt && (
                                <span className="ml-2 text-muted-foreground">
                                  on {format(correction.appliedAt, "MMM dd, yyyy HH:mm")}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Audit Log */}
              <div>
                <h3 className="mb-3 flex items-center gap-2 font-semibold">
                  <User className="h-4 w-4" />
                  Activity Log ({auditData.auditLogs.length})
                </h3>
                <div className="gap-2">
                  {auditData.auditLogs.map((log, index) => (
                    <div key={log.id}>
                      <div className="flex items-start gap-3 rounded-lg bg-muted/30 p-3">
                        <div className="mt-0.5">{getActionIcon(log.action)}</div>
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex items-center justify-between">
                            <span className="font-medium text-sm">{log.action}</span>
                            <span className="text-muted-foreground text-xs">
                              {format(log.performedAt, "MMM dd, yyyy HH:mm:ss")}
                            </span>
                          </div>
                          <div className="mb-1 text-muted-foreground text-sm">
                            <span className="font-medium">
                              {log.performedBy.name || "Unknown User"}
                            </span>
                            <span className="mx-1">•</span>
                            <span>{log.performedBy.email}</span>
                            <span className="mx-1">•</span>
                            <Badge variant="outline" className="text-xs">
                              {log.performedBy.role}
                            </Badge>
                          </div>
                          {log.details && Object.keys(log.details).length > 0 && (
                            <div className="text-muted-foreground text-xs">
                              <span className="font-medium">Details:</span>{" "}
                              {formatChangeDetails(log.details)}
                            </div>
                          )}
                          {log.ipAddress && (
                            <div className="text-muted-foreground text-xs">
                              <span className="font-medium">IP:</span> {log.ipAddress}
                            </div>
                          )}
                        </div>
                      </div>
                      {index < auditData.auditLogs.length - 1 && <Separator className="my-2" />}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
        ) : (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">No audit data available</p>
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
