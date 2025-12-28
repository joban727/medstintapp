import React from "react"

// Dashboard-specific type definitions

export interface Task {
  id: string
  title: string
  description?: string
  type: "competency" | "evaluation" | "assignment" | "reminder"
  dueDate: string
  priority: "High" | "Medium" | "Low" | "URGENT" | "NORMAL"
  status: "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "OVERDUE" | "PENDING"
  progress?: number | null
  rotationId?: string
  competencyId?: string
}

export interface ScheduleDay {
  date: string
  dayOfWeek: string
  day: string
  shift?: string
  hours?: number
  status: "completed" | "today" | "upcoming" | "past"
  rotation?: {
    specialty: string
    site: string
    location: string
  } | null
  competencies: Array<{
    id: string
    title: string
    dueDate: string
    priority: string
    status: string
  }>
  evaluations: Array<{
    id: string
    type: string
    scheduledDate: string
    status: string
  }>
}


export interface DashboardStats {
  title: string
  value: string | number
  target?: string
  change?: string
  trend?: "up" | "down" | "neutral"
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  color: string
  bgColor: string
  progress?: number
}

export interface CurrentRotationDetails {
  name: string
  site: string
  preceptor: string
  supervisor: string
  startDate: string
  endDate: string
  weekNumber: number
  totalWeeks: number
  hoursCompleted: number
  hoursRequired: number
}

export interface DashboardData {
  currentRotation?: {
    id: string
    specialty: string
    startDate: string
    endDate: string
    requiredHours: number
    completedHours: number
    status: string
  } | null
  recentTimeRecords: Array<{
    id: string
    date: string
    totalHours: number
    activities: string[]
    status: string
  }>
  totalClinicalHours: string
  competencyProgress: Array<{
    id: string
    name: string
    progress: number
    category: string
  }>
}

export interface Rotation {
  id: string
  name: string
  site: string
  startDate: string
  endDate: string
  status: string
  duration?: string
  preceptor?: string
  focus?: string
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface TasksApiResponse extends ApiResponse<Task[]> {
  upcomingTasks: Task[]
  total: number
}

export interface RotationsApiResponse extends ApiResponse<Rotation[]> {
  upcomingRotations: Array<{
    id: string
    specialty: string
    startDate: string
    endDate: string
    site: {
      name: string
      location: string
    }
    preceptor: {
      name: string
      email: string
    }
    focus: string
    status: string
  }>
  total: number
}

export interface ScheduleApiResponse extends ApiResponse<ScheduleDay[]> {
  weekStart: string
  weekEnd: string
  currentRotation: {
    id: string
    specialty: string
    site: {
      name: string
      location: string
    }
    startDate: string
    endDate: string
    status: string
  } | null
  schedule: ScheduleDay[]
  summary: {
    totalCompetencies: number
    totalEvaluations: number
    hasRotation: boolean
  }
}

// Loading and error states
export interface LoadingState {
  isLoading: boolean
  error: string | null
  lastFetch: Date | null
  retryCount: number
}

export interface DashboardState {
  tasks: {
    data: Task[]
    loading: LoadingState
  }
  rotations: {
    data: Rotation[]
    loading: LoadingState
  }
  schedule: {
    data: ScheduleDay[]
    loading: LoadingState
  }
}

// Component props interfaces
export interface StudentDashboardClientProps {
  userId: string
  currentRotationDetails?: CurrentRotationDetails
}

export interface DashboardCardProps {
  title: string
  description?: string
  children: React.ReactNode
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  className?: string
}

export interface LoadingSkeletonProps {
  count?: number
  height?: string
  className?: string
}

// Utility types
export type DashboardSection = "tasks" | "rotations" | "schedule"

export interface RefreshOptions {
  force?: boolean
  section?: DashboardSection
  showLoading?: boolean
}

export interface CacheConfig {
  ttl: number // Time to live in milliseconds
  maxAge: number // Maximum age before forced refresh
  staleWhileRevalidate: boolean
}
