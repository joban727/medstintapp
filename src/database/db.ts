import { neonConfig, Pool } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-serverless"
import { connectionMonitor } from "../lib/connection-monitor"
import * as schema from "./schema"

// Handle build-time scenario where DATABASE_URL might not be available
if (!process.env.DATABASE_URL && process.env.NODE_ENV !== "production") {
  console.warn("DATABASE_URL is not set - using placeholder for build")
}

// Configure Neon for serverless environments
neonConfig.fetchConnectionCache = true
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
const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL || "postgresql://placeholder:placeholder@localhost:5432/placeholder",
  max: 3, // Reduced from 10 to stay within Neon limits
  min: 1, // Reduced from 2 to prevent idle connection termination
  idleTimeoutMillis: 8000, // Reduced from 15s to 8s to prevent administrator termination
  connectionTimeoutMillis: 3000, // Keep at 3s for fast timeout
  maxUses: 1000, // Reduced from 7500 to recycle connections more frequently
  allowExitOnIdle: true,
})

// Add pool error handling
pool.on('error', (err) => {
  if (err.message?.includes('57P01') || err.message?.includes('terminating connection due to administrator command')) {
    console.warn('Pool connection terminated by Neon administrator - connection will be recycled')
  } else {
    console.error('Database pool error:', err)
  }
})

// Create drizzle instance with the pool
export const db = drizzle(pool, { schema })

// Export the pool for advanced operations
export { pool }

export async function checkDatabaseConnection() {
  try {
    const startTime = Date.now()
    
    // Add timeout wrapper to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database connection timeout')), 5000)
    })
    
    const connectionPromise = (async () => {
      const client = await pool.connect()
      await client.query("SELECT 1")
      client.release()
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

    // Database connections closed successfully
  } catch (_error) {
    // Error closing database connections
  }
}

// Initialize monitoring in production
if (process.env.NODE_ENV === "production") {
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

    return {
      database: await checkDatabaseConnection(),
      pool: {
        status: healthReport.status,
        score: healthReport.score,
        totalConnections: pool.totalCount,
        idleConnections: pool.idleCount,
        waitingClients: pool.waitingCount,
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
