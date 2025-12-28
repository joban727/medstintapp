/**
 * Query Performance Logger
 * Implements comprehensive query performance monitoring and logging
 * Integrates with the database migration for persistent performance tracking
 */

// This file is server-only and should not be bundled for the client
import "server-only"
import { createHash, randomUUID } from "node:crypto"

const crypto = { createHash, randomUUID }

import { neonConfig, Pool } from "@neondatabase/serverless"
import { sql, desc, and, gte, lt, count, avg, isNotNull, eq } from "drizzle-orm"
// Import db directly from drizzle to avoid circular dependency
import { drizzle } from "drizzle-orm/neon-serverless"
import * as schema from "../database/schema"

// Configure Neon for serverless environments to prevent WebSocket issues
// fetchConnectionCache is deprecated and now always true
neonConfig.webSocketConstructor = undefined // Disable WebSocket to prevent s.unref errors

// Create a separate db instance to avoid circular dependency
const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required")
}
const pool = new Pool({ connectionString })
const db = drizzle(pool, { schema })

// Performance logging configuration
interface PerformanceLoggerConfig {
  slowQueryThreshold: number // milliseconds
  enableLogging: boolean
  enableConsoleOutput: boolean
  batchSize: number
  flushInterval: number // milliseconds
  maxRetries: number
  // Enhanced monitoring thresholds
  criticalQueryThreshold: number // milliseconds
  memoryUsageThreshold: number // MB
  enableRealTimeAlerts: boolean
  performanceTrendWindow: number // minutes
}

const DEFAULT_CONFIG: PerformanceLoggerConfig = {
  slowQueryThreshold: 50, // Log queries slower than 50ms (lowered from 100ms)
  enableLogging: true, // Always enable logging for better monitoring
  enableConsoleOutput: process.env.NODE_ENV === "development",
  batchSize: 100, // Increased batch size for efficiency
  flushInterval: 15000, // Flush every 15 seconds (more frequent)
  maxRetries: 3,
  // Enhanced monitoring parameters
  criticalQueryThreshold: 500, // Critical queries over 500ms
  memoryUsageThreshold: 100, // Alert when query uses >100MB
  enableRealTimeAlerts: true,
  performanceTrendWindow: 30, // 30-minute trend analysis window
}

// Query performance metrics interface
interface QueryPerformanceMetrics {
  queryHash: string
  queryType: "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "OTHER"
  tableName?: string
  executionTimeMs: number
  rowsExamined?: number
  rowsReturned?: number
  queryPlanHash?: string
  endpoint?: string
  userId?: string
  schoolId?: string
  querySample?: string
  timestamp: Date
  // Enhanced metrics
  memoryUsageMB?: number
  cpuUsagePercent?: number
  cacheHitRate?: number
  indexUsage?: boolean
  connectionPoolSize?: number
}

// Performance alert interface
interface PerformanceAlert {
  type: "slow_query" | "critical_query" | "memory_usage" | "performance_degradation"
  severity: "warning" | "critical"
  message: string
  timestamp: Date
  metrics: QueryPerformanceMetrics
  threshold: number
  actualValue: number
}

// Performance trend analysis
interface PerformanceTrend {
  endpoint: string
  avgExecutionTime: number
  trendDirection: "improving" | "degrading" | "stable"
  changePercent: number
  sampleSize: number
  timeWindow: string
}

// Batch queue for performance logs
interface QueuedLog extends QueryPerformanceMetrics {
  retryCount: number
}

/**
 * Query Performance Logger Class
 */
export class QueryPerformanceLogger {
  private config: PerformanceLoggerConfig
  private logQueue: QueuedLog[] = []
  private flushTimer: NodeJS.Timeout | null = null
  private isProcessing = false
  private performanceHistory: Map<string, number[]> = new Map()
  private alertCallbacks: ((alert: PerformanceAlert) => void)[] = []

  constructor(config: Partial<PerformanceLoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.startBatchProcessor()
  }

  /**
   * Register callback for performance alerts
   */
  onAlert(callback: (alert: PerformanceAlert) => void): void {
    this.alertCallbacks.push(callback)
  }

  /**
   * Emit performance alert
   */
  private emitAlert(alert: PerformanceAlert): void {
    if (this.config.enableRealTimeAlerts) {
      this.alertCallbacks.forEach((callback) => {
        try {
          callback(alert)
        } catch (error) {
          console.error("❌ Alert callback failed:", error)
        }
      })
    }
  }

