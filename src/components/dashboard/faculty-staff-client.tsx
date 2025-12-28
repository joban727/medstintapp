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
import { cn } from "@/lib/utils"
import {
  MobileDataCard,
  MobileDataField,
  ResponsiveTableWrapper,
} from "@/components/ui/responsive-table"

const validateEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

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

interface ClinicalSiteOption {
  id: string
  name: string
}

interface FacultyStaffClientProps {
  preceptorData: PreceptorData[]
  facultyData: FacultyData[]
  clinicalSites: ClinicalSiteOption[]
}

const specialtyColors: Record<string, string> = {
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
  Other: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
}

export function FacultyStaffClient({ preceptorData, facultyData, clinicalSites }: FacultyStaffClientProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [specialtyFilter, setSpecialtyFilter] = useState("all")
  const [showAddPreceptor, setShowAddPreceptor] = useState(false)
  const [showAddFaculty, setShowAddFaculty] = useState(false)

  // Filter preceptors
  const filteredPreceptors = preceptorData.filter((preceptor) => {
    const matchesSearch =
      preceptor.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      preceptor.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      preceptor.specialty.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || preceptor.status === statusFilter
    const matchesSpecialty = specialtyFilter === "all" || preceptor.specialty === specialtyFilter
    return matchesSearch && matchesStatus && matchesSpecialty
  })

  // Filter faculty
  const filteredFaculty = facultyData.filter((faculty) => {
    const matchesSearch =
      faculty.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      faculty.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      faculty.department.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || faculty.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: {
        variant: "default" as const,
        label: "Active",
        className:
          "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50",
      },
      inactive: {
        variant: "secondary" as const,
        label: "Inactive",
        className:
          "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700",
      },
      pending: {
        variant: "outline" as const,
        label: "Pending",
        className: "text-yellow-600 border-yellow-600 dark:text-yellow-400 dark:border-yellow-400",
      },
    }
    const config =
      statusConfig[status.toLowerCase() as keyof typeof statusConfig] || statusConfig.active
    return (
      <Badge variant={config.variant} className={config.className}>
        {config.label}
      </Badge>
    )
  }

  return (
    <div className="space-y-6 stagger-children">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Faculty & Staff</h1>
          <p className="text-muted-foreground mt-1">
            Manage preceptors, faculty members, and clinical staff
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowAddPreceptor(true)}
            className="gap-2 shadow-lg hover:shadow-primary/20 transition-all"
          >
            <UserPlus className="h-4 w-4" />
            Add Preceptor
          </Button>
          <Button
            onClick={() => setShowAddFaculty(true)}
            variant="outline"
            className="gap-2 hover:bg-primary/10 hover:text-primary border-primary/20"
          >
            <Users className="h-4 w-4" />
            Add Faculty
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center glass-card-subtle p-4 rounded-lg">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search faculty and staff..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-background/50 backdrop-blur-sm"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px] bg-background/50 backdrop-blur-sm min-h-[44px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
          <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
            <SelectTrigger className="w-full sm:w-[180px] bg-background/50 backdrop-blur-sm min-h-[44px]">
              <SelectValue placeholder="Filter by specialty" />
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
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="preceptors" className="space-y-4">
        <TabsList className="bg-background/50 backdrop-blur-sm p-1 rounded-lg">
          <TabsTrigger
            value="preceptors"
            className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
          >
            <GraduationCap className="h-4 w-4" />
            Preceptors ({filteredPreceptors.length})
          </TabsTrigger>
          <TabsTrigger
            value="faculty"
            className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
          >
            <Users className="h-4 w-4" />
            Faculty ({filteredFaculty.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="preceptors" className="space-y-4">
          <Card className="glass-card overflow-hidden">
            <CardHeader>
              <CardTitle>Clinical Preceptors</CardTitle>
              <CardDescription>
                Manage clinical preceptors and their student assignments
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {/* Mobile Card View for Preceptors */}
              <div className="block md:hidden p-4 space-y-3">
                {filteredPreceptors.map((preceptor) => (
                  <MobileDataCard key={`mobile-preceptor-${preceptor.id}`}>
                    <div className="flex items-start justify-between gap-2 pb-2 border-b border-border/30">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {preceptor.name?.split(" ").map((n) => n[0]).join("") || "P"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="font-medium truncate">{preceptor.name || "Unknown"}</div>
                          <div className="text-muted-foreground text-xs truncate">{preceptor.email}</div>
                        </div>
                      </div>
                      {getStatusBadge(preceptor.status)}
                    </div>
                    <MobileDataField label="Specialty">
                      <Badge variant="secondary" className={cn("text-xs", specialtyColors[preceptor.specialty] || "bg-gray-100")}>
                        {preceptor.specialty}
                      </Badge>
                    </MobileDataField>
                    <MobileDataField label="Site">
                      <span className="truncate">{preceptor.clinicalSite}</span>
                    </MobileDataField>
                    <MobileDataField label="Students">
                      <span>{preceptor.activeStudents}/{preceptor.maxCapacity}</span>
                    </MobileDataField>
                    <MobileDataField label="Rating">
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 text-yellow-500 fill-current" />
                        {preceptor.rating.toFixed(1)}
                      </div>
                    </MobileDataField>
                  </MobileDataCard>
                ))}
              </div>
              {/* Desktop Table */}
              <ResponsiveTableWrapper className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-b border-border/50">
                      <TableHead>Preceptor</TableHead>
                      <TableHead>Specialty</TableHead>
                      <TableHead>Clinical Site</TableHead>
                      <TableHead>Students</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[70px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPreceptors.map((preceptor) => (
                      <TableRow
                        key={preceptor.id}
                        className="group hover:bg-muted/30 transition-colors duration-200 border-b border-border/50"
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8 ring-2 ring-background group-hover:ring-primary/20 transition-all">
                              <AvatarImage src={`/avatars/${preceptor.id}.jpg`} />
                              <AvatarFallback className="bg-primary/10 text-primary">
                                {preceptor.name
                                  ?.split(" ")
                                  .map((n) => n[0])
                                  .join("") || "P"}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium group-hover:text-primary transition-colors">
                                {preceptor.name || "Unknown"}
                              </div>
                              <div className="text-sm text-muted-foreground">{preceptor.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={cn(
                              specialtyColors[preceptor.specialty] ||
                              "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                            )}
                          >
                            {preceptor.specialty}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building className="h-4 w-4 text-muted-foreground" />
                            {preceptor.clinicalSite}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            {preceptor.activeStudents}/{preceptor.maxCapacity}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Star className="h-4 w-4 text-yellow-500 fill-current" />
                            {preceptor.rating.toFixed(1)}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(preceptor.status)}</TableCell>
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
                              <DropdownMenuItem className="gap-2 cursor-pointer focus:bg-primary/10 focus:text-primary">
                                <Eye className="h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem className="gap-2 cursor-pointer focus:bg-primary/10 focus:text-primary">
                                <Edit className="h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem className="gap-2 cursor-pointer focus:bg-primary/10 focus:text-primary">
                                <Calendar className="h-4 w-4" />
                                Schedule
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ResponsiveTableWrapper>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="faculty" className="space-y-4">
          <Card className="glass-card overflow-hidden">
            <CardHeader>
              <CardTitle>Faculty Members</CardTitle>
              <CardDescription>Manage academic faculty and administrative staff</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {/* Mobile Card View for Faculty */}
              <div className="block md:hidden p-4 space-y-3">
                {filteredFaculty.map((faculty) => (
                  <MobileDataCard key={`mobile-faculty-${faculty.id}`}>
                    <div className="flex items-start justify-between gap-2 pb-2 border-b border-border/30">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {faculty.name?.split(" ").map((n) => n[0]).join("") || "F"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="font-medium truncate">{faculty.name || "Unknown"}</div>
                          <div className="text-muted-foreground text-xs truncate">{faculty.email}</div>
                        </div>
                      </div>
                      {getStatusBadge(faculty.status)}
                    </div>
                    <MobileDataField label="Role">
                      <span>{faculty.role}</span>
                    </MobileDataField>
                    <MobileDataField label="Department">
                      <span className="truncate">{faculty.department}</span>
                    </MobileDataField>
                    <MobileDataField label="Joined">
                      <span>{faculty.joinedDate}</span>
                    </MobileDataField>
                  </MobileDataCard>
                ))}
              </div>
              {/* Desktop Table */}
              <ResponsiveTableWrapper className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-b border-border/50">
                      <TableHead>Faculty Member</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Last Active</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[70px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFaculty.map((faculty) => (
                      <TableRow
                        key={faculty.id}
                        className="group hover:bg-muted/30 transition-colors duration-200 border-b border-border/50"
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8 ring-2 ring-background group-hover:ring-primary/20 transition-all">
                              <AvatarImage src={`/avatars/${faculty.id}.jpg`} />
                              <AvatarFallback className="bg-primary/10 text-primary">
                                {faculty.name
                                  ?.split(" ")
                                  .map((n) => n[0])
                                  .join("") || "F"}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium group-hover:text-primary transition-colors">
                                {faculty.name || "Unknown"}
                              </div>
                              <div className="text-sm text-muted-foreground">{faculty.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-muted-foreground" />
                            {faculty.role}
                          </div>
                        </TableCell>
                        <TableCell>{faculty.department}</TableCell>
                        <TableCell>{faculty.joinedDate}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Activity className="h-4 w-4 text-muted-foreground" />
                            {faculty.lastActive}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(faculty.status)}</TableCell>
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
                              <DropdownMenuItem className="gap-2 cursor-pointer focus:bg-primary/10 focus:text-primary">
                                <Eye className="h-4 w-4" />
                                View Profile
                              </DropdownMenuItem>
                              <DropdownMenuItem className="gap-2 cursor-pointer focus:bg-primary/10 focus:text-primary">
                                <Edit className="h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ResponsiveTableWrapper>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <AddPreceptorModal
        open={showAddPreceptor}
        onOpenChange={setShowAddPreceptor}
        clinicalSites={clinicalSites}
      />
      <AddFacultyModal open={showAddFaculty} onOpenChange={setShowAddFaculty} />
    </div>
  )
}
