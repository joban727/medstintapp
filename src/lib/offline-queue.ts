/**
 * Offline Operation Queue
 * 
 * Provides graceful degradation and operation queuing for offline scenarios
 * with automatic recovery and conflict resolution.
 */

import { logger } from './logger'

export interface QueuedOperation {
  id: string
  type: 'clock-in' | 'clock-out' | 'time-sync'
  data: any
  timestamp: number
  retryCount: number
  maxRetries: number
  priority: 'high' | 'medium' | 'low'
  status: 'pending' | 'processing' | 'completed' | 'failed'
}

export interface OfflineQueueConfig {
  maxQueueSize: number
  maxRetries: number
  retryDelay: number
  storageKey: string
  enablePersistence: boolean
  conflictResolution: 'merge' | 'overwrite' | 'manual'
}

const DEFAULT_CONFIG: OfflineQueueConfig = {
  maxQueueSize: 100,
  maxRetries: 3,
  retryDelay: 5000, // 5 seconds
  storageKey: 'medstint_offline_queue',
  enablePersistence: true,
  conflictResolution: 'merge'
}

export class OfflineQueue {
  private static instance: OfflineQueue | null = null
  private config: OfflineQueueConfig
  private queue: QueuedOperation[] = []
  private isProcessing = false
  private processingTimer: NodeJS.Timeout | null = null
  private listeners: Map<string, (operation: QueuedOperation) => void> = new Map()

  private constructor(config: Partial<OfflineQueueConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.loadFromStorage()
    this.startProcessing()
  }

  static getInstance(config?: Partial<OfflineQueueConfig>): OfflineQueue {
    if (!OfflineQueue.instance) {
      OfflineQueue.instance = new OfflineQueue(config)
    }
    return OfflineQueue.instance
  }

  /**
   * Add operation to queue
   */
  enqueue(operation: Omit<QueuedOperation, 'id' | 'retryCount' | 'status'>): string {
    const queuedOperation: QueuedOperation = {
      ...operation,
      id: this.generateId(),
      retryCount: 0,
      status: 'pending'
    }

    // Check queue size limit
    if (this.queue.length >= this.config.maxQueueSize) {
      // Remove oldest low-priority operation
      const oldestLowPriority = this.queue.findIndex(op => op.priority === 'low')
      if (oldestLowPriority !== -1) {
        this.queue.splice(oldestLowPriority, 1)
        logger.warn('Queue size limit reached, removed oldest low-priority operation')
      } else {
        throw new Error('Queue is full and no low-priority operations to remove')
      }
    }

    // Insert based on priority
    const insertIndex = this.findInsertIndex(queuedOperation.priority)
    this.queue.splice(insertIndex, 0, queuedOperation)

    this.saveToStorage()
    this.notifyListeners('enqueue', queuedOperation)

    logger.info('Operation queued for offline processing', {
      id: queuedOperation.id,
      type: queuedOperation.type,
      priority: queuedOperation.priority
    })

    return queuedOperation.id
  }

  /**
   * Remove operation from queue
   */
  dequeue(id: string): QueuedOperation | null {
    const index = this.queue.findIndex(op => op.id === id)
    if (index === -1) return null

    const operation = this.queue.splice(index, 1)[0]
    this.saveToStorage()
    this.notifyListeners('dequeue', operation)

    return operation
  }

