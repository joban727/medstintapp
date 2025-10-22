"use client"

import {
  BookOpen,
  Clock,
  Filter,
  GraduationCap,
  MoreHorizontal,
  Plus,
  Search,
  Target,
  Users,
} from "lucide-react"
import { useState } from "react"
import { CreateProgramModal } from "@/components/modals/create-program-modal"
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

interface Program {
  id: string
  name: string
  description: string
  duration: number | null
  classYear: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date | null
  studentCount: number
}

interface ProgramStats {
  totalPrograms: number
  activePrograms: number
  totalStudents: number
  avgStudentsPerProgram: number
}

interface ProgramsClientProps {
  initialPrograms: Program[]
  initialStats: ProgramStats
  schoolId: string
}

export function ProgramsClient({ initialPrograms, initialStats, schoolId }: ProgramsClientProps) {
  const [programs, setPrograms] = useState<Program[]>(initialPrograms)
  const [stats, setStats] = useState<ProgramStats>(initialStats)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const refreshPrograms = async () => {
    setIsRefreshing(true)
    try {
      const response = await fetch(`/api/programs?schoolId=${schoolId}&includeStats=true`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          const programsWithStats = data.data.map((program: Program & { stats?: { totalStudents?: number } }) => ({
            ...program,
            studentCount: program.stats?.totalStudents || 0,
          }))
          setPrograms(programsWithStats)

          // Recalculate stats
          const newStats = {
            totalPrograms: programsWithStats.length,
            activePrograms: programsWithStats.filter((p: Program) => p.isActive).length,
            totalStudents: programsWithStats.reduce(
              (sum: number, p: Program) => sum + p.studentCount,
              0
            ),
            avgStudentsPerProgram:
              programsWithStats.length > 0
                ? Math.round(
                    programsWithStats.reduce((sum: number, p: Program) => sum + p.studentCount, 0) /
                      programsWithStats.length
                  )
                : 0,
          }
          setStats(newStats)
        }
      }
    } catch (_error) {
      // Error refreshing programs
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleCreateSuccess = () => {
    refreshPrograms()
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl text-gray-900">Academic Programs</h1>
          <p className="mt-1 text-gray-600">Manage your school's academic programs and curricula</p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Program
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Total Programs</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{stats.totalPrograms}</div>
            <p className="text-muted-foreground text-xs">All programs</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Active Programs</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{stats.activePrograms}</div>
            <p className="text-muted-foreground text-xs">Currently running</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Enrolled Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{stats.totalStudents}</div>
            <p className="text-muted-foreground text-xs">Across all programs</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Avg Students</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{stats.avgStudentsPerProgram}</div>
            <p className="text-muted-foreground text-xs">Students per program</p>
          </CardContent>
        </Card>
      </div>

      {/* Programs Management */}
      <Card>
        <CardHeader>
          <CardTitle>Program Directory</CardTitle>
          <CardDescription>
            Manage your academic programs, curricula, and requirements
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search and Filter */}
          <div className="mb-6 flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-3 h-4 w-4 text-gray-400" />
              <Input placeholder="Search programs..." className="pl-10" />
            </div>
            <Select>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Programs</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Filter className="mr-2 h-4 w-4" />
              More Filters
            </Button>
            <Button variant="outline" onClick={refreshPrograms} disabled={isRefreshing}>
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </Button>
          </div>

          {/* Programs Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Program Name</TableHead>
                <TableHead>Class Year</TableHead>
                <TableHead>Enrolled Students</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {programs.map((program) => (
                <TableRow key={program.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{program.name}</div>
                      <div className="max-w-xs truncate text-gray-500 text-sm">
                        {program.description}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <GraduationCap className="mr-1 h-4 w-4 text-gray-400" />
                      <span>Class of {program.classYear}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Users className="mr-1 h-4 w-4 text-gray-400" />
                      <span>{program.studentCount} students</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={program.isActive ? "default" : "secondary"}>
                      {program.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-gray-500 text-sm">
                      {program.updatedAt
                        ? new Date(program.updatedAt).toLocaleDateString()
                        : "Never"}
                    </span>
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
                        <DropdownMenuItem>Edit Program</DropdownMenuItem>
                        <DropdownMenuItem>Manage Curriculum</DropdownMenuItem>
                        <DropdownMenuItem>View Students</DropdownMenuItem>
                        <DropdownMenuItem>Export Data</DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600">
                          {program.isActive ? "Deactivate" : "Delete"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {programs.length === 0 && (
            <div className="py-12 text-center">
              <GraduationCap className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 font-medium text-gray-900 text-sm">No programs found</h3>
              <p className="mt-1 text-gray-500 text-sm">
                Get started by creating your first academic program.
              </p>
              <div className="mt-6">
                <Button onClick={() => setIsCreateModalOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Program
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Program Modal */}
      <CreateProgramModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onSuccess={handleCreateSuccess}
        schoolId={schoolId}
      />
    </div>
  )
}
