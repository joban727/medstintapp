"use client"

import React, { useState, useEffect, useMemo, memo } from 'react'

interface UltraMinimalistClockProps {
  className?: string
  showSeconds?: boolean
  format?: '12h' | '24h'
  size?: 'small' | 'medium' | 'large' | 'xl'
  showDate?: boolean
}

const UltraMinimalistClock = memo(function UltraMinimalistClock({
  className = '',
  showSeconds = true,
  format = '12h',
  size = 'large',
  showDate = true
}: UltraMinimalistClockProps) {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const timeFormat = useMemo(() => {
    const options: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: format === '12h'
    }
    
    if (showSeconds) {
      options.second = '2-digit'
    }
    
    return options
  }, [format, showSeconds])

  const dateFormat = useMemo(() => {
    return {
      weekday: 'long' as const,
      year: 'numeric' as const,
      month: 'long' as const,
      day: 'numeric' as const
    }
  }, [])

  const timeString = useMemo(() => {
    return isClient ? currentTime.toLocaleTimeString('en-US', timeFormat) : '00:00:00'
  }, [currentTime, timeFormat, isClient])

  const dateString = useMemo(() => {
    return isClient ? currentTime.toLocaleDateString('en-US', dateFormat) : 'Loading...'
  }, [currentTime, dateFormat, isClient])

  const sizeClasses = {
    small: 'text-4xl md:text-5xl',
    medium: 'text-5xl md:text-6xl lg:text-7xl',
    large: 'text-6xl md:text-7xl lg:text-8xl xl:text-9xl',
    xl: 'text-7xl md:text-8xl lg:text-9xl xl:text-10xl'
  }

  return (
    <div className={`min-h-screen bg-white dark:bg-black transition-colors duration-300 ${className}`}>
      <div className="flex flex-col items-center justify-center min-h-screen">
        {/* Time Display - Ultra Clean */}
        <div className="text-center px-8">
          <div className={`${sizeClasses[size]} font-thin text-black dark:text-white transition-colors duration-300 tracking-tighter leading-none`}>
            {timeString}
          </div>
        </div>

        {/* Date Display - Optional */}
        {showDate && (
          <div className="mt-8 text-center">
            <div className="text-xl md:text-2xl text-gray-700 dark:text-gray-300 transition-colors duration-300 font-light tracking-wide">
              {dateString}
            </div>
          </div>
        )}
      </div>
    </div>
  )
})

UltraMinimalistClock.displayName = 'UltraMinimalistClock'

export default UltraMinimalistClock