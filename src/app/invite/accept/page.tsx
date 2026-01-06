"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Loader2,
  CheckCircle,
  XCircle,
  ArrowRight,
  Mail,
  School,
  BookOpen,
  Users,
  AlertTriangle,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface InvitationDetails {
  email: string
  schoolName?: string
  programName?: string
  cohortName?: string
  role: string
  expiresAt: string
}

function InviteAcceptContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const { user: clerkUser, isLoaded: isUserLoaded } = useUser()
  const token = searchParams.get("token")

  const [status, setStatus] = useState<"loading" | "preview" | "accepting" | "success" | "error">(
    "loading"
  )
  const [errorMessage, setErrorMessage] = useState("")
  const [invitationDetails, setInvitationDetails] = useState<InvitationDetails | null>(null)

  // Check for email mismatch
  const currentUserEmail = clerkUser?.primaryEmailAddress?.emailAddress?.toLowerCase()
  const invitedEmail = invitationDetails?.email?.toLowerCase()
  const hasEmailMismatch = Boolean(
    isUserLoaded &&
      invitationDetails &&
      currentUserEmail &&
      invitedEmail &&
      currentUserEmail !== invitedEmail
  )

  // Fetch invitation details on mount (read-only preview)
  useEffect(() => {
    if (!token) {
      setStatus("error")
      setErrorMessage("Invalid invitation link. Token is missing.")
      return
    }

    const fetchInvitationDetails = async () => {
      try {
        const response = await fetch(`/api/invitations/preview?token=${token}`)
        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || "Invalid or expired invitation")
        }

        setInvitationDetails(result.data)
        setStatus("preview")
      } catch (error: any) {
        console.error("Fetch invitation error:", error)
        setStatus("error")
        setErrorMessage(error.message || "Failed to load invitation details")
      }
    }

    fetchInvitationDetails()
  }, [token])

  // Accept invitation when user clicks the button
  const handleAccept = async () => {
    if (!token) return

    setStatus("accepting")
    try {
      const response = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to accept invitation")
      }

      setStatus("success")
      toast({
        title: "Invitation Accepted",
        description: "You have successfully joined the school.",
      })

      // Redirect to onboarding to complete any remaining steps
      setTimeout(() => {
        router.push("/onboarding")
      }, 2000)
    } catch (error: any) {
      console.error("Accept invitation error:", error)
      setStatus("error")
      setErrorMessage(error.message || "An unexpected error occurred.")
    }
  }

  const handleDecline = () => {
    router.push("/")
  }

  const formatRole = (role: string) => {
    return role
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase())
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4">
      <Card className="w-full max-w-md shadow-xl border-0 bg-white/80 backdrop-blur">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Invitation</CardTitle>
          <CardDescription>
            {status === "loading" && "Loading invitation details..."}
            {status === "preview" && "You've been invited to join a school"}
            {status === "accepting" && "Processing your acceptance..."}
            {status === "success" && "Welcome aboard!"}
            {status === "error" && "Something went wrong"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center p-6 space-y-4">
          {status === "loading" && (
            <>
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground">Please wait while we load your invitation...</p>
            </>
          )}

          {status === "preview" && invitationDetails && (
            <>
              <div className="w-full space-y-4 mb-4">
                <div className="rounded-lg bg-muted/50 p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <School className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">School</p>
                      <p className="font-medium">{invitationDetails.schoolName || "N/A"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <BookOpen className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Program</p>
                      <p className="font-medium">{invitationDetails.programName || "N/A"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Role</p>
                      <p className="font-medium">{formatRole(invitationDetails.role)}</p>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-center text-muted-foreground">
                  This invitation expires on{" "}
                  {new Date(invitationDetails.expiresAt).toLocaleDateString()}
                </p>
              </div>

              {/* Email mismatch warning */}
              {hasEmailMismatch && (
                <Alert variant="destructive" className="mb-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    This invitation was sent to <strong>{invitationDetails.email}</strong>, but
                    you're signed in as <strong>{currentUserEmail}</strong>. Please sign in with the
                    correct email to accept this invitation.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-3 w-full">
                <Button variant="outline" onClick={handleDecline} className="flex-1">
                  {hasEmailMismatch ? "Go Back" : "Decline"}
                </Button>
                <Button onClick={handleAccept} className="flex-1" disabled={hasEmailMismatch}>
                  Accept Invitation
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </>
          )}

          {status === "accepting" && (
            <>
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground">Setting up your account...</p>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle className="h-12 w-12 text-green-500" />
              <div className="text-center space-y-2">
                <h3 className="text-lg font-medium">Welcome!</h3>
                <p className="text-muted-foreground">You have successfully joined the school.</p>
                <p className="text-sm text-muted-foreground">
                  Redirecting to complete your setup...
                </p>
              </div>
              <Button onClick={() => router.push("/onboarding")} className="w-full">
                Continue Setup <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </>
          )}

          {status === "error" && (
            <>
              <XCircle className="h-12 w-12 text-destructive" />
              <div className="text-center space-y-2">
                <h3 className="text-lg font-medium text-destructive">Invitation Failed</h3>
                <p className="text-muted-foreground">{errorMessage}</p>
              </div>
              <Button variant="outline" onClick={() => router.push("/")} className="w-full">
                Return Home
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function InviteAcceptPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <InviteAcceptContent />
    </Suspense>
  )
}
