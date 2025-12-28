/**
 * Request Batching and Deduplication Service
 * Optimizes API calls by batching similar requests and deduplicating identical ones
 * Reduces server load and improves response times for clock-in operations
 */

interface BatchRequest<T = any> {
  id: string
  endpoint: string
  method: string
  body?: any
  headers?: Record<string, string>
  resolve: (value: T) => void
  reject: (error: Error) => void
  timestamp: number
  priority: "high" | "medium" | "low"
}

interface BatchConfig {
  maxBatchSize: number
  batchTimeout: number // milliseconds
  maxWaitTime: number // milliseconds
  enableDeduplication: boolean
  priorityLevels: {
    high: number // max wait time for high priority
    medium: number
    low: number
  }
}

const DEFAULT_BATCH_CONFIG: BatchConfig = {
  maxBatchSize: 10,
  batchTimeout: 100, // 100ms batch window
  maxWaitTime: 2000, // 2 seconds max wait
  enableDeduplication: true,
  priorityLevels: {
    high: 50, // Clock operations get 50ms max wait
    medium: 200, // Status checks get 200ms
    low: 1000, // Other requests get 1s
  },
}

export class RequestBatcher {
  private static instance: RequestBatcher
  private pendingRequests = new Map<string, BatchRequest[]>()
  private batchTimers = new Map<string, NodeJS.Timeout>()
  private deduplicationCache = new Map<string, Promise<any>>()
  private config: BatchConfig

  constructor(config: Partial<BatchConfig> = {}) {
    this.config = { ...DEFAULT_BATCH_CONFIG, ...config }
  }

  static getInstance(config?: Partial<BatchConfig>): RequestBatcher {
    if (!RequestBatcher.instance) {
      RequestBatcher.instance = new RequestBatcher(config)
    }
    return RequestBatcher.instance
  }

  /**
   * Batch a request with automatic deduplication and priority handling
   */
  async batchRequest<T>(
    endpoint: string,
    options: {
      method?: string
      body?: any
      headers?: Record<string, string>
      priority?: "high" | "medium" | "low"
      skipBatching?: boolean
    } = {}
  ): Promise<T> {
    const {
      method = "GET",
      body,
      headers = {},
      priority = "medium",
      skipBatching = false,
    } = options

    // Skip batching for high-priority clock operations if requested
    if (skipBatching || (priority === "high" && endpoint.includes("/clock"))) {
      return this.executeRequest<T>(endpoint, { method, body, headers })
    }

    // Create deduplication key
    const deduplicationKey = this.createDeduplicationKey(endpoint, method, body)

    // Check for existing identical request
    if (this.config.enableDeduplication && this.deduplicationCache.has(deduplicationKey)) {
      const existing = this.deduplicationCache.get(deduplicationKey)
      if (existing) return existing
    }

    // Create promise for this request
    const requestPromise = new Promise<T>((resolve, reject) => {
      const request: BatchRequest<T> = {
        id: Math.random().toString(36).substr(2, 9),
        endpoint,
        method,
        body,
        headers,
        resolve,
        reject,
        timestamp: Date.now(),
        priority,
      }

      this.addToBatch(request)
    })

    // Cache for deduplication
    if (this.config.enableDeduplication) {
      this.deduplicationCache.set(deduplicationKey, requestPromise)

      // Clean up cache after request completes
      requestPromise.finally(() => {
        setTimeout(() => {
          this.deduplicationCache.delete(deduplicationKey)
        }, 5000) // Keep in cache for 5 seconds to catch rapid duplicates
      })
    }

    return requestPromise
  }