  /**
   * Analyze performance trends for an endpoint
   */
  async analyzePerformanceTrend(endpoint: string): Promise<PerformanceTrend | null> {
    try {
      const windowStart = new Date(Date.now() - this.config.performanceTrendWindow * 60 * 1000)

      const recentMetrics = await db
        .select({
          executionTimeMs: schema.queryPerformanceLog.executionTime,
          createdAt: schema.queryPerformanceLog.createdAt,
        })
        .from(schema.queryPerformanceLog)
        .where(
          and(
            eq(schema.queryPerformanceLog.endpoint, endpoint),
            gte(schema.queryPerformanceLog.createdAt, windowStart)
          )
        )
        .orderBy(desc(schema.queryPerformanceLog.createdAt))
        .limit(100)

      if (recentMetrics.length < 10) {
        return null // Not enough data for trend analysis
      }

      const times = recentMetrics.map((m) => Number(m.executionTimeMs))
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length

      // Compare with historical average (last hour vs previous hour)
      const midPoint = Math.floor(times.length / 2)
      const recentAvg = times.slice(0, midPoint).reduce((a, b) => a + b, 0) / midPoint
      const olderAvg = times.slice(midPoint).reduce((a, b) => a + b, 0) / (times.length - midPoint)

      const changePercent = ((recentAvg - olderAvg) / olderAvg) * 100

      let trendDirection: "improving" | "degrading" | "stable"
      if (Math.abs(changePercent) < 5) {
        trendDirection = "stable"
      } else if (changePercent > 0) {
        trendDirection = "degrading"
      } else {
        trendDirection = "improving"
      }

      return {
        endpoint,
        avgExecutionTime: Math.round(avgTime),
        trendDirection,
        changePercent: Math.round(changePercent),
        sampleSize: times.length,
        timeWindow: `${this.config.performanceTrendWindow} minutes`,
      }
    } catch (error) {
      console.error("❌ Failed to analyze performance trend:", error)
      return null
    }
  }

  /**
   * Get real-time performance metrics
   */
  async getRealTimeMetrics(): Promise<{
    activeQueries: number
    avgResponseTime: number
    slowQueries: number
    criticalQueries: number
    errorRate: number
  }> {
    try {
      const last5Minutes = new Date(Date.now() - 5 * 60 * 1000)

      const metrics = await db
        .select({
          totalQueries: count(),
          avgTime: avg(schema.queryPerformanceLog.executionTime),
          slowQueries: sql<number>`count(CASE WHEN ${schema.queryPerformanceLog.executionTime} > ${this.config.slowQueryThreshold} THEN 1 END)`,
          criticalQueries: sql<number>`count(CASE WHEN ${schema.queryPerformanceLog.executionTime} > ${this.config.criticalQueryThreshold} THEN 1 END)`,
        })
        .from(schema.queryPerformanceLog)
        .where(gte(schema.queryPerformanceLog.createdAt, last5Minutes))

      const result = metrics[0]
      return {
        activeQueries: Number(result?.totalQueries || 0),
        avgResponseTime: Math.round(Number(result?.avgTime || 0)),
        slowQueries: Number(result?.slowQueries || 0),
        criticalQueries: Number(result?.criticalQueries || 0),
        errorRate: 0, // Would need error tracking implementation
      }
    } catch (error) {
      console.error("❌ Failed to get real-time metrics:", error)
      return {
        activeQueries: 0,
        avgResponseTime: 0,
        slowQueries: 0,
        criticalQueries: 0,
        errorRate: 0,
      }
    }
  }

  /**
   * Log query performance metrics
   */
  async logQuery(
    query: string,
    executionTimeMs: number,
    options: {
      rowsExamined?: number
      rowsReturned?: number
      endpoint?: string
      userId?: string
      schoolId?: string
      error?: Error
    } = {}
  ): Promise<void> {
    // Only log if enabled and meets threshold
    if (!this.config.enableLogging || executionTimeMs < this.config.slowQueryThreshold) {
      return
    }

    try {
      const metrics = this.extractQueryMetrics(query, executionTimeMs, options)

      // Console output for development
      if (this.config.enableConsoleOutput) {
        this.logToConsole(metrics, options.error)
      }

      // Add to batch queue for database logging
      this.logQueue.push({
        ...metrics,
        retryCount: 0,
      })

      // Flush immediately if queue is full
      if (this.logQueue.length >= this.config.batchSize) {
        await this.flushLogs()
      }
    } catch (error) {
      console.error("❌ Failed to log query performance:", error)
    }
  }

