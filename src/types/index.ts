// User and Authentication Types
export type UserRole =
  | "SUPER_ADMIN"
  | "SCHOOL_ADMIN"
  | "CLINICAL_PRECEPTOR"
  | "CLINICAL_SUPERVISOR"
  | "STUDENT"

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  avatar?: string
  schoolId?: string
  department?: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface UserProfile extends User {
  phone?: string
  address?: string
  emergencyContact?: {
    name: string
    phone: string
    relationship: string
  }
  certifications?: Certification[]
  specializations?: string[]
}

// School and Institution Types
export interface School {
  id: string
  name: string
  address: string
  phone: string
  email: string
  website?: string
  accreditation: string
  isActive: boolean
  adminId: string
  programs: Program[]
  createdAt: Date
  updatedAt: Date
}

export interface Program {
  id: string
  name: string
  description: string
  duration: number // in months
  schoolId: string
  isActive: boolean
  requirements: string[]
  competencies: Competency[]
}

// Clinical Site Types
export interface ClinicalSite {
  id: string
  name: string
  address: string
  phone: string
  email: string
  type: "HOSPITAL" | "CLINIC" | "NURSING_HOME" | "OUTPATIENT" | "OTHER"
  capacity: number
  specialties: string[]
  isActive: boolean
  contactPerson: {
    name: string
    title: string
    phone: string
    email: string
  }
  requirements: string[]
  createdAt: Date
  updatedAt: Date
}

// Student and Academic Types
export interface Student extends User {
  studentId: string
  programId: string
  enrollmentDate: Date
  expectedGraduation: Date
  academicStatus: "ACTIVE" | "PROBATION" | "SUSPENDED" | "GRADUATED" | "WITHDRAWN"
  gpa?: number
  totalClinicalHours: number
  completedRotations: number
  currentRotation?: Rotation
}

export interface Rotation {
  id: string
  studentId: string
  clinicalSiteId: string
  preceptorId: string
  supervisorId?: string
  specialty: string
  startDate: Date
  endDate: Date
  requiredHours: number
  completedHours: number
  status: "SCHEDULED" | "ACTIVE" | "COMPLETED" | "CANCELLED"
  objectives: string[]
  competencies: RotationCompetency[]
  evaluations: Evaluation[]
  timeRecords: TimeRecord[]
}

// Time Tracking Types
export interface TimeRecord {
  id: string
  studentId: string
  rotationId: string
  date: Date
  clockIn: Date
  clockOut?: Date
  totalHours: number
  activities: string[]
  notes?: string
  status: "PENDING" | "APPROVED" | "REJECTED"
  approvedBy?: string
  approvedAt?: Date
  createdAt: Date
}

export interface TimeSheet {
  id: string
  studentId: string
  rotationId: string
  weekStarting: Date
  weekEnding: Date
  totalHours: number
  timeRecords: TimeRecord[]
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED"
  submittedAt?: Date
  approvedBy?: string
  approvedAt?: Date
  comments?: string
}

// Competency and Assessment Types
export interface Competency {
  id: string
  name: string
  description: string
  category: string
  level: "FUNDAMENTAL" | "INTERMEDIATE" | "ADVANCED" | "EXPERT"
  criteria: CompetencyCriteria[]
  isRequired: boolean
  programId?: string
}

export interface CompetencyCriteria {
  id: string
  description: string
  weight: number // percentage
  passingScore: number
}

export interface RotationCompetency {
  id: string
  rotationId: string
  competencyId: string
  isRequired: boolean
  targetDate?: Date
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "VALIDATED"
  assessments: Assessment[]
  validations: SkillValidation[]
}

export interface Assessment {
  id: string
  studentId: string
  competencyId: string
  assessorId: string
  type: "INITIAL" | "FORMATIVE" | "SUMMATIVE" | "FINAL"
  method: "OBSERVATION" | "SIMULATION" | "ORAL_EXAM" | "WRITTEN_EXAM" | "PRACTICAL"
  date: Date
  score: number
  maxScore: number
  passed: boolean
  attempts: number
  feedback: string
  recommendations?: string
  nextAssessmentDate?: Date
  createdAt: Date
}

export interface SkillValidation {
  id: string
  studentId: string
  competencyId: string
  validatorId: string
  skill: string
  date: Date
  result: "PASSED" | "NEEDS_IMPROVEMENT" | "FAILED"
  score: number
  notes: string
  witnessedBy?: string
  expirationDate?: Date
  createdAt: Date
}

