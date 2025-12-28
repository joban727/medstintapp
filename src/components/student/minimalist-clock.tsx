"use client"

import React, { useState, useEffect, useMemo, memo } from "react"

interface MinimalistClockProps {
  className?: string
  showSeconds?: boolean
  format?: "12h" | "24h"
  size?: "small" | "medium" | "large" | "xl"
}

const MinimalistClock = memo(function MinimalistClock({
  className = "",
  showSeconds = true,
  format = "12h",
  size = "large",
}: MinimalistClockProps) {
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
      hour: "2-digit",
      minute: "2-digit",
      hour12: format === "12h",
    }

    if (showSeconds) {
      options.second = "2-digit"
    }

    return options
  }, [format, showSeconds])

  const dateFormat = useMemo(() => {
    return {
      weekday: "long" as const,
      year: "numeric" as const,
      month: "long" as const,
      day: "numeric" as const,
    }
  }, [])

  const timeString = useMemo(() => {
    return isClient ? currentTime.toLocaleTimeString("en-US", timeFormat) : "00:00:00"
  }, [currentTime, timeFormat, isClient])

  const dateString = useMemo(() => {
    return isClient ? currentTime.toLocaleDateString("en-US", dateFormat) : "Loading..."
  }, [currentTime, dateFormat, isClient])

  const sizeClasses = {
    small: "text-3xl md:text-4xl",
    medium: "text-4xl md:text-5xl lg:text-6xl",
    large: "text-5xl md:text-6xl lg:text-7xl xl:text-8xl",
    xl: "text-6xl md:text-7xl lg:text-8xl xl:text-9xl",
  }

  return (
    <div
      className={`min-h-screen bg-white dark:bg-gray-900 transition-color duration-200s duration-300 ${className}`}
    >
      <div className="flex flex-col items-center justify-center min-h-screen p-8">
        {/* Time Display */}
        <div className="text-center">
          <div
            className={`${sizeClasses[size]} font-light text-gray-900 dark:text-white transition-color duration-200s duration-300 tracking-tight`}
          >
            {timeString}
          </div>
        </div>

        {/* Date Display */}
        <div className="mt-6 text-center">
          <div className="text-lg md:text-xl text-gray-600 dark:text-gray-300 transition-color duration-200s duration-300 font-light">
            {dateString}
          </div>
        </div>

        {/* Subtle separator */}
        <div className="mt-8">
          <div className="w-16 h-px bg-gray-300 dark:bg-gray-600 transition-color duration-200s duration-300" />
        </div>
      </div>
    </div>
  )
})

MinimalistClock.displayName = "MinimalistClock"

export default MinimalistClock
