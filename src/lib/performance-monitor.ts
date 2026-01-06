/**
 * Performance Monitoring and Circuit Breaker System
 * Provides comprehensive performance monitoring, metrics collection,
 * and circuit breaker pattern for database and external service resilience
 */

import { logger } from "./logger"

// Performance metrics interface
export interface PerformanceMetrics {
  requestCount: number
  errorCount: number
  totalResponseTime: number
  averageResponseTime: number
  minResponseTime: number
  maxResponseTime: number
  p95ResponseTime: number
  p99ResponseTime: number
  throughput: number // requests per second
  errorRate: number // percentage
  timestamp: Date
}

// Circuit breaker states
export enum CircuitBreakerState {
  CLOSED = "closed",
  OPEN = "open",
  HALF_OPEN = "half_open",
}

// Circuit breaker configuration
interface CircuitBreakerConfig {
  failureThreshold: number
  recoveryTimeout: number
  monitoringPeriod: number
  minimumRequests: number
  errorThresholdPercentage: number
}

// Performance alert configuration
interface AlertConfig {
  responseTimeThreshold: number
  errorRateThreshold: number
  throughputThreshold: number
  enabled: boolean
}

// Request timing data
interface RequestTiming {
  startTime: number
  endTime?: number
  duration?: number
  success: boolean
  error?: Error
  metadata?: Record<string, unknown>
}

// Circuit breaker implementation
export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED
  private failureCount = 0
  private lastFailureTime = 0
  private successCount = 0
  private requestCount = 0
  private config: CircuitBreakerConfig
  private name: string

  constructor(name: string, config: Partial<CircuitBreakerConfig> = {}) {
    this.name = name
    this.config = {
      failureThreshold: config.failureThreshold || 5,
      recoveryTimeout: config.recoveryTimeout || 60000, // 1 minute
      monitoringPeriod: config.monitoringPeriod || 60000, // 1 minute
      minimumRequests: config.minimumRequests || 10,
      errorThresholdPercentage: config.errorThresholdPercentage || 50,
    }
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitBreakerState.HALF_OPEN
        logger.info({}, `Circuit breaker ${this.name} moved to HALF_OPEN state`)
      } else {
        throw new Error(`Circuit breaker ${this.name} is OPEN`)
      }
    }

    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure(error as Error)
      throw error
    }
  }

  private onSuccess(): void {
    this.requestCount++
    this.successCount++

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.state = CircuitBreakerState.CLOSED
      this.failureCount = 0
      logger.info({}, `Circuit breaker ${this.name} moved to CLOSED state`)
    }
  }

  private onFailure(error: Error): void {
    this.requestCount++
    this.failureCount++
    this.lastFailureTime = Date.now()

    logger.warn({ error: error.message }, `Circuit breaker ${this.name} recorded failure`)

    if (this.shouldOpenCircuit()) {
      this.state = CircuitBreakerState.OPEN
      logger.error(
        {
          failureCount: this.failureCount,
          requestCount: this.requestCount,
          errorRate: this.getErrorRate(),
        },
        `Circuit breaker ${this.name} moved to OPEN state`
      )
    }
  }

  private shouldOpenCircuit(): boolean {
    if (this.requestCount < this.config.minimumRequests) {
      return false
    }

    const errorRate = this.getErrorRate()
    return errorRate >= this.config.errorThresholdPercentage
  }

  private shouldAttemptReset(): boolean {
    return Date.now() - this.lastFailureTime >= this.config.recoveryTimeout
  }

  private getErrorRate(): number {
    if (this.requestCount === 0) return 0
    return (this.failureCount / this.requestCount) * 100
  }

  getState(): CircuitBreakerState {
    return this.state
  }

  getStats(): {
    state: CircuitBreakerState
    failureCount: number
    requestCount: number
    successCount: number
    errorRate: number
  } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      requestCount: this.requestCount,
      successCount: this.successCount,
      errorRate: this.getErrorRate(),
    }
  }

  reset(): void {
    this.state = CircuitBreakerState.CLOSED
    this.failureCount = 0
    this.requestCount = 0
    this.successCount = 0
    this.lastFailureTime = 0
    logger.info({}, `Circuit breaker ${this.name} manually reset`)
  }
}

