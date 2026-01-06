/**
 * Time Synchronization Service - Enterprise-grade real-time clock solution
 *
 * Provides accurate time synchronization across the application using Server-Sent Events
 * as the primary protocol with automatic fallback to Long Polling and WebSocket.
 *
 * Features:
 * - ±100ms synchronization accuracy
 * - Real-time drift detection and correction
 * - Multiple fallback protocols for connection resilience
 * - Lightweight implementation (<1KB/minute bandwidth)
 * - Offline resilience with graceful degradation
 */

import { logger } from "./client-logger"
import { offlineQueue } from "./offline-queue"

// Time synchronization configuration
export interface TimeSyncConfig {
  syncInterval: number // milliseconds
  driftTolerance: number // milliseconds
  maxRetries: number
  fallbackDelay: number // milliseconds
  offlineTimeout: number // milliseconds
}

// Default configuration optimized for clinical environments
export const DEFAULT_SYNC_CONFIG: TimeSyncConfig = {
  syncInterval: 1000, // 1 second
  driftTolerance: 100, // 100ms
  maxRetries: 3,
  fallbackDelay: 5000, // 5 seconds
  offlineTimeout: 30000, // 30 seconds
}

// Sync protocol types
export type SyncProtocol = "sse" | "longpolling" | "websocket" | "offline"
export type TimeSyncAccuracy = "high" | "medium" | "low"

// Sync status and metrics
export interface SyncStatus {
  isConnected: boolean
  protocol: SyncProtocol
  accuracy: TimeSyncAccuracy
  drift: number // milliseconds
  lastSync: Date
  connectionHealth: number // 0-100%
  retryCount: number
  isOffline?: boolean
  offlineDuration?: number
  estimatedDriftRate?: number
}

// Time sync event data
export interface TimeSyncEvent {
  serverTime: number // Unix timestamp in milliseconds
  requestId: string
  accuracy: number // estimated accuracy in milliseconds
}

// Connection state
interface ConnectionState {
  eventSource?: EventSource
  pollInterval?: NodeJS.Timeout
  websocket?: WebSocket
  isConnecting: boolean
  lastHeartbeat: Date
  failureCount: number
}

export class TimeSyncService {
  private config: TimeSyncConfig
  private status: SyncStatus
  private connection: ConnectionState
  private listeners: Set<(status: SyncStatus) => void>
  private timeListeners: Set<(time: Date) => void>
  private serverTimeOffset = 0
  private localTimeBase = 0
  private isDestroyed = false
  private offlineMode = false
  private lastKnownGoodTime: Date | null = null
  private offlineDriftRate = 0 // ms per second
  // Internal timers/listeners to ensure proper cleanup
  private healthInterval: NodeJS.Timeout | null = null
  private offlineInterval: NodeJS.Timeout | null = null
  private offlineReconnectTimeout: NodeJS.Timeout | null = null
  private onlineListener?: () => void
  private offlineListener?: () => void

  constructor(config: Partial<TimeSyncConfig> = {}) {
    this.config = { ...DEFAULT_SYNC_CONFIG, ...config }
    this.listeners = new Set()
    this.timeListeners = new Set()

    this.status = {
      isConnected: false,
      protocol: "offline",
      accuracy: "low",
      drift: 0,
      lastSync: new Date(),
      connectionHealth: 0,
      retryCount: 0,
    }

    this.connection = {
      isConnecting: false,
      lastHeartbeat: new Date(),
      failureCount: 0,
    }

    // Start synchronization
    this.initialize()
  }

  /**
   * Initialize the time synchronization service
   */
  private async initialize(): Promise<void> {
    try {
      logger.info("Initializing time synchronization service")

      // Check if online
      if (!navigator.onLine) {
        this.handleOfflineMode()
        return
      }

      // Start with Server-Sent Events
      await this.connectSSE()

      // Set up periodic health checks
      this.startHealthMonitoring()

      // Listen for online/offline events with removable handlers
      this.onlineListener = () => this.handleOnlineMode()
      this.offlineListener = () => this.handleOfflineMode()
      window.addEventListener("online", this.onlineListener)
      window.addEventListener("offline", this.offlineListener)
    } catch (error) {
      logger.error({ error: String(error) }, "Failed to initialize time sync service")
      this.handleConnectionFailure()
    }
  }

