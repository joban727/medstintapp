import { and, desc, eq } from "drizzle-orm"
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Clock,
  Edit3,
  Eye,
  Filter,
  MapPin,
  MoreHorizontal,
  Search,
  XCircle,
} from "lucide-react"
import { TimecardCorrectionReviewDialog } from "../../../../components/timecard-correction-review-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "../../../../components/ui/avatar"
import { Badge } from "../../../../components/ui/badge"
import { Button } from "../../../../components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../../components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../../components/ui/dropdown-menu"
import { Input } from "../../../../components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../../components/ui/table"
import { db } from "../../../../database/db"
import {
  clinicalSites,
  rotations,
  timecardCorrections,
  timeRecords,
  users,
} from "../../../../database/schema"
import { requireAnyRole } from "../../../../lib/auth-clerk"

export default async function TimeRecordsPage() {
  const user = await requireAnyRole(["CLINICAL_PRECEPTOR"], "/dashboard")

  // Fetch time records for students assigned to this preceptor
  const studentTimeRecords = await db
    .select({
      id: timeRecords.id,
      date: timeRecords.date,
      clockIn: timeRecords.clockIn,
      clockOut: timeRecords.clockOut,
      totalHours: timeRecords.totalHours,
      activities: timeRecords.activities,
      notes: timeRecords.notes,
      status: timeRecords.status,
      createdAt: timeRecords.createdAt,
      studentName: users.name,
      studentEmail: users.email,
      studentImage: users.image,
      rotationName: rotations.specialty,
      siteName: clinicalSites.name,
    })
    .from(timeRecords)
    .innerJoin(users, eq(users.id, timeRecords.studentId))
    .leftJoin(rotations, eq(rotations.id, timeRecords.rotationId))
    .leftJoin(clinicalSites, eq(clinicalSites.id, rotations.clinicalSiteId))
    .where(and(eq(rotations.preceptorId, user.id)))
    .orderBy(desc(timeRecords.date))

  // Fetch pending timecard corrections for this preceptor's students
  const pendingCorrections = await db
    .select({
      id: timecardCorrections.id,
      correctionType: timecardCorrections.correctionType,
      requestedChanges: timecardCorrections.requestedChanges,
      reason: timecardCorrections.reason,
      status: timecardCorrections.status,
      createdAt: timecardCorrections.createdAt,
      studentName: users.name,
      studentEmail: users.email,
      studentImage: users.image,
      originalRecordId: timecardCorrections.originalTimeRecordId,
      originalDate: timeRecords.date,
      originalClockIn: timeRecords.clockIn,
      originalClockOut: timeRecords.clockOut,
      originalTotalHours: timeRecords.totalHours,
      originalActivities: timeRecords.activities,
      originalNotes: timeRecords.notes,
      rotationName: rotations.specialty,
      siteName: clinicalSites.name,
    })
    .from(timecardCorrections)
    .innerJoin(timeRecords, eq(timeRecords.id, timecardCorrections.originalTimeRecordId))
    .innerJoin(users, eq(users.id, timecardCorrections.studentId))
    .leftJoin(rotations, eq(rotations.id, timecardCorrections.rotationId))
    .leftJoin(clinicalSites, eq(clinicalSites.id, rotations.clinicalSiteId))
    .where(and(eq(rotations.preceptorId, user.id), eq(timecardCorrections.status, "PENDING")))
    .orderBy(desc(timecardCorrections.createdAt))

  const recordStats = {
    totalRecords: studentTimeRecords.length,
    pendingRecords: studentTimeRecords.filter((r) => r.status === "PENDING").length,
    approvedRecords: studentTimeRecords.filter((r) => r.status === "APPROVED").length,
    rejectedRecords: studentTimeRecords.filter((r) => r.status === "REJECTED").length,
    totalHours: studentTimeRecords
      .filter((r) => r.status === "APPROVED")
      .reduce((sum, r) => sum + (Number(r.totalHours) || 0), 0),
    pendingCorrections: pendingCorrections.length,
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "APPROVED":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "REJECTED":
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            Approved
          </Badge>
        )
      case "REJECTED":
        return <Badge variant="destructive">Rejected</Badge>
      default:
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            Pending
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl text-gray-900">Time Records Review</h1>
          <p className="mt-1 text-gray-600">Review and approve student time records</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Total Records</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{recordStats.totalRecords}</div>
            <p className="text-muted-foreground text-xs">All submissions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Pending Review</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{recordStats.pendingRecords}</div>
            <p className="text-muted-foreground text-xs">Awaiting approval</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{recordStats.approvedRecords}</div>
            <p className="text-muted-foreground text-xs">Approved records</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Rejected</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{recordStats.rejectedRecords}</div>
            <p className="text-muted-foreground text-xs">Rejected records</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Total Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{Math.round(recordStats.totalHours)}</div>
            <p className="text-muted-foreground text-xs">Approved hours</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Corrections</CardTitle>
            <Edit3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{recordStats.pendingCorrections}</div>
            <p className="text-muted-foreground text-xs">Pending review</p>
          </CardContent>
        </Card>
      </div>

      {/* Time Records Management */}
      <Card>
        <CardHeader>
          <CardTitle>Student Time Records</CardTitle>
          <CardDescription>
            Review and approve time records submitted by your students
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search and Filter */}
          <div className="mb-6 flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 transform text-gray-400" />
              <Input placeholder="Search time records..." className="pl-10" />
            </div>
            <Select>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Records</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by student" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Students</SelectItem>
                {/* Add student options here */}
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Filter className="mr-2 h-4 w-4" />
              More Filters
            </Button>
          </div>

          {/* Time Records Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Time Period</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Activities</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {studentTimeRecords.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={record.studentImage || ""} />
                        <AvatarFallback>
                          {record.studentName
                            ?.split(" ")
                            .map((n) => n[0])
                            .join("") || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{record.studentName}</div>
                        <div className="text-gray-500 text-sm">{record.studentEmail}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Calendar className="mr-1 h-4 w-4 text-gray-400" />
                      <span>{new Date(record.date).toLocaleDateString()}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>
                        {new Date(record.clockIn).toLocaleTimeString()} -{" "}
                        {record.clockOut
                          ? new Date(record.clockOut).toLocaleTimeString()
                          : "In Progress"}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Clock className="mr-1 h-4 w-4 text-gray-400" />
                      <span className="font-medium">{record.totalHours}h</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <MapPin className="mr-1 h-4 w-4 text-gray-400" />
                      <div className="text-sm">
                        <div>{record.siteName || "N/A"}</div>
                        <div className="text-gray-500">{record.rotationName || "General"}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-xs">
                      <p className="truncate text-sm" title={record.activities || ""}>
                        {record.activities || "No activities listed"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(record.status)}
                      {getStatusBadge(record.status)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>View Details</DropdownMenuItem>
                        {record.status === "PENDING" && (
                          <>
                            <DropdownMenuItem className="text-green-600">
                              Approve Record
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600">
                              Reject Record
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuItem>Add Comment</DropdownMenuItem>
                        <DropdownMenuItem>View Student Profile</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {studentTimeRecords.length === 0 && (
            <div className="py-12 text-center">
              <Clock className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 font-medium text-gray-900 text-sm">No time records found</h3>
              <p className="mt-1 text-gray-500 text-sm">
                Time records submitted by your students will appear here.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Timecard Corrections Review Section */}
      {pendingCorrections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Edit3 className="h-5 w-5" />
              Pending Timecard Corrections
            </CardTitle>
            <CardDescription>
              Review and approve/reject timecard correction requests from students.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Original Date</TableHead>
                  <TableHead>Correction Type</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingCorrections.map((correction) => {
                  const requestedChanges = JSON.parse(correction.requestedChanges || "{}")
                  return (
                    <TableRow key={correction.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={correction.studentImage || ""} />
                            <AvatarFallback>
                              {correction.studentName?.charAt(0) || "S"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{correction.studentName}</div>
                            <div className="text-muted-foreground text-sm">
                              {correction.rotationName} • {correction.siteName}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {new Date(correction.originalDate).toLocaleDateString()}
                        </div>
                        <div className="text-muted-foreground text-sm">
                          {correction.originalClockIn && correction.originalClockOut
                            ? `${new Date(correction.originalClockIn).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })} - ${new Date(correction.originalClockOut).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}`
                            : "No time recorded"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {correction.correctionType.replace("_", " ").toLowerCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="text-sm">
                          {(correction.correctionType === "CLOCK_IN_TIME" ||
                            correction.correctionType === "CLOCK_OUT_TIME") && (
                            <div>
                              {requestedChanges.newClockIn && (
                                <div>
                                  In:{" "}
                                  {new Date(requestedChanges.newClockIn).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </div>
                              )}
                              {requestedChanges.newClockOut && (
                                <div>
                                  Out:{" "}
                                  {new Date(requestedChanges.newClockOut).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                          {correction.correctionType === "ACTIVITIES" && (
                            <div className="truncate">{requestedChanges.newActivities}</div>
                          )}
                          {correction.correctionType === "NOTES" && (
                            <div className="truncate">{requestedChanges.newNotes}</div>
                          )}
                          {correction.correctionType === "MULTIPLE" && (
                            <div className="text-muted-foreground">Multiple changes</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="truncate text-sm" title={correction.reason}>
                          {correction.reason}
                        </div>
                      </TableCell>
                      <TableCell>
                        <TimecardCorrectionReviewDialog
                          correction={{
                            id: correction.id,
                            correctionType: correction.correctionType,
                            requestedChanges: correction.requestedChanges,
                            reason: correction.reason,
                            status: correction.status,
                            createdAt: correction.createdAt.toISOString(),
                            studentName: correction.studentName || "Unknown Student",
                            studentEmail: correction.studentEmail || "",
                            studentImage: correction.studentImage || "",
                            originalRecord: {
                              id: correction.originalRecordId,
                              date: correction.originalDate.toISOString(),
                              clockIn: correction.originalClockIn?.toISOString() || "",
                              clockOut: correction.originalClockOut?.toISOString() || "",
                              totalHours: correction.originalTotalHours,
                              activities: correction.originalActivities,
                              notes: correction.originalNotes,
                            },
                            rotationName: correction.rotationName,
                            siteName: correction.siteName,
                          }}
                        >
                          <Button variant="outline" size="sm">
                            <Eye className="mr-2 h-4 w-4" />
                            Review
                          </Button>
                        </TimecardCorrectionReviewDialog>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
