"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Send, AlertCircle, X, Mail, Plus } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { GlassCard } from "@/components/ui/glass-card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

import { CreateCohortDialog } from "./create-cohort-dialog"

interface StudentInviteFormProps {
  programs: { id: string; name: string }[]
  cohorts: { id: string; name: string; programId: string }[]
  onInvite: (emails: string[], programId: string, cohortId: string) => Promise<void>
  onSkip: () => void
  isSubmitting: boolean
  onCohortCreated?: (cohort: any) => void
}

export function StudentInviteForm({
  programs,
  cohorts,
  onInvite,
  onSkip,
  isSubmitting,
  onCohortCreated,
}: StudentInviteFormProps) {
  const [emailInput, setEmailInput] = useState("")
  const [emails, setEmails] = useState<string[]>([])
  const [selectedProgram, setSelectedProgram] = useState("")
  const [selectedCohort, setSelectedCohort] = useState("")
  const [validationError, setValidationError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filteredCohorts = cohorts.filter((c) => c.programId === selectedProgram)

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  const addEmails = (input: string) => {
    const newEmails = input
      .split(/[\n, ]/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0)

    if (newEmails.length === 0) return

    // Filter out duplicates
    const uniqueNewEmails = newEmails.filter((e) => !emails.includes(e))

    if (uniqueNewEmails.length > 0) {
      setEmails([...emails, ...uniqueNewEmails])
      setEmailInput("")
      setValidationError(null)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (["Enter", ",", " "].includes(e.key)) {
      e.preventDefault()
      addEmails(emailInput)
    } else if (e.key === "Backspace" && emailInput === "" && emails.length > 0) {
      // Remove last email on backspace if input is empty
      const newEmails = [...emails]
      newEmails.pop()
      setEmails(newEmails)
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData("text")
    addEmails(pastedData)
  }

  const removeEmail = (emailToRemove: string) => {
    setEmails(emails.filter((e) => e !== emailToRemove))
  }

  const handleSubmit = () => {
    setValidationError(null)

    if (!selectedProgram) {
      setValidationError("Please select a program.")
      return
    }
    if (!selectedCohort) {
      setValidationError("Please select a cohort.")
      return
    }

    if (emails.length === 0 && !emailInput) {
      setValidationError("Please add at least one email address.")
      return
    }

    // Add any remaining input as an email
    if (emailInput) {
      addEmails(emailInput)
      // We need to wait for state update or pass the combined list
      // For simplicity, let's just add it to our local validation check
      const currentInputEmail = emailInput.trim()
      if (currentInputEmail && !validateEmail(currentInputEmail)) {
        setValidationError(`Invalid email format: ${currentInputEmail}`)
        return
      }
      // If valid, we'll proceed with it included (conceptually), but since state update is async,
      // let's just require the user to hit enter first or handle it carefully.
      // Better UX: Try to add it, if invalid stop.
      if (
        currentInputEmail &&
        validateEmail(currentInputEmail) &&
        !emails.includes(currentInputEmail)
      ) {
        // Proceed with this email included
        const finalEmails = [...emails, currentInputEmail]
        onInvite(finalEmails, selectedProgram, selectedCohort)
        return
      }
    }

    const invalidEmails = emails.filter((e) => !validateEmail(e))
    if (invalidEmails.length > 0) {
      setValidationError(`Invalid email format: ${invalidEmails.join(", ")}`)
      return
    }

    onInvite(emails, selectedProgram, selectedCohort)
  }

  return (
    <GlassCard className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Mail className="h-6 w-6" />
          </div>
          <div>
            <CardTitle>Invite Students</CardTitle>
            <CardDescription>
              Send invitations to your students. They will be automatically enrolled in the selected
              cohort.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="program">Program</Label>
            <Select
              value={selectedProgram}
              onValueChange={(val) => {
                setSelectedProgram(val)
                setSelectedCohort("")
              }}
            >
              <SelectTrigger id="program" className="bg-muted/50 dark:bg-white/5 border-border dark:border-white/10">
                <SelectValue placeholder="Select a program" />
              </SelectTrigger>
              <SelectContent>
                {programs.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cohort">Cohort</Label>
            <div className="flex gap-2">
              <Select
                value={selectedCohort}
                onValueChange={setSelectedCohort}
                disabled={!selectedProgram}
              >
                <SelectTrigger id="cohort" className="bg-muted/50 dark:bg-white/5 border-border dark:border-white/10 flex-1">
                  <SelectValue placeholder="Select a cohort" />
                </SelectTrigger>
                <SelectContent>
                  {filteredCohorts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {onCohortCreated && (
                <CreateCohortDialog
                  programId={selectedProgram}
                  onCohortCreated={(cohort) => {
                    onCohortCreated(cohort)
                    setSelectedCohort(cohort.id)
                  }}
                />
              )}
            </div>
            {selectedProgram && filteredCohorts.length === 0 && (
              <p className="text-xs text-amber-500 flex items-center gap-1 mt-1">
                <AlertCircle className="h-3 w-3" />
                No cohorts found for this program. Create one to continue.
              </p>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <Label>Student Emails</Label>
          <div
            className={cn(
              "min-h-[150px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-within:ring-1 focus-within:ring-ring",
              "bg-muted/30 dark:bg-white/5 border-border dark:border-white/10"
            )}
            onClick={() => inputRef.current?.focus()}
          >
            <div className="flex flex-wrap gap-2">
              {emails.map((email) => (
                <Badge
                  key={email}
                  variant={validateEmail(email) ? "secondary" : "destructive"}
                  className="gap-1 pr-1 py-1 pl-3 text-sm font-normal"
                >
                  {email}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      removeEmail(email)
                    }}
                    className="ml-1 rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/20"
                  >
                    <X className="h-3 w-3" />
                    <span className="sr-only">Remove {email}</span>
                  </button>
                </Badge>
              ))}
              <input
                ref={inputRef}
                type="text"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                className="flex-1 bg-transparent outline-none min-w-[200px] placeholder:text-muted-foreground"
                placeholder={
                  emails.length === 0
                    ? "Type or paste emails (separated by space, comma, or enter)..."
                    : ""
                }
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
              i
            </span>
            Tip: You can paste a list of emails directly from Excel or CSV.
          </p>
        </div>

        {validationError && (
          <Alert
            variant="destructive"
            className="bg-destructive/10 border-destructive/20 text-destructive"
          >
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Validation Error</AlertTitle>
            <AlertDescription>{validationError}</AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-border dark:border-white/10">
          <Button variant="ghost" onClick={onSkip} className="hover:bg-muted/50 dark:hover:bg-white/5">
            Skip for now
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || (emails.length === 0 && !emailInput)}
            className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending Invitations...
              </>
            ) : (
              <>
                Send {emails.length > 0 ? `${emails.length} ` : ""}Invitations
                <Send className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </GlassCard>
  )
}
