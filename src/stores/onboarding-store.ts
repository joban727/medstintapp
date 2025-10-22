import React from "react"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import type { UserRole } from "../types"
import type {
  EnhancedOnboardingState,
  OnboardingAnalyticsEvent,
  OnboardingAnalyticsEventData,
  OnboardingSessionStatus,
  OnboardingStep,
  ValidationResult,
  OnboardingSessionData,
} from "../types/onboarding"

// Initial state
const initialState: Omit<EnhancedOnboardingState, "sessionId"> = {
  currentStep: "welcome",
  completedSteps: [],
  progress: 0,
  selectedRole: null,
  selectedSchool: null,
  selectedProgram: null,
  schoolName: "",
  schoolAddress: "",
  sessionStatus: "active",
  sessionStartedAt: null,
  sessionUpdatedAt: null,
  sessionExpiresAt: null,
  analyticsEnabled: true,
  stepStartTimes: {
    welcome: null,
    "role-selection": null,
    "school-selection": null,
    "program-selection": null,
    "school-setup": null,
    "affiliation-setup": null,
    complete: null,
  },
  stepCompletionTimes: {
    welcome: null,
    "role-selection": null,
    "school-selection": null,
    "program-selection": null,
    "school-setup": null,
    "affiliation-setup": null,
    complete: null,
  },
  errorCount: 0,
  lastError: null,
  isLoading: false,
  isSubmitting: false,
  validationErrors: {},
  hasUnsavedChanges: false,
  autoSaveEnabled: true,
  lastSavedAt: null,
}

interface OnboardingStore extends EnhancedOnboardingState {
  // Navigation actions
  setCurrentStep: (step: OnboardingStep) => void
  goToNextStep: () => void
  goToPreviousStep: () => void
  completeStep: (step: OnboardingStep) => void

  // Form data actions
  setSelectedRole: (role: UserRole | null) => void
  setSelectedSchool: (schoolId: string | null) => void
  setSelectedProgram: (programId: string | null) => void
  setSchoolName: (name: string) => void
  setSchoolAddress: (address: string) => void

  // Session management
  initializeSession: (sessionId?: string) => void
  updateSessionStatus: (status: OnboardingSessionStatus) => void
  markSessionExpired: () => void
  refreshSession: () => void

  // Analytics tracking
  trackEvent: (event: OnboardingAnalyticsEvent, metadata?: Record<string, unknown>) => Promise<void>
  startStepTimer: (step: OnboardingStep) => void
  completeStepTimer: (step: OnboardingStep) => void

  // Loading and error states
  setLoading: (loading: boolean) => void
  setSubmitting: (submitting: boolean) => void
  setValidationErrors: (errors: Record<string, string>) => void
  clearValidationErrors: () => void
  setError: (error: string | null) => void
  incrementErrorCount: () => void

  // Persistence
  markUnsavedChanges: () => void
  markChangesSaved: () => void
  saveSession: () => Promise<void>
  loadSession: (sessionId: string) => Promise<void>

  // Validation
  validateCurrentStep: () => ValidationResult
  canProceedToNextStep: () => boolean

  // Utility actions
  resetState: () => void
  calculateProgress: () => number
  getStepDuration: (step: OnboardingStep) => number | null
}

// Step order for navigation
const stepOrder: OnboardingStep[] = [
  "welcome",
  "role-selection",
  "school-selection",
  "program-selection",
  "school-setup",
  "affiliation-setup",
  "complete",
]

// Analytics API helper
const trackAnalyticsEvent = async (eventData: Partial<OnboardingAnalyticsEventData>) => {
  try {
    const response = await fetch("/api/onboarding/analytics", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event: eventData.event,
        step: eventData.step,
        metadata: eventData.metadata,
        duration: eventData.duration,
        errorMessage: eventData.errorMessage,
        timestamp: new Date().toISOString(),
      }),
    })

    if (!response.ok) {
      console.warn("Failed to track analytics event:", response.statusText)
    }
  } catch (error) {
    console.warn("Analytics tracking error:", error)
  }
}

