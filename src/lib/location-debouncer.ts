"use client"

/**
 * Location Debouncer Utility
 * Prevents excessive location requests by implementing debouncing and throttling
 */

interface LocationRequest {
  id: string
  timestamp: number
  resolve: (value: any) => void
  reject: (error: any) => void
}

class LocationDebouncer {
  private pendingRequests: Map<string, LocationRequest> = new Map()
  private lastRequestTime = 0
  private debounceTimeout: NodeJS.Timeout | null = null
  private readonly minInterval: number = 5000 // 5 seconds minimum between requests
  private readonly debounceDelay: number = 1000 // 1 second debounce delay

  /**
   * Debounced location request
   * @param requestId Unique identifier for the request
   * @param locationFunction Function that returns a Promise with location data
   * @returns Promise that resolves with location data
   */
  async debouncedLocationRequest<T>(
    requestId: string,
    locationFunction: () => Promise<T>
  ): Promise<T> {
    const now = Date.now()
    
    // Check if we're within the minimum interval
    if (now - this.lastRequestTime < this.minInterval) {
      // If there's already a pending request with the same ID, return that promise
      const existingRequest = this.pendingRequests.get(requestId)
      if (existingRequest) {
        return new Promise((resolve, reject) => {
          existingRequest.resolve = resolve
          existingRequest.reject = reject
        })
      }
    }

    return new Promise((resolve, reject) => {
      // Clear any existing timeout
      if (this.debounceTimeout) {
        clearTimeout(this.debounceTimeout)
      }

      // Store the request
      this.pendingRequests.set(requestId, {
        id: requestId,
        timestamp: now,
        resolve,
        reject
      })

      // Set up debounced execution
      this.debounceTimeout = setTimeout(async () => {
        try {
          this.lastRequestTime = Date.now()
          const result = await locationFunction()
          
          // Resolve all pending requests with the same result
          this.pendingRequests.forEach((request) => {
            request.resolve(result)
          })
          
          this.pendingRequests.clear()
        } catch (error) {
          // Reject all pending requests with the same error
          this.pendingRequests.forEach((request) => {
            request.reject(error)
          })
          
          this.pendingRequests.clear()
        }
      }, this.debounceDelay)
    })
  }

  /**
   * Throttled location request
   * @param locationFunction Function that returns a Promise with location data
   * @returns Promise that resolves with location data or null if throttled
   */
  async throttledLocationRequest<T>(
    locationFunction: () => Promise<T>
  ): Promise<T | null> {
    const now = Date.now()
    
    // Check if we're within the minimum interval
    if (now - this.lastRequestTime < this.minInterval) {
      console.log('Location request throttled - too frequent')
      return null
    }

    try {
      this.lastRequestTime = now
      return await locationFunction()
    } catch (error) {
      throw error
    }
  }

  /**
   * Clear all pending requests
   */
  clearPendingRequests(): void {
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout)
      this.debounceTimeout = null
    }
    
    this.pendingRequests.forEach((request) => {
      request.reject(new Error('Location request cancelled'))
    })
    
    this.pendingRequests.clear()
  }

  /**
   * Get the time until next request is allowed
   */
  getTimeUntilNextRequest(): number {
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime
    return Math.max(0, this.minInterval - timeSinceLastRequest)
  }

  /**
   * Check if a request can be made immediately
   */
  canMakeRequest(): boolean {
    return this.getTimeUntilNextRequest() === 0
  }
}

// Export singleton instance
export const locationDebouncer = new LocationDebouncer()

// Export utility functions
export const debouncedLocationCapture = <T>(
  requestId: string,
  locationFunction: () => Promise<T>
): Promise<T> => {
  return locationDebouncer.debouncedLocationRequest(requestId, locationFunction)
}

export const throttledLocationCapture = <T>(
  locationFunction: () => Promise<T>
): Promise<T | null> => {
  return locationDebouncer.throttledLocationRequest(locationFunction)
}