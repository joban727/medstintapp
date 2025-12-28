"use client"

import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Clock,
  Edit,
  Eye,
  MapPin,
  MoreHorizontal,
  Plus,
  Search,
  Users,
  XCircle,
} from "lucide-react"
import { PageContainer, PageHeader } from "@/components/ui/page-container"
import { StatCard, StatGrid } from "@/components/ui/stat-card"
import {
  MobileDataCard,
  MobileDataField,
  ResponsiveTableWrapper,
} from "@/components/ui/responsive-table"
import { useState } from "react"
import { CreateRotationModal } from "@/components/modals/create-rotation-modal"
import { AssignStudentsModal } from "@/components/modals/assign-students-modal"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

interface RotationDetail {
  id: string
  title: string
  specialty: string
  clinicalSite: string
  clinicalSiteId?: string | null
  preceptorName: string
  preceptorAvatar?: string
  startDate?: Date
  endDate?: Date
  status: "SCHEDULED" | "ACTIVE" | "COMPLETED" | "CANCELLED"
  studentsAssigned: number
  maxStudents: number
  attendanceRate: number
  cohortName: string | null
}

interface SchoolRotationsClientProps {
  rotationDetails: RotationDetail[]
  statusCounts: {
    SCHEDULED: number
    ACTIVE: number
    COMPLETED: number
    CANCELLED: number
  }
}

