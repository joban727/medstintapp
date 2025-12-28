/**
 * Enhanced Database Connection Pool
 * Implements efficient connection pooling and batch processing
 * for optimal resource utilization and cost reduction
 */

import { neonConfig, Pool, type PoolClient } from "@neondatabase/serverless"
import { sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
// Temporarily disabled to fix build issues
// import { queryPerformanceLogger } from "../lib/query-performance-logger"
import * as schema from "./schema"

// Configure Neon for serverless environments to prevent WebSocket issues
// fetchConnectionCache is deprecated and now always true
neonConfig.webSocketConstructor = undefined // Disable WebSocket to prevent s.unref errors

// Connection pool configuration
interface PoolConfig {
  min: number
  max: number
  idleTimeoutMillis: number
  connectionTimeoutMillis: number
  maxUses: number
  allowExitOnIdle: boolean
}

// Dynamic scaling configuration
interface DynamicScalingConfig {
  enabled: boolean
  scaleUpThreshold: number // utilization percentage to scale up
  scaleDownThreshold: number // utilization percentage to scale down
  scaleUpIncrement: number // connections to add when scaling up
  scaleDownDecrement: number // connections to remove when scaling down
  evaluationInterval: number // milliseconds between scaling evaluations
  minScaleInterval: number // minimum time between scaling actions
  maxConnections: number // absolute maximum connections
  minConnections: number // absolute minimum connections
}

// Default pool configuration optimized for serverless environments
const DEFAULT_POOL_CONFIG: PoolConfig = {
  min: 1, // Reduced minimum connections to prevent idle connection termination
  max: 5, // Reduced maximum connections to stay within Neon limits
  idleTimeoutMillis: 10000, // Reduced to 10 seconds to prevent administrator termination
  connectionTimeoutMillis: 3000, // Reduced to 3 seconds for faster timeout
  maxUses: 1000, // Reduced max uses to recycle connections more frequently
  allowExitOnIdle: true, // Allow process to exit when idle
}

// Default dynamic scaling configuration
const DEFAULT_SCALING_CONFIG: DynamicScalingConfig = {
  enabled: process.env.NODE_ENV === "production", // Enable in production
  scaleUpThreshold: 80, // Scale up when 80% utilized
  scaleDownThreshold: 30, // Scale down when below 30% utilized
  scaleUpIncrement: 2, // Add 2 connections when scaling up
  scaleDownDecrement: 1, // Remove 1 connection when scaling down
  evaluationInterval: 30000, // Evaluate every 30 seconds
  minScaleInterval: 60000, // Wait at least 1 minute between scaling actions
  maxConnections: 25, // Never exceed 25 connections
  minConnections: 1, // Never go below 1 connection
}

// Environment-based configuration
const getPoolConfig = (): PoolConfig => {
  const config = { ...DEFAULT_POOL_CONFIG }

  // Production optimizations
  if (process.env.NODE_ENV === "production") {
    config.max = Number.parseInt(process.env.DB_POOL_MAX || "8") // Reduced from 15
    config.min = Number.parseInt(process.env.DB_POOL_MIN || "1") // Reduced from 3
    config.idleTimeoutMillis = Number.parseInt(process.env.DB_IDLE_TIMEOUT || "15000") // Reduced from 60000
  }

  // Development settings
  if (process.env.NODE_ENV === "development") {
    config.max = Number.parseInt(process.env.DB_POOL_MAX || "3") // Reduced from 5
    config.min = Number.parseInt(process.env.DB_POOL_MIN || "1")
    config.idleTimeoutMillis = Number.parseInt(process.env.DB_IDLE_TIMEOUT || "8000") // Reduced from 15000
  }

  return config
}

// Connection string validation
const connectionString = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
if (!connectionString) {
  throw new Error("TEST_DATABASE_URL or DATABASE_URL environment variable is required")
}

// Create connection pool
const poolConfig = getPoolConfig()
const pool = new Pool({
  connectionString,
  ...poolConfig,
  // Always enable SSL for Neon/Postgres; avoid CA verification issues in test environments
  ssl: { rejectUnauthorized: false },
})

// Connection pool metrics
interface PoolMetrics {
  totalConnections: number
  idleConnections: number
  waitingClients: number
  totalCount: number
  idleCount: number
  waitingCount: number
  utilization: number // percentage of connections in use
  avgWaitTime: number // average wait time for connections
}

// Dynamic pool manager class
class DynamicPoolManager {
  private config: DynamicScalingConfig
  private lastScaleAction = 0
  private evaluationTimer?: NodeJS.Timeout
  private waitTimes: number[] = []
  private maxWaitTimeHistory = 10

  constructor(config: DynamicScalingConfig) {
    this.config = config
    if (config.enabled) {
      this.startMonitoring()
    }
  }

  private startMonitoring(): void {
    this.evaluationTimer = setInterval(() => {
      this.evaluateScaling()
    }, this.config.evaluationInterval)
    
    // Only use unref in Node.js environment to prevent process hanging
    if (typeof process !== 'undefined' && process.versions?.node && this.evaluationTimer) {
      (this.evaluationTimer as any).unref?.()
    }
  }

  private evaluateScaling(): void {
    const metrics = this.getEnhancedPoolMetrics()
    const now = Date.now()

    // Check if enough time has passed since last scaling action
    if (now - this.lastScaleAction < this.config.minScaleInterval) {
      return
    }

    // Scale up if utilization is high or there are waiting clients
    if (metrics.utilization >= this.config.scaleUpThreshold || metrics.waitingCount > 0) {
      this.scaleUp(metrics)
    }
    // Scale down if utilization is low and no waiting clients
    else if (metrics.utilization <= this.config.scaleDownThreshold && metrics.waitingCount === 0) {
      this.scaleDown(metrics)
    }
  }

  private scaleUp(_metrics: PoolMetrics): void {
    const currentMax = pool.options.max || DEFAULT_POOL_CONFIG.max
    const newMax = Math.min(currentMax + this.config.scaleUpIncrement, this.config.maxConnections)

    if (newMax > currentMax) {
      pool.options.max = newMax
      this.lastScaleAction = Date.now()
      // Scaled up connection pool
    }
  }

  private scaleDown(metrics: PoolMetrics): void {
    const currentMax = pool.options.max || DEFAULT_POOL_CONFIG.max
    const newMax = Math.max(currentMax - this.config.scaleDownDecrement, this.config.minConnections)

    if (newMax < currentMax && metrics.totalCount > newMax) {
      pool.options.max = newMax
      this.lastScaleAction = Date.now()
      // Scaled down connection pool
    }
  }

  private getEnhancedPoolMetrics(): PoolMetrics {
    const totalCount = pool.totalCount
    const idleCount = pool.idleCount
    const waitingCount = pool.waitingCount
    const activeCount = totalCount - idleCount
    const utilization = totalCount > 0 ? (activeCount / totalCount) * 100 : 0
    const avgWaitTime =
      this.waitTimes.length > 0
        ? this.waitTimes.reduce((a, b) => a + b, 0) / this.waitTimes.length
        : 0

    return {
      totalConnections: totalCount,
      idleConnections: idleCount,
      waitingClients: waitingCount,
      totalCount,
      idleCount,
      waitingCount,
      utilization,
      avgWaitTime,
    }
  }

  public recordWaitTime(waitTime: number): void {
    this.waitTimes.push(waitTime)
    if (this.waitTimes.length > this.maxWaitTimeHistory) {
      this.waitTimes.shift()
    }
  }

  public getScalingMetrics() {
    return {
      config: this.config,
      lastScaleAction: this.lastScaleAction,
      metrics: this.getEnhancedPoolMetrics(),
    }
  }

  public stop(): void {
    if (this.evaluationTimer) {
      clearInterval(this.evaluationTimer)
      this.evaluationTimer = undefined
    }
  }
}

// Initialize dynamic pool manager
const dynamicPoolManager = new DynamicPoolManager(DEFAULT_SCALING_CONFIG)

// Enhanced Drizzle configuration with connection pool
export const db = drizzle(pool, {
  schema,
  logger: process.env.NODE_ENV === "development" && process.env.DEBUG_SQL === "true",
})

// Get current pool metrics with enhanced information
export function getPoolMetrics(): PoolMetrics {
  const totalCount = pool.totalCount
  const idleCount = pool.idleCount
  const waitingCount = pool.waitingCount
  const activeCount = totalCount - idleCount
  const utilization = totalCount > 0 ? (activeCount / totalCount) * 100 : 0

  return {
    totalConnections: totalCount,
    idleConnections: idleCount,
    waitingClients: waitingCount,
    totalCount,
    idleCount,
    waitingCount,
    utilization,
    avgWaitTime: 0, // Will be populated by dynamic manager if available
  }
}

// Get enhanced pool metrics with scaling information
export function getEnhancedPoolMetrics() {
  return dynamicPoolManager.getScalingMetrics()
}

// Connection health check with pool awareness
export async function checkDatabaseConnection(): Promise<{
  healthy: boolean
  poolMetrics: PoolMetrics
  latency?: number
}> {
  const startTime = Date.now()

  try {
    // Use pool for health check
    const client = await pool.connect()
    await client.query("SELECT 1")
    client.release()

    const latency = Date.now() - startTime

    return {
      healthy: true,
      poolMetrics: getPoolMetrics(),
      latency,
    }
  } catch (_error) {
    // Database connection failed
    return {
      healthy: false,
      poolMetrics: getPoolMetrics(),
    }
  }
}

// Graceful pool shutdown
export async function closeDatabasePool(): Promise<void> {
  try {
    // Stop dynamic scaling first
    dynamicPoolManager.stop()
    await pool.end()
    // Database pool closed gracefully
  } catch (_error) {
    // Error closing database pool
  }
}

// Connection pool event handlers for monitoring
pool.on("connect", async (client: PoolClient) => {
  // New database connection established
  try {
    // Set sane defaults to prevent runaway queries/locks
    await client.query("SET statement_timeout = 15000") // 15s
    await client.query("SET lock_timeout = 5000") // 5s
    await client.query("SET idle_in_transaction_session_timeout = 15000") // 15s
  } catch (_err) {
    // Avoid crashing if SET fails; continue without hard timeouts
  }
})

pool.on("remove", (_client: PoolClient) => {
  // Database connection removed from pool
})

pool.on("error", (_err: Error, _client: PoolClient) => {
  // Database pool error
})

// Enhanced connection wrapper with wait time tracking
export async function getConnectionWithTracking() {
  const startTime = Date.now()

  try {
    const client = await pool.connect()
    const waitTime = Date.now() - startTime

    // Record wait time for dynamic scaling decisions
    dynamicPoolManager.recordWaitTime(waitTime)

    // Log slow connection acquisitions
    if (waitTime > 1000) {
      // Slow connection acquisition
    }

    return {
      client,
      waitTime,
      release: () => client.release(),
    }
  } catch (error) {
    const waitTime = Date.now() - startTime
    dynamicPoolManager.recordWaitTime(waitTime)
    throw error
  }
}

// Export pool for advanced usage
export { pool }

// Export configuration for monitoring
export { poolConfig }

// Export dynamic pool manager for external monitoring
export { dynamicPoolManager }

// Database utilities for compatibility
export const dbUtils = {
  async getHealthStatus() {
    try {
      const startTime = Date.now()
      await db.execute(sql`SELECT 1`)
      const responseTime = Date.now() - startTime

      const poolMetrics = getPoolMetrics()

      return {
        status: "healthy",
        responseTime,
        pool: poolMetrics,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      // Database health check failed
      return {
        status: "unhealthy",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      }
    }
  },

  async executeWithMonitoring<T>(
    operation: () => Promise<T>,
    _operationName: string,
    _options: {
      endpoint?: string
      userId?: string
      schoolId?: string
      query?: string
    } = {}
  ): Promise<T> {
    // Temporarily disabled performance logging to fix build issues
    return operation()
    // return queryPerformanceLogger.executeWithLogging(operation, {
    //   name: operationName,
    //   query: options.query,
    //   endpoint: options.endpoint,
    //   userId: options.userId,
    //   schoolId: options.schoolId,
    // })
  },

  /**
   * Enhanced query execution with automatic performance logging
   */
  async executeQuery<T>(
    queryFn: () => Promise<T>,
    _options: {
      name: string
      endpoint?: string
      userId?: string
      schoolId?: string
      query?: string
    }
  ): Promise<T> {
    // Lightweight timing + console logging without external deps
    const start = Date.now()
    try {
      const result = await queryFn()
      return result
    } finally {
      const duration = Date.now() - start
      if (process.env.NODE_ENV === "development" && process.env.DEBUG_SQL === "true") {
        const name = _options?.name || "unnamed_query"
        const endpoint = _options?.endpoint ? ` @ ${_options.endpoint}` : ""
        console.log(`SQL[${name}]${endpoint} took ${duration}ms`)
      }
    }
  },

  /**
   * Get query performance metrics
   */
  async getPerformanceMetrics(_hours = 24) {
    // Temporarily disabled performance logging to fix build issues
    return { summary: "Performance logging temporarily disabled" }
    // return queryPerformanceLogger.getPerformanceSummary(hours)
  },

  /**
   * Cleanup old performance logs
   */
  async cleanupPerformanceLogs() {
    // Temporarily disabled performance logging to fix build issues
    return { cleaned: 0 }
    // return queryPerformanceLogger.cleanup()
  },
}
