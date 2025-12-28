/**
 * Database Connection Pool Monitoring
 * Comprehensive monitoring and metrics collection for database connection pools
 * Provides insights for performance optimization and cost reduction
 */

import { EventEmitter } from "node:events"
import { pool } from "@/database/connection-pool"

// Monitoring configuration
interface MonitoringConfig {
  metricsInterval: number // milliseconds
  alertThresholds: {
    highUtilization: number // percentage
    longWaitTime: number // milliseconds
    errorRate: number // percentage
    slowQuery: number // milliseconds
  }
  retentionPeriod: number // hours
  enableAlerts: boolean
}

const DEFAULT_MONITORING_CONFIG: MonitoringConfig = {
  metricsInterval: 10000, // Reduced to 10 seconds for faster detection
  alertThresholds: {
    highUtilization: 60, // Reduced to 60% to be more conservative
    longWaitTime: 1500, // Reduced to 1.5 seconds
    errorRate: 1, // Reduced to 1% for stricter monitoring
    slowQuery: 800, // Reduced to 800ms for faster detection
  },
  retentionPeriod: 48, // 48 hours (increased retention)
  enableAlerts: true,
}

// Metrics interfaces
interface ConnectionMetrics {
  timestamp: Date
  totalConnections: number
  activeConnections: number
  idleConnections: number
  waitingRequests: number
  poolUtilization: number // percentage
  averageWaitTime: number // milliseconds
  totalQueries: number
  successfulQueries: number
  failedQueries: number
  errorRate: number // percentage
  averageQueryTime: number // milliseconds
  slowQueries: number
  memoryUsage: {
    used: number
    total: number
    percentage: number
  }
}

interface QueryMetrics {
  id: string
  query: string
  duration: number
  timestamp: Date
  success: boolean
  error?: string
  connectionId?: string
}

interface AlertEvent {
  type:
  | "high_utilization"
  | "long_wait_time"
  | "high_error_rate"
  | "slow_query"
  | "connection_leak"
  | "neon_termination"
  severity: "warning" | "critical"
  message: string
  timestamp: Date
  metrics?: Partial<ConnectionMetrics>
  query?: QueryMetrics
}

/**
 * Connection Pool Monitor
 * Tracks and analyzes database connection pool performance
 */
export class ConnectionPoolMonitor extends EventEmitter {
  private config: MonitoringConfig
  private metrics: ConnectionMetrics[] = []
  private queryMetrics: QueryMetrics[] = []
  private alerts: AlertEvent[] = []
  private monitoringInterval: NodeJS.Timeout | null = null
  private isMonitoring = false

  // Real-time counters
  private counters = {
    totalQueries: 0,
    successfulQueries: 0,
    failedQueries: 0,
    totalQueryTime: 0,
    slowQueries: 0,
    waitTimes: [] as number[],
    connectionLeaks: 0,
  }

  constructor(config: Partial<MonitoringConfig> = {}) {
    super()
    this.config = { ...DEFAULT_MONITORING_CONFIG, ...config }
    this.setupEventListeners()
  }

  /**
   * Start monitoring the connection pool
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      console.warn("⚠️ Connection monitoring is already running")
      return
    }

    console.log("🔍 Starting connection pool monitoring...")
    this.isMonitoring = true

    // Collect metrics at regular intervals
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics()
    }, this.config.metricsInterval)

    // Initial metrics collection
    this.collectMetrics()

    console.log(`✅ Connection monitoring started (interval: ${this.config.metricsInterval}ms)`)
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return
    }

    console.log("🛑 Stopping connection pool monitoring...")

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }

    this.isMonitoring = false
    console.log("✅ Connection monitoring stopped")
  }

  /**
   * Collect current metrics
   */
  private async collectMetrics(): Promise<void> {
    try {
      const { getPoolMetrics } = await import("@/database/connection-pool")
      const poolMetrics = getPoolMetrics()
      const memoryUsage = process.memoryUsage()

      const currentMetrics: ConnectionMetrics = {
        timestamp: new Date(),
        totalConnections: poolMetrics.totalCount,
        activeConnections: poolMetrics.totalCount - poolMetrics.idleCount,
        idleConnections: poolMetrics.idleCount,
        waitingRequests: poolMetrics.waitingCount,
        poolUtilization: poolMetrics.utilization,
        averageWaitTime: this.calculateAverageWaitTime(),
        totalQueries: this.counters.totalQueries,
        successfulQueries: this.counters.successfulQueries,
        failedQueries: this.counters.failedQueries,
        errorRate:
          this.counters.totalQueries > 0
            ? (this.counters.failedQueries / this.counters.totalQueries) * 100
            : 0,
        averageQueryTime:
          this.counters.totalQueries > 0
            ? this.counters.totalQueryTime / this.counters.totalQueries
            : 0,
        slowQueries: this.counters.slowQueries,
        memoryUsage: {
          used: memoryUsage.heapUsed,
          total: memoryUsage.heapTotal,
          percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
        },
      }

      // Store metrics
      this.metrics.push(currentMetrics)

      // Clean up old metrics
      this.cleanupOldMetrics()

      // Check for alerts
      this.checkAlerts(currentMetrics)

      // Emit metrics event
      this.emit("metrics", currentMetrics)
    } catch (error) {
      console.error("❌ Failed to collect connection metrics:", error)
    }
  }

