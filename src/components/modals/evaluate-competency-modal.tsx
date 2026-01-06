"use client"

import { CheckCircle, Loader2, Target, X } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { submitCompetencyEvaluation } from "@/app/actions/competency-evaluations"

interface Competency {
  id: string
  name: string
  description: string
  category: string
  level: string
  isRequired: boolean
}

interface EvaluateCompetencyModalProps {
  studentId: string
  studentName: string
  competencies: Competency[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

const LEVELS = [
  { value: "FUNDAMENTAL", label: "Fundamental", color: "bg-blue-100 text-blue-800" },
  { value: "INTERMEDIATE", label: "Intermediate", color: "bg-yellow-100 text-yellow-800" },
  { value: "ADVANCED", label: "Advanced", color: "bg-orange-100 text-orange-800" },
  { value: "EXPERT", label: "Expert", color: "bg-red-100 text-red-800" },
]

export function EvaluateCompetencyModal({
  studentId,
  studentName,
  competencies,
  open,
  onOpenChange,
  onSuccess,
}: EvaluateCompetencyModalProps) {
  const [selectedCompetencyId, setSelectedCompetencyId] = useState<string>("")
  const [feedback, setFeedback] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const selectedCompetency = competencies.find((c) => c.id === selectedCompetencyId)

  const getLevelBadge = (level: string) => {
    const levelConfig = LEVELS.find((l) => l.value === level)
    return levelConfig ? (
      <Badge className={levelConfig.color}>{levelConfig.label}</Badge>
    ) : (
      <Badge variant="secondary">{level}</Badge>
    )
  }

  const handleSubmit = async () => {
    if (!selectedCompetencyId) {
      toast.error("Please select a competency")
      return
    }

    setIsSubmitting(true)

    const result = await submitCompetencyEvaluation({
      studentId,
      competencyId: selectedCompetencyId,
      feedback: feedback || undefined,
      status: "APPROVED",
    })

    if (result.success) {
      toast.success(result.message || "Competency signed off successfully!")
      setSelectedCompetencyId("")
      setFeedback("")
      onOpenChange(false)
      onSuccess()
    } else {
      toast.error(result.error || "Failed to submit evaluation")
    }

    setIsSubmitting(false)
  }

  const handleClose = () => {
    setSelectedCompetencyId("")
    setFeedback("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Sign Off Competency
          </DialogTitle>
          <DialogDescription>
            Confirm that <strong>{studentName}</strong> has demonstrated this competency.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Competency Selection */}
          <div className="space-y-2">
            <Label htmlFor="competency">Select Competency</Label>
            <Select value={selectedCompetencyId} onValueChange={setSelectedCompetencyId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a competency to sign off..." />
              </SelectTrigger>
              <SelectContent>
                {competencies.length === 0 ? (
                  <div className="p-2 text-center text-muted-foreground text-sm">
                    No competencies available
                  </div>
                ) : (
                  competencies.map((comp) => (
                    <SelectItem key={comp.id} value={comp.id}>
                      <div className="flex items-center gap-2">
                        <span>{comp.name}</span>
                        {comp.isRequired && (
                          <Badge variant="outline" className="text-xs">
                            Required
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Selected Competency Details */}
          {selectedCompetency && (
            <div className="rounded-lg border p-3 bg-muted/50">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-medium">{selectedCompetency.name}</h4>
                {getLevelBadge(selectedCompetency.level)}
              </div>
              <p className="text-sm text-muted-foreground mb-2">{selectedCompetency.description}</p>
              <div className="flex gap-2">
                <Badge variant="outline">{selectedCompetency.category}</Badge>
                {selectedCompetency.isRequired && (
                  <Badge className="bg-green-100 text-green-800">Required</Badge>
                )}
              </div>
            </div>
          )}

          {/* Feedback (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="feedback">Feedback (Optional)</Label>
            <Textarea
              id="feedback"
              placeholder="Add any notes or feedback about the student's performance..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedCompetencyId || isSubmitting}
            className="bg-green-600 hover:bg-green-700"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Sign Off Competency
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
