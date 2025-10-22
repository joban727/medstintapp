"use client"

import { AlertCircle, CheckCircle, Clock, Save, Star, X } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Progress } from "../ui/progress"
import { RadioGroup, RadioGroupItem } from "../ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Textarea } from "../ui/textarea"
import { toast } from "sonner"

interface RubricLevel {
  id: string
  name: string
  description: string
  points: number
}

interface RubricCriterion {
  id: string
  name: string
  description: string
  weight: number
  levels: RubricLevel[]
}

interface CompetencyAssignment {
  id: string
  studentId: string
  competencyId: string
  dueDate: string
  status: string
  priority: string
  student: {
    name: string
    email: string
    program: string
  }
  competency: {
    name: string
    description: string
    category: string
    maxScore: number
    rubric?: RubricCriterion[]
  }
  submission?: {
    id: string
    submittedAt: string
    evidence: string
    selfAssessment: string
  }
}

interface EvaluationFormData {
  criterionScores: Record<string, number>
  overallScore: number
  feedback: string
  status: "approved" | "needs_revision" | "incomplete"
  recommendations: string
}

interface CompetencyEvaluationFormProps {
  assignment: CompetencyAssignment | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  evaluatorId: string
}

export function CompetencyEvaluationForm({
  assignment,
  isOpen,
  onClose,
  onSuccess,
  evaluatorId,
}: CompetencyEvaluationFormProps) {
  const [formData, setFormData] = useState<EvaluationFormData>({
    criterionScores: {},
    overallScore: 0,
    feedback: "",
    status: "approved",
    recommendations: "",
  })
  const [submitting, setSubmitting] = useState(false)

  // Calculate overall score based on criterion scores and weights
  const calculateOverallScore = useCallback((scores: Record<string, number>) => {
    if (!assignment?.competency.rubric || Object.keys(scores).length === 0) return 0

    const totalWeight = assignment.competency.rubric.reduce((sum, criterion) => sum + criterion.weight, 0)
    const weightedScore = assignment.competency.rubric.reduce((sum, criterion) => {
      const score = scores[criterion.id] || 0
      return sum + (score * criterion.weight)
    }, 0)

    return totalWeight > 0 ? Math.round((weightedScore / totalWeight) * 100) / 100 : 0
  }, [assignment])

  // Update overall score when criterion scores change
  useEffect(() => {
    const newOverallScore = calculateOverallScore(formData.criterionScores)
    setFormData(prev => ({ ...prev, overallScore: newOverallScore }))
  }, [formData.criterionScores, calculateOverallScore])

  // Reset form when assignment changes
  useEffect(() => {
    if (assignment) {
      setFormData({
        criterionScores: {},
        overallScore: 0,
        feedback: "",
        status: "approved",
        recommendations: "",
      })
    }
  }, [assignment])

  const handleCriterionScoreChange = (criterionId: string, score: number) => {
    setFormData(prev => ({
      ...prev,
      criterionScores: {
        ...prev.criterionScores,
        [criterionId]: score,
      },
    }))
  }

  const handleSubmit = async () => {
    if (!assignment) return

    // Validate that all criteria have been scored
    const requiredCriteria = assignment.competency.rubric || []
    const missingScores = requiredCriteria.filter(
      criterion => !(criterion.id in formData.criterionScores)
    )

    if (missingScores.length > 0) {
      toast.error(`Please score all criteria: ${missingScores.map(c => c.name).join(", ")}`)
      return
    }

    if (!formData.feedback.trim()) {
      toast.error("Please provide feedback for the student")
      return
    }

    try {
      setSubmitting(true)

      const response = await fetch("/api/competency-evaluations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assignmentId: assignment.id,
          evaluatorId,
          criterionScores: formData.criterionScores,
          overallScore: formData.overallScore,
          feedback: formData.feedback,
          status: formData.status,
          recommendations: formData.recommendations,
          evaluationDate: new Date().toISOString(),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to submit evaluation")
      }

      toast.success("Evaluation submitted successfully")
      onSuccess()
      onClose()
    } catch (error) {
      console.error("Failed to submit evaluation:", error)
      toast.error(error instanceof Error ? error.message : "Failed to submit evaluation")
    } finally {
      setSubmitting(false)
    }
  }

  if (!assignment) return null

  const { competency, student, submission } = assignment
  const rubric = competency.rubric || []
  const completedCriteria = Object.keys(formData.criterionScores).length
  const totalCriteria = rubric.length
  const progressPercentage = totalCriteria > 0 ? (completedCriteria / totalCriteria) * 100 : 0

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Evaluate Competency</DialogTitle>
          <DialogDescription>
            Assess student performance using the competency rubric
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Assignment Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{competency.name}</CardTitle>
              <CardDescription>
                Student: {student.name} • {student.program}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Badge variant="secondary">{competency.category}</Badge>
                  <Badge variant={assignment.priority === "high" ? "destructive" : "outline"}>
                    {assignment.priority} priority
                  </Badge>
                  <Badge variant={submission ? "default" : "secondary"}>
                    {submission ? "Submitted" : "Not Submitted"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{competency.description}</p>
                {submission && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Student Submission</h4>
                    <p className="text-sm bg-muted p-3 rounded">{submission.evidence}</p>
                    {submission.selfAssessment && (
                      <div>
                        <h5 className="font-medium text-sm">Self-Assessment</h5>
                        <p className="text-sm bg-muted p-3 rounded">{submission.selfAssessment}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Evaluation Progress */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Evaluation Progress</span>
                  <span className="text-sm text-muted-foreground">
                    {completedCriteria} of {totalCriteria} criteria scored
                  </span>
                </div>
                <Progress value={progressPercentage} className="h-2" />
              </div>
            </CardContent>
          </Card>

          {/* Rubric Evaluation */}
          {rubric.length > 0 ? (
            <div className="space-y-4">
              <h3 className="font-semibold">Competency Rubric</h3>
              {rubric.map((criterion) => (
                <Card key={criterion.id}>
                  <CardHeader>
                    <CardTitle className="text-base">{criterion.name}</CardTitle>
                    <CardDescription>
                      {criterion.description} • Weight: {criterion.weight}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <RadioGroup
                      value={formData.criterionScores[criterion.id]?.toString() || ""}
                      onValueChange={(value) => 
                        handleCriterionScoreChange(criterion.id, Number.parseInt(value))
                      }
                    >
                      <div className="grid gap-3">
                        {criterion.levels.map((level) => (
                          <div key={level.id} className="flex items-start space-x-2">
                            <RadioGroupItem value={level.points.toString()} id={level.id} />
                            <div className="flex-1">
                              <Label htmlFor={level.id} className="font-medium">
                                {level.name} ({level.points} points)
                              </Label>
                              <p className="text-sm text-muted-foreground mt-1">
                                {level.description}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </RadioGroup>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <Label htmlFor="overallScore">Overall Score (0-{competency.maxScore})</Label>
                  <Input
                    id="overallScore"
                    type="number"
                    min="0"
                    max={competency.maxScore}
                    value={formData.overallScore}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      overallScore: Number.parseFloat(e.target.value) || 0 
                    }))}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Overall Score Display */}
          {rubric.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Calculated Overall Score:</span>
                  <div className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-yellow-500" />
                    <span className="text-lg font-bold">{formData.overallScore}</span>
                    <span className="text-muted-foreground">/ {competency.maxScore}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Evaluation Status */}
          <div className="space-y-2">
            <Label>Evaluation Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value: "approved" | "needs_revision" | "incomplete") =>
                setFormData(prev => ({ ...prev, status: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="approved">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Approved
                  </div>
                </SelectItem>
                <SelectItem value="needs_revision">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                    Needs Revision
                  </div>
                </SelectItem>
                <SelectItem value="incomplete">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    Incomplete
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Feedback */}
          <div className="space-y-2">
            <Label htmlFor="feedback">Feedback *</Label>
            <Textarea
              id="feedback"
              placeholder="Provide detailed feedback on the student's performance..."
              value={formData.feedback}
              onChange={(e) => setFormData(prev => ({ ...prev, feedback: e.target.value }))}
              rows={4}
              required
            />
          </div>

          {/* Recommendations */}
          <div className="space-y-2">
            <Label htmlFor="recommendations">Recommendations for Improvement</Label>
            <Textarea
              id="recommendations"
              placeholder="Suggest specific areas for improvement or next steps..."
              value={formData.recommendations}
              onChange={(e) => setFormData(prev => ({ ...prev, recommendations: e.target.value }))}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Submitting..." : "Submit Evaluation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}