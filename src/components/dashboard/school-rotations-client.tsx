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
import { useState } from "react"
import { CreateRotationModal } from "@/components/modals/create-rotation-modal"
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

interface RotationDetail {
  id: string
  title: string
  specialty: string
  clinicalSite: string
  preceptorName: string
  preceptorAvatar?: string
  startDate: Date
  endDate: Date
  status: "SCHEDULED" | "ACTIVE" | "COMPLETED" | "CANCELLED"
  studentsAssigned: number
  maxStudents: number
  attendanceRate: number
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
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [specialtyFilter, setSpecialtyFilter] = useState("all")

  const statusColors = {
    SCHEDULED: "bg-yellow-100 text-yellow-800",
    ACTIVE: "bg-green-100 text-green-800",
    COMPLETED: "bg-gray-100 text-gray-800",
    CANCELLED: "bg-red-100 text-red-800",
  }

  const statusIcons = {
    SCHEDULED: AlertCircle,
    ACTIVE: Clock,
    COMPLETED: CheckCircle,
    CANCELLED: XCircle,
  }

  const specialtyColors = {
    "Internal Medicine": "bg-blue-100 text-blue-800",
    Surgery: "bg-red-100 text-red-800",
    Pediatrics: "bg-green-100 text-green-800",
    "Emergency Medicine": "bg-orange-100 text-orange-800",
    "Family Medicine": "bg-purple-100 text-purple-800",
    Psychiatry: "bg-pink-100 text-pink-800",
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

    return matchesSearch && matchesStatus && matchesSpecialty
  })

  const handleCreateSuccess = () => {
    setIsCreateModalOpen(false)
    // Refresh the page to show the new rotation
    window.location.reload()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">Rotation Management</h1>
          <p className="text-muted-foreground">
            Manage clinical rotations, schedules, and assignments
          </p>
        </div>
        <Button
          className="bg-blue-600 hover:bg-blue-700"
          onClick={() => setIsCreateModalOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Rotation
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Total Rotations</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{rotationDetails.length}</div>
            <p className="text-muted-foreground text-xs">Across all specialties</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Scheduled</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{statusCounts.SCHEDULED}</div>
            <p className="text-muted-foreground text-xs">Upcoming rotations</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Active</CardTitle>
            <Clock className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{statusCounts.ACTIVE}</div>
            <p className="text-muted-foreground text-xs">Currently running</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{statusCounts.COMPLETED}</div>
            <p className="text-muted-foreground text-xs">Successfully finished</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Cancelled</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{statusCounts.CANCELLED}</div>
            <p className="text-muted-foreground text-xs">Cancelled rotations</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 items-center space-x-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search rotations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
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
          <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Specialty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Specialties</SelectItem>
              <SelectItem value="Internal Medicine">Internal Medicine</SelectItem>
              <SelectItem value="Surgery">Surgery</SelectItem>
              <SelectItem value="Pediatrics">Pediatrics</SelectItem>
              <SelectItem value="Emergency Medicine">Emergency Medicine</SelectItem>
              <SelectItem value="Family Medicine">Family Medicine</SelectItem>
              <SelectItem value="Psychiatry">Psychiatry</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Rotations Table */}
      <Card>
        <CardHeader>
          <CardTitle>Rotations</CardTitle>
          <CardDescription>Manage and monitor all clinical rotations</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rotation</TableHead>
                <TableHead>Preceptor</TableHead>
                <TableHead>Clinical Site</TableHead>
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
                  <TableRow key={rotation.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{rotation.title}</div>
                        <Badge
                          variant="secondary"
                          className={`mt-1 ${specialtyColors[rotation.specialty as keyof typeof specialtyColors] || "bg-gray-100 text-gray-800"}`}
                        >
                          {rotation.specialty}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={rotation.preceptorAvatar} />
                          <AvatarFallback>
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
                      <div className="flex items-center space-x-1">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{rotation.clinicalSite}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{rotation.startDate.toLocaleDateString()}</div>
                        <div className="text-muted-foreground">
                          to {rotation.endDate.toLocaleDateString()}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {rotation.studentsAssigned}/{rotation.maxStudents}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={statusColors[rotation.status]}>
                        <StatusIcon className="mr-1 h-3 w-3" />
                        {rotation.status.toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{rotation.attendanceRate}%</div>
                    </TableCell>
                    <TableCell className="text-right">
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
                          <DropdownMenuItem>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Rotation
                          </DropdownMenuItem>
                          <DropdownMenuItem>
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
        </CardContent>
      </Card>

      <CreateRotationModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onSuccess={handleCreateSuccess}
      />
    </div>
  )
}