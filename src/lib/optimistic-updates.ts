/**
 * Optimistic Updates Service
 * Provides immediate UI feedback while API requests are processed in the background
 * Handles rollback on failures and maintains data consistency
 */

interface OptimisticUpdate<T = any> {
  id: string
  type: 'clock-in' | 'clock-out' | 'status-update'
  optimisticData: T
  originalData?: T
  timestamp: number
  status: 'pending' | 'confirmed' | 'failed' | 'rolled-back'
  retryCount: number
  maxRetries: number
}

interface OptimisticConfig {
  maxRetries: number
  retryDelay: number
  rollbackDelay: number
  enableAutoRollback: boolean
  persistFailedUpdates: boolean
}

const DEFAULT_OPTIMISTIC_CONFIG: OptimisticConfig = {
  maxRetries: 3,
  retryDelay: 1000, // 1 second
  rollbackDelay: 5000, // 5 seconds before auto-rollback
  enableAutoRollback: true,
  persistFailedUpdates: false
}

export class OptimisticUpdatesService {
  private static instance: OptimisticUpdatesService
  private updates = new Map<string, OptimisticUpdate>()
  private subscribers = new Map<string, Set<(update: OptimisticUpdate) => void>>()
  private config: OptimisticConfig

  constructor(config: Partial<OptimisticConfig> = {}) {
    this.config = { ...DEFAULT_OPTIMISTIC_CONFIG, ...config }
  }

  static getInstance(config?: Partial<OptimisticConfig>): OptimisticUpdatesService {
    if (!OptimisticUpdatesService.instance) {
      OptimisticUpdatesService.instance = new OptimisticUpdatesService(config)
    }
    return OptimisticUpdatesService.instance
  }

  /**
   * Apply an optimistic update immediately
   */
  applyOptimisticUpdate<T>(
    id: string,
    type: OptimisticUpdate['type'],
    optimisticData: T,
    originalData?: T
  ): OptimisticUpdate<T> {
    const update: OptimisticUpdate<T> = {
      id,
      type,
      optimisticData,
      originalData,
      timestamp: Date.now(),
      status: 'pending',
      retryCount: 0,
      maxRetries: this.config.maxRetries
    }

    this.updates.set(id, update)
    this.notifySubscribers(id, update)

    // Set up auto-rollback if enabled
    if (this.config.enableAutoRollback) {
      setTimeout(() => {
        const currentUpdate = this.updates.get(id)
        if (currentUpdate && currentUpdate.status === 'pending') {
          this.rollbackUpdate(id, 'timeout')
        }
      }, this.config.rollbackDelay)
    }

    return update
  }

  /**
   * Confirm an optimistic update (API call succeeded)
   */
  confirmUpdate<T>(id: string, confirmedData?: T): boolean {
    const update = this.updates.get(id)
    if (!update) return false

    update.status = 'confirmed'
    if (confirmedData) {
      update.optimisticData = confirmedData
    }

    this.notifySubscribers(id, update)
    
    // Clean up confirmed updates after a delay
    setTimeout(() => {
      this.updates.delete(id)
    }, 1000)

    return true
  }

  /**
   * Fail an optimistic update and optionally retry
   */
  failUpdate(id: string, error: Error, shouldRetry = true): boolean {
    const update = this.updates.get(id)
    if (!update) return false

    update.status = 'failed'
    update.retryCount++

    // Attempt retry if within limits and requested
    if (shouldRetry && update.retryCount <= update.maxRetries) {
      setTimeout(() => {
        const currentUpdate = this.updates.get(id)
        if (currentUpdate && currentUpdate.status === 'failed') {
          currentUpdate.status = 'pending'
          this.notifySubscribers(id, currentUpdate)
        }
      }, this.config.retryDelay * update.retryCount) // Exponential backoff
      
      return true
    }

    // Rollback if retries exhausted
    this.rollbackUpdate(id, 'max-retries-exceeded')
    return false
  }

  /**
   * Rollback an optimistic update
   */
  rollbackUpdate(id: string, reason: 'timeout' | 'max-retries-exceeded' | 'manual'): boolean {
    const update = this.updates.get(id)
    if (!update) return false

    update.status = 'rolled-back'
    this.notifySubscribers(id, update)

    // Clean up rolled-back updates
    if (!this.config.persistFailedUpdates) {
      setTimeout(() => {
        this.updates.delete(id)
      }, 1000)
    }

    return true
  }

  /**
   * Get current optimistic data for an update
   */
  getOptimisticData<T>(id: string): T | null {
    const update = this.updates.get(id)
    if (!update || update.status === 'rolled-back') {
      return update?.originalData as T || null
    }
    return update.optimisticData as T
  }

