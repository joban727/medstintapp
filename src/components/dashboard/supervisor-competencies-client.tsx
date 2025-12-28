"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle, Clock, Target, Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { StatCard, StatGrid } from "@/components/ui/stat-card"
import { EvaluateCompetencyModal } from "@/components/modals/evaluate-competency-modal"

interface Competency {
    id: string
    name: string
    description: string
    category: string
    level: string
    isRequired: boolean
}

interface StudentCompetency {
    assignmentId: string
    studentId: string
    studentName: string | null
    competencyId: string
    competencyName: string
    competencyCategory: string
    competencyLevel: string
    status: string
    progressPercentage: string | null
    dueDate: Date | null
}

interface StudentData {
    studentId: string
    name: string
    programId: string | null
    competencies: StudentCompetency[]
    completedCount: number
    totalCount: number
    availableCompetencies: Competency[]
}

interface SupervisorCompetenciesClientProps {
    students: StudentData[]
    totalAssignments: number
    completedAssignments: number
    inProgressAssignments: number
}

const LEVEL_COLORS: Record<string, string> = {
    FUNDAMENTAL: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    INTERMEDIATE: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    ADVANCED: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    EXPERT: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
}

const STATUS_COLORS: Record<string, string> = {
    ASSIGNED: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
    IN_PROGRESS: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    COMPLETED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    OVERDUE: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    APPROVED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
}

export function SupervisorCompetenciesClient({
    students,
    totalAssignments,
    completedAssignments,
    inProgressAssignments,
}: SupervisorCompetenciesClientProps) {
    const router = useRouter()
    const [evaluateModalOpen, setEvaluateModalOpen] = useState(false)
    const [selectedStudent, setSelectedStudent] = useState<StudentData | null>(null)

    const handleEvaluateClick = (student: StudentData) => {
        setSelectedStudent(student)
        setEvaluateModalOpen(true)
    }

    const handleEvaluationSuccess = () => {
        router.refresh()
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-bold text-3xl tracking-tight">Student Competencies</h1>
                    <p className="text-muted-foreground">
                        Sign off on student competencies as they demonstrate required skills
                    </p>
                </div>
                <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    Clinical Supervisor
                </Badge>
            </div>

            {/* Stats */}
            <StatGrid columns={4}>
                <StatCard
                    title="My Students"
                    value={students.length}
                    icon={Users}
                    variant="blue"
                    description="Under your supervision"
                />
                <StatCard
                    title="Total Competencies"
                    value={totalAssignments}
                    icon={Target}
                    variant="purple"
                    description="Across all students"
                />
                <StatCard
                    title="Signed Off"
                    value={completedAssignments}
                    icon={CheckCircle}
                    variant="green"
                    description="Successfully completed"
                />
                <StatCard
                    title="Pending"
                    value={inProgressAssignments}
                    icon={Clock}
                    variant="orange"
                    description="Awaiting sign off"
                />
            </StatGrid>

            {/* Student Competencies List */}
            <Card>
                <CardHeader>
                    <CardTitle>Student Competency Sign-Off</CardTitle>
                    <CardDescription>
                        Click "Sign Off" when a student has demonstrated a competency
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {students.length === 0 ? (
                        <div className="py-12 text-center">
                            <Target className="mx-auto h-12 w-12 text-muted-foreground" />
                            <h3 className="mt-4 font-semibold text-lg">No Students Assigned</h3>
                            <p className="mt-2 text-muted-foreground">
                                You don't have any students under your supervision yet.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {students.map((student) => (
                                <div key={student.studentId} className="rounded-lg border p-4">
                                    <div className="mb-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                                                <Users className="h-5 w-5 text-primary" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold">{student.name}</h3>
                                                <p className="text-sm text-muted-foreground">
                                                    {student.completedCount} / {student.totalCount || "—"} competencies signed off
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            {student.totalCount > 0 && (
                                                <>
                                                    <div className="text-right">
                                                        <div className="font-semibold">
                                                            {Math.round((student.completedCount / student.totalCount) * 100)}%
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">Complete</div>
                                                    </div>
                                                    <Progress
                                                        value={(student.completedCount / student.totalCount) * 100}
                                                        className="w-32"
                                                    />
                                                </>
                                            )}
                                            <Button
                                                onClick={() => handleEvaluateClick(student)}
                                                size="sm"
                                                className="bg-green-600 hover:bg-green-700"
                                                disabled={student.availableCompetencies.length === 0}
                                            >
                                                <CheckCircle className="mr-2 h-4 w-4" />
                                                Sign Off
                                            </Button>
                                        </div>
                                    </div>

                                    {student.competencies.length > 0 ? (
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Competency</TableHead>
                                                    <TableHead>Category</TableHead>
                                                    <TableHead>Level</TableHead>
                                                    <TableHead>Status</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {student.competencies.slice(0, 5).map((comp) => (
                                                    <TableRow key={comp.assignmentId}>
                                                        <TableCell className="font-medium">
                                                            {comp.competencyName}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline">{comp.competencyCategory}</Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge className={LEVEL_COLORS[comp.competencyLevel] || "bg-gray-100 dark:bg-gray-800"}>
                                                                {comp.competencyLevel}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge className={STATUS_COLORS[comp.status] || "bg-gray-100 dark:bg-gray-800"}>
                                                                {comp.status === "COMPLETED" ? "Signed Off" : "Pending"}
                                                            </Badge>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    ) : (
                                        <div className="py-4 text-center text-muted-foreground text-sm">
                                            No competencies defined for this student's program yet.
                                        </div>
                                    )}

                                    {student.competencies.length > 5 && (
                                        <div className="mt-2 text-center">
                                            <Button variant="link" size="sm">
                                                View all {student.competencies.length} competencies
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Evaluate Competency Modal */}
            {selectedStudent && (
                <EvaluateCompetencyModal
                    studentId={selectedStudent.studentId}
                    studentName={selectedStudent.name}
                    competencies={selectedStudent.availableCompetencies}
                    open={evaluateModalOpen}
                    onOpenChange={setEvaluateModalOpen}
                    onSuccess={handleEvaluationSuccess}
                />
            )}
        </div>
    )
}
