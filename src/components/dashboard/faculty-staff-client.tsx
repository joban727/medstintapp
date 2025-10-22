"use client"

import {
  Activity,
  Building,
  Calendar,
  Edit,
  Eye,
  GraduationCap,
  MoreHorizontal,
  Search,
  Shield,
  Star,
  UserPlus,
  Users,
} from "lucide-react"
import { useState } from "react"
import { AddFacultyModal } from "@/components/modals/add-faculty-modal"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface PreceptorData {
  id: string
  name: string | null
  email: string
  specialty: string
  clinicalSite: string
  activeStudents: number
  maxCapacity: number
  rating: number
  yearsExperience: number
  completedEvaluations: number
  status: string
}

interface FacultyData {
  id: string
  name: string | null
  email: string
  role: string
  department: string
  status: string
  joinedDate: string
  lastActive: string
}

interface FacultyStaffClientProps {
  preceptorData: PreceptorData[]
  facultyData: FacultyData[]
}

const specialtyColors: Record<string, string> = {
  "Internal Medicine": "bg-blue-100 text-blue-800",
  Surgery: "bg-red-100 text-red-800",
  Pediatrics: "bg-green-100 text-green-800",
  "Emergency Medicine": "bg-orange-100 text-orange-800",
  "Family Medicine": "bg-purple-100 text-purple-800",
  "General Medicine": "bg-gray-100 text-gray-800",
}

const roleColors: Record<string, string> = {
  CLINICAL_SUPERVISOR: "bg-indigo-100 text-indigo-800",
  SCHOOL_ADMIN: "bg-emerald-100 text-emerald-800",
}

