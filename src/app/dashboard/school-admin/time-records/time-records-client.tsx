"use client"

import { format } from "date-fns"
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Clock,
  Eye,
  FileText,
  MoreHorizontal,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  XCircle,
} from "lucide-react"
import { TimeRecordsFilterForm } from "@/components/time-records-filter-form"
import { TimecardAuditDialog } from "@/components/timecard-audit-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { approveTimeRecord, rejectTimeRecord } from "@/app/actions/time-records"
import { useTransition } from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  MobileDataCard,
  MobileDataField,
  ResponsiveTableWrapper,
} from "@/components/ui/responsive-table"

interface TimeRecord {
  id: string
  clockIn: string | null
  clockOut: string | null
  totalHours: number | null
  status: string
  notes: string | null
  student: {
    name: string
    email: string
  }
  rotation: {
    name: string
  }
  site?: {
    name: string
  } | null
  corrections: Array<{
    id: string
    correctionType: string
    status: string
  }>
}

interface SummaryStats {
  totalRecords: number
  pendingRecords: number
  approvedRecords: number
  rejectedRecords: number
  totalHours: number
  totalCorrections: number
  pendingCorrections: number
}

interface SearchParams {
  school?: string
  search?: string
  status?: string
  dateFrom?: string
  dateTo?: string
}

interface TimeRecordsClientProps {
  timeRecords: TimeRecord[]
  summaryStats: SummaryStats
  searchParams: SearchParams
}