  /**
   * Check if an update is pending
   */
  isPending(id: string): boolean {
    const update = this.updates.get(id)
    return update?.status === 'pending' || false
  }

  /**
   * Subscribe to updates for a specific ID or type
   */
  subscribe(
    idOrType: string,
    callback: (update: OptimisticUpdate) => void
  ): () => void {
    if (!this.subscribers.has(idOrType)) {
      this.subscribers.set(idOrType, new Set())
    }
    
    this.subscribers.get(idOrType)!.add(callback)

    // Return unsubscribe function
    return () => {
      const subscribers = this.subscribers.get(idOrType)
      if (subscribers) {
        subscribers.delete(callback)
        if (subscribers.size === 0) {
          this.subscribers.delete(idOrType)
        }
      }
    }
  }

  /**
   * Notify subscribers of update changes
   */
  private notifySubscribers(id: string, update: OptimisticUpdate): void {
    // Notify specific ID subscribers
    const idSubscribers = this.subscribers.get(id)
    if (idSubscribers) {
      idSubscribers.forEach(callback => callback(update))
    }

    // Notify type subscribers
    const typeSubscribers = this.subscribers.get(update.type)
    if (typeSubscribers) {
      typeSubscribers.forEach(callback => callback(update))
    }

    // Notify global subscribers
    const globalSubscribers = this.subscribers.get('*')
    if (globalSubscribers) {
      globalSubscribers.forEach(callback => callback(update))
    }
  }

  /**
   * Get all pending updates
   */
  getPendingUpdates(): OptimisticUpdate[] {
    return Array.from(this.updates.values()).filter(update => update.status === 'pending')
  }

  /**
   * Get update statistics
   */
  getStats(): {
    total: number
    pending: number
    confirmed: number
    failed: number
    rolledBack: number
  } {
    const updates = Array.from(this.updates.values())
    
    return {
      total: updates.length,
      pending: updates.filter(u => u.status === 'pending').length,
      confirmed: updates.filter(u => u.status === 'confirmed').length,
      failed: updates.filter(u => u.status === 'failed').length,
      rolledBack: updates.filter(u => u.status === 'rolled-back').length
    }
  }

  /**
   * Clear all updates
   */
  clear(): void {
    this.updates.clear()
    this.subscribers.clear()
  }
}

// Global instance
export const optimisticUpdates = OptimisticUpdatesService.getInstance()

// Convenience functions for common clock operations
export interface ClockStatus {
  isClocked: boolean
  clockedInAt?: string
  currentDuration?: number
}

/**
 * Apply optimistic clock-in update
 */
export function applyOptimisticClockIn(
  studentId: string
): OptimisticUpdate<ClockStatus> {
  const optimisticData: ClockStatus = {
    isClocked: true,
    clockedInAt: new Date().toISOString(),
    currentDuration: 0
  }

  return optimisticUpdates.applyOptimisticUpdate(
    `clock-status-${studentId}`,
    'clock-in',
    optimisticData
  )
}

/**
 * Apply optimistic clock-out update
 */
export function applyOptimisticClockOut(
  studentId: string,
  originalStatus?: ClockStatus
): OptimisticUpdate<ClockStatus> {
  const optimisticData: ClockStatus = {
    isClocked: false,
    clockedInAt: undefined,
    currentDuration: undefined
  }

  return optimisticUpdates.applyOptimisticUpdate(
    `clock-status-${studentId}`,
    'clock-out',
    optimisticData,
    originalStatus
  )
}

/**
 * Confirm clock operation
 */
export function confirmClockOperation(
  studentId: string,
  confirmedData?: ClockStatus
): boolean {
  return optimisticUpdates.confirmUpdate(`clock-status-${studentId}`, confirmedData)
}

/**
 * Fail clock operation
 */
export function failClockOperation(
  studentId: string,
  error: Error,
  shouldRetry = true
): boolean {
  return optimisticUpdates.failUpdate(`clock-status-${studentId}`, error, shouldRetry)
}

/**
 * Get current optimistic clock status
 */
export function getOptimisticClockStatus(studentId: string): ClockStatus | null {
  return optimisticUpdates.getOptimisticData<ClockStatus>(`clock-status-${studentId}`)
}

/**
 * Check if clock operation is pending
 */
export function isClockOperationPending(studentId: string): boolean {
  return optimisticUpdates.isPending(`clock-status-${studentId}`)
}

/**
 * Subscribe to clock status changes
 */
export function subscribeToClockStatus(
  studentId: string,
  callback: (update: OptimisticUpdate<ClockStatus>) => void
): () => void {
  return optimisticUpdates.subscribe(`clock-status-${studentId}`, callback as any)
}