  /**
   * Setup event listeners for pool events
   */
  private setupEventListeners(): void {
    // Listen for pool events
    pool.on("connect", () => {
      console.log("Database connection established")
    })

    pool.on("error", (err: Error & { message?: string }) => {
      console.error("Database pool error:", err)

      // Handle Neon-specific connection termination errors
      if (
        err.message?.includes("57P01") ||
        err.message?.includes("terminating connection due to administrator command")
      ) {
        this.createAlert(
          "neon_termination",
          "warning",
          "Neon connection terminated by administrator - connection will be recycled",
          undefined,
          this.getCurrentMetrics() || undefined
        )

        // Log for debugging
        console.warn("Neon connection termination detected (57P01) - this is expected behavior")
      }

      this.counters.failedQueries++
    })

    pool.on("remove", () => {
      console.log("Database connection removed from pool")
    })
  }

  /**
   * Record query metrics
   */
  recordQueryMetrics(queryId: string, duration: number, success: boolean, error?: string): void {
    const queryMetric: QueryMetrics = {
      id: queryId,
      query: queryId.includes("SELECT") ? "SELECT..." : queryId, // Truncate for privacy
      duration,
      timestamp: new Date(),
      success,
      error,
    }

    this.queryMetrics.push(queryMetric)

    // Update counters
    this.counters.totalQueries++
    this.counters.totalQueryTime += duration

    if (success) {
      this.counters.successfulQueries++
    } else {
      this.counters.failedQueries++
    }

    if (duration > this.config.alertThresholds.slowQuery) {
      this.counters.slowQueries++

      if (this.config.enableAlerts) {
        this.createAlert("slow_query", "warning", `Slow query detected: ${duration}ms`, queryMetric)
      }
    }

    // Clean up old query metrics
    this.cleanupOldQueryMetrics()
  }

  /**
   * Record wait time
   */
  recordWaitTime(waitTime: number): void {
    this.counters.waitTimes.push(waitTime)

    // Keep only recent wait times
    if (this.counters.waitTimes.length > 100) {
      this.counters.waitTimes = this.counters.waitTimes.slice(-50)
    }

    if (waitTime > this.config.alertThresholds.longWaitTime && this.config.enableAlerts) {
      this.createAlert("long_wait_time", "warning", `Long connection wait time: ${waitTime}ms`)
    }
  }

  /**
   * Calculate average wait time
   */
  private calculateAverageWaitTime(): number {
    if (this.counters.waitTimes.length === 0) return 0

    const sum = this.counters.waitTimes.reduce((acc, time) => acc + time, 0)
    return sum / this.counters.waitTimes.length
  }

  /**
   * Check for alert conditions
   */
  private checkAlerts(metrics: ConnectionMetrics): void {
    if (!this.config.enableAlerts) return

    // High utilization alert
    if (metrics.poolUtilization > this.config.alertThresholds.highUtilization) {
      this.createAlert(
        "high_utilization",
        "warning",
        `High pool utilization: ${metrics.poolUtilization.toFixed(1)}%`,
        undefined,
        metrics
      )
    }

    // High error rate alert
    if (metrics.errorRate > this.config.alertThresholds.errorRate) {
      this.createAlert(
        "high_error_rate",
        "critical",
        `High error rate: ${metrics.errorRate.toFixed(1)}%`,
        undefined,
        metrics
      )
    }

    // Connection leak detection
    if (metrics.activeConnections > metrics.totalConnections * 0.9) {
      this.counters.connectionLeaks++
      this.createAlert(
        "connection_leak",
        "critical",
        "Potential connection leak detected",
        undefined,
        metrics
      )
    }
  }