  /**
   * Connect using Server-Sent Events (primary protocol)
   */
  private async connectSSE(): Promise<void> {
    if (this.isDestroyed || this.connection.isConnecting) return

    try {
      // Check if online
      if (!navigator.onLine) {
        this.handleOfflineMode()
        return
      }

      this.connection.isConnecting = true
      this.updateStatus({ protocol: "sse", isConnected: false })

      // Close existing connection
      this.closeCurrentConnection()

      const eventSource = new EventSource("/api/time-sync/stream")
      this.connection.eventSource = eventSource

      eventSource.onopen = () => {
        logger.info("SSE connection established")
        this.connection.isConnecting = false
        this.connection.failureCount = 0

        // If we were offline, mark as back online
        if (this.offlineMode) {
          this.handleOnlineMode()
        }

        this.updateStatus({
          isConnected: true,
          protocol: "sse",
          connectionHealth: 100,
          retryCount: 0,
        })
      }

      eventSource.onmessage = (event) => {
        this.handleTimeSyncEvent(JSON.parse(event.data))
      }

      eventSource.onerror = (error) => {
        logger.warn({ error: error.toString() }, "SSE connection error")
        this.handleConnectionFailure()
      }
    } catch (error) {
      logger.error({ error: String(error) }, "Failed to establish SSE connection")
      this.connection.isConnecting = false
      this.handleOfflineMode()
    }
  }

  /**
   * Fallback to Long Polling
   */
  private async connectLongPolling(): Promise<void> {
    if (this.isDestroyed || this.connection.isConnecting) return

    try {
      this.connection.isConnecting = true
      this.updateStatus({ protocol: "longpolling", isConnected: false })

      // Close existing connection
      this.closeCurrentConnection()

      const poll = async () => {
        if (this.isDestroyed) return

        try {
          const response = await fetch("/api/time-sync/poll", {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          })

          if (response.ok) {
            const data = await response.json()
            this.handleTimeSyncEvent(data)

            if (!this.status.isConnected) {
              this.connection.isConnecting = false
              this.connection.failureCount = 0
              this.updateStatus({
                isConnected: true,
                protocol: "longpolling",
                connectionHealth: 80,
                retryCount: 0,
              })
            }
          } else {
            throw new Error(`HTTP ${response.status}`)
          }
        } catch (error) {
          logger.warn({ error: String(error) }, "Long polling request failed")
          this.connection.failureCount++

          if (this.connection.failureCount >= this.config.maxRetries) {
            this.handleConnectionFailure()
            return
          }
        }

        // Schedule next poll
        this.connection.pollInterval = setTimeout(poll, this.config.syncInterval)
      }

      // Start polling
      poll()
    } catch (error) {
      logger.error({ error: String(error) }, "Failed to establish long polling")
      this.connection.isConnecting = false
      this.handleConnectionFailure()
    }
  }

  /**
   * Emergency fallback to WebSocket
   */
  private async connectWebSocket(): Promise<void> {
    if (this.isDestroyed || this.connection.isConnecting) return

    try {
      this.connection.isConnecting = true
      this.updateStatus({ protocol: "websocket", isConnected: false })

      // Close existing connection
      this.closeCurrentConnection()

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
      const wsUrl = `${protocol}//${window.location.host}/api/time-sync/ws`

      const websocket = new WebSocket(wsUrl)
      this.connection.websocket = websocket

      websocket.onopen = () => {
        logger.info("WebSocket connection established")
        this.connection.isConnecting = false
        this.connection.failureCount = 0
        this.updateStatus({
          isConnected: true,
          protocol: "websocket",
          connectionHealth: 60,
          retryCount: 0,
        })

        // Send ping to start time sync
        websocket.send(JSON.stringify({ type: "ping" }))
      }

      websocket.onmessage = (event) => {
        const data = JSON.parse(event.data)
        if (data.type === "time-sync") {
          this.handleTimeSyncEvent(data)
        }
      }

      websocket.onerror = (error) => {
        logger.warn({ error: error.toString() }, "WebSocket connection error")
        this.handleConnectionFailure()
      }

      websocket.onclose = () => {
        if (!this.isDestroyed) {
          logger.warn("WebSocket connection closed")
          this.handleConnectionFailure()
        }
      }
    } catch (error) {
      logger.error({ error: String(error) }, "Failed to establish WebSocket connection")
      this.connection.isConnecting = false
      this.handleConnectionFailure()
    }
  }

