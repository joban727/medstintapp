import type { UserRole } from "../types"

// Enhanced onboarding step types with analytics support
export type OnboardingStep =
  | "welcome"
  | "role-selection"
  | "school-selection"
  | "program-selection"
  | "school-setup"
  | "affiliation-setup"
  | "school-profile"
  | "profile-completion"
  | "tutorial"
  | "completion"
  | "complete"

// Analytics event types for tracking user interactions
export type OnboardingAnalyticsEvent =
  | "step_started"
  | "step_completed"
  | "step_skipped"
  | "validation_error"
  | "form_validation_error"
  | "api_error"
  | "user_interaction"
  | "session_saved"
  | "session_resumed"
  | "session_expired"
  | "session_abandoned"
  | "onboarding_abandoned"
  | "onboarding_completed"

// Session status for progress persistence
export type OnboardingSessionStatus = "active" | "paused" | "expired" | "completed" | "abandoned"

// Enhanced user data interface with additional fields
export interface EnhancedUserData {
  id: string
  email: string
  name: string
  role: UserRole | null
  schoolId: string | null
  programId: string | null
  onboardingCompleted: boolean
  createdAt: Date
  updatedAt: Date
}

// School interface with enhanced fields
export interface School {
  id: string
  name: string
  address: string
  email: string
  isActive: boolean
  createdAt?: Date
  updatedAt?: Date
}

// Program interface with enhanced fields
export interface Program {
  id: string
  name: string
  description: string
  schoolId: string
  duration?: number
  classYear?: number
  isActive?: boolean
  createdAt?: Date
  updatedAt?: Date
}

// Clerk user interface
export interface ClerkUser {
  id: string
  firstName: string | null
  lastName: string | null
  emailAddresses: {
    id: string
    emailAddress: string
    verification: unknown
    linkedTo: unknown[]
  }[]
}

// Enhanced onboarding state with analytics and session support
export interface EnhancedOnboardingState {
  // Current step and progress
  currentStep: OnboardingStep
  completedSteps: OnboardingStep[]
  progress: number

  // User selections
  selectedRole: UserRole | null
  selectedSchool: string | null
  selectedProgram: string | null

  // School creation data
  schoolName: string
  schoolAddress: string

  // Session management
  sessionId: string | null
  sessionStatus: OnboardingSessionStatus
  sessionStartedAt: Date | null
  sessionUpdatedAt: Date | null
  sessionExpiresAt: Date | null

  // Analytics and tracking
  analyticsEnabled: boolean
  stepStartTimes: Record<OnboardingStep, Date | null>
  stepCompletionTimes: Record<OnboardingStep, Date | null>
  errorCount: number
  lastError: string | null

  // Validation and loading states
  isLoading: boolean
  isSubmitting: boolean
  validationErrors: Record<string, string>

  // Persistence flags
  hasUnsavedChanges: boolean
  autoSaveEnabled: boolean
  lastSavedAt: Date | null
}

// Step configuration with enhanced metadata
export interface OnboardingStepConfig {
  title: string
  description: string
  progress: number
  isRequired: boolean
  estimatedTimeMinutes: number
  validationRules?: string[]
  dependencies?: OnboardingStep[]
  skipConditions?: (state: EnhancedOnboardingState) => boolean
}

// Analytics event data structure
export interface OnboardingAnalyticsEventData {
  userId: string
  sessionId: string | null
  event: OnboardingAnalyticsEvent
  step: OnboardingStep
  timestamp: Date
  metadata?: Record<string, unknown>
  userAgent?: string
  ipAddress?: string
  duration?: number
  errorMessage?: string
}

// Session data structure for persistence
export interface OnboardingSessionData {
  id: string
  userId: string
  currentStep: OnboardingStep
  completedSteps: OnboardingStep[]
  formData: Record<string, unknown>
  status: OnboardingSessionStatus
  startedAt: Date
  updatedAt: Date
  expiresAt: Date
  metadata?: Record<string, unknown>
}

// API response interfaces
export interface OnboardingApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
  sessionId?: string
}

// Session management API interfaces
export interface SaveSessionRequest {
  step: OnboardingStep
  formData: Record<string, unknown>
  completedSteps: OnboardingStep[]
}

export interface ResumeSessionResponse {
  sessionId: string
  currentStep: OnboardingStep
  completedSteps: OnboardingStep[]
  formData: Record<string, unknown>
  expiresAt: Date
}

// Analytics API interfaces
export interface TrackEventRequest {
  event: OnboardingAnalyticsEvent
  step: OnboardingStep
  metadata?: Record<string, unknown>
  duration?: number
  errorMessage?: string
}

// Enhanced onboarding flow props
export interface EnhancedOnboardingFlowProps {
  user: EnhancedUserData
  clerkUser: ClerkUser
  availableSchools: School[]
  availablePrograms: Program[]
  initialStep?: OnboardingStep
  initialRole?: UserRole
  sessionId?: string
  analyticsEnabled?: boolean
  autoSaveEnabled?: boolean
}

// Validation function type
type ValidationFunction = (value: unknown) => boolean | string

// Onboarding completion requirements by role
export interface RoleRequirements {
  role: UserRole
  requiredSteps: OnboardingStep[]
  requiredFields: string[]
  validationRules: Record<string, ValidationFunction>
}

// Enhanced onboarding verification state
export interface EnhancedOnboardingVerificationState {
  isCompleted: boolean
  meetsRoleRequirements: boolean
  needsRedirect: boolean
  redirectPath: string
  user: EnhancedUserData | null
  missingRequirements: string[]
  completionPercentage: number
  lastActivity: Date | null
  sessionExpired: boolean
}

// Onboarding metrics for analytics dashboard
export interface OnboardingMetrics {
  totalUsers: number
  completedOnboarding: number
  inProgressOnboarding: number
  abandonedOnboarding: number
  averageCompletionTime: number
  stepCompletionRates: Record<OnboardingStep, number>
  commonDropOffPoints: OnboardingStep[]
  errorRates: Record<OnboardingStep, number>
  roleDistribution: Record<UserRole, number>
}

// Error types for better error handling
export interface OnboardingError {
  code: string
  message: string
  step: OnboardingStep
  field?: string
  timestamp: Date
  recoverable: boolean
  retryCount?: number
}

// Validation result interface
export interface ValidationResult {
  isValid: boolean
  errors: Record<string, string>
  warnings: Record<string, string>
}

// Step transition interface
export interface StepTransition {
  from: OnboardingStep
  to: OnboardingStep
  condition?: (state: EnhancedOnboardingState) => boolean
  beforeTransition?: (state: EnhancedOnboardingState) => Promise<void>
  afterTransition?: (state: EnhancedOnboardingState) => Promise<void>
}