  /**
   * Execute query with automatic performance logging
   */
  async executeWithLogging<T>(
    queryFn: () => Promise<T>,
    queryInfo: {
      name: string
      query?: string
      endpoint?: string
      userId?: string
      schoolId?: string
    }
  ): Promise<T> {
    const startTime = Date.now()
    let result: T
    let error: Error | undefined
    let rowsReturned: number | undefined

    try {
      result = await queryFn()

      // Try to extract row count from result
      if (Array.isArray(result)) {
        rowsReturned = result.length
      } else if (result && typeof result === "object" && "length" in result) {
        rowsReturned = (result as { length?: number }).length
      }

      return result
    } catch (err) {
      error = err as Error
      throw err
    } finally {
      const executionTime = Date.now() - startTime

      // Log performance metrics
      await this.logQuery(queryInfo.query || queryInfo.name, executionTime, {
        rowsReturned,
        endpoint: queryInfo.endpoint,
        userId: queryInfo.userId,
        schoolId: queryInfo.schoolId,
        error,
      })
    }
  }

  /**
   * Extract query metrics from SQL string
   */
  private extractQueryMetrics(
    query: string,
    executionTimeMs: number,
    options: {
      rowsExamined?: number
      rowsReturned?: number
      endpoint?: string
      userId?: string
      schoolId?: string
    }
  ): QueryPerformanceMetrics {
    const queryHash = this.generateQueryHash(query)
    const queryType = this.extractQueryType(query)
    const tableName = this.extractTableName(query)
    const querySample = this.sanitizeQuery(query)

    return {
      queryHash,
      queryType,
      tableName,
      executionTimeMs,
      rowsExamined: options.rowsExamined,
      rowsReturned: options.rowsReturned,
      endpoint: options.endpoint,
      userId: options.userId,
      schoolId: options.schoolId,
      querySample,
      timestamp: new Date(),
    }
  }

  /**
   * Generate hash for query normalization
   */
  private generateQueryHash(query: string): string {
    // Normalize query by removing parameters and whitespace
    const normalized = query
      .replace(/\$\d+/g, "?") // Replace parameters
      .replace(/\s+/g, " ") // Normalize whitespace
      .replace(/\d+/g, "N") // Replace numbers
      .replace(/'[^']*'/g, "'X'") // Replace string literals
      .trim()
      .toLowerCase()

    // Use a simple hash function for browser compatibility
    if (typeof window !== "undefined") {
      // Browser environment - use a simple string hash
      let hash = 0
      for (let i = 0; i < normalized.length; i++) {
        const char = normalized.charCodeAt(i)
        hash = (hash << 5) - hash + char
        hash = hash & hash // Convert to 32-bit integer
      }
      return Math.abs(hash).toString(16)
    }
    // Node.js environment
    return crypto.createHash("md5").update(normalized).digest("hex")
  }

  /**
   * Extract query type from SQL
   */
  private extractQueryType(query: string): QueryPerformanceMetrics["queryType"] {
    const normalizedQuery = query.trim().toLowerCase()

    if (normalizedQuery.startsWith("select")) return "SELECT"
    if (normalizedQuery.startsWith("insert")) return "INSERT"
    if (normalizedQuery.startsWith("update")) return "UPDATE"
    if (normalizedQuery.startsWith("delete")) return "DELETE"

    return "OTHER"
  }