export function TimeRecordsClient({
  timeRecords,
  summaryStats,
  searchParams,
}: TimeRecordsClientProps) {
  const {
    totalRecords,
    pendingRecords,
    approvedRecords,
    rejectedRecords,
    totalHours,
    totalCorrections,
    pendingCorrections,
  } = summaryStats

  const [isPending, startTransition] = useTransition()

  const handleApprove = (id: string) => {
    startTransition(async () => {
      try {
        await approveTimeRecord(id)
        toast.success("Time record approved")
      } catch (error) {
        toast.error("Failed to approve record")
      }
    })
  }

  const handleReject = (id: string) => {
    startTransition(async () => {
      try {
        await rejectTimeRecord(id)
        toast.success("Time record rejected")
      } catch (error) {
        toast.error("Failed to reject record")
      }
    })
  }

  return (
    <div className="space-y-6 stagger-children">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight text-foreground">Timecard Monitoring</h1>
          <p className="text-muted-foreground">
            Monitor and review all student timecard activities
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="glass-card card-hover-lift spotlight-card rounded-xl relative overflow-hidden border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Total Records</CardTitle>
            <div className="icon-container icon-container-blue">
              <Clock className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl animate-stat-value">{totalRecords}</div>
            <p className="text-muted-foreground text-xs">
              {Number(totalHours).toFixed(1)} total hours
            </p>
          </CardContent>
        </Card>
        <Card className="glass-card card-hover-lift spotlight-card rounded-xl relative overflow-hidden border-l-4 border-l-yellow-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Pending Review</CardTitle>
            <div className="icon-container icon-container-yellow">
              <AlertCircle className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl animate-stat-value">{pendingRecords}</div>
            <p className="text-muted-foreground text-xs">Awaiting approval</p>
          </CardContent>
        </Card>
        <Card className="glass-card card-hover-lift spotlight-card rounded-xl relative overflow-hidden border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Approved</CardTitle>
            <div className="icon-container icon-container-green">
              <CheckCircle className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl animate-stat-value">{approvedRecords}</div>
            <p className="text-muted-foreground text-xs">{rejectedRecords} rejected</p>
          </CardContent>
        </Card>
        <Card className="glass-card card-hover-lift spotlight-card rounded-xl relative overflow-hidden border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Corrections</CardTitle>
            <div className="icon-container icon-container-purple">
              <FileText className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl animate-stat-value">{totalCorrections}</div>
            <p className="text-muted-foreground text-xs">{pendingCorrections} pending</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="glass-card-subtle p-4 rounded-lg">
        <TimeRecordsFilterForm
          defaultValues={{
            search: searchParams.search,
            status: searchParams.status,
            dateFrom: searchParams.dateFrom,
            dateTo: searchParams.dateTo,
          }}
        />
      </div>

      {/* Time Records Table */}
      <Card className="glass-card overflow-hidden">
        <CardHeader>
          <CardTitle>Student Time Records</CardTitle>
          <CardDescription>
            All timecard entries with correction history and audit trail
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {/* Mobile Card View */}
          <div className="block md:hidden p-4 space-y-3">
            {timeRecords.map((record) => {
              const hasSystemFlags = record.notes?.includes("[SYSTEM FLAG]")
              return (
                <MobileDataCard key={`mobile-${record.id}`}>
                  <div className="flex items-start justify-between gap-2 pb-2 border-b border-border/30">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{record.student.name}</div>
                      <div className="text-muted-foreground text-xs truncate">{record.student.email}</div>
                    </div>
                    <Badge
                      className={cn(
                        "shrink-0",
                        record.status === "APPROVED" && "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
                        record.status === "REJECTED" && "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
                        record.status === "PENDING" && "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                      )}
                    >
                      {record.status}
                    </Badge>
                  </div>
                  <MobileDataField label="Rotation">
                    <span className="truncate">{record.rotation.name}</span>
                  </MobileDataField>
                  <MobileDataField label="Date">
                    <span>{record.clockIn ? format(new Date(record.clockIn), "MMM dd, yyyy") : "--"}</span>
                  </MobileDataField>
                  <MobileDataField label="Time">
                    <span>
                      {record.clockIn ? format(new Date(record.clockIn), "HH:mm") : "--"} - {record.clockOut ? format(new Date(record.clockOut), "HH:mm") : "Active"}
                    </span>
                  </MobileDataField>
                  <MobileDataField label="Hours">
                    <span className="font-semibold">
                      {record.totalHours != null ? `${Number(record.totalHours).toFixed(1)}h` : "--"}
                    </span>
                  </MobileDataField>
                  {record.status === "PENDING" && (
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        className="flex-1 min-h-[44px] bg-green-600 hover:bg-green-700"
                        onClick={() => handleApprove(record.id)}
                        disabled={isPending}
                      >
                        <ThumbsUp className="h-4 w-4 mr-1" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1 min-h-[44px]"
                        onClick={() => handleReject(record.id)}
                        disabled={isPending}
                      >
                        <ThumbsDown className="h-4 w-4 mr-1" /> Reject
                      </Button>
                    </div>
                  )}
                </MobileDataCard>
              )
            })}
          </div>

          {/* Desktop Table View */}
          <ResponsiveTableWrapper className="hidden md:block">
            <div className="border-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b border-border/50">
                    <TableHead>Student</TableHead>
                    <TableHead>Rotation</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Time Period</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Corrections</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timeRecords.map((record) => {
                    const hasSystemFlags = record.notes?.includes("[SYSTEM FLAG]")

                    return (
                      <TableRow
                        key={record.id}
                        className="group hover:bg-muted/30 transition-colors duration-200 border-b border-border/50"
                      >
                        <TableCell>
                          <div>
                            <div className="font-medium group-hover:text-primary transition-colors">
                              {record.student.name}
                            </div>
                            <div className="text-muted-foreground text-sm">
                              {record.student.email}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{record.rotation.name}</div>
                            <div className="text-muted-foreground text-sm">
                              {record.site?.name || "No site assigned"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {record.clockIn ? format(new Date(record.clockIn), "MMM dd, yyyy") : "--"}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>
                              {record.clockIn ? format(new Date(record.clockIn), "HH:mm") : "--"}
                            </div>
                            <div className="text-muted-foreground">
                              {record.clockOut
                                ? format(new Date(record.clockOut), "HH:mm")
                                : "Active"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {record.totalHours != null
                            ? `${Number(record.totalHours).toFixed(1)}h`
                            : "--"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                record.status === "APPROVED"
                                  ? "default"
                                  : record.status === "REJECTED"
                                    ? "destructive"
                                    : "secondary"
                              }
                              className={cn(
                                record.status === "APPROVED" &&
                                "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200",
                                record.status === "REJECTED" &&
                                "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200",
                                record.status === "PENDING" &&
                                "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 hover:bg-yellow-200"
                              )}
                            >
                              {record.status}
                            </Badge>
                            {hasSystemFlags && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="max-w-xs whitespace-pre-wrap">{record.notes}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}

                            {record.status === "PENDING" && (
                              <div className="flex items-center gap-1 ml-2">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
                                        onClick={() => handleApprove(record.id)}
                                        disabled={isPending}
                                      >
                                        <CheckCircle className="h-4 w-4" />
                                        <span className="sr-only">Approve</span>
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Approve</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>

                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                        onClick={() => handleReject(record.id)}
                                        disabled={isPending}
                                      >
                                        <XCircle className="h-4 w-4" />
                                        <span className="sr-only">Reject</span>
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Reject</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {record.corrections.length > 0 ? (
                            <div className="flex flex-col gap-1">
                              {record.corrections.map((correction) => (
                                <Badge
                                  key={correction.id}
                                  variant="outline"
                                  className="text-xs bg-background/50"
                                >
                                  {correction.correctionType} - {correction.status}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">None</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="glass-card-subtle">
                              <DropdownMenuItem className="cursor-pointer focus:bg-primary/10 focus:text-primary">
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              <TimecardAuditDialog timeRecordId={record.id}>
                                <DropdownMenuItem
                                  onSelect={(e) => e.preventDefault()}
                                  className="cursor-pointer focus:bg-primary/10 focus:text-primary"
                                >
                                  <FileText className="mr-2 h-4 w-4" />
                                  View Audit Trail
                                </DropdownMenuItem>
                              </TimecardAuditDialog>
                              <DropdownMenuItem className="cursor-pointer focus:bg-primary/10 focus:text-primary">
                                <Calendar className="mr-2 h-4 w-4" />
                                View Rotation Details
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </ResponsiveTableWrapper>
          {timeRecords.length === 0 && (
            <div className="py-12 text-center">
              <Clock className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 font-medium text-foreground text-sm">No time records found</h3>
              <p className="mt-1 text-muted-foreground text-sm">
                No time records found matching your criteria.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
