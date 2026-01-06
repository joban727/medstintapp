"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, Plus, Trash2, Mail } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface StaffInviteFormProps {
  programs: any[]
  cohorts: any[]
  onInvite: (emails: string[], role: string, programId: string, cohortId: string) => Promise<void>
  onSkip?: () => void
  isSubmitting: boolean
}

export function StaffInviteForm({
  programs,
  cohorts,
  onInvite,
  onSkip,
  isSubmitting,
}: StaffInviteFormProps) {
  const [emails, setEmails] = useState<string[]>([])
  const [currentEmail, setCurrentEmail] = useState("")
  const [selectedRole, setSelectedRole] = useState<string>("CLINICAL_PRECEPTOR")
  const [selectedProgram, setSelectedProgram] = useState<string>("")
  const [selectedCohort, setSelectedCohort] = useState<string>("")

  const handleAddEmail = () => {
    if (currentEmail && currentEmail.includes("@") && !emails.includes(currentEmail)) {
      setEmails([...emails, currentEmail])
      setCurrentEmail("")
    }
  }

  const handleRemoveEmail = (email: string) => {
    setEmails(emails.filter((e) => e !== email))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      handleAddEmail()
    }
  }

  const handleSubmit = async () => {
    if (emails.length === 0 || !selectedProgram || !selectedCohort) return
    await onInvite(emails, selectedRole, selectedProgram, selectedCohort)
    setEmails([])
  }

  // Filter cohorts based on selected program
  const filteredCohorts = cohorts.filter((c) => c.programId === selectedProgram)

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="role">Role</Label>
          <Select value={selectedRole} onValueChange={setSelectedRole}>
            <SelectTrigger id="role">
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CLINICAL_PRECEPTOR">Clinical Preceptor</SelectItem>
              <SelectItem value="CLINICAL_SUPERVISOR">Clinical Supervisor</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="program">Program</Label>
          <Select value={selectedProgram} onValueChange={setSelectedProgram}>
            <SelectTrigger id="program">
              <SelectValue placeholder="Select program" />
            </SelectTrigger>
            <SelectContent>
              {programs.map((program) => (
                <SelectItem key={program.id} value={program.id}>
                  {program.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cohort">Cohort</Label>
          <Select
            value={selectedCohort}
            onValueChange={setSelectedCohort}
            disabled={!selectedProgram}
          >
            <SelectTrigger id="cohort">
              <SelectValue placeholder="Select cohort" />
            </SelectTrigger>
            <SelectContent>
              {filteredCohorts.map((cohort) => (
                <SelectItem key={cohort.id} value={cohort.id}>
                  {cohort.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email-input">Email Addresses</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="email-input"
              placeholder="Enter email address and press Enter"
              value={currentEmail}
              onChange={(e) => setCurrentEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-9"
            />
          </div>
          <Button onClick={handleAddEmail} type="button" variant="secondary">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Press Enter or comma to add multiple emails.
        </p>
      </div>

      {emails.length > 0 && (
        <div className="flex flex-wrap gap-2 p-4 border rounded-md bg-muted/20">
          {emails.map((email) => (
            <Badge
              key={email}
              variant="secondary"
              className="pl-2 pr-1 py-1 flex items-center gap-1"
            >
              {email}
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 ml-1 hover:bg-destructive/20 hover:text-destructive rounded-full"
                onClick={() => handleRemoveEmail(email)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4">
        {onSkip && (
          <Button
            variant="outline"
            onClick={onSkip}
            className="hover:bg-primary/10 hover:text-primary"
          >
            Skip
          </Button>
        )}
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || emails.length === 0 || !selectedProgram || !selectedCohort}
          className="shadow-lg hover:shadow-primary/20 transition-all"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending Invites...
            </>
          ) : (
            <>
              Send {emails.length > 0 ? `${emails.length} ` : ""}Invites
              <Mail className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