  /**
   * Get queue status
   */
  getStatus() {
    const statusCounts = this.queue.reduce((acc, op) => {
      acc[op.status] = (acc[op.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return {
      totalOperations: this.queue.length,
      isProcessing: this.isProcessing,
      statusCounts,
      oldestOperation: this.queue.length > 0 ? this.queue[this.queue.length - 1].timestamp : null
    }
  }

  /**
   * Clear all operations
   */
  clear(): void {
    this.queue = []
    this.saveToStorage()
    logger.info('Offline queue cleared')
  }

  /**
   * Get all operations
   */
  getOperations(): QueuedOperation[] {
    return [...this.queue]
  }

  /**
   * Add event listener
   */
  addEventListener(event: string, callback: (operation: QueuedOperation) => void): void {
    this.listeners.set(event, callback)
  }

  /**
   * Remove event listener
   */
  removeEventListener(event: string): void {
    this.listeners.delete(event)
  }

  /**
   * Start processing queue
   */
  startProcessing(): void {
    if (this.processingTimer) return

    this.processingTimer = setInterval(() => {
      this.processQueue()
    }, this.config.retryDelay)
  }

  /**
   * Stop processing queue
   */
  stopProcessing(): void {
    if (this.processingTimer) {
      clearInterval(this.processingTimer)
      this.processingTimer = null
    }
  }

  /**
   * Process queued operations
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return

    // Check if online
    if (!navigator.onLine) {
      logger.debug('Still offline, skipping queue processing')
      return
    }

    this.isProcessing = true

    try {
      const pendingOperations = this.queue.filter(op => op.status === 'pending')
      
      for (const operation of pendingOperations) {
        try {
          operation.status = 'processing'
          this.notifyListeners('processing', operation)

          await this.executeOperation(operation)

          operation.status = 'completed'
          this.notifyListeners('completed', operation)

          // Remove completed operation
          this.dequeue(operation.id)

          logger.info('Offline operation completed', {
            id: operation.id,
            type: operation.type
          })

        } catch (error) {
          operation.retryCount++
          
          if (operation.retryCount >= operation.maxRetries) {
            operation.status = 'failed'
            this.notifyListeners('failed', operation)
            
            logger.error('Offline operation failed permanently', {
              id: operation.id,
              type: operation.type,
              retryCount: operation.retryCount,
              error: error instanceof Error ? error.message : 'Unknown error'
            })
          } else {
            operation.status = 'pending'
            this.notifyListeners('retry', operation)
            
            logger.warn('Offline operation retry scheduled', {
              id: operation.id,
              type: operation.type,
              retryCount: operation.retryCount,
              maxRetries: operation.maxRetries
            })
          }
        }
      }

      this.saveToStorage()

    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Execute individual operation
   */
  private async executeOperation(operation: QueuedOperation): Promise<void> {
    switch (operation.type) {
      case 'clock-in':
        await this.executeClockIn(operation)
        break
      case 'clock-out':
        await this.executeClockOut(operation)
        break
      case 'time-sync':
        await this.executeTimeSync(operation)
        break
      default:
        throw new Error(`Unknown operation type: ${operation.type}`)
    }
  }

  /**
   * Execute clock-in operation
   */
  private async executeClockIn(operation: QueuedOperation): Promise<void> {
    const response = await fetch('/api/clock/in', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...operation.data,
        offlineTimestamp: operation.timestamp,
        queueId: operation.id
      })
    })

    if (!response.ok) {
      throw new Error(`Clock-in failed: ${response.statusText}`)
    }

    const result = await response.json()
    if (!result.success) {
      throw new Error(result.error?.message || 'Clock-in operation failed')
    }
  }

  /**
   * Execute clock-out operation
   */
  private async executeClockOut(operation: QueuedOperation): Promise<void> {
    const response = await fetch('/api/clock/out', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...operation.data,
        offlineTimestamp: operation.timestamp,
        queueId: operation.id
      })
    })

    if (!response.ok) {
      throw new Error(`Clock-out failed: ${response.statusText}`)
    }

    const result = await response.json()
    if (!result.success) {
      throw new Error(result.error?.message || 'Clock-out operation failed')
    }
  }

  /**
   * Execute time sync operation
   */
  private async executeTimeSync(operation: QueuedOperation): Promise<void> {
    const response = await fetch('/api/time-sync/server-time')
    
    if (!response.ok) {
      throw new Error(`Time sync failed: ${response.statusText}`)
    }

    const result = await response.json()
    if (!result.success) {
      throw new Error(result.error?.message || 'Time sync operation failed')
    }
  }

  /**
   * Find insert index based on priority
   */
  private findInsertIndex(priority: 'high' | 'medium' | 'low'): number {
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    const targetPriority = priorityOrder[priority]

    for (let i = 0; i < this.queue.length; i++) {
      if (priorityOrder[this.queue[i].priority] > targetPriority) {
        return i
      }
    }

    return this.queue.length
  }

  /**
   * Generate unique operation ID
   */
  private generateId(): string {
    return `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Notify event listeners
   */
  private notifyListeners(event: string, operation: QueuedOperation): void {
    const callback = this.listeners.get(event)
    if (callback) {
      try {
        callback(operation)
      } catch (error) {
        logger.error('Error in offline queue listener', {
          event,
          operationId: operation.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
  }

  /**
   * Save queue to localStorage
   */
  private saveToStorage(): void {
    if (!this.config.enablePersistence) return

    try {
      localStorage.setItem(this.config.storageKey, JSON.stringify(this.queue))
    } catch (error) {
      logger.error('Failed to save offline queue to storage', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Load queue from localStorage
   */
  private loadFromStorage(): void {
    if (!this.config.enablePersistence) return

    try {
      const stored = localStorage.getItem(this.config.storageKey)
      if (stored) {
        this.queue = JSON.parse(stored)
        logger.info('Offline queue loaded from storage', {
          operationCount: this.queue.length
        })
      }
    } catch (error) {
      logger.error('Failed to load offline queue from storage', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      this.queue = []
    }
  }
}

// Export singleton instance
export const offlineQueue = OfflineQueue.getInstance()

// Auto-start processing when online
window.addEventListener('online', () => {
  logger.info('Connection restored, processing offline queue')
  offlineQueue.startProcessing()
})

window.addEventListener('offline', () => {
  logger.warn('Connection lost, operations will be queued')
})