  /**
   * Create alert
   */
  private createAlert(
    type: AlertEvent["type"],
    severity: AlertEvent["severity"],
    message: string,
    query?: QueryMetrics,
    metrics?: ConnectionMetrics
  ): void {
    const alert: AlertEvent = {
      type,
      severity,
      message,
      timestamp: new Date(),
      query,
      metrics,
    }

    this.alerts.push(alert)

    // Emit alert event
    this.emit("alert", alert)

    // Log alert
    const emoji = severity === "critical" ? "🚨" : "⚠️"
    console.log(`${emoji} Connection Pool Alert [${severity.toUpperCase()}]: ${message}`)

    // Clean up old alerts
    this.cleanupOldAlerts()
  }

  /**
   * Get current metrics
   */
  getCurrentMetrics(): ConnectionMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(hours = 1): ConnectionMetrics[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000)
    return this.metrics.filter((metric) => metric.timestamp >= cutoff)
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(hours = 1): AlertEvent[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000)
    return this.alerts.filter((alert) => alert.timestamp >= cutoff)
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(hours = 1): {
    averageUtilization: number
    averageQueryTime: number
    errorRate: number
    slowQueryCount: number
    totalQueries: number
    peakUtilization: number
    alertCount: number
  } {
    const recentMetrics = this.getMetricsHistory(hours)
    const recentAlerts = this.getRecentAlerts(hours)

    if (recentMetrics.length === 0) {
      return {
        averageUtilization: 0,
        averageQueryTime: 0,
        errorRate: 0,
        slowQueryCount: 0,
        totalQueries: 0,
        peakUtilization: 0,
        alertCount: 0,
      }
    }

    const totalUtilization = recentMetrics.reduce((sum, m) => sum + m.poolUtilization, 0)
    const totalQueryTime = recentMetrics.reduce((sum, m) => sum + m.averageQueryTime, 0)
    const totalErrors = recentMetrics.reduce((sum, m) => sum + m.failedQueries, 0)
    const totalQueries = recentMetrics.reduce((sum, m) => sum + m.totalQueries, 0)
    const slowQueries = recentMetrics.reduce((sum, m) => sum + m.slowQueries, 0)
    const peakUtilization = Math.max(...recentMetrics.map((m) => m.poolUtilization))

    return {
      averageUtilization: totalUtilization / recentMetrics.length,
      averageQueryTime: totalQueryTime / recentMetrics.length,
      errorRate: totalQueries > 0 ? (totalErrors / totalQueries) * 100 : 0,
      slowQueryCount: slowQueries,
      totalQueries,
      peakUtilization,
      alertCount: recentAlerts.length,
    }
  }

  /**
   * Generate health report
   */
  generateHealthReport(): {
    status: "healthy" | "warning" | "critical"
    score: number // 0-100
    issues: string[]
    recommendations: string[]
    summary: {
      averageUtilization: number
      averageQueryTime: number
      errorRate: number
      slowQueryCount: number
      totalQueries: number
      peakUtilization: number
      alertCount: number
    }
  } {
    const summary = this.getPerformanceSummary()
    const currentMetrics = this.getCurrentMetrics()
    const issues: string[] = []
    const recommendations: string[] = []
    let score = 100

    // Check utilization
    if (summary.averageUtilization > 80) {
      issues.push(`High average utilization: ${summary.averageUtilization.toFixed(1)}%`)
      recommendations.push("Consider increasing pool size or optimizing queries")
      score -= 20
    }

    // Check error rate
    if (summary.errorRate > 5) {
      issues.push(`High error rate: ${summary.errorRate.toFixed(1)}%`)
      recommendations.push("Investigate and fix failing queries")
      score -= 30
    }

    // Check query performance
    if (summary.averageQueryTime > 1000) {
      issues.push(`Slow average query time: ${summary.averageQueryTime.toFixed(0)}ms`)
      recommendations.push("Optimize slow queries and add appropriate indexes")
      score -= 15
    }

    // Check alerts
    if (summary.alertCount > 10) {
      issues.push(`High alert count: ${summary.alertCount} alerts in the last hour`)
      recommendations.push("Address recurring alerts to improve stability")
      score -= 10
    }

    // Check memory usage
    if (currentMetrics && currentMetrics.memoryUsage.percentage > 85) {
      issues.push(`High memory usage: ${currentMetrics.memoryUsage.percentage.toFixed(1)}%`)
      recommendations.push("Monitor memory usage and consider scaling resources")
      score -= 10
    }

    // Determine status
    let status: "healthy" | "warning" | "critical"
    if (score >= 80) {
      status = "healthy"
    } else if (score >= 60) {
      status = "warning"
    } else {
      status = "critical"
    }

    return {
      status,
      score: Math.max(0, score),
      issues,
      recommendations,
      summary,
    }
  }

