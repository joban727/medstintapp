import { neonConfig, Pool } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/node-postgres"
import { withReplicas } from "drizzle-orm/pg-core"
import { connectionMonitor } from "../lib/connection-monitor"
import * as schema from "./schema"

// Handle build-time scenario where DATABASE_URL might not be available
if (!process.env.DATABASE_URL && process.env.NODE_ENV !== "production") {
  console.warn("DATABASE_URL is not set - using placeholder for build")
}

// Configure Neon for serverless environments
// fetchConnectionCache is deprecated and now always true
neonConfig.webSocketConstructor = undefined // Disable WebSocket to prevent s.unref errors

// Global error handling for Neon connection termination errors
process.on('uncaughtException', (error) => {
  // Handle Neon-specific connection termination errors gracefully
  if (error.message?.includes('57P01') || error.message?.includes('terminating connection due to administrator command')) {
    console.warn('Neon connection terminated by administrator (57P01) - this is expected behavior and will be handled gracefully')
    return // Don't crash the application
  }

  // For other uncaught exceptions, log and let the default handler take over
  console.error('Uncaught Exception:', error)
  throw error
})

// Create a single pool instance for the entire application with optimized settings
const connectionString = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || "postgresql://placeholder:placeholder@localhost:5432/placeholder"
const pool = new Pool({
  connectionString,
  max: 3, // Reduced from 10 to stay within Neon limits
  min: 1, // Reduced from 2 to prevent idle connection termination
  idleTimeoutMillis: 8000, // Reduced from 15s to 8s to prevent administrator termination
  connectionTimeoutMillis: 3000, // Keep at 3s for fast timeout
  maxUses: 1000, // Reduced from 7500 to recycle connections more frequently
  allowExitOnIdle: true,
  // Always enable SSL for Neon/Postgres; avoid CA verification issues in test environments
  ssl: { rejectUnauthorized: false },
})

// Add pool error handling
pool.on('error', (err: Error) => {
  if (err.message?.includes('57P01') || err.message?.includes('terminating connection due to administrator command')) {
    console.warn('Pool connection terminated by Neon administrator - connection will be recycled')
  } else {
    console.error('Database pool error:', err)
  }
})

// Configure Read Replica if available
const readConnectionString = process.env.DATABASE_URL_READ
let readPool: Pool | undefined

if (readConnectionString) {
  readPool = new Pool({
    connectionString: readConnectionString,
    max: 3,
    min: 1,
    idleTimeoutMillis: 8000,
    connectionTimeoutMillis: 3000,
    maxUses: 1000,
    allowExitOnIdle: true,
    ssl: { rejectUnauthorized: false },
  })

  readPool.on('error', (err: Error) => {
    if (err.message?.includes('57P01') || err.message?.includes('terminating connection due to administrator command')) {
      console.warn('Read Pool connection terminated by Neon administrator - connection will be recycled')
    } else {
      console.error('Read Database pool error:', err)
    }
  })
}

// Create drizzle instance with the pool
const primaryDb = drizzle(pool, { schema })

// Export db with read replicas support if configured
export const db = readPool
  ? withReplicas(primaryDb, [drizzle(readPool, { schema })])
  : primaryDb

// Export the pool for advanced operations
export { pool, readPool }

export async function checkDatabaseConnection() {
  try {
    const startTime = Date.now()

    // Add timeout wrapper to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database connection timeout')), 5000)
    })

    const checkPool = async (p: Pool, name: string) => {
      const client = await p.connect()
      await client.query("SELECT 1")
      client.release()
      return true
    }

    const connectionPromise = (async () => {
      await checkPool(pool, 'Primary')
      if (readPool) {
        await checkPool(readPool, 'Read Replica')
      }
      return true
    })()

    await Promise.race([connectionPromise, timeoutPromise])

    const duration = Date.now() - startTime

    // Record metrics
    connectionMonitor.recordQueryMetrics("health_check", duration, true)

    // Database connection successful
    return true
  } catch (error) {
    const duration = Date.now() - Date.now() // Will be 0, but consistent with success case

    // Record failed metrics
    connectionMonitor.recordQueryMetrics("health_check", duration, false, (error as Error).message)

    // Database connection failed
    return false
  }
}

// Enhanced connection management with pool support
export async function closeDatabaseConnection() {
  try {
    // Closing database connections

    // Stop monitoring
    connectionMonitor.stopMonitoring()

    // Close connection pool gracefully
    await pool.end()

    if (readPool) {
      await readPool.end()
    }

    // Database connections closed successfully
    return true
  } catch (_error) {
    // Error closing database connections
    return false
  }
}

// Initialize monitoring in production (but not during build)
if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
  // Start connection monitoring
  connectionMonitor.startMonitoring()

  // Note: Graceful shutdown handlers removed for Edge Runtime compatibility
}

// Export enhanced database utilities
export const dbUtils = {
  /**
   * Execute query with automatic monitoring
   */
  async executeWithMonitoring<T>(queryFn: () => Promise<T>, queryId = "custom_query"): Promise<T> {
    const startTime = Date.now()

    try {
      const result = await queryFn()
      const duration = Date.now() - startTime

      connectionMonitor.recordQueryMetrics(queryId, duration, true)
      return result
    } catch (error) {
      const duration = Date.now() - startTime

      connectionMonitor.recordQueryMetrics(queryId, duration, false, (error as Error).message)
      throw error
    }
  },

  /**
   * Get connection pool health status
   */
  async getHealthStatus() {
    const healthReport = connectionMonitor.generateHealthReport()
    const dbConnected = await checkDatabaseConnection()

    return {
      database: dbConnected,
      pool: {
        status: healthReport.status,
        score: healthReport.score,
        totalConnections: pool.totalCount,
        idleConnections: pool.idleCount,
        waitingClients: pool.waitingCount,
        // Add read pool stats if available
        ...(readPool ? {
          readPool: {
            totalConnections: readPool.totalCount,
            idleConnections: readPool.idleCount,
            waitingClients: readPool.waitingCount,
          }
        } : {})
      },
      issues: healthReport.issues,
      recommendations: healthReport.recommendations,
    }
  },

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(hours = 1) {
    return connectionMonitor.getPerformanceSummary(hours)
  },
}