// Performance monitor implementation
export class PerformanceMonitor {
  private metrics = new Map<string, PerformanceMetrics>()
  private requestTimings = new Map<string, RequestTiming[]>()
  private circuitBreakers = new Map<string, CircuitBreaker>()
  private alertConfig: AlertConfig
  private monitoringInterval?: NodeJS.Timeout

  constructor(alertConfig: Partial<AlertConfig> = {}) {
    this.alertConfig = {
      responseTimeThreshold: alertConfig.responseTimeThreshold || 5000, // 5 seconds
      errorRateThreshold: alertConfig.errorRateThreshold || 10, // 10%
      throughputThreshold: alertConfig.throughputThreshold || 1, // 1 req/sec minimum
      enabled: alertConfig.enabled ?? true,
    }

    this.startMonitoring()
  }

  /**
   * Start timing a request
   */
  startTiming(operation: string, metadata?: Record<string, unknown>): string {
    const timingId = this.generateTimingId()
    const timing: RequestTiming = {
      startTime: Date.now(),
      success: false,
      metadata,
    }

    if (!this.requestTimings.has(operation)) {
      this.requestTimings.set(operation, [])
    }

    this.requestTimings.get(operation)?.push(timing)
    return timingId
  }

  /**
   * End timing a request
   */
  endTiming(operation: string, _timingId: string, success: boolean, error?: Error): void {
    const timings = this.requestTimings.get(operation)
    if (!timings) return

    const timing = timings[timings.length - 1] // Get the most recent timing
    if (timing) {
      timing.endTime = Date.now()
      timing.duration = timing.endTime - timing.startTime
      timing.success = success
      timing.error = error

      this.updateMetrics(operation, timing)
    }
  }