// Session persistence API helper
const saveSessionToAPI = async (sessionData: OnboardingSessionData) => {
  try {
    const response = await fetch("/api/onboarding/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sessionData),
    })

    if (!response.ok) {
      throw new Error("Failed to save session")
    }

    return await response.json()
  } catch (error) {
    console.error("Session save error:", error)
    throw error
  }
}

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set, get) => ({
      ...initialState,
      sessionId: null,

      // Navigation actions
      setCurrentStep: (step: OnboardingStep) => {
        const state = get()
        set({ currentStep: step })
        state.startStepTimer(step)
        state.trackEvent("step_started", { step })
        state.markUnsavedChanges()
      },

      goToNextStep: () => {
        const state = get()
        const currentIndex = stepOrder.indexOf(state.currentStep)
        if (currentIndex < stepOrder.length - 1) {
          const nextStep = stepOrder[currentIndex + 1]
          state.completeStep(state.currentStep)
          state.setCurrentStep(nextStep)
        }
      },

      goToPreviousStep: () => {
        const state = get()
        const currentIndex = stepOrder.indexOf(state.currentStep)
        if (currentIndex > 0) {
          const previousStep = stepOrder[currentIndex - 1]
          state.setCurrentStep(previousStep)
        }
      },

      completeStep: (step: OnboardingStep) => {
        const state = get()
        if (!state.completedSteps.includes(step)) {
          const newCompletedSteps = [...state.completedSteps, step]
          set({
            completedSteps: newCompletedSteps,
            progress: state.calculateProgress(),
          })
          state.completeStepTimer(step)
          state.trackEvent("step_completed", { step })
          state.markUnsavedChanges()
        }
      },

      // Form data actions
      setSelectedRole: (role: UserRole | null) => {
        set({ selectedRole: role })
        get().markUnsavedChanges()
      },

      setSelectedSchool: (schoolId: string | null) => {
        set({ selectedSchool: schoolId })
        get().markUnsavedChanges()
      },

      setSelectedProgram: (programId: string | null) => {
        set({ selectedProgram: programId })
        get().markUnsavedChanges()
      },

      setSchoolName: (name: string) => {
        set({ schoolName: name })
        get().markUnsavedChanges()
      },

      setSchoolAddress: (address: string) => {
        set({ schoolAddress: address })
        get().markUnsavedChanges()
      },

      // Session management
      initializeSession: (sessionId?: string) => {
        const now = new Date()
        const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000) // 24 hours

        set({
          sessionId: sessionId || crypto.randomUUID(),
          sessionStatus: "active",
          sessionStartedAt: now,
          sessionUpdatedAt: now,
          sessionExpiresAt: expiresAt,
        })
      },

      updateSessionStatus: (status: OnboardingSessionStatus) => {
        set({
          sessionStatus: status,
          sessionUpdatedAt: new Date(),
        })
      },

      markSessionExpired: () => {
        set({ sessionStatus: "expired" })
        get().trackEvent("session_expired")
      },

      refreshSession: () => {
        const now = new Date()
        const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000)

        set({
          sessionUpdatedAt: now,
          sessionExpiresAt: expiresAt,
          sessionStatus: "active",
        })
      },

      // Analytics tracking
      trackEvent: async (event: OnboardingAnalyticsEvent, metadata?: Record<string, unknown>) => {
        const state = get()
        if (!state.analyticsEnabled) return

        await trackAnalyticsEvent({
          event,
          step: state.currentStep,
          metadata,
          sessionId: state.sessionId,
        })
      },

      startStepTimer: (step: OnboardingStep) => {
        set({
          stepStartTimes: {
            ...get().stepStartTimes,
            [step]: new Date(),
          },
        })
      },

      completeStepTimer: (step: OnboardingStep) => {
        const state = get()
        const completionTime = new Date()
        const startTime = state.stepStartTimes[step]

        set({
          stepCompletionTimes: {
            ...state.stepCompletionTimes,
            [step]: completionTime,
          },
        })

        if (startTime) {
          const duration = completionTime.getTime() - startTime.getTime()
          state.trackEvent("step_completed", { step, duration })
        }
      },

      // Loading and error states
      setLoading: (loading: boolean) => set({ isLoading: loading }),
      setSubmitting: (submitting: boolean) => set({ isSubmitting: submitting }),

      setValidationErrors: (errors: Record<string, string>) => {
        set({ validationErrors: errors })
        if (Object.keys(errors).length > 0) {
          get().trackEvent("validation_error", { errors })
        }
      },

      clearValidationErrors: () => set({ validationErrors: {} }),

      setError: (error: string | null) => {
        set({ lastError: error })
        if (error) {
          get().incrementErrorCount()
          get().trackEvent("api_error", { error })
        }
      },

      incrementErrorCount: () => {
        set({ errorCount: get().errorCount + 1 })
      },

      // Persistence
      markUnsavedChanges: () => {
        set({ hasUnsavedChanges: true })
      },

      markChangesSaved: () => {
        set({
          hasUnsavedChanges: false,
          lastSavedAt: new Date(),
        })
      },

      saveSession: async () => {
        const state = get()
        if (!state.autoSaveEnabled || !state.hasUnsavedChanges) return

        try {
          await saveSessionToAPI({
            id: state.sessionId || '',
            userId: '', // This should be populated from user context
            currentStep: state.currentStep,
            completedSteps: state.completedSteps,
            formData: {
              selectedRole: state.selectedRole,
              selectedSchool: state.selectedSchool,
              selectedProgram: state.selectedProgram,
              schoolName: state.schoolName,
              schoolAddress: state.schoolAddress,
            },
            status: 'active' as OnboardingSessionStatus,
            startedAt: state.sessionStartedAt || new Date(),
            updatedAt: new Date(),
            expiresAt: state.sessionExpiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
          })

          state.markChangesSaved()
          state.trackEvent("session_saved")
        } catch (error) {
          console.error("Failed to save session:", error)
          state.setError("Failed to save progress")
        }
      },

      loadSession: async (sessionId: string) => {
        try {
          const response = await fetch(`/api/onboarding/session/${sessionId}`)
          if (!response.ok) throw new Error("Session not found")

          const sessionData = await response.json()

          set({
            sessionId: sessionData.sessionId,
            currentStep: sessionData.currentStep,
            completedSteps: sessionData.completedSteps,
            selectedRole: sessionData.formData.selectedRole,
            selectedSchool: sessionData.formData.selectedSchool,
            selectedProgram: sessionData.formData.selectedProgram,
            schoolName: sessionData.formData.schoolName || "",
            schoolAddress: sessionData.formData.schoolAddress || "",
            progress: get().calculateProgress(),
          })

          get().trackEvent("session_resumed")
        } catch (error) {
          console.error("Failed to load session:", error)
          get().setError("Failed to resume session")
        }
      },

      // Validation
      validateCurrentStep: (): ValidationResult => {
        const state = get()
        const errors: Record<string, string> = {}

        switch (state.currentStep) {
          case "role-selection":
            if (!state.selectedRole) {
              errors.role = "Please select a role"
            }
            break
          case "school-selection":
            if (!state.selectedSchool) {
              errors.school = "Please select a school"
            }
            break
          case "program-selection":
            if (!state.selectedProgram) {
              errors.program = "Please select a program"
            }
            break
          case "school-setup":
            if (!state.schoolName.trim()) {
              errors.schoolName = "Please enter a school name"
            }
            break
          case "affiliation-setup":
            if (!state.selectedSchool) {
              errors.school = "Please select a school affiliation"
            }
            break
        }

        return {
          isValid: Object.keys(errors).length === 0,
          errors,
          warnings: {},
        }
      },

      canProceedToNextStep: (): boolean => {
        return get().validateCurrentStep().isValid
      },

      // Utility actions
      resetState: () => {
        set({ ...initialState, sessionId: null })
      },

      calculateProgress: (): number => {
        const state = get()
        const totalSteps = stepOrder.length - 1 // Exclude 'complete' step
        const completedCount = state.completedSteps.filter((step) => step !== "complete").length
        return Math.round((completedCount / totalSteps) * 100)
      },

      getStepDuration: (step: OnboardingStep): number | null => {
        const state = get()
        const startTime = state.stepStartTimes[step]
        const endTime = state.stepCompletionTimes[step]

        if (startTime && endTime) {
          return endTime.getTime() - startTime.getTime()
        }

        return null
      },
    }),
    {
      name: "onboarding-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        currentStep: state.currentStep,
        completedSteps: state.completedSteps,
        selectedRole: state.selectedRole,
        selectedSchool: state.selectedSchool,
        selectedProgram: state.selectedProgram,
        schoolName: state.schoolName,
        schoolAddress: state.schoolAddress,
        sessionId: state.sessionId,
        sessionStartedAt: state.sessionStartedAt,
        lastSavedAt: state.lastSavedAt,
      }),
    }
  )
)

// Auto-save hook
export const useAutoSave = () => {
  const saveSession = useOnboardingStore((state) => state.saveSession)
  const hasUnsavedChanges = useOnboardingStore((state) => state.hasUnsavedChanges)
  const autoSaveEnabled = useOnboardingStore((state) => state.autoSaveEnabled)

  // Auto-save every 30 seconds if there are unsaved changes
  React.useEffect(() => {
    if (!autoSaveEnabled || !hasUnsavedChanges) return

    const interval = setInterval(() => {
      saveSession()
    }, 30000) // 30 seconds

    return () => clearInterval(interval)
  }, [saveSession, hasUnsavedChanges, autoSaveEnabled])
}
