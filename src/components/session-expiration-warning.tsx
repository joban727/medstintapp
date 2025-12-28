"use client"

import { AlertTriangle, Clock, RefreshCw } from "lucide-react"
import { useEffect, useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

interface SessionExpirationWarningProps {
  timeUntilExpiry: number | null // in seconds
  isExpired: boolean
  onExtendSession: () => Promise<boolean>
  onRecoverSession: () => Promise<any>
  isLoading: boolean
}

export function SessionExpirationWarning({
  timeUntilExpiry,
  isExpired,
  onExtendSession,
  onRecoverSession,
  isLoading,
}: SessionExpirationWarningProps) {
  const [showWarning, setShowWarning] = useState(false)
  const [isExtending, setIsExtending] = useState(false)
  const [isRecovering, setIsRecovering] = useState(false)

  // Show warning when less than 5 minutes (300 seconds) remain
  const warningThreshold = 300

  useEffect(() => {
    if (timeUntilExpiry !== null && timeUntilExpiry <= warningThreshold && timeUntilExpiry > 0) {
      setShowWarning(true)
    } else if (timeUntilExpiry === null || timeUntilExpiry > warningThreshold) {
      setShowWarning(false)
    }
  }, [timeUntilExpiry])

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
  }

  const handleExtendSession = async () => {
    setIsExtending(true)
    try {
      const success = await onExtendSession()
      if (success) {
        setShowWarning(false)
      }
    } catch (error) {
      console.error("Failed to extend session:", error)
    } finally {
      setIsExtending(false)
    }
  }

  const handleRecoverSession = async () => {
    setIsRecovering(true)
    try {
      await onRecoverSession()
    } catch (error) {
      console.error("Failed to recover session:", error)
    } finally {
      setIsRecovering(false)
    }
  }

  const getProgressValue = (): number => {
    if (!timeUntilExpiry || timeUntilExpiry <= 0) return 0
    return Math.max(0, Math.min(100, (timeUntilExpiry / warningThreshold) * 100))
  }

  if (isExpired) {
    return (
      <Alert className="border-red-200 bg-red-50 text-red-800">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Session Expired</AlertTitle>
        <AlertDescription className="mt-2">
          <p className="mb-3">
            Your onboarding session has expired. You can recover your progress and continue where
            you left off.
          </p>
          <Button
            onClick={handleRecoverSession}
            disabled={isRecovering || isLoading}
            className="bg-red-600 hover:bg-red-700 transition-colors duration-200"
          >
            {isRecovering ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Recovering Session...
              </>
            ) : (
              "Recover Session"
            )}
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (!showWarning || !timeUntilExpiry) {
    return null
  }

  return (
    <Alert className="border-amber-200 bg-amber-50 text-amber-800">
      <Clock className="h-4 w-4" />
      <AlertTitle>Session Expiring Soon</AlertTitle>
      <AlertDescription className="mt-2">
        <div className="space-y-3">
          <p>
            Your onboarding session will expire in{" "}
            <span className="font-semibold">{formatTime(timeUntilExpiry)}</span>. Extend your
            session to continue without losing progress.
          </p>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Time remaining</span>
              <span className="font-mono">{formatTime(timeUntilExpiry)}</span>
            </div>
            <Progress value={getProgressValue()} className="h-2" />
          </div>
          <Button
            onClick={handleExtendSession}
            disabled={isExtending || isLoading}
            className="bg-amber-600 hover:bg-amber-700 transition-colors duration-200"
          >
            {isExtending ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Extending Session...
              </>
            ) : (
              "Extend Session (+24 hours)"
            )}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}