  /**
   * Time an async operation
   */
  async timeOperation<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>
  ): Promise<T> {
    const timingId = this.startTiming(operation, metadata)

    try {
      const result = await fn()
      this.endTiming(operation, timingId, true)
      return result
    } catch (error) {
      this.endTiming(operation, timingId, false, error as Error)
      throw error
    }
  }

  /**
   * Time an operation with circuit breaker
   */
  async timeOperationWithCircuitBreaker<T>(
    operation: string,
    fn: () => Promise<T>,
    circuitBreakerConfig?: Partial<CircuitBreakerConfig>,
    metadata?: Record<string, unknown>
  ): Promise<T> {
    let circuitBreaker = this.circuitBreakers.get(operation)

    if (!circuitBreaker) {
      circuitBreaker = new CircuitBreaker(operation, circuitBreakerConfig)
      this.circuitBreakers.set(operation, circuitBreaker)
    }

    const timingId = this.startTiming(operation, metadata)

    try {
      const result = await circuitBreaker.execute(fn)
      this.endTiming(operation, timingId, true)
      return result
    } catch (error) {
      this.endTiming(operation, timingId, false, error as Error)
      throw error
    }
  }

  /**
   * Get metrics for an operation
   */
  getMetrics(operation: string): PerformanceMetrics | null {
    return this.metrics.get(operation) || null
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Map<string, PerformanceMetrics> {
    return new Map(this.metrics)
  }

  /**
   * Get circuit breaker stats
   */
  getCircuitBreakerStats(operation: string): ReturnType<CircuitBreaker["getStats"]> | null {
    const circuitBreaker = this.circuitBreakers.get(operation)
    return circuitBreaker ? circuitBreaker.getStats() : null
  }

  /**
   * Get all circuit breaker stats
   */
  getAllCircuitBreakerStats(): Map<string, ReturnType<CircuitBreaker["getStats"]>> {
    const stats = new Map()
    for (const [operation, circuitBreaker] of this.circuitBreakers) {
      stats.set(operation, circuitBreaker.getStats())
    }
    return stats
  }

  /**
   * Reset metrics for an operation
   */
  resetMetrics(operation: string): void {
    this.metrics.delete(operation)
    this.requestTimings.delete(operation)

    const circuitBreaker = this.circuitBreakers.get(operation)
    if (circuitBreaker) {
      circuitBreaker.reset()
    }
  }

  /**
   * Reset all metrics
   */
  resetAllMetrics(): void {
    this.metrics.clear()
    this.requestTimings.clear()

    for (const circuitBreaker of this.circuitBreakers.values()) {
      circuitBreaker.reset()
    }
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    totalOperations: number
    totalRequests: number
    totalErrors: number
    averageResponseTime: number
    overallErrorRate: number
    circuitBreakersOpen: number
  } {
    let totalRequests = 0
    let totalErrors = 0
    let totalResponseTime = 0
    let circuitBreakersOpen = 0

    for (const metrics of this.metrics.values()) {
      totalRequests += metrics.requestCount
      totalErrors += metrics.errorCount
      totalResponseTime += metrics.totalResponseTime
    }

    for (const circuitBreaker of this.circuitBreakers.values()) {
      if (circuitBreaker.getState() === CircuitBreakerState.OPEN) {
        circuitBreakersOpen++
      }
    }

    return {
      totalOperations: this.metrics.size,
      totalRequests,
      totalErrors,
      averageResponseTime: totalRequests > 0 ? totalResponseTime / totalRequests : 0,
      overallErrorRate: totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0,
      circuitBreakersOpen,
    }
  }

  /**
   * Export metrics for external monitoring systems
   */
  exportMetrics(): {
    timestamp: string
    metrics: Record<string, PerformanceMetrics>
    circuitBreakers: Record<string, ReturnType<CircuitBreaker["getStats"]>>
    summary: ReturnType<PerformanceMonitor["getPerformanceSummary"]>
  } {
    const metricsObj: Record<string, PerformanceMetrics> = {}
    for (const [operation, metrics] of this.metrics) {
      metricsObj[operation] = metrics
    }

    const circuitBreakersObj: Record<string, ReturnType<CircuitBreaker["getStats"]>> = {}
    for (const [operation, circuitBreaker] of this.circuitBreakers) {
      circuitBreakersObj[operation] = circuitBreaker.getStats()
    }

    return {
      timestamp: new Date().toISOString(),
      metrics: metricsObj,
      circuitBreakers: circuitBreakersObj,
      summary: this.getPerformanceSummary(),
    }
  }

  /**
   * Destroy monitor and cleanup resources
   */
  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
    }
    this.resetAllMetrics()
  }

  // Private methods
  private updateMetrics(operation: string, timing: RequestTiming): void {
    if (!timing.duration) return

    let metrics = this.metrics.get(operation)

    if (!metrics) {
      metrics = {
        requestCount: 0,
        errorCount: 0,
        totalResponseTime: 0,
        averageResponseTime: 0,
        minResponseTime: Number.POSITIVE_INFINITY,
        maxResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        throughput: 0,
        errorRate: 0,
        timestamp: new Date(),
      }
      this.metrics.set(operation, metrics)
    }

    // Update basic metrics
    metrics.requestCount++
    if (!timing.success) {
      metrics.errorCount++
    }

    metrics.totalResponseTime += timing.duration
    metrics.averageResponseTime = metrics.totalResponseTime / metrics.requestCount
    metrics.minResponseTime = Math.min(metrics.minResponseTime, timing.duration)
    metrics.maxResponseTime = Math.max(metrics.maxResponseTime, timing.duration)
    metrics.errorRate = (metrics.errorCount / metrics.requestCount) * 100
    metrics.timestamp = new Date()

    // Calculate percentiles
    this.calculatePercentiles(operation, metrics)

    // Calculate throughput (requests per second over last minute)
    this.calculateThroughput(operation, metrics)

    // Check for alerts
    if (this.alertConfig.enabled) {
      this.checkAlerts(operation, metrics)
    }
  }

  private calculatePercentiles(operation: string, metrics: PerformanceMetrics): void {
    const timings = this.requestTimings.get(operation)
    if (!timings || timings.length === 0) return

    const durations = timings
      .filter((t) => t.duration !== undefined)
      .map((t) => t.duration as number)
      .sort((a, b) => a - b)

    if (durations.length === 0) return

    const p95Index = Math.ceil(durations.length * 0.95) - 1
    const p99Index = Math.ceil(durations.length * 0.99) - 1

    metrics.p95ResponseTime = durations[Math.max(0, p95Index)]
    metrics.p99ResponseTime = durations[Math.max(0, p99Index)]
  }

  private calculateThroughput(operation: string, metrics: PerformanceMetrics): void {
    const timings = this.requestTimings.get(operation)
    if (!timings || timings.length === 0) return

    const oneMinuteAgo = Date.now() - 60000
    const recentTimings = timings.filter((t) => t.startTime >= oneMinuteAgo)

    metrics.throughput = recentTimings.length / 60 // requests per second
  }

  private checkAlerts(operation: string, metrics: PerformanceMetrics): void {
    const alerts: string[] = []

    if (metrics.averageResponseTime > this.alertConfig.responseTimeThreshold) {
      alerts.push(`High response time: ${metrics.averageResponseTime}ms`)
    }

    if (metrics.errorRate > this.alertConfig.errorRateThreshold) {
      alerts.push(`High error rate: ${metrics.errorRate.toFixed(2)}%`)
    }

    if (metrics.throughput < this.alertConfig.throughputThreshold) {
      alerts.push(`Low throughput: ${metrics.throughput.toFixed(2)} req/sec`)
    }

    if (alerts.length > 0) {
      logger.warn(
        {
          alerts: JSON.stringify(alerts),
          metrics: JSON.stringify({
            responseTime: metrics.averageResponseTime,
            errorRate: metrics.errorRate,
            throughput: metrics.throughput,
          }),
        },
        `Performance alerts for operation ${operation}`
      )
    }
  }

  private generateTimingId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36)
  }

  private startMonitoring(): void {
    // Clean up old timing data every 5 minutes
    this.monitoringInterval = setInterval(
      () => {
        this.cleanupOldTimings()
      },
      5 * 60 * 1000
    )
  }

  private cleanupOldTimings(): void {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000

    for (const [operation, timings] of this.requestTimings) {
      const recentTimings = timings.filter((t) => t.startTime >= fiveMinutesAgo)
      this.requestTimings.set(operation, recentTimings)
    }
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor({
  responseTimeThreshold: 5000, // 5 seconds
  errorRateThreshold: 10, // 10%
  throughputThreshold: 1, // 1 req/sec
  enabled: process.env.NODE_ENV === "production",
})

// Utility functions for common operations
export const timeMiddlewareOperation = async <T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> => {
  return performanceMonitor.timeOperation(operation, fn)
}

export const timeDatabaseOperation = async <T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> => {
  return performanceMonitor.timeOperationWithCircuitBreaker(`database:${operation}`, fn, {
    failureThreshold: 5,
    recoveryTimeout: 30000, // 30 seconds
    errorThresholdPercentage: 50,
  })
}

export const timeExternalAPIOperation = async <T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> => {
  return performanceMonitor.timeOperationWithCircuitBreaker(`external:${operation}`, fn, {
    failureThreshold: 3,
    recoveryTimeout: 60000, // 1 minute
    errorThresholdPercentage: 30,
  })
}

// Export performance metrics for monitoring endpoints
export const getPerformanceMetrics = () => {
  return performanceMonitor.exportMetrics()
}
