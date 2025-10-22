/**
 * useTimeSync Hook - Client-side time synchronization integration
 * 
 * Provides real-time synchronized time updates with connection management
 * and fallback protocols for React components.
 * 
 * Features:
 * - Real-time time updates with ±100ms accuracy
 * - Connection status monitoring
 * - Automatic fallback protocol handling
 * - Performance optimized with minimal re-renders
 * - Offline resilience
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { getTimeSyncService, type TimeSyncService, type SyncStatus } from '../lib/time-sync-service'
import { logger } from '../lib/logger'

// Hook configuration
interface TimeSyncHookConfig {
  autoStart?: boolean
  updateInterval?: number // milliseconds for local updates between syncs
  enableLogging?: boolean
}

// Hook return type
interface TimeSyncHookReturn {
  currentTime: Date
  status: SyncStatus
  isConnected: boolean
  accuracy: 'high' | 'medium' | 'low'
  drift: number
  protocol: string
  connectionHealth: number
  forceSync: () => Promise<void>
  getFormattedTime: (format?: 'time' | 'date' | 'datetime' | 'iso') => string
}

// Default configuration
const DEFAULT_CONFIG: Required<TimeSyncHookConfig> = {
  autoStart: true,
  updateInterval: 100, // 100ms for smooth UI updates
  enableLogging: false
}

/**
 * Custom hook for time synchronization
 */
export function useTimeSync(config: TimeSyncHookConfig = {}): TimeSyncHookReturn {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }
  
  // State management
  const [currentTime, setCurrentTime] = useState<Date>(new Date())
  const [status, setStatus] = useState<SyncStatus>({
    isConnected: false,
    protocol: 'offline',
    accuracy: 'low',
    drift: 0,
    lastSync: new Date(),
    connectionHealth: 0,
    retryCount: 0
  })

  // Service and cleanup refs
  const serviceRef = useRef<TimeSyncService | null>(null)
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const statusUnsubscribeRef = useRef<(() => void) | null>(null)
  const timeUnsubscribeRef = useRef<(() => void) | null>(null)

  /**
   * Initialize the time synchronization service
   */
  const initializeService = useCallback(() => {
    if (serviceRef.current) return serviceRef.current

    try {
      const service = getTimeSyncService()
      serviceRef.current = service

      // Subscribe to status updates
      statusUnsubscribeRef.current = service.onStatusChange((newStatus) => {
        setStatus(newStatus)
        
        if (finalConfig.enableLogging) {
          logger.info('Time sync status updated', { 
            protocol: newStatus.protocol,
            isConnected: newStatus.isConnected,
            accuracy: newStatus.accuracy,
            drift: newStatus.drift
          })
        }
      })

      // Subscribe to time updates from the service
      timeUnsubscribeRef.current = service.onTimeUpdate((syncedTime) => {
        setCurrentTime(syncedTime)
        
        if (finalConfig.enableLogging) {
          logger.debug('Synchronized time updated', { 
            time: syncedTime.toISOString(),
            drift: service.getStatus().drift
          })
        }
      })

      // Get initial status
      setStatus(service.getStatus())
      setCurrentTime(service.getSynchronizedTime())

      return service
    } catch (error) {
      logger.error('Failed to initialize time sync service', { error })
      return null
    }
  }, [finalConfig.enableLogging])

  /**
   * Start local time updates for smooth UI
   */
  const startLocalUpdates = useCallback(() => {
    if (updateIntervalRef.current) return

    updateIntervalRef.current = setInterval(() => {
      const service = serviceRef.current
      if (service) {
        // Use synchronized time when available, fallback to local time
        const newTime = service.getSynchronizedTime()
        setCurrentTime(newTime)
      } else {
        // Fallback to local time
        setCurrentTime(new Date())
      }
    }, finalConfig.updateInterval)
  }, [finalConfig.updateInterval])

  /**
   * Stop local time updates
   */
  const stopLocalUpdates = useCallback(() => {
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current)
      updateIntervalRef.current = null
    }
  }, [])

  /**
   * Force synchronization
   */
  const forceSync = useCallback(async () => {
    const service = serviceRef.current
    if (service) {
      try {
        await service.forceSync()
        
        if (finalConfig.enableLogging) {
          logger.info('Force sync completed')
        }
      } catch (error) {
        logger.error('Force sync failed', { error })
      }
    }
  }, [finalConfig.enableLogging])

  /**
   * Format time based on specified format
   */
  const getFormattedTime = useCallback((format: 'time' | 'date' | 'datetime' | 'iso' = 'time'): string => {
    try {
      switch (format) {
        case 'time':
          return currentTime.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })
        
        case 'date':
          return currentTime.toLocaleDateString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          })
        
        case 'datetime':
          return currentTime.toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          })
        
        case 'iso':
          return currentTime.toISOString()
        
        default:
          return currentTime.toLocaleTimeString()
      }
    } catch (error) {
      logger.warn('Time formatting error', { error, format })
      return currentTime.toString()
    }
  }, [currentTime])

  /**
   * Initialize service and start updates on mount
   */
  useEffect(() => {
    if (finalConfig.autoStart) {
      initializeService()
      startLocalUpdates()
    }

    return () => {
      // Cleanup on unmount
      stopLocalUpdates()
      
      if (statusUnsubscribeRef.current) {
        statusUnsubscribeRef.current()
        statusUnsubscribeRef.current = null
      }
      
      if (timeUnsubscribeRef.current) {
        timeUnsubscribeRef.current()
        timeUnsubscribeRef.current = null
      }
    }
  }, [finalConfig.autoStart, initializeService, startLocalUpdates, stopLocalUpdates])

  /**
   * Handle visibility change to optimize performance
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden, reduce update frequency
        stopLocalUpdates()
      } else {
        // Page is visible, resume normal updates
        startLocalUpdates()
        
        // Force sync when page becomes visible
        if (serviceRef.current) {
          serviceRef.current.forceSync().catch(error => {
            logger.warn('Auto sync on visibility change failed', { error })
          })
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [startLocalUpdates, stopLocalUpdates])

  return {
    currentTime,
    status,
    isConnected: status.isConnected,
    accuracy: status.accuracy,
    drift: status.drift,
    protocol: status.protocol,
    connectionHealth: status.connectionHealth,
    forceSync,
    getFormattedTime
  }
}

/**
 * Lightweight hook for components that only need the current time
 */
