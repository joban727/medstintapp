"use client"

import React, { useState, useEffect, useMemo, memo, useCallback } from 'react'
import { usePerformanceMonitoring } from '@/lib/performance-monitoring'

// Optimized loading states for better UX
enum LoadingState {
  IDLE = 'idle',
  LOADING = 'loading',
  READY = 'ready',
  ERROR = 'error'
}

interface OptimizedClockProps {
  className?: string
  showSeconds?: boolean
  format?: '12h' | '24h'
  size?: 'small' | 'medium' | 'large' | 'xl'
  showDate?: boolean
  theme?: 'minimal' | 'ultra'
}

// Memoized time formatter for performance - always exclude seconds for cleaner display
const createTimeFormatter = (format: '12h' | '24h', showSeconds: boolean) => {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    // Always exclude seconds for cleaner HH:MM display
    hour12: format === '12h'
  })
}

const createDateFormatter = () => {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

// Optimized clock display component
const ClockDisplay = memo(function ClockDisplay({ 
  time, 
  size, 
  theme 
}: { 
  time: Date
  size: string
  theme: 'minimal' | 'ultra'
}) {
  const timeFormatter = useMemo(() => createTimeFormatter('12h', true), [])
  const dateFormatter = useMemo(() => createDateFormatter(), [])
  
  const timeString = useMemo(() => {
    return timeFormatter.format(time)
  }, [time, timeFormatter])
  
  const dateString = useMemo(() => {
    return dateFormatter.format(time)
  }, [time, dateFormatter])
  
  const dayString = useMemo(() => {
    return time.toLocaleDateString('en-US', { weekday: 'short' })
  }, [time])

  const sizeClasses = {
    small: 'text-3xl md:text-4xl',
    medium: 'text-4xl md:text-5xl lg:text-6xl',
    large: 'text-5xl md:text-6xl lg:text-7xl xl:text-8xl',
    xl: 'text-6xl md:text-7xl lg:text-8xl xl:text-9xl'
  }

  const themeStyles = {
    minimal: {
      container: 'bg-background',
      time: 'font-light text-foreground',
      date: 'text-muted-foreground',
      day: 'text-primary'
    },
    ultra: {
      container: 'bg-background',
      time: 'font-thin text-foreground tracking-tighter',
      date: 'text-muted-foreground',
      day: 'text-muted-foreground'
    }
  }

  const currentTheme = themeStyles[theme]

  return (
    <div className={`${currentTheme.container} transition-colors duration-300`}>
      <div className="flex flex-col items-center justify-center min-h-screen p-8">
        {/* Day indicator for minimal theme */}
        {theme === 'minimal' && (
          <div className={`text-xs font-semibold mb-2 uppercase tracking-wide ${currentTheme.day} transition-colors duration-300`}>
            {dayString}
          </div>
        )}
        
        {/* Time Display */}
        <div className="text-center">
          <div className={`${sizeClasses[size]} ${currentTheme.time} transition-colors duration-300`}>
            {timeString}
          </div>
        </div>

        {/* Date Display */}
        <div className="mt-6 text-center">
          <div className={`text-lg md:text-xl font-light ${currentTheme.date} transition-colors duration-300`}>
            {dateString}
          </div>
        </div>

        {/* Subtle separator for minimal theme */}
        {theme === 'minimal' && (
          <div className="mt-8">
            <div className="w-16 h-px bg-border transition-colors duration-300" />
          </div>
        )}
      </div>
    </div>
  )
})

// Optimized loading skeleton
const LoadingSkeleton = memo(function LoadingSkeleton({ theme }: { theme: 'minimal' | 'ultra' }) {
  const themeStyles = {
    minimal: 'bg-background',
    ultra: 'bg-background'
  }

  return (
    <div className={`${themeStyles[theme]} transition-colors duration-300`}>
      <div className="flex flex-col items-center justify-center min-h-screen p-8">
        <div className="text-center">
          <div className="text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-light text-muted-foreground animate-pulse">
            00:00
          </div>
        </div>
        <div className="mt-6 text-center">
          <div className="text-lg md:text-xl font-light text-muted-foreground animate-pulse">
            Loading...
          </div>
        </div>
      </div>
    </div>
  )
})

// Main optimized clock component
const OptimizedClock = memo(function OptimizedClock({
  className = '',
  showSeconds = true,
  format = '12h',
  size = 'large',
  showDate = true,
  theme = 'minimal'
}: OptimizedClockProps) {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [loadingState, setLoadingState] = useState<LoadingState>(LoadingState.IDLE)
  const [isClient, setIsClient] = useState(false)
  
  // Performance monitoring
  const { getMetrics } = usePerformanceMonitoring('OptimizedClock')

  // Optimized time update with RAF for smooth performance
  const updateTime = useCallback(() => {
    setCurrentTime(new Date())
  }, [])

  useEffect(() => {
    setLoadingState(LoadingState.LOADING)
    setIsClient(true)
    
    // Use requestAnimationFrame for smooth updates
    let animationFrameId: number
    let lastSecond = -1
    
    const tick = () => {
      const now = new Date()
      const currentSecond = now.getSeconds()
      
      // Since we're only showing HH:MM, update only when minute changes (at second 0)
      if (currentSecond === 0 && currentSecond !== lastSecond) {
        setCurrentTime(now)
        lastSecond = currentSecond
        setLoadingState(LoadingState.READY)
      }
      
      animationFrameId = requestAnimationFrame(tick)
    }
    
    animationFrameId = requestAnimationFrame(tick)
    
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }
    }
  }, [showSeconds])

  // Handle loading states efficiently
  if (loadingState === LoadingState.LOADING || !isClient) {
    return <LoadingSkeleton theme={theme} />
  }

  return (
    <div className={`min-h-screen ${className}`}>
      <ClockDisplay 
        time={currentTime} 
        size={size} 
        theme={theme}
      />
    </div>
  )
})

OptimizedClock.displayName = 'OptimizedClock'

export default OptimizedClock