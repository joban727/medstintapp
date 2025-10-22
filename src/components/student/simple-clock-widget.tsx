'use client'

import React, { useState, useEffect } from 'react'
import { Clock } from 'lucide-react'
import { ThemeAwareCard, ThemeAwareCardContent } from '@/components/ui/theme-aware-card'

export default function SimpleClockWidget() {
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <ThemeAwareCard className="w-full">
      <ThemeAwareCardContent className="p-6">
        <div className="flex items-center justify-center space-y-4 flex-col">
          <div className="flex items-center gap-3">
            <Clock className="h-6 w-6 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Current Time</h2>
          </div>
          
          <div className="text-center space-y-2">
            <div className="text-4xl font-mono font-bold text-foreground">
              {formatTime(currentTime)}
            </div>
            <div className="text-sm text-muted-foreground">
              {formatDate(currentTime)}
            </div>
          </div>
        </div>
      </ThemeAwareCardContent>
    </ThemeAwareCard>
  )
}