import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@clerk/nextjs'

interface TimeSyncData {
  type: 'time_sync' | 'heartbeat' | 'connection'
  timestamp: number
  serverTime: string
  clientId: string
  pollInterval?: number
}

interface SyncStats {
  sessionActive: boolean
  lastSync: string | null
  protocol: 'sse' | 'longpoll' | null
  recentEventCount: number
  averageDrift: number
  maxDrift: number
}

interface DriftMeasurement {
  timestamp: number
  driftMs: number
  roundTripTime?: number
  networkLatency?: number
}

interface TimeSyncState {
  isConnected: boolean
  clientId: string | null
  serverTime: Date | null
  driftMs: number
  syncAccuracy: 'high' | 'medium' | 'low'
  protocol: 'sse' | 'longpoll' | null
  stats: SyncStats | null
  error: string | null
  // Enhanced drift detection fields
  driftHistory: DriftMeasurement[]
  averageDrift: number
  driftTrend: 'stable' | 'increasing' | 'decreasing'
  lastCorrectionTime: number | null
  correctionCount: number
}

export function useTimeSync() {
  const { isSignedIn } = useAuth()
  const [state, setState] = useState<TimeSyncState>({
    isConnected: false,
    clientId: null,
    serverTime: null,
    driftMs: 0,
    syncAccuracy: 'medium',
    protocol: null,
    stats: null,
    error: null,
    driftHistory: [],
    averageDrift: 0,
    driftTrend: 'stable',
    lastCorrectionTime: null,
    correctionCount: 0,
  })

  // Disable time sync in development to prevent API errors
  const isTimeSyncEnabled = process.env.NODE_ENV === 'production'

  const eventSourceRef = useRef<EventSource | null>(null)
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const clientIdRef = useRef<string | null>(null)
  const lastEventTimeRef = useRef<number>(0)
  const requestStartTimeRef = useRef<number>(0)

  // Constants for drift detection
  const DRIFT_HISTORY_SIZE = 20
  const SIGNIFICANT_DRIFT_THRESHOLD = 50
  const CORRECTION_THRESHOLD = 100
  const OUTLIER_THRESHOLD = 3 // Standard deviations

  // Generate or get client ID
  const getClientId = useCallback(() => {
    if (!clientIdRef.current) {
      clientIdRef.current = `client_${Date.now()}_${Math.random().toString(36).substring(2)}`
    }
    return clientIdRef.current
  }, [])

  // Calculate time drift with network latency compensation
  const calculateDrift = useCallback((serverTimestamp: number, clientTimestamp: number, requestStartTime?: number) => {
    let networkLatency = 0
    let roundTripTime = 0
    
    if (requestStartTime) {
      roundTripTime = clientTimestamp - requestStartTime
      networkLatency = roundTripTime / 2 // Estimate one-way latency
    }
    
    // Compensate for network latency
    const compensatedServerTime = serverTimestamp + networkLatency
    const drift = compensatedServerTime - clientTimestamp
    
    return { drift, roundTripTime, networkLatency }
  }, [])

  // Detect outliers using statistical analysis
  const isOutlier = useCallback((newDrift: number, history: DriftMeasurement[]) => {
    if (history.length < 5) return false
    
    const drifts = history.map(h => h.driftMs)
    const mean = drifts.reduce((sum, d) => sum + d, 0) / drifts.length
    const variance = drifts.reduce((sum, d) => sum + (d - mean) ** 2, 0) / drifts.length
    const stdDev = Math.sqrt(variance)
    
    return Math.abs(newDrift - mean) > (OUTLIER_THRESHOLD * stdDev)
  }, [])

  // Calculate drift trend
  const calculateDriftTrend = useCallback((history: DriftMeasurement[]) => {
    if (history.length < 3) return 'stable'
    
    const recent = history.slice(-5)
    const older = history.slice(-10, -5)
    
    if (recent.length === 0 || older.length === 0) return 'stable'
    
    const recentAvg = recent.reduce((sum, h) => sum + h.driftMs, 0) / recent.length
    const olderAvg = older.reduce((sum, h) => sum + h.driftMs, 0) / older.length
    
    const difference = Math.abs(recentAvg - olderAvg)
    
    if (difference < 10) return 'stable'
    return recentAvg > olderAvg ? 'increasing' : 'decreasing'
  }, [])

  // Apply adaptive drift correction
  const applyDriftCorrection = useCallback((currentDrift: number, history: DriftMeasurement[]) => {
    if (history.length < 3) return currentDrift
    
    // Use weighted average of recent measurements
    const recentHistory = history.slice(-5)
    const weights = recentHistory.map((_, index) => index + 1) // More weight to recent measurements
    const totalWeight = weights.reduce((sum, w) => sum + w, 0)
    
    const weightedDrift = recentHistory.reduce((sum, measurement, index) => {
      return sum + (measurement.driftMs * weights[index])
    }, 0) / totalWeight
    
    // Smooth the correction to avoid sudden jumps
    const smoothingFactor = 0.3
    return currentDrift * (1 - smoothingFactor) + weightedDrift * smoothingFactor
  }, [])

  // Report drift to server with enhanced data
  const reportDrift = useCallback(async (clientId: string, driftMs: number, networkLatency?: number, roundTripTime?: number) => {
    try {
      await fetch('/api/time-sync/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          clientTime: new Date().toISOString(),
          clientTimestamp: Date.now(),
          driftMs,
          networkLatency,
          roundTripTime,
          correctionCount: state.correctionCount,
        }),
      })
    } catch (error) {
      console.error('Failed to report drift:', error)
    }
  }, [state.correctionCount])

  // Process sync data with enhanced drift detection
  const processSyncData = useCallback((data: TimeSyncData) => {
    const clientTimestamp = Date.now()
    const serverTimestamp = data.timestamp
    const requestStartTime = requestStartTimeRef.current
    
    const { drift, roundTripTime, networkLatency } = calculateDrift(
      serverTimestamp, 
      clientTimestamp, 
      requestStartTime
    )
    
    setState(prev => {
      // Check for outliers
      if (isOutlier(drift, prev.driftHistory)) {
        console.warn('Drift outlier detected:', drift, 'ms')
        // Don't update state with outlier, but log it
        return prev
      }
      
      // Update drift history
      const newMeasurement: DriftMeasurement = {
        timestamp: clientTimestamp,
        driftMs: drift,
        roundTripTime,
        networkLatency,
      }
      
      const updatedHistory = [...prev.driftHistory, newMeasurement]
        .slice(-DRIFT_HISTORY_SIZE) // Keep only recent measurements
      
      // Calculate average drift from history
      const averageDrift = updatedHistory.length > 0 
        ? updatedHistory.reduce((sum, h) => sum + h.driftMs, 0) / updatedHistory.length
        : drift
      
      // Apply adaptive correction
      const correctedDrift = applyDriftCorrection(drift, updatedHistory)
      
      // Calculate drift trend
      const driftTrend = calculateDriftTrend(updatedHistory)
      
      // Determine if correction is needed
      const needsCorrection = Math.abs(correctedDrift) > CORRECTION_THRESHOLD
      const correctionCount = needsCorrection ? prev.correctionCount + 1 : prev.correctionCount
      const lastCorrectionTime = needsCorrection ? clientTimestamp : prev.lastCorrectionTime
      
      return {
        ...prev,
        serverTime: new Date(data.serverTime),
        driftMs: correctedDrift,
        syncAccuracy: Math.abs(correctedDrift) < 100 ? 'high' : Math.abs(correctedDrift) < 500 ? 'medium' : 'low',
        error: null,
        driftHistory: updatedHistory,
        averageDrift,
        driftTrend,
        lastCorrectionTime,
        correctionCount,
      }
    })

    // Report significant drift
    if (Math.abs(drift) > SIGNIFICANT_DRIFT_THRESHOLD && data.clientId) {
      reportDrift(data.clientId, drift, networkLatency, roundTripTime)
    }

    lastEventTimeRef.current = clientTimestamp
  }, [calculateDrift, isOutlier, applyDriftCorrection, calculateDriftTrend, reportDrift])

  // SSE connection
  const connectSSE = useCallback(() => {
    if (!isSignedIn) return

    const clientId = getClientId()
    const url = `/api/time-sync/connect?clientId=${clientId}`
    
    requestStartTimeRef.current = Date.now()
    eventSourceRef.current = new EventSource(url)
    
    eventSourceRef.current.onopen = () => {
      setState(prev => ({
        ...prev,
        isConnected: true,
        clientId,
        protocol: 'sse',
        error: null,
      }))
    }

    eventSourceRef.current.onmessage = (event) => {
      try {
        const data: TimeSyncData = JSON.parse(event.data)
        processSyncData(data)
      } catch (error) {
        console.error('Failed to parse SSE data:', error)
      }
    }

    eventSourceRef.current.onerror = (error) => {
      console.error('SSE error:', error)
      setState(prev => ({
        ...prev,
        isConnected: false,
        error: 'SSE connection failed',
      }))
      
      // Fallback to long polling after SSE failure
      setTimeout(() => {
        if (eventSourceRef.current?.readyState === EventSource.CLOSED) {
          connectLongPoll()
        }
      }, 1000)
    }
  }, [isSignedIn, getClientId, processSyncData])

  // Long polling fallback
  const connectLongPoll = useCallback(async () => {
    if (!isSignedIn) return

    const clientId = getClientId()
    
    try {
      requestStartTimeRef.current = Date.now()
      const url = `/api/time-sync/poll?clientId=${clientId}&lastEventTime=${lastEventTimeRef.current}`
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data: TimeSyncData = await response.json()
      
      setState(prev => ({
        ...prev,
        isConnected: true,
        clientId,
        protocol: 'longpoll',
        error: null,
      }))

      processSyncData(data)

      // Schedule next poll
      const pollInterval = data.pollInterval || 5000
      pollTimeoutRef.current = setTimeout(connectLongPoll, pollInterval)

    } catch (error) {
      console.error('Long polling error:', error)
      setState(prev => ({
        ...prev,
        isConnected: false,
        error: 'Long polling failed',
      }))
      
      // Retry after delay
      pollTimeoutRef.current = setTimeout(connectLongPoll, 10000)
    }
  }, [isSignedIn, getClientId, processSyncData])

  // Get sync status and stats
  const getSyncStatus = useCallback(async () => {
    if (!state.clientId) return

    try {
      const response = await fetch(`/api/time-sync/status?clientId=${state.clientId}`)
      if (response.ok) {
        const data = await response.json()
        setState(prev => ({
          ...prev,
          stats: data.syncStats,
        }))
      }
    } catch (error) {
      console.error('Failed to get sync status:', error)
    }
  }, [state.clientId])

  // Get corrected timestamp for clock operations with enhanced precision
  const getCorrectedTimestamp = useCallback(() => {
    if (!state.serverTime || state.driftHistory.length === 0) {
      return new Date()
    }
    
    // Use the most recent corrected drift
    const correctedTime = new Date(Date.now() - state.driftMs)
    return correctedTime
  }, [state.serverTime, state.driftMs, state.driftHistory.length])

  // Get drift statistics for debugging/monitoring
  const getDriftStatistics = useCallback(() => {
    if (state.driftHistory.length === 0) return null
    
    const drifts = state.driftHistory.map(h => h.driftMs)
    const min = Math.min(...drifts)
    const max = Math.max(...drifts)
    const variance = drifts.reduce((sum, d) => sum + (d - state.averageDrift) ** 2, 0) / drifts.length
    const stdDev = Math.sqrt(variance)
    
    return {
      count: state.driftHistory.length,
      average: state.averageDrift,
      min,
      max,
      stdDev,
      trend: state.driftTrend,
      correctionCount: state.correctionCount,
      lastCorrectionTime: state.lastCorrectionTime,
    }
  }, [state.driftHistory, state.averageDrift, state.driftTrend, state.correctionCount, state.lastCorrectionTime])

  // Initialize connection
  useEffect(() => {
    if (!isSignedIn || !isTimeSyncEnabled) {
      setState(prev => ({
        ...prev,
        isConnected: false,
        clientId: null,
        error: isTimeSyncEnabled ? 'Not authenticated' : 'Time sync disabled in development',
      }))
      return
    }

    // Try SSE first, fallback to long polling
    connectSSE()

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current)
        pollTimeoutRef.current = null
      }
    }
  }, [isSignedIn, isTimeSyncEnabled, connectSSE])

  // Periodic status updates
  useEffect(() => {
    if (state.isConnected && state.clientId && isTimeSyncEnabled) {
      getSyncStatus()
      const statusInterval = setInterval(getSyncStatus, 30000) // Every 30 seconds
      return () => clearInterval(statusInterval)
    }
  }, [state.isConnected, state.clientId, isTimeSyncEnabled, getSyncStatus])

  return {
    ...state,
    getCorrectedTimestamp,
    getDriftStatistics,
    reconnect: () => {
      if (state.protocol === 'sse') {
        connectSSE()
      } else {
        connectLongPoll()
      }
    },
  }
}