export function SchoolRotationsClient({
  rotationDetails,
  statusCounts,
}: SchoolRotationsClientProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  const [selectedRotation, setSelectedRotation] = useState<RotationDetail | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [specialtyFilter, setSpecialtyFilter] = useState("all")
  const [cohortFilter, setCohortFilter] = useState("all")

  // Extract unique cohorts
  const uniqueCohorts = Array.from(new Set(rotationDetails.map(r => r.cohortName).filter(Boolean))).sort()

  const statusColors = {
    SCHEDULED:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800",
    ACTIVE:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800",
    COMPLETED:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    CANCELLED:
      "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800",
  }

  const statusIcons = {
    SCHEDULED: AlertCircle,
    ACTIVE: Clock,
    COMPLETED: CheckCircle,
    CANCELLED: XCircle,
  }

  const specialtyColors = {
    "General Radiology": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    MRI: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    "Ultrasound / Sonography": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    "CT Scan": "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    "Nuclear Medicine": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    Mammography: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400",
    "Interventional Radiology": "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    Fluoroscopy: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
    "Mobile Radiography": "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400",
    "Surgical Radiography": "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400",
    "Trauma Radiography": "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400",
    "Pediatric Radiology": "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400",
    Other: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  }

  // Filter rotations based on search and filters
  const filteredRotations = rotationDetails.filter((rotation) => {
    const matchesSearch =
      rotation.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rotation.specialty.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rotation.clinicalSite.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rotation.preceptorName.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === "all" || rotation.status === statusFilter
    const matchesSpecialty = specialtyFilter === "all" || rotation.specialty === specialtyFilter
    const matchesCohort = cohortFilter === "all" || (rotation.cohortName || "N/A") === cohortFilter

    return matchesSearch && matchesStatus && matchesSpecialty && matchesCohort
  })

  const handleCreateSuccess = () => {
    setIsCreateModalOpen(false)
    // Refresh the page to show the new rotation
    window.location.reload()
  }

  const handleAssignOpen = (rotation: RotationDetail) => {
    setSelectedRotation(rotation)
    setIsAssignModalOpen(true)
  }

  const handleAssignSuccess = () => {
    setIsAssignModalOpen(false)
    setSelectedRotation(null)
    window.location.reload()
  }

  return (
    <PageContainer>
      <PageHeader
        title="Rotation Management"
        description="Manage clinical rotations, schedules, and assignments"
      >
        <Button
          className="shadow-lg hover:shadow-primary/20 transition-all"
          onClick={() => setIsCreateModalOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Rotation
        </Button>
      </PageHeader>

      {/* Stats Cards */}
      <StatGrid columns={5}>
        <StatCard
          title="Total Rotations"
          value={rotationDetails.length}
          description="Across all specialties"
          icon={Calendar}
          variant="blue"
        />
        <StatCard
          title="Scheduled"
          value={statusCounts.SCHEDULED}
          description="Upcoming rotations"
          icon={AlertCircle}
          variant="orange"
        />
        <StatCard
          title="Active"
          value={statusCounts.ACTIVE}
          description="Currently running"
          icon={Clock}
          variant="green"
        />
        <StatCard
          title="Completed"
          value={statusCounts.COMPLETED}
          description="Successfully finished"
          icon={CheckCircle}
          variant="purple"
        />
        <StatCard
          title="Cancelled"
          value={statusCounts.CANCELLED}
          description="Cancelled rotations"
          icon={XCircle}
          variant="teal"
        />
      </StatGrid>

      {/* Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between glass-card-subtle p-4 rounded-lg">
        <div className="flex flex-1 items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search rotations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm bg-background/50 backdrop-blur-sm"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select aria-label="Status" value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[140px] bg-background/50 backdrop-blur-sm min-h-[44px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="SCHEDULED">Scheduled</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select aria-label="Specialty" value={specialtyFilter} onValueChange={setSpecialtyFilter}>
            <SelectTrigger className="w-full sm:w-[160px] bg-background/50 backdrop-blur-sm min-h-[44px]">
              <SelectValue placeholder="Specialty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Specialties</SelectItem>
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
          <Select aria-label="Cohort" value={cohortFilter} onValueChange={setCohortFilter}>
            <SelectTrigger className="w-full sm:w-[160px] bg-background/50 backdrop-blur-sm min-h-[44px]">
              <SelectValue placeholder="Cohort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cohorts</SelectItem>
              {uniqueCohorts.map((cohort) => (
                <SelectItem key={cohort as string} value={cohort as string}>
                  {cohort}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Rotations Table */}
      <Card className="glass-card overflow-hidden">
        <CardHeader>
          <CardTitle>Rotations</CardTitle>
          <CardDescription>Manage and monitor all clinical rotations</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {/* Mobile Card View */}
          <div className="block md:hidden p-4 space-y-3">
            {filteredRotations.map((rotation) => {
              const StatusIcon = statusIcons[rotation.status]
              return (
                <MobileDataCard key={`mobile-${rotation.id}`}>
                  <div className="flex items-start justify-between gap-2 pb-2 border-b border-border/30">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{rotation.title}</div>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "mt-1 text-xs",
                          specialtyColors[rotation.specialty as keyof typeof specialtyColors] ||
                          "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                        )}
                      >
                        {rotation.specialty}
                      </Badge>
                    </div>
                    <Badge
                      className={cn(
                        "shrink-0",
                        statusColors[rotation.status]
                      )}
                    >
                      <StatusIcon className="mr-1 h-3 w-3" />
                      {rotation.status}
                    </Badge>
                  </div>
                  <MobileDataField label="Preceptor">
                    <span className="truncate">{rotation.preceptorName}</span>
                  </MobileDataField>
                  <MobileDataField label="Site">
                    <span className="truncate">{rotation.clinicalSite}</span>
                  </MobileDataField>
                  <MobileDataField label="Duration">
                    <span>{rotation.startDate?.toLocaleDateString()} - {rotation.endDate?.toLocaleDateString()}</span>
                  </MobileDataField>
                  <MobileDataField label="Students">
                    <span>{rotation.studentsAssigned}/{rotation.maxStudents}</span>
                  </MobileDataField>
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" className="flex-1 min-h-[44px]" onClick={() => {
                      setSelectedRotation(rotation)
                      setIsAssignModalOpen(true)
                    }}>
                      <Users className="h-4 w-4 mr-1" /> Assign
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 min-h-[44px]">
                      <Eye className="h-4 w-4 mr-1" /> View
                    </Button>
                  </div>
                </MobileDataCard>
              )
            })}
          </div>

          {/* Desktop Table View */}
          <ResponsiveTableWrapper className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-border/50">
                  <TableHead>Rotation</TableHead>
                  <TableHead>Preceptor</TableHead>
                  <TableHead>Clinical Site</TableHead>
                  <TableHead>Cohort</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Attendance</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRotations.map((rotation) => {
                  const StatusIcon = statusIcons[rotation.status]
                  return (
                    <TableRow
                      key={rotation.id}
                      className="group hover:bg-muted/30 transition-colors duration-200 border-b border-border/50"
                    >
                      <TableCell>
                        <div>
                          <div className="font-medium group-hover:text-primary transition-colors">
                            {rotation.title}
                          </div>
                          <Badge
                            variant="secondary"
                            className={cn(
                              "mt-1",
                              specialtyColors[rotation.specialty as keyof typeof specialtyColors] ||
                              "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                            )}
                          >
                            {rotation.specialty}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8 ring-2 ring-background group-hover:ring-primary/20 transition-all">
                            <AvatarImage src={rotation.preceptorAvatar} />
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {rotation.preceptorName
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{rotation.preceptorName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{rotation.clinicalSite}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-background/50">
                          {rotation.cohortName || "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>
                            {rotation.startDate
                              ? rotation.startDate.toLocaleDateString()
                              : "No start date"}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            {rotation.endDate
                              ? `to ${rotation.endDate.toLocaleDateString()}`
                              : "No end date"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            {rotation.studentsAssigned}/{rotation.maxStudents}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn("border", statusColors[rotation.status])}
                        >
                          <StatusIcon className="mr-1 h-3 w-3" />
                          {rotation.status.toLowerCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{rotation.attendanceRate}%</div>
                      </TableCell>
                      <TableCell className="text-right">
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
                            <DropdownMenuItem className="cursor-pointer focus:bg-primary/10 focus:text-primary">
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Rotation
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleAssignOpen(rotation)}
                              className="cursor-pointer focus:bg-primary/10 focus:text-primary"
                            >
                              <Users className="mr-2 h-4 w-4" />
                              Manage Students
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </ResponsiveTableWrapper>
        </CardContent>
      </Card>

      <CreateRotationModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onSuccess={handleCreateSuccess}
      />
      <AssignStudentsModal
        open={isAssignModalOpen}
        onOpenChange={setIsAssignModalOpen}
        rotation={
          selectedRotation
            ? {
              id: selectedRotation.id,
              clinicalSiteId: selectedRotation.clinicalSiteId,
              startDate: selectedRotation.startDate,
              endDate: selectedRotation.endDate,
              currentAssigned: selectedRotation.studentsAssigned,
              maxCapacity: selectedRotation.maxStudents,
            }
            : null
        }
        onSuccess={handleAssignSuccess}
      />
    </PageContainer>
  )
}