  /**
   * Clean up old metrics
   */
  private cleanupOldMetrics(): void {
    const cutoff = new Date(Date.now() - this.config.retentionPeriod * 60 * 60 * 1000)
    this.metrics = this.metrics.filter((metric) => metric.timestamp >= cutoff)
  }

  /**
   * Clean up old query metrics
   */
  private cleanupOldQueryMetrics(): void {
    const cutoff = new Date(Date.now() - this.config.retentionPeriod * 60 * 60 * 1000)
    this.queryMetrics = this.queryMetrics.filter((metric) => metric.timestamp >= cutoff)
  }

  /**
   * Clean up old alerts
   */
  private cleanupOldAlerts(): void {
    const cutoff = new Date(Date.now() - this.config.retentionPeriod * 60 * 60 * 1000)
    this.alerts = this.alerts.filter((alert) => alert.timestamp >= cutoff)
  }

  /**
   * Reset all metrics and counters
   */
  resetMetrics(): void {
    this.metrics = []
    this.queryMetrics = []
    this.alerts = []
    this.counters = {
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      totalQueryTime: 0,
      slowQueries: 0,
      waitTimes: [],
      connectionLeaks: 0,
    }
    console.log("✅ Connection monitor metrics reset")
  }

  /**
   * Export metrics to JSON
   */
  exportMetrics(hours = 24): {
    metrics: ConnectionMetrics[]
    queries: QueryMetrics[]
    alerts: AlertEvent[]
    summary: {
      averageUtilization: number
      averageQueryTime: number
      errorRate: number
      slowQueryCount: number
      totalQueries: number
      peakUtilization: number
      alertCount: number
    }
    healthReport: {
      status: "healthy" | "warning" | "critical"
      score: number
      issues: string[]
      recommendations: string[]
      summary: {
        averageUtilization: number
        averageQueryTime: number
        errorRate: number
        slowQueryCount: number
        totalQueries: number
        peakUtilization: number
        alertCount: number
      }
    }
  } {
    return {
      metrics: this.getMetricsHistory(hours),
      queries: this.queryMetrics.filter(
        (q) => q.timestamp >= new Date(Date.now() - hours * 60 * 60 * 1000)
      ),
      alerts: this.getRecentAlerts(hours),
      summary: this.getPerformanceSummary(hours),
      healthReport: this.generateHealthReport(),
    }
  }
}

// Export singleton instance
export const connectionMonitor = new ConnectionPoolMonitor()

// Auto-start monitoring in production (but not during build)
if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
  connectionMonitor.startMonitoring()

  // Setup graceful shutdown
  process.on("SIGTERM", () => {
    connectionMonitor.stopMonitoring()
  })

  process.on("SIGINT", () => {
    connectionMonitor.stopMonitoring()
  })
}

// Export monitoring utilities
export const monitoringUtils = {
  /**
   * Create custom monitoring dashboard data
   */
  createDashboardData(hours = 1) {
    const summary = connectionMonitor.getPerformanceSummary(hours)
    const healthReport = connectionMonitor.generateHealthReport()
    const recentAlerts = connectionMonitor.getRecentAlerts(hours)

    return {
      status: healthReport.status,
      score: healthReport.score,
      metrics: {
        utilization: summary.averageUtilization,
        queryTime: summary.averageQueryTime,
        errorRate: summary.errorRate,
        totalQueries: summary.totalQueries,
      },
      alerts: recentAlerts.length,
      issues: healthReport.issues.length,
      recommendations: healthReport.recommendations,
    }
  },

  /**
   * Setup custom alert handlers
   */
  setupAlertHandlers() {
    connectionMonitor.on("alert", (alert: AlertEvent) => {
      // Custom alert handling logic
      if (alert.severity === "critical") {
        // Send notification, log to external service, etc.
        console.error(`🚨 CRITICAL ALERT: ${alert.message}`)
      }
    })

    connectionMonitor.on("metrics", (metrics: ConnectionMetrics) => {
      // Custom metrics processing
      if (metrics.poolUtilization > 90) {
        console.warn(`⚠️ Pool utilization very high: ${metrics.poolUtilization.toFixed(1)}%`)
      }
    })
  },
}
