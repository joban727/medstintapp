"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import { useAuth } from "@clerk/nextjs"
import { Clock, Play, Square, History, Settings, User, BarChart3, Home, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import OptimizedClock from "./optimized-clock"
import ClockLoading from "./clock-loading"
import { usePerformanceMonitoring } from "@/lib/performance-monitoring"

// Types for time tracking
interface TimeRecord {
  id: string
  clockIn: Date
  clockOut?: Date
  totalHours?: string
  activities?: string[]
  notes?: string
  status: "PENDING" | "APPROVED" | "REJECTED"
}

interface ClockStatus {
  isClockedIn: boolean
  currentRecord?: TimeRecord
  lastClockIn?: Date
  totalHoursToday?: string
}

// Clock In/Out Button Component
const ClockButton = React.memo(
  ({
    isClockedIn,
    onClockIn,
    onClockOut,
    lastAction,
    isLoading,
  }: {
    isClockedIn: boolean
    onClockIn: () => void
    onClockOut: () => void
    lastAction?: { type: "in" | "out"; timestamp: Date }
    isLoading: boolean
  }) => {
    const getButtonConfig = () => {
      if (isClockedIn) {
        return {
          text: "Clock Out",
          icon: Square,
          variant: "destructive" as const,
          onClick: onClockOut,
          className:
            "bg-error hover:bg-red transition-color duration-200s duration-200-700 text-white",
        }
      }
      return {
        text: "Clock In",
        icon: Play,
        variant: "default" as const,
        onClick: onClockIn,
        className: "bg-primary hover:bg-primary/90 transition-colors duration-200 text-white",
      }
    }

    const config = getButtonConfig()
    const Icon = config.icon

    return (
      <Button
        onClick={config.onClick}
        variant={config.variant}
        size="lg"
        disabled={isLoading}
        className={`w-full ${config.className}`}
      >
        <Icon className="mr-2 h-5 w-5" />
        {isLoading ? "Processing..." : config.text}
      </Button>
    )
  }
)

ClockButton.displayName = "ClockButton"

// Status Indicator Component
const StatusIndicator = React.memo(
  ({
    isClockedIn,
    lastAction,
  }: {
    isClockedIn: boolean
    lastAction?: { type: "in" | "out"; timestamp: Date }
  }) => {
    const formatTime = (date: Date) => {
      return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    }

    const getStatusInfo = () => {
      if (isClockedIn) {
        return {
          text: "Clocked In",
          color: "bg-green-500",
          timestamp: lastAction?.type === "in" ? lastAction.timestamp : undefined,
        }
      }
      return {
        text: "Clocked Out",
        color: "bg-gray-400",
        timestamp: lastAction?.type === "out" ? lastAction.timestamp : undefined,
      }
    }

    const status = getStatusInfo()

    return (
      <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
        <div className={`w-3 h-3 rounded-full ${status.color}`} />
        <div>
          <p className="font-medium">{status.text}</p>
          {status.timestamp && (
            <p className="text-sm text-muted-foreground">Since {formatTime(status.timestamp)}</p>
          )}
        </div>
      </div>
    )
  }
)

StatusIndicator.displayName = "StatusIndicator"

// Time History Component
const TimeHistory = React.memo(
  ({ records, isLoading }: { records: TimeRecord[]; isLoading: boolean }) => {
    const formatRecordTime = (date: Date) => {
      return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    }

    const formatRecordDate = (date: Date) => {
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    }

    const getStatusBadge = (status: string) => {
      const variants = {
        PENDING: "secondary",
        APPROVED: "default",
        REJECTED: "destructive",
      } as const

      return (
        <Badge variant={variants[status as keyof typeof variants] || "secondary"}>{status}</Badge>
      )
    }

    if (isLoading) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No time records found</p>
          ) : (
            <div className="space-y-3">
              {records.slice(0, 5).map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                >
                  <div>
                    <p className="font-medium">
                      {formatRecordDate(record.clockIn)} - {formatRecordTime(record.clockIn)}
                      {record.clockOut && ` to ${formatRecordTime(record.clockOut)}`}
                    </p>
                    {record.totalHours && (
                      <p className="text-sm text-muted-foreground">{record.totalHours}</p>
                    )}
                  </div>
                  {getStatusBadge(record.status)}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }
)

TimeHistory.displayName = "TimeHistory"

// Main Comprehensive Time Tracker Component
export default function ComprehensiveTimeTracker({ className = "" }: { className?: string }) {
  const { userId, isLoaded } = useAuth()
  const { getMetrics } = usePerformanceMonitoring("ComprehensiveTimeTracker")

  const [clockStatus, setClockStatus] = useState<ClockStatus>({ isClockedIn: false })
  const [timeRecords, setTimeRecords] = useState<TimeRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [lastAction, setLastAction] = useState<{ type: "in" | "out"; timestamp: Date }>()

  // Fetch clock status and time records
  const fetchData = useCallback(async () => {
    if (!userId || !isLoaded) return

    try {
      setIsLoading(true)

      // Fetch clock status
      const statusResponse = await fetch("/api/time-records/status")
      if (statusResponse.ok) {
        const statusData = await statusResponse.json()
        setClockStatus(statusData)
      }

      // Fetch recent time records
      const recordsResponse = await fetch("/api/time-records?limit=10")
      if (recordsResponse.ok) {
        const recordsData = await recordsResponse.json()
        setTimeRecords(recordsData.records || [])
      }
    } catch (error) {
      console.error("Error fetching data:", error)
      toast.error("Failed to load time tracking data")
    } finally {
      setIsLoading(false)
    }
  }, [userId, isLoaded])

  // Clock in handler
  const handleClockIn = useCallback(async () => {
    if (!userId) return

    try {
      setIsLoading(true)
      const response = await fetch("/api/time-records/clock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clock-in" }),
      })

      if (response.ok) {
        const data = await response.json()
        setClockStatus((prev) => ({ ...prev, isClockedIn: true, currentRecord: data.record }))
        setLastAction({ type: "in", timestamp: new Date() })
        toast.success("Successfully clocked in")
        await fetchData()
      } else {
        throw new Error("Failed to clock in")
      }
    } catch (error) {
      console.error("Clock in error:", error)
      toast.error("Failed to clock in")
    } finally {
      setIsLoading(false)
    }
  }, [userId, fetchData])

  // Clock out handler
  const handleClockOut = useCallback(async () => {
    if (!userId) return

    try {
      setIsLoading(true)
      const response = await fetch("/api/time-records/clock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clock-out" }),
      })

      if (response.ok) {
        const data = await response.json()
        setClockStatus((prev) => ({ ...prev, isClockedIn: false, currentRecord: undefined }))
        setLastAction({ type: "out", timestamp: new Date() })
        toast.success("Successfully clocked out")
        await fetchData()
      } else {
        throw new Error("Failed to clock out")
      }
    } catch (error) {
      console.error("Clock out error:", error)
      toast.error("Failed to clock out")
    } finally {
      setIsLoading(false)
    }
  }, [userId, fetchData])

  // Initial data fetch
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Performance monitoring
  useEffect(() => {
    const metrics = getMetrics()
    if (metrics.renderTime > 100) {
      console.warn("ComprehensiveTimeTracker: Slow render detected", metrics)
    }
  }, [getMetrics])

  if (!isLoaded) {
    return <ClockLoading />
  }

  if (!userId) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="text-center">
            <p className="text-muted-foreground">Please sign in to access time tracking</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Main Clock Display */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Time Tracker
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <OptimizedClock size="large" showSeconds={true} />
          <StatusIndicator isClockedIn={clockStatus.isClockedIn} lastAction={lastAction} />
          <ClockButton
            isClockedIn={clockStatus.isClockedIn}
            onClockIn={handleClockIn}
            onClockOut={handleClockOut}
            lastAction={lastAction}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>

      {/* Today's Summary */}
      {clockStatus.totalHoursToday && (
        <Card>
          <CardHeader>
            <CardTitle>Today's Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <span className="font-medium">Total Hours: {clockStatus.totalHoursToday}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <TimeHistory records={timeRecords} isLoading={isLoading} />
    </div>
  )
}
