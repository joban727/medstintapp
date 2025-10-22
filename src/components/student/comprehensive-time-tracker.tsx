"use client"

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@clerk/nextjs'
import { Clock, Play, Square, History, Settings, User, BarChart3, Home, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import OptimizedClock from './optimized-clock'
import ClockLoading from './clock-loading'
import { usePerformanceMonitoring } from '@/lib/performance-monitoring'

// Types for time tracking
interface TimeRecord {
  id: string
  clockIn: Date
  clockOut?: Date
  totalHours?: string
  activities?: string[]
  notes?: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
}

interface ClockStatus {
  isClockedIn: boolean
  currentRecord?: TimeRecord
  lastClockIn?: Date
  totalHoursToday?: string
}



// Clock In/Out Button Component
const ClockButton = React.memo(({ 
  isClockedIn, 
  onClockIn, 
  onClockOut, 
  lastAction, 
  isLoading 
}: {
  isClockedIn: boolean
  onClockIn: () => void
  onClockOut: () => void
  lastAction?: { type: 'in' | 'out'; timestamp: Date }
  isLoading: boolean
}) => {
  const getButtonConfig = () => {
    if (isClockedIn) {
      return {
        text: 'Clock Out',
        icon: Square,
        variant: 'destructive' as const,
        onClick: onClockOut,
        className: 'bg-red-600 hover:bg-red-700 text-white'
      }
    }
      return {
        text: 'Clock In',
        icon: Play,
        variant: 'default' as const,
        onClick: onClockIn,
        className: 'bg-green-600 hover:bg-green-700 text-white'
      }
  }

  const config = getButtonConfig()
  const Icon = config.icon

  return (
    <Button
      onClick={config.onClick}
      disabled={isLoading}
      variant={config.variant}
      className={`w-full h-16 text-lg font-semibold transition-all duration-200 ${config.className} ${
        isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'
      }`}
    >
      {isLoading ? (
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          Processing...
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5" />
          {config.text}
        </div>
      )}
    </Button>
  )
})

ClockButton.displayName = 'ClockButton'

// Status Indicator Component
const StatusIndicator = React.memo(({ 
  isClockedIn, 
  lastAction 
}: {
  isClockedIn: boolean
  lastAction?: { type: 'in' | 'out'; timestamp: Date }
}) => {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusInfo = () => {
    if (isClockedIn) {
      return {
        text: 'Clocked In',
        color: 'bg-green-500',
        timestamp: lastAction?.type === 'in' ? lastAction.timestamp : undefined
      }
    }
      return {
        text: 'Clocked Out',
        color: 'bg-gray-400',
        timestamp: lastAction?.type === 'out' ? lastAction.timestamp : undefined
      }
  }

  const status = getStatusInfo()

  return (
    <div className="flex items-center justify-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg border">
      <div className={`w-3 h-3 rounded-full ${status.color} animate-pulse`} />
      <div className="text-center">
        <div className="font-semibold text-gray-900 dark:text-white">
          {status.text}
        </div>
        {status.timestamp && (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Since {formatTime(status.timestamp)}
          </div>
        )}
      </div>
    </div>
  )
})

StatusIndicator.displayName = 'StatusIndicator'

// Time History Component
const TimeHistory = React.memo(({ 
  records, 
  isLoading 
}: {
  records: TimeRecord[]
  isLoading: boolean
}) => {
  const formatRecordTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatRecordDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }

  const getStatusBadge = (status: string) => {
    const configs = {
      PENDING: { text: 'Pending', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
      APPROVED: { text: 'Approved', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
      REJECTED: { text: 'Rejected', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' }
    }
    const config = configs[status as keyof typeof configs]
    return <Badge className={config.className}>{config.text}</Badge>
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse bg-gray-200 dark:bg-gray-700 h-16 rounded-lg" />
        ))}
      </div>
    )
  }

  if (records.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>No time records found</p>
        <p className="text-sm">Your clock in/out history will appear here</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 max-h-64 overflow-y-auto">
      {records.map((record) => (
        <div key={record.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {formatRecordTime(record.clockIn)} - {record.clockOut ? formatRecordTime(record.clockOut) : '...'}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatRecordDate(record.clockIn)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {record.totalHours && (
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {record.totalHours}h
              </span>
            )}
            {getStatusBadge(record.status)}
          </div>
        </div>
      ))}
    </div>
  )
})

