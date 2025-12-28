"use client"

import {
  BookOpen,
  Clock,
  Edit,
  Filter,
  FolderKanban,
  GraduationCap,
  MoreHorizontal,
  Plus,
  Search,
  Target,
  Users,
} from "lucide-react"
import { PageContainer, PageHeader } from "@/components/ui/page-container"
import { StatCard, StatGrid } from "@/components/ui/stat-card"
import {
  MobileDataCard,
  MobileDataField,
  ResponsiveTableWrapper,
} from "@/components/ui/responsive-table"
import { useState } from "react"
import { CreateProgramModal } from "@/components/modals/create-program-modal"
import { ManageCohortsModal } from "@/components/modals/manage-cohorts-modal"
import { ManageCompetenciesModal } from "@/components/modals/manage-competencies-modal"
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
  cohortCount: number
}

interface ProgramStats {
  totalPrograms: number
  activePrograms: number
  totalStudents: number
  totalCohorts: number
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
  const [isManageCohortsModalOpen, setIsManageCohortsModalOpen] = useState(false)
  const [isManageCompetenciesModalOpen, setIsManageCompetenciesModalOpen] = useState(false)
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const refreshPrograms = async () => {
    setIsRefreshing(true)
    try {
      const response = await fetch(`/api/programs?schoolId=${schoolId}&includeStats=true`)
      if (response.ok) {
        const data = await response.json().catch((err) => {
          console.error("Failed to parse JSON response:", err)
          throw new Error("Invalid response format")
        })
        if (data.success) {
          const programsWithStats = data.data.map(
            (program: Program & { stats?: { totalStudents?: number; totalCohorts?: number } }) => ({
              ...program,
              studentCount: program.stats?.totalStudents || 0,
              cohortCount: program.stats?.totalCohorts || 0,
            })
          )
          setPrograms(programsWithStats)
          // Recalculate stats
          const newStats = {
            totalPrograms: programsWithStats.length,
            activePrograms: programsWithStats.filter((p: Program) => p.isActive).length,
            totalStudents: programsWithStats.reduce(
              (sum: number, p: Program) => sum + p.studentCount,
              0
            ),
            totalCohorts: programsWithStats.reduce(
              (sum: number, p: Program) => sum + p.cohortCount,
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
    <PageContainer>
      <PageHeader
        title="Academic Programs"
        description="Manage your school's academic programs and curricula"
      >
        <Button
          onClick={() => setIsCreateModalOpen(true)}
          className="shadow-lg hover:shadow-primary/20 transition-all"
          disabled={!schoolId}
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Program
        </Button>
      </PageHeader>

      {/* Setup Required Banner */}
      {!schoolId && (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/50 mb-6">
          <CardContent className="flex items-center gap-4 py-4">
            <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900">
              <BookOpen className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-amber-800 dark:text-amber-200">School Setup Required</p>
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Complete the school setup wizard to create and manage programs.
              </p>
            </div>
            <Button asChild variant="outline" className="border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900">
              <a href="/dashboard/school-admin/setup">Go to Setup</a>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <StatGrid columns={4}>
        <StatCard
          title="Total Programs"
          value={stats.totalPrograms}
          description="All programs"
          icon={BookOpen}
          variant="blue"
        />
        <StatCard
          title="Total Cohorts"
          value={stats.totalCohorts}
          description="Click program cohorts to manage"
          icon={FolderKanban}
          variant="green"
        />
        <StatCard
          title="Enrolled Students"
          value={stats.totalStudents}
          description="Across all programs"
          icon={Users}
          variant="purple"
        />
        <StatCard
          title="Avg Students"
          value={stats.avgStudentsPerProgram}
          description="Students per program"
          icon={Clock}
          variant="orange"
        />      </StatGrid>

      {/* Programs Management */}
      <Card className="glass-card overflow-hidden">
        <CardHeader>
          <CardTitle>Program Directory</CardTitle>
          <CardDescription>
            Manage your academic programs, curricula, and requirements
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {/* Search and Filter */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center p-6 glass-card-subtle mx-6 mb-6 rounded-lg">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search programs..."
                aria-label="Search programs..."
                className="pl-10 bg-background/50 backdrop-blur-sm"
              />
            </div>
            <Select aria-label="Filter by status">
              <SelectTrigger className="w-48 bg-background/50 backdrop-blur-sm">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Programs</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="bg-background/50 backdrop-blur-sm">
              <Filter className="mr-2 h-4 w-4" />
              More Filters
            </Button>
            <Button
              variant="outline"
              onClick={refreshPrograms}
              disabled={isRefreshing}
              className="bg-background/50 backdrop-blur-sm"
            >
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </Button>
          </div>

          {/* Mobile Card View */}
          <div className="block md:hidden p-4 space-y-3">
            {programs.map((program) => (
              <MobileDataCard key={`mobile-${program.id}`}>
                <div className="flex items-start justify-between gap-2 pb-2 border-b border-border/30">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{program.name}</div>
                    <div className="text-muted-foreground text-xs truncate">
                      {program.description}
                    </div>
                  </div>
                  <Badge
                    className={cn(
                      "shrink-0",
                      program.isActive
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                    )}
                  >
                    {program.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <MobileDataField label="Class Year">
                  <span>Class of {program.classYear}</span>
                </MobileDataField>
                <MobileDataField label="Cohorts">
                  <span>{program.cohortCount} cohorts</span>
                </MobileDataField>
                <MobileDataField label="Students">
                  <span>{program.studentCount} students</span>
                </MobileDataField>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" className="flex-1 min-h-[44px]" onClick={() => {
                    setSelectedProgram(program)
                    setIsManageCohortsModalOpen(true)
                  }}>
                    <BookOpen className="h-4 w-4 mr-1" /> Cohorts
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 min-h-[44px]">
                    <Edit className="h-4 w-4 mr-1" /> Edit
                  </Button>
                </div>
              </MobileDataCard>
            ))}
          </div>

          {/* Desktop Table View */}
          <ResponsiveTableWrapper className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-border/50">
                  <TableHead>Program Name</TableHead>
                  <TableHead>Class Year</TableHead>
                  <TableHead>Cohorts</TableHead>
                  <TableHead>Enrolled Students</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {programs.map((program) => (
                  <TableRow
                    key={program.id}
                    className="group hover:bg-muted/30 transition-colors duration-200 border-b border-border/50"
                  >
                    <TableCell>
                      <div>
                        <div className="font-medium group-hover:text-primary transition-colors">
                          {program.name}
                        </div>
                        <div className="max-w-xs truncate text-muted-foreground text-sm">
                          {program.description}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <GraduationCap className="mr-1 h-4 w-4 text-muted-foreground" />
                        <span>Class of {program.classYear}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex items-center gap-1 hover:bg-primary/10 hover:text-primary -ml-2 px-2"
                        onClick={() => {
                          setSelectedProgram(program)
                          setIsManageCohortsModalOpen(true)
                        }}
                      >
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{program.cohortCount} cohorts</span>
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Users className="mr-1 h-4 w-4 text-muted-foreground" />
                        <span>{program.studentCount} students</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={program.isActive ? "default" : "secondary"}
                        className={
                          program.isActive
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200"
                        }
                      >
                        {program.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground text-sm">
                        {program.updatedAt
                          ? new Date(program.updatedAt).toLocaleDateString()
                          : "Never"}
                      </span>
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
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer focus:bg-primary/10 focus:text-primary">
                            Edit Program
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer focus:bg-primary/10 focus:text-primary">
                            Manage Curriculum
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="cursor-pointer focus:bg-primary/10 focus:text-primary"
                            onClick={() => {
                              setSelectedProgram(program)
                              setIsManageCohortsModalOpen(true)
                            }}
                          >
                            Manage Cohorts
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="cursor-pointer focus:bg-primary/10 focus:text-primary"
                            onClick={() => {
                              setSelectedProgram(program)
                              setIsManageCompetenciesModalOpen(true)
                            }}
                          >
                            Manage Competencies
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer focus:bg-primary/10 focus:text-primary">
                            View Students
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer focus:bg-primary/10 focus:text-primary">
                            Export Data
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600 focus:text-red-700 focus:bg-red-50 dark:focus:bg-red-900/20 cursor-pointer">
                            {program.isActive ? "Deactivate" : "Delete"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ResponsiveTableWrapper>

          {programs.length === 0 && (
            <div className="py-12 text-center">
              <GraduationCap className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 font-medium text-foreground text-sm">No programs found</h3>
              <p className="mt-1 text-muted-foreground text-sm">
                Get started by creating your first academic program.
              </p>
              <div className="mt-6">
                <Button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="shadow-lg hover:shadow-primary/20 transition-all"
                >
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

      <ManageCohortsModal
        open={isManageCohortsModalOpen}
        onOpenChange={setIsManageCohortsModalOpen}
        programId={selectedProgram?.id || null}
        programName={selectedProgram?.name || ""}
      />

      <ManageCompetenciesModal
        open={isManageCompetenciesModalOpen}
        onOpenChange={setIsManageCompetenciesModalOpen}
        programId={selectedProgram?.id || null}
        programName={selectedProgram?.name || ""}
      />
    </PageContainer>
  )
}
