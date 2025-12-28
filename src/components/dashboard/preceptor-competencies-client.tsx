"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Award, CheckCircle, Clock, Target, Users, FileText } from "lucide-react"

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
import { CompetencyEvaluationForm } from "@/components/competency/competency-evaluation-form"
import { toast } from "sonner"

interface Competency {
    id: string
    name: string
    description: string
    category: string
    level: string
    isRequired: boolean
}

interface StudentCompetency {
    assignmentId?: string
    studentId: string
    studentName: string | null
    studentEmail: string
    competencyId: string
    competencyName: string
    competencyDescription: string
    competencyCategory: string
    competencyLevel: string
    competencyRubric: any
    competencyMaxScore: number
    status: string
    progressPercentage: string | null
    dueDate: Date | null
}

interface StudentData {
    studentId: string
    name: string
    email: string
    programId: string | null
    competencies: StudentCompetency[]
    completedCount: number
    totalCount: number
    availableCompetencies: Competency[]
}

interface PreceptorCompetenciesClientProps {
    userId: string
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

export function PreceptorCompetenciesClient({
    userId,
    students,
    totalAssignments,
    completedAssignments,
    inProgressAssignments,
}: PreceptorCompetenciesClientProps) {
    const router = useRouter()
    const [evaluateModalOpen, setEvaluateModalOpen] = useState(false)
    const [detailedEvaluationOpen, setDetailedEvaluationOpen] = useState(false)
    const [selectedStudent, setSelectedStudent] = useState<StudentData | null>(null)
    const [selectedAssignment, setSelectedAssignment] = useState<any | null>(null)

    const handleEvaluateClick = (student: StudentData) => {
        setSelectedStudent(student)
        setEvaluateModalOpen(true)
    }

    const handleDetailedEvaluationClick = (competency: StudentCompetency) => {
        if (!competency.assignmentId) {
            toast.error("This competency has not been assigned yet.")
            return
        }

        // Map to CompetencyAssignment format expected by the form
        const assignment = {
            id: competency.assignmentId,
            studentId: competency.studentId,
            competencyId: competency.competencyId,
            dueDate: competency.dueDate ? new Date(competency.dueDate).toISOString() : new Date().toISOString(),
            status: competency.status,
            priority: "medium", // Default
            student: {
                name: competency.studentName || "Unknown",
                email: competency.studentEmail,
                program: "Medical Program", // Placeholder
            },
            competency: {
                name: competency.competencyName,
                description: competency.competencyDescription,
                category: competency.competencyCategory,
                maxScore: competency.competencyMaxScore,
                rubric: competency.competencyRubric,
            },
            // Submission details would go here if we fetched them
        }

        setSelectedAssignment(assignment)
        setDetailedEvaluationOpen(true)
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
                        Track and evaluate competency progress for your assigned students
                    </p>
                </div>
                <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                    Clinical Preceptor
                </Badge>
            </div>

            {/* Stats */}
            <StatGrid columns={4}>
                <StatCard
                    title="My Students"
                    value={students.length}
                    icon={Users}
                    variant="blue"
                    description="Assigned to you"
                />
                <StatCard
                    title="Total Competencies"
                    value={totalAssignments}
                    icon={Target}
                    variant="purple"
                    description="Across all students"
                />
                <StatCard
                    title="Completed"
                    value={completedAssignments}
                    icon={CheckCircle}
                    variant="green"
                    description="Successfully achieved"
                />
                <StatCard
                    title="In Progress"
                    value={inProgressAssignments}
                    icon={Clock}
                    variant="orange"
                    description="Currently working on"
                />
            </StatGrid>

            {/* Student Competencies List */}
            <Card>
                <CardHeader>
                    <CardTitle>Student Competency Progress</CardTitle>
                    <CardDescription>
                        View and evaluate competency progress for each of your assigned students
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {students.length === 0 ? (
                        <div className="py-12 text-center">
                            <Target className="mx-auto h-12 w-12 text-muted-foreground" />
                            <h3 className="mt-4 font-semibold text-lg">No Students Assigned</h3>
                            <p className="mt-2 text-muted-foreground">
                                You don't have any students assigned to you yet.
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
                                                    {student.completedCount} / {student.totalCount || "—"} competencies completed
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
                                                        <div className="text-xs text-muted-foreground">Progress</div>
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
                                            >
                                                <CheckCircle className="mr-2 h-4 w-4" />
                                                Quick Sign Off
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
                                                    <TableHead>Progress</TableHead>
                                                    <TableHead className="text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {student.competencies.slice(0, 5).map((comp) => (
                                                    <TableRow key={comp.competencyId}>
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
                                                                {comp.status.replace("_", " ")}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-2">
                                                                <Progress
                                                                    value={parseFloat(comp.progressPercentage || "0")}
                                                                    className="w-20"
                                                                />
                                                                <span className="text-sm text-muted-foreground">
                                                                    {Math.round(parseFloat(comp.progressPercentage || "0"))}%
                                                                </span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleDetailedEvaluationClick(comp)}
                                                                disabled={!comp.assignmentId}
                                                            >
                                                                <FileText className="h-4 w-4 mr-2" />
                                                                Evaluate
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    ) : (
                                        <div className="py-4 text-center text-muted-foreground text-sm">
                                            No competency assignments yet. Use "Sign Off" to record completed competencies.
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

            {/* Quick Sign Off Modal */}
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

            {/* Detailed Evaluation Modal */}
            {selectedAssignment && (
                <CompetencyEvaluationForm
                    assignment={selectedAssignment}
                    isOpen={detailedEvaluationOpen}
                    onClose={() => setDetailedEvaluationOpen(false)}
                    onSuccess={handleEvaluationSuccess}
                    evaluatorId={userId}
                />
            )}
        </div>
    )
}
