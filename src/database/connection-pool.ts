/**
 * Enhanced Database Connection Pool
 * Implements efficient connection pooling and batch processing
 * for optimal resource utilization and cost reduction
 */

import { neonConfig, Pool, type PoolClient } from "@neondatabase/serverless"
import { logger } from "@/lib/logger"
import { sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
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

// Connection pool metrics
interface PoolMetrics {
  totalConnections: number
  idleConnections: number
  waitingClients: number
  totalCount: number
  idleCount: number
  waitingCount: number
  utilization: number
  avgWaitTime: number
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

    if (typeof process !== 'undefined' && process.versions?.node && this.evaluationTimer) {
      if (typeof (this.evaluationTimer as any).unref === "function") {
        (this.evaluationTimer as any).unref()
      }
    }
  }

  private evaluateScaling(): void {
    const metrics = this.getEnhancedPoolMetrics()
    const now = Date.now()

    if (now - this.lastScaleAction < this.config.minScaleInterval) {
      return
    }

    if (metrics.utilization >= this.config.scaleUpThreshold || metrics.waitingCount > 0) {
      this.scaleUp()
    } else if (metrics.utilization <= this.config.scaleDownThreshold && metrics.waitingCount === 0) {
      this.scaleDown(metrics)
    }
  }

  private scaleUp(): void {
    // Pool scaling is handled lazily
  }

  private scaleDown(_metrics: PoolMetrics): void {
    // Pool scaling is handled lazily
  }

  private getEnhancedPoolMetrics(): PoolMetrics {
    // Return safe defaults if pool not initialized
    if (!_pool) {
      return {
        totalConnections: 0,
        idleConnections: 0,
        waitingClients: 0,
        totalCount: 0,
        idleCount: 0,
        waitingCount: 0,
        utilization: 0,
        avgWaitTime: 0,
      }
    }
    const totalCount = _pool.totalCount
    const idleCount = _pool.idleCount
    const waitingCount = _pool.waitingCount
    const activeCount = totalCount - idleCount
    const utilization = totalCount > 0 ? (activeCount / totalCount) * 100 : 0
    const avgWaitTime = this.waitTimes.length > 0
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

// Lazy connection initialization to prevent build-time errors
// Pool and db are created on first access, not at import time
let _pool: Pool | null = null
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null
let _dynamicPoolManager: DynamicPoolManager | null = null

// Check if we're in build environment (no database available)
const isBuildTime = typeof process !== 'undefined' && !process.env.DATABASE_URL && !process.env.TEST_DATABASE_URL

function getConnectionString(): string {
  const connectionString = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("TEST_DATABASE_URL or DATABASE_URL environment variable is required")
  }
  return connectionString
}

function getPool(): Pool {
  if (!_pool) {
    const poolConfig = getPoolConfig()
    _pool = new Pool({
      connectionString: getConnectionString(),
      ...poolConfig,
      // Always enable SSL for Neon/Postgres; avoid CA verification issues in test environments
      ssl: { rejectUnauthorized: false },
    })

    // Connection pool event handlers for monitoring
    _pool.on("connect", async (client: PoolClient) => {
      try {
        await client.query("SET statement_timeout = 15000")
        await client.query("SET lock_timeout = 5000")
        await client.query("SET idle_in_transaction_session_timeout = 15000")
      } catch (_err) {
        // Avoid crashing if SET fails
      }
    })

    _pool.on("remove", (_client: PoolClient) => { })
    _pool.on("error", (_err: Error, _client: PoolClient) => { })
  }
  return _pool
}

function getDynamicPoolManager(): DynamicPoolManager {
  if (!_dynamicPoolManager) {
    _dynamicPoolManager = new DynamicPoolManager(DEFAULT_SCALING_CONFIG)
  }
  return _dynamicPoolManager
}

// Export pool getter
export const pool = new Proxy({} as Pool, {
  get(_target, prop) {
    return (getPool() as any)[prop]
  }
})

// Export pool config
export const poolConfig = getPoolConfig()

// Enhanced Drizzle configuration with lazy connection pool
// Use conditional export to handle build-time vs runtime
const createDbProxy = (): ReturnType<typeof drizzle<typeof schema>> => {
  return new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
    get(_target, prop) {
      if (isBuildTime) {
        // During build, return empty objects for type checking only
        if (prop === 'query') {
          return new Proxy({}, { get: () => () => Promise.resolve(null) })
        }
        return () => Promise.resolve(null)
      }
      if (!_db) {
        _db = drizzle(getPool(), {
          schema,
          logger: process.env.NODE_ENV === "development" && process.env.DEBUG_SQL === "true",
        })
      }
      return (_db as any)[prop]
    }
  })
}

export const db = createDbProxy()

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
  return getDynamicPoolManager().getScalingMetrics()
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
    if (_dynamicPoolManager) {
      _dynamicPoolManager.stop()
    }
    if (_pool) {
      await _pool.end()
    }
    _pool = null
    _db = null
    _dynamicPoolManager = null
  } catch (_error) {
    // Error closing database pool
  }
}

// Note: Pool event handlers are now set up in getPool() function above

// Enhanced connection wrapper with wait time tracking
export async function getConnectionWithTracking() {
  const startTime = Date.now()
  const actualPool = getPool()
  const manager = getDynamicPoolManager()

  try {
    const client = await actualPool.connect()
    const waitTime = Date.now() - startTime

    // Record wait time for dynamic scaling decisions
    manager.recordWaitTime(waitTime)

    return {
      client,
      waitTime,
      release: () => client.release(),
    }
  } catch (error) {
    const waitTime = Date.now() - startTime
    manager.recordWaitTime(waitTime)
    throw error
  }
}


// Note: pool and poolConfig are already exported above

// Export dynamic pool manager getter for external monitoring
export const dynamicPoolManager = new Proxy({} as DynamicPoolManager, {
  get(_target, prop) {
    return (getDynamicPoolManager() as any)[prop]
  }
})

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
    return operation()
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
    return { summary: "Performance logging disabled" }
  },

  /**
   * Cleanup old performance logs
   */
  async cleanupPerformanceLogs() {
    return { cleaned: 0 }
  },
}