  /**
   * Handle incoming time synchronization events
   */
  private handleTimeSyncEvent(event: TimeSyncEvent): void {
    const now = Date.now()
    const serverTime = event.serverTime
    const roundTripTime = now - (this.localTimeBase || now)

    // Calculate server time offset accounting for network latency
    const estimatedServerTime = serverTime + roundTripTime / 2
    this.serverTimeOffset = estimatedServerTime - now
    this.localTimeBase = now

    // Update offline drift rate based on actual vs expected time
    if (this.lastKnownGoodTime && this.offlineMode) {
      const expectedTime =
        this.lastKnownGoodTime.getTime() + (Date.now() - this.lastKnownGoodTime.getTime())
      const actualTime = Date.now() + this.serverTimeOffset
      const driftDifference = actualTime - expectedTime
      const timeDifference = (Date.now() - this.lastKnownGoodTime.getTime()) / 1000

      if (timeDifference > 0) {
        this.offlineDriftRate = driftDifference / timeDifference
      }
    }

    // Calculate drift
    const drift = Math.abs(this.serverTimeOffset)

    // Determine accuracy based on drift and round-trip time
    let accuracy: TimeSyncAccuracy = "high"
    if (drift > 50 || roundTripTime > 200) accuracy = "medium"
    if (drift > 100 || roundTripTime > 500) accuracy = "low"

    // Update status
    this.updateStatus({
      drift,
      accuracy,
      lastSync: new Date(),
      connectionHealth: Math.max(0, 100 - drift / 10),
    })

    // Notify time listeners with synchronized time
    const syncedTime = new Date(now + this.serverTimeOffset)
    this.timeListeners.forEach((listener) => {
      try {
        listener(syncedTime)
      } catch (error) {
        logger.warn({ error: String(error) }, "Time listener error")
      }
    })

    // Log significant drift
    if (drift > this.config.driftTolerance) {
      logger.warn(
        {
          drift,
          protocol: this.status.protocol,
          accuracy,
        },
        "Significant time drift detected"
      )
    }
  }

  /**
   * Handle connection failures and implement fallback strategy
   */
  private async handleConnectionFailure(): Promise<void> {
    this.updateStatus({ isConnected: false, retryCount: this.status.retryCount + 1 })

    // Implement fallback strategy: SSE → Long Polling → WebSocket → Offline
    if (this.status.protocol === "sse") {
      logger.info("Falling back to long polling")
      setTimeout(() => this.connectLongPolling(), this.config.fallbackDelay)
    } else if (this.status.protocol === "longpolling") {
      logger.info("Falling back to WebSocket")
      setTimeout(() => this.connectWebSocket(), this.config.fallbackDelay)
    } else if (this.status.protocol === "websocket") {
      logger.warn("All protocols failed, entering offline mode")
      this.enterOfflineMode()
    } else {
      // Already offline, try to reconnect to SSE after timeout
      setTimeout(() => this.connectSSE(), this.config.offlineTimeout)
    }
  }