  /**
   * Add request to appropriate batch
   */
  private addToBatch<T>(request: BatchRequest<T>): void {
    const batchKey = this.createBatchKey(request.endpoint, request.method)

    if (!this.pendingRequests.has(batchKey)) {
      this.pendingRequests.set(batchKey, [])
    }

    const batch = this.pendingRequests.get(batchKey) || []
    batch.push(request)

    // Sort by priority and timestamp
    batch.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
      if (priorityDiff !== 0) return priorityDiff
      return a.timestamp - b.timestamp
    })

    // Set or update batch timer
    this.scheduleBatchExecution(batchKey, request.priority)
  }

  /**
   * Schedule batch execution based on priority and timing
   */
  private scheduleBatchExecution(batchKey: string, priority: "high" | "medium" | "low"): void {
    const batch = this.pendingRequests.get(batchKey) || []

    // Clear existing timer
    if (this.batchTimers.has(batchKey)) {
      const existingTimer = this.batchTimers.get(batchKey)
      if (existingTimer) clearTimeout(existingTimer)
    }

    // Determine timeout based on priority and batch size
    let timeout = this.config.priorityLevels[priority]

    // Execute immediately if batch is full or has high priority items that are old
    const shouldExecuteImmediately =
      batch.length >= this.config.maxBatchSize ||
      (priority === "high" &&
        batch.some((r) => Date.now() - r.timestamp > this.config.priorityLevels.high))

    if (shouldExecuteImmediately) {
      timeout = 0
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.executeBatch(batchKey)
    }, timeout)

    this.batchTimers.set(batchKey, timer)
  }

  /**
   * Execute a batch of requests
   */
  private async executeBatch(batchKey: string): Promise<void> {
    const batch = this.pendingRequests.get(batchKey)
    if (!batch || batch.length === 0) return

    // Remove batch from pending
    this.pendingRequests.delete(batchKey)
    this.batchTimers.delete(batchKey)

    // Group requests by identical parameters for true batching
    const groupedRequests = this.groupIdenticalRequests(batch)

    // Execute each group
    await Promise.all(
      Array.from(groupedRequests.entries()).map(([groupKey, requests]) =>
        this.executeRequestGroup(requests)
      )
    )
  }

  /**
   * Group identical requests together
   */
  private groupIdenticalRequests(batch: BatchRequest[]): Map<string, BatchRequest[]> {
    const groups = new Map<string, BatchRequest[]>()

    for (const request of batch) {
      const groupKey = this.createDeduplicationKey(request.endpoint, request.method, request.body)

      let group = groups.get(groupKey)
      if (!group) {
        group = []
        groups.set(groupKey, group)
      }
      group.push(request)
    }

    return groups
  }

  /**
   * Execute a group of identical requests
   */
  private async executeRequestGroup(requests: BatchRequest[]): Promise<void> {
    if (requests.length === 0) return

    const firstRequest = requests[0]

    try {
      // Execute the request once for all identical requests
      const result = await this.executeRequest(firstRequest.endpoint, {
        method: firstRequest.method,
        body: firstRequest.body,
        headers: firstRequest.headers,
      })

      // Resolve all requests in the group with the same result
      requests.forEach((request) => request.resolve(result))
    } catch (error) {
      // Reject all requests in the group with the same error
      requests.forEach((request) => request.reject(error as Error))
    }
  }

  /**
   * Execute a single request
   */
  private async executeRequest<T>(
    endpoint: string,
    options: {
      method: string
      body?: any
      headers?: Record<string, string>
    }
  ): Promise<T> {
    const { method, body, headers = {} } = options

    const fetchOptions: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    }

    if (body && method !== "GET") {
      fetchOptions.body = JSON.stringify(body)
    }

    const response = await fetch(endpoint, fetchOptions)

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Create a key for batching similar requests
   */
  private createBatchKey(endpoint: string, method: string): string {
    return `${method}:${endpoint}`
  }

  /**
   * Create a key for deduplicating identical requests
   */
  private createDeduplicationKey(endpoint: string, method: string, body?: any): string {
    const bodyHash = body ? JSON.stringify(body) : ""
    return `${method}:${endpoint}:${bodyHash}`
  }

  /**
   * Get batch statistics
   */
  getBatchStats(): {
    pendingBatches: number
    totalPendingRequests: number
    cacheSize: number
  } {
    const totalPendingRequests = Array.from(this.pendingRequests.values()).reduce(
      (sum, batch) => sum + batch.length,
      0
    )

    return {
      pendingBatches: this.pendingRequests.size,
      totalPendingRequests,
      cacheSize: this.deduplicationCache.size,
    }
  }

  /**
   * Clear all pending requests and caches
   */
  clear(): void {
    // Clear all timers
    this.batchTimers.forEach((timer) => clearTimeout(timer))
    this.batchTimers.clear()

    // Reject all pending requests
    this.pendingRequests.forEach((batch) => {
      batch.forEach((request) => {
        request.reject(new Error("Request batcher cleared"))
      })
    })
    this.pendingRequests.clear()

    // Clear deduplication cache
    this.deduplicationCache.clear()
  }
}

// Global instance for easy access
export const requestBatcher = RequestBatcher.getInstance()

// Convenience functions for common operations
export async function batchedFetch<T>(
  endpoint: string,
  options: {
    method?: string
    body?: any
    headers?: Record<string, string>
    priority?: "high" | "medium" | "low"
    skipBatching?: boolean
  } = {}
): Promise<T> {
  return requestBatcher.batchRequest<T>(endpoint, options)
}

// Specialized functions for clock operations
export async function batchedClockRequest<T>(
  endpoint: string,
  options: {
    method?: string
    body?: any
    headers?: Record<string, string>
  } = {}
): Promise<T> {
  return requestBatcher.batchRequest<T>(endpoint, {
    ...options,
    priority: "high",
    skipBatching: true, // Clock operations should not be batched for accuracy
  })
}

export async function batchedStatusRequest<T>(
  endpoint: string,
  options: {
    method?: string
    body?: any
    headers?: Record<string, string>
  } = {}
): Promise<T> {
  return requestBatcher.batchRequest<T>(endpoint, {
    ...options,
    priority: "medium",
  })
}
