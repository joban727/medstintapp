import { useUser } from "@clerk/nextjs"
import React, { useCallback } from "react"
import type { OnboardingAnalyticsEvent, OnboardingStep } from "@/types/onboarding"

interface AnalyticsEventData {
  eventType: OnboardingAnalyticsEvent
  step: OnboardingStep
  sessionId?: string
  metadata?: Record<string, unknown>
  duration?: number
  errorMessage?: string
}

interface UseOnboardingAnalyticsReturn {
  trackEvent: (data: AnalyticsEventData) => Promise<void>
  trackStepStarted: (
    step: OnboardingStep,
    sessionId?: string,
    metadata?: Record<string, unknown>
  ) => Promise<void>
  trackStepCompleted: (
    step: OnboardingStep,
    sessionId?: string,
    duration?: number,
    metadata?: Record<string, unknown>
  ) => Promise<void>
  trackStepSkipped: (step: OnboardingStep, sessionId?: string, reason?: string) => Promise<void>
  trackValidationError: (
    step: OnboardingStep,
    sessionId?: string,
    errorDetails?: Record<string, unknown>
  ) => Promise<void>
  trackApiError: (
    step: OnboardingStep,
    sessionId?: string,
    errorMessage?: string,
    errorDetails?: Record<string, any>
  ) => Promise<void>
  trackSessionAbandoned: (
    step: OnboardingStep,
    sessionId?: string,
    reason?: string
  ) => Promise<void>
  trackOnboardingCompleted: (
    sessionId?: string,
    completionTime?: number,
    metadata?: Record<string, unknown>
  ) => Promise<void>
}

export function useOnboardingAnalytics(): UseOnboardingAnalyticsReturn {
  const { user } = useUser()

  const trackEvent = useCallback(
    async (data: AnalyticsEventData) => {
      if (!user) {
        console.warn("Cannot track analytics: user not authenticated")
        return
      }

      try {
        const response = await fetch("/api/onboarding/analytics", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        })

        if (!response.ok) {
          const errorData = await response.json()
          console.error("Analytics tracking failed:", errorData.error)
        }
      } catch (error) {
        console.error("Analytics tracking error:", error)
      }
    },
    [user]
  )

  const trackStepStarted = useCallback(
    async (step: OnboardingStep, sessionId?: string, metadata?: Record<string, any>) => {
      await trackEvent({
        eventType: "step_started",
        step,
        sessionId,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
          },
        },
      })
    },
    [trackEvent]
  )

  const trackStepCompleted = useCallback(
    async (
      step: OnboardingStep,
      sessionId?: string,
      duration?: number,
      metadata?: Record<string, any>
    ) => {
      await trackEvent({
        eventType: "step_completed",
        step,
        sessionId,
        duration,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
        },
      })
    },
    [trackEvent]
  )

  const trackStepSkipped = useCallback(
    async (step: OnboardingStep, sessionId?: string, reason?: string) => {
      await trackEvent({
        eventType: "step_skipped",
        step,
        sessionId,
        metadata: {
          reason: reason || "user_skipped",
          timestamp: new Date().toISOString(),
        },
      })
    },
    [trackEvent]
  )

  const trackValidationError = useCallback(
    async (step: OnboardingStep, sessionId?: string, errorDetails?: Record<string, any>) => {
      await trackEvent({
        eventType: "form_validation_error",
        step,
        sessionId,
        metadata: {
          ...errorDetails,
          timestamp: new Date().toISOString(),
        },
      })
    },
    [trackEvent]
  )

  const trackApiError = useCallback(
    async (
      step: OnboardingStep,
      sessionId?: string,
      errorMessage?: string,
      errorDetails?: Record<string, unknown>
    ) => {
      await trackEvent({
        eventType: "api_error",
        step,
        sessionId,
        errorMessage,
        metadata: {
          ...errorDetails,
          timestamp: new Date().toISOString(),
        },
      })
    },
    [trackEvent]
  )

  const trackSessionAbandoned = useCallback(
    async (step: OnboardingStep, sessionId?: string, reason?: string) => {
      await trackEvent({
        eventType: "session_abandoned",
        step,
        sessionId,
        metadata: {
          reason: reason || "unknown",
          timestamp: new Date().toISOString(),
        },
      })
    },
    [trackEvent]
  )

  const trackOnboardingCompleted = useCallback(
    async (sessionId?: string, completionTime?: number, metadata?: Record<string, any>) => {
      await trackEvent({
        eventType: "onboarding_completed",
        step: "complete", // Final step
        sessionId,
        duration: completionTime,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
        },
      })
    },
    [trackEvent]
  )

  return {
    trackEvent,
    trackStepStarted,
    trackStepCompleted,
    trackStepSkipped,
    trackValidationError,
    trackApiError,
    trackSessionAbandoned,
    trackOnboardingCompleted,
  }
}

// Helper hook for tracking step timing
export function useStepTimer() {
  const startTime = React.useRef<number | null>(null)

  const startTimer = useCallback(() => {
    startTime.current = Date.now()
  }, [])

  const getElapsedTime = useCallback(() => {
    if (startTime.current === null) return 0
    return Date.now() - startTime.current
  }, [])

  const resetTimer = useCallback(() => {
    startTime.current = null
  }, [])

  return {
    startTimer,
    getElapsedTime,
    resetTimer,
  }
}