export function FacultyStaffClient({ preceptorData, facultyData }: FacultyStaffClientProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [specialtyFilter, setSpecialtyFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [roleFilter, setRoleFilter] = useState("all")
  const [isAddPreceptorModalOpen, setIsAddPreceptorModalOpen] = useState(false)
  const [isAddFacultyModalOpen, setIsAddFacultyModalOpen] = useState(false)

  // Filter preceptors
  const filteredPreceptors = preceptorData.filter((preceptor) => {
    const matchesSearch =
      preceptor.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      preceptor.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesSpecialty = specialtyFilter === "all" || preceptor.specialty === specialtyFilter
    const matchesStatus =
      statusFilter === "all" || preceptor.status.toLowerCase() === statusFilter.toLowerCase()

    return matchesSearch && matchesSpecialty && matchesStatus
  })

  // Filter faculty
  const filteredFaculty = facultyData.filter((faculty) => {
    const matchesSearch =
      faculty.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      faculty.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = roleFilter === "all" || faculty.role === roleFilter
    const matchesStatus =
      statusFilter === "all" || faculty.status.toLowerCase() === statusFilter.toLowerCase()

    return matchesSearch && matchesRole && matchesStatus
  })

  // Calculate stats
  const totalPreceptors = preceptorData.length
  const totalFaculty = facultyData.length
  const totalStaff = totalPreceptors + totalFaculty
  const activePreceptors = preceptorData.filter((p) => p.status === "Active").length
  const activeFaculty = facultyData.filter((f) => f.status === "Active").length
  const totalStudents = preceptorData.reduce((sum, p) => sum + p.activeStudents, 0)
  const totalCapacity = preceptorData.reduce((sum, p) => sum + p.maxCapacity, 0)
  const avgRating =
    preceptorData.length > 0
      ? (preceptorData.reduce((sum, p) => sum + p.rating, 0) / preceptorData.length).toFixed(1)
      : "0.0"

  const handleAddPreceptorSuccess = () => {
    // Refresh data or show success message
    console.log("Preceptor added successfully")
  }

  const handleAddFacultySuccess = () => {
    // Refresh data or show success message
    console.log("Faculty added successfully")
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Total Staff</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{totalStaff}</div>
            <p className="text-muted-foreground text-xs">
              {totalPreceptors} preceptors, {totalFaculty} faculty
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Active Staff</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{activePreceptors + activeFaculty}</div>
            <p className="text-muted-foreground text-xs">
              {Math.round(((activePreceptors + activeFaculty) / totalStaff) * 100)}% active rate
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Students Supervised</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
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
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center space-x-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search faculty and staff..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>
        <div className="flex items-center space-x-2">
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

      {/* Tabs for different staff types */}
      <Tabs defaultValue="all" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="all">All Staff ({totalStaff})</TabsTrigger>
            <TabsTrigger value="preceptors">Preceptors ({totalPreceptors})</TabsTrigger>
            <TabsTrigger value="faculty">Faculty ({totalFaculty})</TabsTrigger>
          </TabsList>
          <div className="flex space-x-2">
            <Button onClick={() => setIsAddPreceptorModalOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Add Preceptor
            </Button>
            <Button onClick={() => setIsAddFacultyModalOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Add Faculty
            </Button>
          </div>
        </div>

        <TabsContent value="all" className="space-y-4">
          {/* Combined view with both preceptors and faculty */}
          <Card>
            <CardHeader>
              <CardTitle>All Faculty & Staff</CardTitle>
              <CardDescription>
                Showing {filteredPreceptors.length + filteredFaculty.length} staff members
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Specialty/Department</TableHead>
                    <TableHead>Clinical Site</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Preceptors */}
                  {filteredPreceptors.map((preceptor) => (
                    <TableRow key={`preceptor-${preceptor.id}`}>
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
                        <Badge className="bg-blue-100 text-blue-800">Clinical Preceptor</Badge>
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
                  {/* Faculty */}
                  {filteredFaculty.map((faculty) => (
                    <TableRow key={`faculty-${faculty.id}`}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={`/avatars/${faculty.id}.jpg`} />
                            <AvatarFallback>
                              {faculty.name
                                ?.split(" ")
                                .map((n) => n[0])
                                .join("") || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{faculty.name || "Unknown"}</div>
                            <div className="text-muted-foreground text-sm">{faculty.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={roleColors[faculty.role] || "bg-gray-100 text-gray-800"}>
                          {faculty.role === "CLINICAL_SUPERVISOR"
                            ? "Clinical Supervisor"
                            : "School Admin"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-gray-100 text-gray-800">{faculty.department}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center text-muted-foreground">
                          <Building className="mr-1 h-4 w-4" />
                          School Campus
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={faculty.status === "Active" ? "default" : "secondary"}>
                          {faculty.status}
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
                              <Shield className="mr-2 h-4 w-4" />
                              Manage Permissions
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
        </TabsContent>

        <TabsContent value="preceptors" className="space-y-4">
          <div className="mb-4 flex items-center space-x-2">
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
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Clinical Preceptors</CardTitle>
              <CardDescription>
                Showing {filteredPreceptors.length} of {preceptorData.length} preceptors
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
        </TabsContent>

        <TabsContent value="faculty" className="space-y-4">
          <div className="mb-4 flex items-center space-x-2">
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="CLINICAL_SUPERVISOR">Clinical Supervisor</SelectItem>
                <SelectItem value="SCHOOL_ADMIN">School Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Faculty Members</CardTitle>
              <CardDescription>
                Showing {filteredFaculty.length} of {facultyData.length} faculty members
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Faculty Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Last Active</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFaculty.map((faculty) => (
                    <TableRow key={faculty.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={`/avatars/${faculty.id}.jpg`} />
                            <AvatarFallback>
                              {faculty.name
                                ?.split(" ")
                                .map((n) => n[0])
                                .join("") || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{faculty.name || "Unknown"}</div>
                            <div className="text-muted-foreground text-sm">{faculty.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={roleColors[faculty.role] || "bg-gray-100 text-gray-800"}>
                          {faculty.role === "CLINICAL_SUPERVISOR"
                            ? "Clinical Supervisor"
                            : "School Admin"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-gray-100 text-gray-800">{faculty.department}</Badge>
                      </TableCell>
                      <TableCell>{faculty.joinedDate}</TableCell>
                      <TableCell>{faculty.lastActive}</TableCell>
                      <TableCell>
                        <Badge variant={faculty.status === "Active" ? "default" : "secondary"}>
                          {faculty.status}
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
                              <Shield className="mr-2 h-4 w-4" />
                              Manage Permissions
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
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <AddPreceptorModal
        open={isAddPreceptorModalOpen}
        onOpenChange={setIsAddPreceptorModalOpen}
        onSuccess={handleAddPreceptorSuccess}
      />
      <AddFacultyModal
        open={isAddFacultyModalOpen}
        onOpenChange={setIsAddFacultyModalOpen}
        onSuccess={handleAddFacultySuccess}
      />
    </div>
  )
}
