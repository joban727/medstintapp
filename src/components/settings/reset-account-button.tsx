"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { resetAccount } from "@/app/actions/settings"
import { AlertTriangle } from "lucide-react"

export function ResetAccountButton() {
  const [isPending, startTransition] = useTransition()
  const [showConfirm, setShowConfirm] = useState(false)

  const handleReset = () => {
    startTransition(async () => {
      try {
        await resetAccount()
      } catch (error) {
        console.error("Failed to reset account:", error)
        alert("Failed to reset account. Please try again.")
      }
    })
  }

  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Danger Zone
        </CardTitle>
        <CardDescription>
          Resetting your account will clear your onboarding status and school association. This is
          useful for testing the onboarding flow again.
          <br />
          <strong>Warning: This action cannot be undone.</strong>
        </CardDescription>
      </CardHeader>
      <CardFooter>
        {!showConfirm ? (
          <Button variant="destructive" onClick={() => setShowConfirm(true)}>
            Reset Account
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="destructive" disabled={isPending} onClick={handleReset}>
              {isPending ? "Resetting..." : "Confirm Reset"}
            </Button>
            <Button variant="ghost" disabled={isPending} onClick={() => setShowConfirm(false)}>
              Cancel
            </Button>
          </div>
        )}
      </CardFooter>
    </Card>
  )
}