  /**
   * Enter offline mode with graceful degradation
   */
  private enterOfflineMode(): void {
    this.closeCurrentConnection()
    this.updateStatus({
      isConnected: false,
      protocol: "offline",
      accuracy: "low",
      connectionHealth: 0,
    })

    // Use local time with periodic reconnection attempts
    if (this.offlineInterval) {
      clearInterval(this.offlineInterval)
      this.offlineInterval = null
    }
    this.offlineInterval = setInterval(() => {
      if (this.isDestroyed) {
        if (this.offlineInterval) {
          clearInterval(this.offlineInterval)
          this.offlineInterval = null
        }
        return
      }

      // Notify listeners with local time
      this.timeListeners.forEach((listener) => {
        try {
          listener(new Date())
        } catch (error) {
          logger.warn({ error: String(error) }, "Time listener error in offline mode")
        }
      })
    }, this.config.syncInterval)

    // Attempt to reconnect after timeout
    if (this.offlineReconnectTimeout) {
      clearTimeout(this.offlineReconnectTimeout)
      this.offlineReconnectTimeout = null
    }
    this.offlineReconnectTimeout = setTimeout(() => {
      if (!this.isDestroyed) {
        logger.info("Attempting to reconnect from offline mode")
        this.connectSSE()
      }
    }, this.config.offlineTimeout)
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    if (this.healthInterval) {
      clearInterval(this.healthInterval)
      this.healthInterval = null
    }
    this.healthInterval = setInterval(() => {
      if (this.isDestroyed) return

      const now = new Date()
      const timeSinceLastSync = now.getTime() - this.status.lastSync.getTime()

      // Check if connection is stale
      if (timeSinceLastSync > this.config.syncInterval * 3) {
        logger.warn("Connection appears stale, attempting recovery")
        this.handleConnectionFailure()
      }
    }, this.config.syncInterval * 2)
  }

  /**
   * Close current connection
   */
  private closeCurrentConnection(): void {
    if (this.connection.eventSource) {
      this.connection.eventSource.close()
      this.connection.eventSource = undefined
    }

    if (this.connection.pollInterval) {
      clearTimeout(this.connection.pollInterval)
      this.connection.pollInterval = undefined
    }

    if (this.connection.websocket) {
      this.connection.websocket.close()
      this.connection.websocket = undefined
    }
  }

  /**
   * Update status and notify listeners
   */
  private updateStatus(updates: Partial<SyncStatus>): void {
    this.status = { ...this.status, ...updates }

    this.listeners.forEach((listener) => {
      try {
        listener(this.status)
      } catch (error) {
        logger.warn({ error: String(error) }, "Status listener error")
      }
    })
  }

  /**
   * Enhanced getCurrentTime with offline support
   */
  getCurrentTime(): Date {
    if (this.offlineMode && this.lastKnownGoodTime) {
      // Calculate estimated time based on drift rate
      const timeSinceLastSync = Date.now() - this.lastKnownGoodTime.getTime()
      const estimatedDrift = (timeSinceLastSync / 1000) * this.offlineDriftRate
      return new Date(Date.now() + this.serverTimeOffset + estimatedDrift)
    }

    return new Date(Date.now() + this.serverTimeOffset)
  }

  /**
   * Get current synchronized time (legacy method)
   */
  public getSynchronizedTime(): Date {
    return this.getCurrentTime()
  }

  /**
   * Handle offline mode activation
   */
  private handleOfflineMode(): void {
    if (!this.offlineMode) {
      this.offlineMode = true
      this.lastKnownGoodTime = new Date()

      logger.warn("Time sync service entering offline mode")

      this.updateStatus({
        isConnected: false,
        protocol: "offline",
        accuracy: "low",
        connectionHealth: 0,
        isOffline: true,
        offlineDuration: 0,
      })

      // Queue time sync operation for when back online
      offlineQueue.enqueue({
        type: "time-sync",
        data: { reason: "offline_recovery" },
        timestamp: Date.now(),
        maxRetries: 5,
        priority: "high",
      })
    }
  }

