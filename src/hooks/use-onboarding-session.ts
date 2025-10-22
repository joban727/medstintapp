import { useUser } from "@clerk/nextjs"
import React, { useCallback, useEffect, useState } from "react"
import type {
  EnhancedOnboardingState,
  OnboardingSessionData,
  OnboardingStep,
} from "@/types/onboarding"

interface UseOnboardingSessionReturn {
  sessionId: string | null
  isLoading: boolean
  error: string | null
  isExpired: boolean
  timeUntilExpiry: number | null
  saveSession: (state: Partial<EnhancedOnboardingState>) => Promise<boolean>
  loadSession: () => Promise<OnboardingSessionData | null>
  abandonSession: () => Promise<boolean>
  extendSession: () => Promise<boolean>
  recoverExpiredSession: () => Promise<OnboardingSessionData | null>
  clearError: () => void
}

interface SessionSaveData {
  currentStep: OnboardingStep
  completedSteps: OnboardingStep[]
  formData: Record<string, any>
}

export function useOnboardingSession(): UseOnboardingSessionReturn {
  const { user } = useUser()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isExpired, setIsExpired] = useState(false)
  const [expiresAt, setExpiresAt] = useState<Date | null>(null)
  const [timeUntilExpiry, setTimeUntilExpiry] = useState<number | null>(null)

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const saveSession = useCallback(
    async (state: Partial<EnhancedOnboardingState>): Promise<boolean> => {
      if (!user) {
        setError("User not authenticated")
        return false
      }

      if (!state.currentStep) {
        setError("Current step is required to save session")
        return false
      }

      setIsLoading(true)
      setError(null)

      try {
        const saveData: SessionSaveData = {
          currentStep: state.currentStep,
          completedSteps: state.completedSteps || [],
          formData: {
            selectedRole: state.selectedRole,
            selectedSchool: state.selectedSchool,
            selectedProgram: state.selectedProgram,
            schoolName: state.schoolName,
            schoolAddress: state.schoolAddress,
          },
        }

        const response = await fetch("/api/onboarding/session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId,
            ...saveData,
          }),
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || "Failed to save session")
        }

        if (result.success && result.sessionId) {
          setSessionId(result.sessionId)
          return true
        }

        throw new Error("Invalid response from server")
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to save session"
        setError(errorMessage)
        console.error("Session save error:", err)
        return false
      } finally {
        setIsLoading(false)
      }
    },
    [user, sessionId]
  )

  const loadSession = useCallback(async (): Promise<OnboardingSessionData | null> => {
    if (!user) {
      setError("User not authenticated")
      return null
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/onboarding/session", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (response.status === 404) {
        // No active session found - this is not an error
        return null
      }

      if (response.status === 410) {
        // Session expired
        setError("Your onboarding session has expired. Please start over.")
        return null
      }

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to load session")
      }

      if (result.success && result.data) {
        setSessionId(result.data.id)
        return result.data
      }

      return null
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load session"
      setError(errorMessage)
      console.error("Session load error:", err)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [user])

  const abandonSession = useCallback(async (): Promise<boolean> => {
    if (!user) {
      setError("User not authenticated")
      return false
    }

    setIsLoading(true)
    setError(null)

    try {
      const url = sessionId
        ? `/api/onboarding/session?sessionId=${sessionId}`
        : "/api/onboarding/session"

      const response = await fetch(url, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to abandon session")
      }

      if (result.success) {
        setSessionId(null)
        return true
      }

      throw new Error("Invalid response from server")
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to abandon session"
      setError(errorMessage)
      console.error("Session abandon error:", err)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [user, sessionId])

  const extendSession = useCallback(async (): Promise<boolean> => {
    if (!user || !sessionId) {
      setError("No active session to extend")
      return false
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/onboarding/session/extend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sessionId }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to extend session")
      }

      if (result.success && result.expiresAt) {
        setExpiresAt(new Date(result.expiresAt))
        setIsExpired(false)
        return true
      }

      throw new Error("Invalid response from server")
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to extend session"
      setError(errorMessage)
      console.error("Session extend error:", err)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [user, sessionId])

  const recoverExpiredSession = useCallback(async (): Promise<OnboardingSessionData | null> => {
    if (!user) {
      setError("User not authenticated")
      return null
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/onboarding/session/recover", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to recover session")
      }

      if (result.success && result.data) {
        setSessionId(result.data.id)
        setExpiresAt(new Date(result.data.expiresAt))
        setIsExpired(false)
        return result.data
      }

      return null
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to recover session"
      setError(errorMessage)
      console.error("Session recovery error:", err)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [user])

  // Timer to track session expiration
  useEffect(() => {
    if (!expiresAt) {
      setTimeUntilExpiry(null)
      return
    }

    const updateTimer = () => {
      const now = new Date()
      const timeLeft = expiresAt.getTime() - now.getTime()

      if (timeLeft <= 0) {
        setIsExpired(true)
        setTimeUntilExpiry(0)
      } else {
        setIsExpired(false)
        setTimeUntilExpiry(Math.floor(timeLeft / 1000)) // seconds
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [expiresAt])

  // Auto-load session on mount if user is available
  useEffect(() => {
    if (user && !sessionId) {
      loadSession()
        .then((sessionData) => {
          if (sessionData?.expiresAt) {
            setExpiresAt(new Date(sessionData.expiresAt))
          }
        })
        .catch(console.error)
    }
  }, [user, sessionId, loadSession])

  return {
    sessionId,
    isLoading,
    error,
    isExpired,
    timeUntilExpiry,
    saveSession,
    loadSession,
    abandonSession,
    extendSession,
    recoverExpiredSession,
    clearError,
  }
}

// Helper hook for auto-saving session data
export function useAutoSaveSession(
  state: Partial<EnhancedOnboardingState>,
  enabled = true,
  debounceMs = 2000
) {
  const { saveSession } = useOnboardingSession()
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  const debouncedSave = useCallback(() => {
    if (!enabled || !state.currentStep) return

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      saveSession(state).catch(console.error)
    }, debounceMs)
  }, [saveSession, state, enabled, debounceMs])

  useEffect(() => {
    debouncedSave()

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [debouncedSave])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])
}