// Evaluation Types
export interface Evaluation {
  id: string
  studentId: string
  rotationId: string
  evaluatorId: string
  type: "MIDTERM" | "FINAL" | "WEEKLY" | "INCIDENT"
  period: {
    startDate: Date
    endDate: Date
  }
  overallRating: number
  categories: EvaluationCategory[]
  strengths: string[]
  areasForImprovement: string[]
  goals: string[]
  comments: string
  studentComments?: string
  status: "DRAFT" | "SUBMITTED" | "REVIEWED" | "FINALIZED"
  submittedAt?: Date
  reviewedAt?: Date
  createdAt: Date
}

export interface EvaluationCategory {
  id: string
  name: string
  description: string
  rating: number
  maxRating: number
  weight: number
  comments?: string
}

// Certification Types
export interface Certification {
  id: string
  name: string
  issuingOrganization: string
  issueDate: Date
  expirationDate?: Date
  certificateNumber: string
  status: "ACTIVE" | "EXPIRED" | "REVOKED"
  verificationUrl?: string
}

// Notification Types
export interface Notification {
  id: string
  userId: string
  type: "INFO" | "WARNING" | "ERROR" | "SUCCESS"
  category: "SYSTEM" | "ACADEMIC" | "CLINICAL" | "ADMINISTRATIVE"
  title: string
  message: string
  actionUrl?: string
  actionText?: string
  isRead: boolean
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  expiresAt?: Date
  createdAt: Date
}

// Report Types
export interface Report {
  id: string
  name: string
  type:
    | "STUDENT_PROGRESS"
    | "CLINICAL_HOURS"
    | "COMPETENCY_TRACKING"
    | "SITE_UTILIZATION"
    | "CUSTOM"
  description: string
  parameters: ReportParameter[]
  generatedBy: string
  generatedAt: Date
  format: "PDF" | "EXCEL" | "CSV"
  data: Record<string, unknown>
  isScheduled: boolean
  schedule?: ReportSchedule
}

export interface ReportParameter {
  name: string
  value: string | number | boolean | Date
  type: "STRING" | "NUMBER" | "DATE" | "BOOLEAN" | "SELECT"
}

export interface ReportSchedule {
  frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY"
  dayOfWeek?: number
  dayOfMonth?: number
  time: string
  recipients: string[]
  isActive: boolean
}

// Dashboard and Analytics Types
export interface DashboardStats {
  totalStudents: number
  activeRotations: number
  pendingApprovals: number
  completedHours: number
  averageGPA?: number
  competencyCompletion: number
  upcomingDeadlines: number
}

export interface ActivityLog {
  id: string
  userId: string
  action: string
  resource: string
  resourceId: string
  details: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  timestamp: Date
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface PaginationParams {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: "asc" | "desc"
  search?: string
  filters?: Record<string, string | number | boolean>
}

// Form and UI Types
export interface FormField {
  name: string
  label: string
  type:
    | "text"
    | "email"
    | "password"
    | "number"
    | "date"
    | "select"
    | "textarea"
    | "checkbox"
    | "radio"
  required: boolean
  placeholder?: string
  options?: { value: string; label: string }[]
  validation?: {
    min?: number
    max?: number
    pattern?: string
    message?: string
  }
}

export interface TableColumn {
  key: string
  label: string
  sortable?: boolean
  width?: string
  align?: "left" | "center" | "right"
  render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode
}

export interface FilterOption {
  key: string
  label: string
  type: "select" | "date" | "text" | "number"
  options?: { value: string; label: string }[]
  multiple?: boolean
}

// Error Types
export interface AppError {
  code: string
  message: string
  details?: Record<string, unknown>
  timestamp: Date
}

// Settings and Configuration Types
export interface SystemSettings {
  id: string
  category: string
  key: string
  value: string | number | boolean | Date | null
  description: string
  isEditable: boolean
  updatedBy: string
  updatedAt: Date
}

export interface UserPreferences {
  userId: string
  theme: "light" | "dark" | "system"
  language: string
  timezone: string
  notifications: {
    email: boolean
    push: boolean
    sms: boolean
    categories: string[]
  }
  dashboard: {
    layout: string
    widgets: string[]
  }
}

// Export utility types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>
export type PartialExcept<T, K extends keyof T> = Partial<T> & Pick<T, K>