TimeHistory.displayName = 'TimeHistory'



// Main Comprehensive Time Tracker Component
export default function ComprehensiveTimeTracker({
  className = ""
}: {
  className?: string
}) {
  const { userId, isLoaded } = useAuth()
  const { getMetrics } = usePerformanceMonitoring('ComprehensiveTimeTracker')
  
  const [clockStatus, setClockStatus] = useState<ClockStatus>({
    isClockedIn: false
  })
  const [timeRecords, setTimeRecords] = useState<TimeRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [activeSection, setActiveSection] = useState('time-tracker')
  const [lastAction, setLastAction] = useState<{ type: 'in' | 'out'; timestamp: Date }>()

  // Fetch clock status and time records
  const fetchData = useCallback(async () => {
    if (!userId || !isLoaded) return

    setIsLoading(true)
    try {
      // Fetch clock status
      const statusResponse = await fetch('/api/time-records/status')
      const statusData = await statusResponse.json()
      
      if (statusResponse.ok) {
        setClockStatus({
          isClockedIn: statusData.isClockedIn,
          currentRecord: statusData.currentRecord,
          lastClockIn: statusData.lastClockIn ? new Date(statusData.lastClockIn) : undefined,
          totalHoursToday: statusData.totalHoursToday
        })
      }

      // Fetch recent time records
      const recordsResponse = await fetch('/api/time-records/recent?limit=5')
      const recordsData = await recordsResponse.json()
      
      if (recordsResponse.ok) {
        setTimeRecords(recordsData.records || [])
      }
    } catch (error) {
      console.error('Error fetching time data:', error)
      toast.error('Failed to load time tracking data')
    } finally {
      setIsLoading(false)
    }
  }, [userId, isLoaded])

  // Clock In functionality
  const handleClockIn = useCallback(async () => {
    if (!userId) {
      toast.error('Please sign in to clock in')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/time-records/clock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'clock-in',
          timestamp: new Date().toISOString()
        })
      })

      const data = await response.json()

      if (response.ok) {
        const now = new Date()
        setClockStatus(prev => ({
          ...prev,
          isClockedIn: true,
          currentRecord: data.record,
          lastClockIn: now
        }))
        setLastAction({ type: 'in', timestamp: now })
        toast.success('Successfully clocked in!')
        
        // Refresh data
        await fetchData()
      } else {
        toast.error(data.error || 'Failed to clock in')
      }
    } catch (error) {
      console.error('Clock in error:', error)
      toast.error('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [userId, fetchData])

  // Clock Out functionality
  const handleClockOut = useCallback(async () => {
    if (!userId || !clockStatus.currentRecord) {
      toast.error('No active clock in record found')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/time-records/clock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'clock-out',
          timeRecordId: clockStatus.currentRecord.id,
          timestamp: new Date().toISOString()
        })
      })

      const data = await response.json()

      if (response.ok) {
        const now = new Date()
        setClockStatus(prev => ({
          ...prev,
          isClockedIn: false,
          currentRecord: undefined
        }))
        setLastAction({ type: 'out', timestamp: now })
        toast.success(`Successfully clocked out! Total hours: ${data.totalHours}`)
        
        // Refresh data
        await fetchData()
      } else {
        toast.error(data.error || 'Failed to clock out')
      }
    } catch (error) {
      console.error('Clock out error:', error)
      toast.error('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [userId, clockStatus.currentRecord, fetchData])

  // Navigation handlers
  const handleBackToDashboard = useCallback(() => {
    window.location.href = '/dashboard/student'
  }, [])

  const handleViewHistory = useCallback(() => {
    setActiveSection('history')
  }, [])

  const handleViewSettings = useCallback(() => {
    window.location.href = '/dashboard/student/settings'
  }, [])



  // Initialize data on mount
  useEffect(() => {
    if (isLoaded && userId) {
      fetchData()
      
      // Set up periodic refresh
      const interval = setInterval(fetchData, 30000) // Refresh every 30 seconds
      
      return () => clearInterval(interval)
    }
  }, [isLoaded, userId, fetchData])

  // Performance monitoring
  useEffect(() => {
    const metrics = getMetrics()
    if (metrics) {
      console.log('ComprehensiveTimeTracker performance:', metrics)
    }
  }, [getMetrics])

  if (!isLoaded) {
    return <ClockLoading theme="ultra" />
  }

  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-6">
          <CardContent className="text-center">
            <Clock className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h2 className="text-xl font-semibold mb-2">Authentication Required</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Please sign in to access the time tracking system
            </p>
            <Button onClick={() => window.location.href = '/sign-in'}>
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-blue-900/20 ${className}`}>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Clean Header with Contextual Navigation */}
        <div className="mb-8">
          <div className="flex items-center justify-between bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-white/20 dark:border-gray-700/30 shadow-sm group">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToDashboard}
                className="gap-2 hover:bg-white/70 dark:hover:bg-gray-700/50 transition-all duration-200 hover:scale-105"
              >
                <Home className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" />
                <span className="hidden sm:inline">Dashboard</span>
              </Button>
              <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                Time Tracking
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleViewHistory}
                className="gap-2 hover:bg-white/70 dark:hover:bg-gray-700/50 transition-all duration-200 hover:scale-105"
              >
                <History className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" />
                <span className="hidden sm:inline">History</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleViewSettings}
                className="gap-2 hover:bg-white/70 dark:hover:bg-gray-700/50 transition-all duration-200 hover:scale-105"
              >
                <Settings className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" />
                <span className="hidden sm:inline">Settings</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4 duration-700">
          {/* Left Column - Clock and Status */}
          <div className="lg:col-span-2 space-y-6">
            {/* Prominent Clock Display */}
            <Card className="overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardContent className="p-0">
                <div className="relative">
                  <OptimizedClock
                    size="large"
                    showSeconds={true}
                    format="12h"
                    showDate={true}
                    theme="ultra"
                    className="min-h-[300px]"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Clock In/Out Controls */}
            <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Time Tracking Controls
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ClockButton
                    isClockedIn={clockStatus.isClockedIn}
                    onClockIn={handleClockIn}
                    onClockOut={handleClockOut}
                    lastAction={lastAction}
                    isLoading={isLoading}
                  />
                  <div className="flex items-center justify-center p-4 bg-gradient-to-r from-gray-50/70 to-blue-50/30 dark:from-gray-800/70 dark:to-blue-900/20 backdrop-blur-sm rounded-lg border border-white/30 dark:border-gray-700/30">
                    <StatusIndicator
                      isClockedIn={clockStatus.isClockedIn}
                      lastAction={lastAction}
                    />
                  </div>
                </div>
                
                {clockStatus.totalHoursToday && (
                  <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="text-sm text-blue-600 dark:text-blue-400">
                      Total hours today
                    </div>
                    <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                      {clockStatus.totalHoursToday}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - History and Stats */}
          <div className="space-y-6">
            {/* Recent Time History */}
            <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TimeHistory records={timeRecords} isLoading={isLoading} />
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Today's Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Status</span>
                  <Badge variant={clockStatus.isClockedIn ? 'default' : 'secondary'}>
                    {clockStatus.isClockedIn ? 'Clocked In' : 'Clocked Out'}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Records Today</span>
                  <span className="font-medium">
                    {timeRecords.filter(r => 
                      new Date(r.clockIn).toDateString() === new Date().toDateString()
                    ).length}
                  </span>
                </div>
                {clockStatus.totalHoursToday && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Total Hours</span>
                    <span className="font-medium">{clockStatus.totalHoursToday}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}