import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"

export interface StudentDashboardData {
  student: {
    id: string
    name: string
    email: string
    studentId: string
    gpa: number | null
    totalClinicalHours: number
    completedRotations: number
    academicStatus: string
    enrollmentDate: Date | null
    expectedGraduation: Date | null
    program: {
      id: string
      name: string
      duration: number
      classYear: string
    } | null
    school: {
      id: string
      name: string
    } | null
  }
  currentRotation: {
    id: string
    specialty: string
    startDate: Date
    endDate: Date
    clinicalSiteId: string
    siteName: string
    siteType: string
    siteAddress: string
    preceptorId: string
  } | null
  assignedSites: Array<{
    id: string
    name: string
    type: string
    address: string
    specialties: string[]
    capacity: number
    contactPersonName: string
    contactPersonEmail: string
    contactPersonPhone: string
  }>
  recentTimeRecords: Array<{
    id: string
    date: Date
    clockIn: Date
    clockOut: Date | null
    totalHours: number | null
    activities: string[]
    notes: string | null
    status: string
    clinicalSiteId: string | null
    siteName: string | null
    specialty: string | null
  }>
  clockStatus: {
    id: string
    clockIn: Date
    rotationId: string
    siteName: string
    specialty: string
  } | null
  statistics: {
    weeklyHours: number
    weeklyCount: number
    monthlyHours: number
    monthlyCount: number
    currentStreak: number
    totalRequiredHours: number
    totalRotations: number
    progressPercentage: number
    rotationProgress: number
  }
}

export interface UseStudentDashboardReturn {
  data: StudentDashboardData | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
  isRefetching: boolean
}

export function useStudentDashboard(): UseStudentDashboardReturn {
  const [data, setData] = useState<StudentDashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefetching, setIsRefetching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefetching(true)
    } else {
      setIsLoading(true)
    }
    setError(null)

    try {
      const response = await fetch("/api/student/dashboard")

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      // Check if response has content before parsing JSON
      const text = await response.text()
      if (!text || text.trim() === "") {
        throw new Error("Empty response from server")
      }

      let result
      try {
        result = JSON.parse(text)
      } catch (parseError) {
        console.error("JSON parse error:", parseError)
        console.error("Response text:", text.substring(0, 500)) // Log first 500 chars to avoid overwhelming logs
        throw new Error("Invalid JSON response from server")
      }

      if (!result.success) {
        throw new Error(result.error || result.message || "Failed to fetch dashboard data")
      }

      // Support API responses that wrap payload in `data`
      const payload = result.data ?? result

      if (!payload || !payload.student) {
        throw new Error("Malformed response: missing student payload")
      }

      // Transform dates from strings to Date objects
      const transformedData: StudentDashboardData = {
        student: {
          ...payload.student,
          enrollmentDate: payload.student.enrollmentDate
            ? new Date(payload.student.enrollmentDate)
            : null,
          expectedGraduation: payload.student.expectedGraduation
            ? new Date(payload.student.expectedGraduation)
            : null,
          program: payload.student.program ?? payload.program ?? null,
          school: payload.student.school ?? payload.school ?? null,
        },
        currentRotation: payload.currentRotation
          ? {
            ...payload.currentRotation,
            startDate: new Date(payload.currentRotation.startDate),
            endDate: new Date(payload.currentRotation.endDate),
          }
          : null,
        assignedSites: Array.isArray(payload.assignedSites) ? payload.assignedSites : [],
        recentTimeRecords: Array.isArray(payload.recentTimeRecords)
          ? payload.recentTimeRecords.map(
            (record: {
              id: string
              date: string
              clockIn: string
              clockOut: string | null
              totalHours: number | null
              activities: string[]
              notes: string | null
              status: string
              clinicalSiteId: string | null
              siteName: string | null
              specialty: string | null
            }) => ({
              ...record,
              date: new Date(record.date),
              clockIn: new Date(record.clockIn),
              clockOut: record.clockOut ? new Date(record.clockOut) : null,
            })
          )
          : [],
        clockStatus: payload.clockStatus
          ? {
            ...payload.clockStatus,
            clockIn: new Date(payload.clockStatus.clockIn),
          }
          : null,
        statistics: payload.statistics ?? {
          weeklyHours: 0,
          weeklyCount: 0,
          monthlyHours: 0,
          monthlyCount: 0,
          currentStreak: 0,
          totalRequiredHours: 0,
          totalRotations: 0,
          progressPercentage: 0,
          rotationProgress: 0,
        },
      }

      setData(transformedData)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch dashboard data"
      setError(errorMessage)
      toast.error("Failed to load dashboard data", {
        description: errorMessage,
      })
    } finally {
      setIsLoading(false)
      setIsRefetching(false)
    }
  }, [])

  const refetch = useCallback(async () => {
    await fetchData(true)
  }, [fetchData])

  // Initial fetch
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Auto-refresh every 30 seconds when clocked in
  useEffect(() => {
    if (!data?.clockStatus) return

    const interval = setInterval(() => {
      fetchData(true)
    }, 60000) // Refresh every 60 seconds when clocked in (was 30s)

    return () => clearInterval(interval)
  }, [data?.clockStatus, fetchData])

  return {
    data,
    isLoading,
    error,
    refetch,
    isRefetching,
  }
}