export function useCurrentTime(updateInterval = 1000): Date {
  const [currentTime, setCurrentTime] = useState<Date>(new Date())
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Try to get synchronized time from the global service
    const service = getTimeSyncService()
    
    const updateTime = () => {
      const newTime = service ? service.getSynchronizedTime() : new Date()
      setCurrentTime(newTime)
    }

    // Initial update
    updateTime()

    // Set up interval
    intervalRef.current = setInterval(updateTime, updateInterval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [updateInterval])

  return currentTime
}

/**
 * Hook for monitoring sync status only
 */
export function useSyncStatus(): Pick<TimeSyncHookReturn, 'status' | 'isConnected' | 'accuracy' | 'drift' | 'protocol' | 'connectionHealth'> {
  const [status, setStatus] = useState<SyncStatus>({
    isConnected: false,
    protocol: 'offline',
    accuracy: 'low',
    drift: 0,
    lastSync: new Date(),
    connectionHealth: 0,
    retryCount: 0
  })

  useEffect(() => {
    const service = getTimeSyncService()
    
    // Get initial status
    setStatus(service.getStatus())

    // Subscribe to status updates
    const unsubscribe = service.onStatusChange(setStatus)

    return unsubscribe
  }, [])

  return {
    status,
    isConnected: status.isConnected,
    accuracy: status.accuracy,
    drift: status.drift,
    protocol: status.protocol,
    connectionHealth: status.connectionHealth
  }
}