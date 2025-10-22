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
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface TimeRecord {
  id: string
  clockIn: Date
  clockOut: Date | null
  totalHours: number | null
  status: string
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">Timecard Monitoring</h1>
          <p className="text-muted-foreground">
            Monitor and review all student timecard activities
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Total Records</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{totalRecords}</div>
            <p className="text-muted-foreground text-xs">{totalHours.toFixed(1)} total hours</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Pending Review</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{pendingRecords}</div>
            <p className="text-muted-foreground text-xs">Awaiting approval</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{approvedRecords}</div>
            <p className="text-muted-foreground text-xs">{rejectedRecords} rejected</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Corrections</CardTitle>
            <FileText className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{totalCorrections}</div>
            <p className="text-muted-foreground text-xs">{pendingCorrections} pending</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <TimeRecordsFilterForm
        defaultValues={{
          search: searchParams.search,
          status: searchParams.status,
          dateFrom: searchParams.dateFrom,
          dateTo: searchParams.dateTo,
        }}
      />

      {/* Time Records Table */}
      <Card>
        <CardHeader>
          <CardTitle>Student Time Records</CardTitle>
          <CardDescription>
            All timecard entries with correction history and audit trail
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
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
                {timeRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{record.student.name}</div>
                        <div className="text-muted-foreground text-sm">{record.student.email}</div>
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
                    <TableCell>{format(record.clockIn, "MMM dd, yyyy")}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{format(record.clockIn, "HH:mm")}</div>
                        <div className="text-muted-foreground">
                          {record.clockOut ? format(record.clockOut, "HH:mm") : "Active"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {record.totalHours ? `${record.totalHours.toFixed(1)}h` : "--"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          record.status === "APPROVED"
                            ? "default"
                            : record.status === "REJECTED"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {record.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {record.corrections.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {record.corrections.map((correction) => (
                            <Badge key={correction.id} variant="outline" className="text-xs">
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
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <TimecardAuditDialog timeRecordId={record.id}>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                              <FileText className="mr-2 h-4 w-4" />
                              View Audit Trail
                            </DropdownMenuItem>
                          </TimecardAuditDialog>
                          <DropdownMenuItem>
                            <Calendar className="mr-2 h-4 w-4" />
                            View Rotation Details
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {timeRecords.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-muted-foreground">No time records found matching your criteria.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