  /**
   * Extract primary table name from query
   */
  private extractTableName(query: string): string | undefined {
    const normalizedQuery = query.trim().toLowerCase()

    // Match common patterns
    const patterns = [
      /from\s+(["']?)([a-zA-Z_][a-zA-Z0-9_]*)\1/i, // SELECT ... FROM table
      /into\s+(["']?)([a-zA-Z_][a-zA-Z0-9_]*)\1/i, // INSERT INTO table
      /update\s+(["']?)([a-zA-Z_][a-zA-Z0-9_]*)\1/i, // UPDATE table
      /delete\s+from\s+(["']?)([a-zA-Z_][a-zA-Z0-9_]*)\1/i, // DELETE FROM table
    ]

    for (const pattern of patterns) {
      const match = normalizedQuery.match(pattern)
      if (match?.[2]) {
        return match[2]
      }
    }

    return undefined
  }

  /**
   * Sanitize query for logging (remove sensitive data)
   */
  private sanitizeQuery(query: string): string {
    return query
      .replace(/\$\d+/g, "?") // Replace parameters
      .replace(/'[^']*'/g, "'***'") // Replace string literals
      .replace(/\b\d{10,}\b/g, "***") // Replace long numbers (potential IDs)
      .substring(0, 500) // Limit length
  }

  /**
   * Log to console for development
   */
  private logToConsole(metrics: QueryPerformanceMetrics, error?: Error): void {
    const emoji = error ? "❌" : metrics.executionTimeMs > 1000 ? "🐌" : "⚡"
    const status = error ? "FAILED" : "SUCCESS"

    console.log(
      `${emoji} Query ${status} [${metrics.queryType}] ${metrics.tableName || "unknown"} ` +
      `${metrics.executionTimeMs}ms` +
      (metrics.rowsReturned ? ` (${metrics.rowsReturned} rows)` : "") +
      (metrics.endpoint ? ` - ${metrics.endpoint}` : "")
    )

    if (error) {
      console.error("   Error:", error.message)
    }

    if (metrics.executionTimeMs > 1000) {
      console.log("   Query:", `${metrics.querySample?.substring(0, 100)}...`)
    }
  }

  /**
   * Start batch processor for database logging
   */
  private startBatchProcessor(): void {
    if (!this.config.enableLogging) return

    this.flushTimer = setInterval(() => {
      if (this.logQueue.length > 0) {
        this.flushLogs().catch((error) => {
          console.error("❌ Failed to flush performance logs:", error)
        })
      }
    }, this.config.flushInterval)

    // Only use unref in Node.js environment to prevent process hanging
    if (typeof process !== "undefined" && process.versions?.node && this.flushTimer) {
      ; (this.flushTimer as any).unref?.()
    }
  }

  /**
   * Flush queued logs to database
   */
  private async flushLogs(): Promise<void> {
    if (this.isProcessing || this.logQueue.length === 0) {
      return
    }

    this.isProcessing = true
    const logsToProcess = this.logQueue.splice(0, this.config.batchSize)

    try {
      // Use the log_slow_query function from our migration
      // Map logs to the schema format
      const mappedLogs = logsToProcess.map((log) => ({
        queryHash: log.queryHash,
        queryText: log.querySample || "N/A",
        executionTime: log.executionTimeMs.toString(), // decimal expects string or number
        rowsAffected: log.rowsReturned,
        userId: log.userId,
        endpoint: log.endpoint,
        method: log.queryType,
        // Missing fields in log object: userAgent, ipAddress, etc.
        // I'll leave them null/default.
      }))

      // Insert all mapped logs directly using Drizzle in a single batch
      if (mappedLogs.length > 0) {
        await db.insert(schema.queryPerformanceLog).values(mappedLogs)
      }

      if (this.config.enableConsoleOutput && logsToProcess.length > 0) {
        console.log(`📊 Logged ${logsToProcess.length} query performance metrics to database`)
      }
    } catch (error) {
      console.error("❌ Failed to flush performance logs to database:", error)

      // Retry failed logs
      const retriableLogs = logsToProcess
        .filter((log) => log.retryCount < this.config.maxRetries)
        .map((log) => ({ ...log, retryCount: log.retryCount + 1 }))

      this.logQueue.unshift(...retriableLogs)
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Get performance summary from database
   */
  async getPerformanceSummary(hours = 24): Promise<{
    totalQueries: number
    averageExecutionTime: number
    slowQueries: number
    topSlowQueries: Array<{
      queryType: string
      tableName: string
      avgTime: number
      count: number
    }>
    endpointPerformance: Array<{
      endpoint: string
      avgTime: number
      count: number
    }>
  }> {
    // Validate and clamp hours to safe range (1-168 hours = 1 week max)
    const safeHours = Math.min(Math.max(1, Math.floor(Number(hours) || 24)), 168)

    try {
      const result = await db
        .select({
          total_queries: count(),
          avg_execution_time: avg(schema.queryPerformanceLog.executionTime),
          slow_queries: sql<number>`count(CASE WHEN ${schema.queryPerformanceLog.executionTime} > 1000 THEN 1 END)`,
        })
        .from(schema.queryPerformanceLog)
        .where(
          sql`${schema.queryPerformanceLog.createdAt} >= NOW() - INTERVAL '${sql.raw(safeHours.toString())} hours'`
        )

      const topSlowQueries = await db
        .select({
          query_type: schema.queryPerformanceLog.method, // Mapping method to query_type
          table_name: sql<string>`'unknown'`, // Schema doesn't have table_name column?
          // Wait, schema doesn't have table_name. The stored proc might have parsed it or it was stored in 'tablesAccessed'?
          // I'll use 'method' as query_type.
          avg_time: avg(schema.queryPerformanceLog.executionTime),
          count: count(),
        })
        .from(schema.queryPerformanceLog)
        .where(
          sql`${schema.queryPerformanceLog.createdAt} >= NOW() - INTERVAL '${sql.raw(safeHours.toString())} hours'`
        )
        .groupBy(schema.queryPerformanceLog.method)
        .orderBy(desc(sql`avg_time`))
        .limit(10)

      const endpointPerformance = await db
        .select({
          endpoint: schema.queryPerformanceLog.endpoint,
          avg_time: avg(schema.queryPerformanceLog.executionTime),
          count: count(),
        })
        .from(schema.queryPerformanceLog)
        .where(
          and(
            sql`${schema.queryPerformanceLog.createdAt} >= NOW() - INTERVAL '${sql.raw(safeHours.toString())} hours'`,
            isNotNull(schema.queryPerformanceLog.endpoint)
          )
        )
        .groupBy(schema.queryPerformanceLog.endpoint)
        .orderBy(desc(sql`avg_time`))
        .limit(10)

      const summary = result[0] as Record<string, unknown> | undefined

      return {
        totalQueries: summary ? Number.parseInt(String(summary.total_queries || 0)) || 0 : 0,
        averageExecutionTime: summary
          ? Number.parseFloat(String(summary.avg_execution_time || 0)) || 0
          : 0,
        slowQueries: summary ? Number.parseInt(String(summary.slow_queries || 0)) || 0 : 0,
        topSlowQueries: Array.isArray(topSlowQueries)
          ? topSlowQueries.map((row) => ({
            queryType: String(row.query_type || ""),
            tableName: String(row.table_name || "unknown"),
            avgTime: Number.parseFloat(String(row.avg_time || 0)),
            count: Number.parseInt(String(row.count || 0)),
          }))
          : [],
        endpointPerformance: Array.isArray(endpointPerformance)
          ? endpointPerformance.map((row) => ({
            endpoint: String(row.endpoint || ""),
            avgTime: Number.parseFloat(String(row.avg_time || 0)),
            count: Number.parseInt(String(row.count || 0)),
          }))
          : [],
      }
    } catch (error) {
      console.error("❌ Failed to get performance summary:", error)
      return {
        totalQueries: 0,
        averageExecutionTime: 0,
        slowQueries: 0,
        topSlowQueries: [],
        endpointPerformance: [],
      }
    }
  }

  /**
   * Cleanup old performance logs
   */
  async cleanup(): Promise<void> {
    try {
      // Cleanup logs older than 30 days
      await db
        .delete(schema.queryPerformanceLog)
        .where(sql`${schema.queryPerformanceLog.createdAt} < NOW() - INTERVAL '30 days'`)
      console.log("✅ Performance log cleanup completed")
    } catch (error) {
      console.error("❌ Failed to cleanup performance logs:", error)
    }
  }

  /**
   * Stop the logger and cleanup
   */
  async stop(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }

    // Flush remaining logs
    if (this.logQueue.length > 0) {
      await this.flushLogs()
    }

    console.log("✅ Query performance logger stopped")
  }
}

// Export singleton instance
export const queryPerformanceLogger = new QueryPerformanceLogger()

// Auto-start in production
if (process.env.NODE_ENV === "production") {
  // Setup graceful shutdown
  process.on("SIGTERM", async () => {
    await queryPerformanceLogger.stop()
  })

  process.on("SIGINT", async () => {
    await queryPerformanceLogger.stop()
  })
}

// Export utility functions
export const queryPerformanceUtils = {
  /**
   * Wrapper for Drizzle queries with automatic logging
   */
  async executeQuery<T>(
    queryFn: () => Promise<T>,
    options: {
      name: string
      endpoint?: string
      userId?: string
      schoolId?: string
    }
  ): Promise<T> {
    return queryPerformanceLogger.executeWithLogging(queryFn, options)
  },

  /**
   * Get performance dashboard data
   */
  async getDashboardData(hours = 24) {
    const summary = await queryPerformanceLogger.getPerformanceSummary(hours)

    return {
      metrics: {
        totalQueries: summary.totalQueries,
        averageExecutionTime: Math.round(summary.averageExecutionTime),
        slowQueries: summary.slowQueries,
        slowQueryPercentage:
          summary.totalQueries > 0
            ? Math.round((summary.slowQueries / summary.totalQueries) * 100)
            : 0,
      },
      topSlowQueries: summary.topSlowQueries.slice(0, 5),
      endpointPerformance: summary.endpointPerformance.slice(0, 5),
    }
  },
}
