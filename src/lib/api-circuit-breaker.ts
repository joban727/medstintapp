/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascade failures by monitoring API endpoint health
 * and temporarily blocking requests to failing services
 */

export interface CircuitBreakerConfig {
  failureThreshold: number
  recoveryTimeout: number
  monitoringWindow: number
  halfOpenMaxCalls: number
}

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Blocking requests
  HALF_OPEN = 'HALF_OPEN' // Testing recovery
}

export interface CircuitBreakerStats {
  state: CircuitState
  failureCount: number
  successCount: number
  lastFailureTime?: number
  nextAttemptTime?: number
  totalRequests: number
  totalFailures: number
}

class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED
  private failureCount = 0
  private successCount = 0
  private lastFailureTime?: number
  private nextAttemptTime?: number
  private totalRequests = 0
  private totalFailures = 0
  private halfOpenCalls = 0

  constructor(
    private name: string,
    private config: CircuitBreakerConfig
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < (this.nextAttemptTime || 0)) {
        throw new Error(`Circuit breaker is OPEN for ${this.name}. Next attempt at ${new Date(this.nextAttemptTime!).toISOString()}`)
      }
      // Transition to HALF_OPEN
      this.state = CircuitState.HALF_OPEN
      this.halfOpenCalls = 0
      console.log(`🔄 Circuit breaker ${this.name} transitioning to HALF_OPEN`)
    }

    if (this.state === CircuitState.HALF_OPEN && this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
      throw new Error(`Circuit breaker ${this.name} is HALF_OPEN and max calls exceeded`)
    }

    this.totalRequests++
    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenCalls++
    }

    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess(): void {
    this.successCount++
    
    if (this.state === CircuitState.HALF_OPEN) {
      // If we've had enough successful calls, close the circuit
      if (this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
        this.state = CircuitState.CLOSED
        this.failureCount = 0
        this.successCount = 0
        this.lastFailureTime = undefined
        this.nextAttemptTime = undefined
        console.log(`✅ Circuit breaker ${this.name} recovered - state: CLOSED`)
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Reset failure count on success in closed state
      this.failureCount = 0
    }
  }

  private onFailure(): void {
    this.failureCount++
    this.totalFailures++
    this.lastFailureTime = Date.now()

    if (this.state === CircuitState.HALF_OPEN) {
      // Any failure in HALF_OPEN state opens the circuit
      this.state = CircuitState.OPEN
      this.nextAttemptTime = Date.now() + this.config.recoveryTimeout
      console.log(`❌ Circuit breaker ${this.name} failed in HALF_OPEN - state: OPEN until ${new Date(this.nextAttemptTime).toISOString()}`)
    } else if (this.state === CircuitState.CLOSED && this.failureCount >= this.config.failureThreshold) {
      // Open the circuit if failure threshold is reached
      this.state = CircuitState.OPEN
      this.nextAttemptTime = Date.now() + this.config.recoveryTimeout
      console.log(`🚨 Circuit breaker ${this.name} opened due to ${this.failureCount} failures - state: OPEN until ${new Date(this.nextAttemptTime).toISOString()}`)
    }
  }

  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures
    }
  }

  reset(): void {
    this.state = CircuitState.CLOSED
    this.failureCount = 0
    this.successCount = 0
    this.lastFailureTime = undefined
    this.nextAttemptTime = undefined
    this.halfOpenCalls = 0
    console.log(`🔄 Circuit breaker ${this.name} manually reset`)
  }

  forceOpen(): void {
    this.state = CircuitState.OPEN
    this.nextAttemptTime = Date.now() + this.config.recoveryTimeout
    console.log(`🔒 Circuit breaker ${this.name} manually opened`)
  }
}

// Global circuit breaker registry
class CircuitBreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>()
  
  private defaultConfig: CircuitBreakerConfig = {
    failureThreshold: 3,
    recoveryTimeout: 15000, // 15 seconds (reduced from 30)
    monitoringWindow: 60000, // 1 minute
    halfOpenMaxCalls: 2
  }

  getBreaker(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.breakers.has(name)) {
      const finalConfig = { ...this.defaultConfig, ...config }
      this.breakers.set(name, new CircuitBreaker(name, finalConfig))
    }
    return this.breakers.get(name)!
  }

  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {}
    for (const [name, breaker] of this.breakers.entries()) {
      stats[name] = breaker.getStats()
    }
    return stats
  }

  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset()
    }
  }

  removeBreaker(name: string): void {
    this.breakers.delete(name)
  }
}

// Export singleton instance
export const circuitBreakerRegistry = new CircuitBreakerRegistry()

// Utility function for wrapping API calls
export async function withCircuitBreaker<T>(
  name: string,
  operation: () => Promise<T>,
  config?: Partial<CircuitBreakerConfig>
): Promise<T> {
  const breaker = circuitBreakerRegistry.getBreaker(name, config)
  return breaker.execute(operation)
}

// Enhanced fetch wrapper with circuit breaker
export async function fetchWithCircuitBreaker(
  url: string,
  options?: RequestInit,
  breakerConfig?: Partial<CircuitBreakerConfig>
): Promise<Response> {
  const breakerName = `fetch-${new URL(url, 'http://localhost').pathname}`
  
  return withCircuitBreaker(
    breakerName,
    async () => {
      const response = await fetch(url, options)
      
      // Consider 5xx errors as failures for circuit breaker
      if (response.status >= 500) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`)
      }
      
      return response
    },
    breakerConfig
  )
}