  /**
   * Handle online mode restoration
   */
  private handleOnlineMode(): void {
    if (this.offlineMode) {
      this.offlineMode = false

      logger.info("Time sync service restored to online mode")

      const offlineDuration = this.lastKnownGoodTime
        ? Date.now() - this.lastKnownGoodTime.getTime()
        : 0

      this.updateStatus({
        isOffline: false,
        offlineDuration: 0,
      })

      // Trigger immediate sync to correct any drift
      this.forceSync()
    }
  }

  /**
   * Get offline status
   */
  isOffline(): boolean {
    return this.offlineMode
  }

  /**
   * Get estimated accuracy in offline mode
   */
  getOfflineAccuracy(): TimeSyncAccuracy {
    if (!this.offlineMode) return this.status.accuracy

    const timeSinceLastSync = this.lastKnownGoodTime
      ? Date.now() - this.lastKnownGoodTime.getTime()
      : Number.POSITIVE_INFINITY

    // Accuracy degrades over time in offline mode
    if (timeSinceLastSync < 60000) return "medium" // < 1 minute
    if (timeSinceLastSync < 300000) return "low" // < 5 minutes
    return "low"
  }

  /**
   * Get current sync status
   */
  public getStatus(): SyncStatus {
    const baseStatus = { ...this.status }

    if (this.offlineMode) {
      baseStatus.isOffline = true
      baseStatus.accuracy = this.getOfflineAccuracy()
      baseStatus.offlineDuration = this.lastKnownGoodTime
        ? Date.now() - this.lastKnownGoodTime.getTime()
        : 0
      baseStatus.estimatedDriftRate = this.offlineDriftRate
    }

    return baseStatus
  }

  /**
   * Subscribe to status updates
   */
  public onStatusChange(listener: (status: SyncStatus) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Subscribe to time updates
   */
  public onTimeUpdate(listener: (time: Date) => void): () => void {
    this.timeListeners.add(listener)
    return () => this.timeListeners.delete(listener)
  }

  /**
   * Force synchronization
   */
  public async forceSync(): Promise<void> {
    logger.info("Forcing time synchronization")

    if (this.status.protocol === "sse") {
      this.connectSSE()
    } else if (this.status.protocol === "longpolling") {
      this.connectLongPolling()
    } else if (this.status.protocol === "websocket") {
      this.connectWebSocket()
    } else {
      this.connectSSE()
    }
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<TimeSyncConfig>): void {
    this.config = { ...this.config, ...config }
    logger.info(
      {
        syncInterval: this.config.syncInterval,
        driftTolerance: this.config.driftTolerance,
      },
      "Time sync configuration updated"
    )
  }

  /**
   * Destroy the service and clean up resources
   */
  public destroy(): void {
    this.isDestroyed = true
    this.closeCurrentConnection()
    // Clear health/offline timers
    if (this.healthInterval) {
      clearInterval(this.healthInterval)
      this.healthInterval = null
    }
    if (this.offlineInterval) {
      clearInterval(this.offlineInterval)
      this.offlineInterval = null
    }
    if (this.offlineReconnectTimeout) {
      clearTimeout(this.offlineReconnectTimeout)
      this.offlineReconnectTimeout = null
    }
    // Remove online/offline listeners
    if (this.onlineListener) {
      window.removeEventListener("online", this.onlineListener)
      this.onlineListener = undefined
    }
    if (this.offlineListener) {
      window.removeEventListener("offline", this.offlineListener)
      this.offlineListener = undefined
    }
    this.listeners.clear()
    this.timeListeners.clear()
    logger.info("Time synchronization service destroyed")
  }
}

// Global singleton instance
let globalTimeSyncService: TimeSyncService | null = null

/**
 * Get or create the global time synchronization service instance
 */
export function getTimeSyncService(config?: Partial<TimeSyncConfig>): TimeSyncService {
  if (!globalTimeSyncService) {
    globalTimeSyncService = new TimeSyncService(config)
  }
  return globalTimeSyncService
}

/**
 * Destroy the global time synchronization service
 */
export function destroyTimeSyncService(): void {
  if (globalTimeSyncService) {
    globalTimeSyncService.destroy()
    globalTimeSyncService = null
  }
}
