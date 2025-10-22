"use client"

import {
  Building,
  Calendar,
  Edit,
  Eye,
  MoreHorizontal,
  Search,
  Star,
  Stethoscope,
  UserPlus,
  Users,
} from "lucide-react"
import { useState } from "react"
import { AddPreceptorModal } from "@/components/modals/add-preceptor-modal"
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

interface PreceptorData {
  id: string
  name: string | null
  email: string
  createdAt: Date
  rotationCount: number
  specialty: string
  clinicalSite: string
  activeStudents: number
  maxCapacity: number
  rating: string
  status: string
  yearsExperience: number
  completedEvaluations: number
}

interface SchoolPreceptorsClientProps {
  preceptorDetails: PreceptorData[]
  activePreceptors: number
  totalStudents: number
  avgRating: string
  totalCapacity: number
}

export function SchoolPreceptorsClient({
  preceptorDetails,
  activePreceptors,
  totalStudents,
  avgRating,
  totalCapacity,
}: SchoolPreceptorsClientProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [specialtyFilter, setSpecialtyFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")

  const specialtyColors: Record<string, string> = {
    "Internal Medicine": "bg-blue-100 text-blue-800",
    Surgery: "bg-red-100 text-red-800",
    Pediatrics: "bg-green-100 text-green-800",
    "Emergency Medicine": "bg-orange-100 text-orange-800",
    "Family Medicine": "bg-purple-100 text-purple-800",
  }

  // Filter preceptors based on search and filters
  const filteredPreceptors = preceptorDetails.filter((preceptor) => {
    const matchesSearch =
      preceptor.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      preceptor.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      preceptor.clinicalSite.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesSpecialty = specialtyFilter === "all" || preceptor.specialty === specialtyFilter
    const matchesStatus = statusFilter === "all" || preceptor.status.toLowerCase() === statusFilter

    return matchesSearch && matchesSpecialty && matchesStatus
  })

  const handleAddPreceptorSuccess = () => {
    // Refresh the page to show the new preceptor
    window.location.reload()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">Preceptor Management</h1>
          <p className="text-muted-foreground">
            Manage clinical preceptors, assignments, and performance
          </p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setIsAddModalOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Add Preceptor
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Total Preceptors</CardTitle>
            <Stethoscope className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{preceptorDetails.length}</div>
            <p className="text-muted-foreground text-xs">
              <span className="text-green-600">{activePreceptors}</span> currently active
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Students Supervised</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{totalStudents}</div>
            <p className="text-muted-foreground text-xs">{totalCapacity} total capacity</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Average Rating</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{avgRating}</div>
            <p className="text-muted-foreground text-xs">Based on student feedback</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Capacity Utilization</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">
              {totalCapacity > 0 ? Math.round((totalStudents / totalCapacity) * 100) : 0}%
            </div>
            <p className="text-muted-foreground text-xs">
              {totalStudents} of {totalCapacity} slots filled
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center space-x-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search preceptors..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by specialty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Specialties</SelectItem>
              <SelectItem value="Internal Medicine">Internal Medicine</SelectItem>
              <SelectItem value="Surgery">Surgery</SelectItem>
              <SelectItem value="Pediatrics">Pediatrics</SelectItem>
              <SelectItem value="Emergency Medicine">Emergency Medicine</SelectItem>
              <SelectItem value="Family Medicine">Family Medicine</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Preceptors Table */}
      <Card>
        <CardHeader>
          <CardTitle>Clinical Preceptors</CardTitle>
          <CardDescription>
            Showing {filteredPreceptors.length} of {preceptorDetails.length} preceptors
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Preceptor</TableHead>
                <TableHead>Specialty</TableHead>
                <TableHead>Clinical Site</TableHead>
                <TableHead>Students</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Experience</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPreceptors.map((preceptor) => (
                <TableRow key={preceptor.id}>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={`/avatars/${preceptor.id}.jpg`} />
                        <AvatarFallback>
                          {preceptor.name
                            ?.split(" ")
                            .map((n) => n[0])
                            .join("") || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{preceptor.name || "Unknown"}</div>
                        <div className="text-muted-foreground text-sm">{preceptor.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        specialtyColors[preceptor.specialty] || "bg-gray-100 text-gray-800"
                      }
                    >
                      {preceptor.specialty}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Building className="mr-1 h-4 w-4 text-muted-foreground" />
                      {preceptor.clinicalSite}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-center">
                      <div className="font-medium">
                        {preceptor.activeStudents}/{preceptor.maxCapacity}
                      </div>
                      <div className="text-muted-foreground text-xs">active/capacity</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Star className="mr-1 h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="font-medium">{preceptor.rating}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-center">
                      <div className="font-medium">{preceptor.yearsExperience} years</div>
                      <div className="text-muted-foreground text-xs">
                        {preceptor.completedEvaluations} evaluations
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={preceptor.status === "Active" ? "default" : "secondary"}>
                      {preceptor.status}
                    </Badge>
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
                          Edit Profile
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Calendar className="mr-2 h-4 w-4" />
                          Manage Schedule
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Preceptor Modal */}
      <AddPreceptorModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        onSuccess={handleAddPreceptorSuccess}
      />
    </div>
  )
}