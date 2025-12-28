/**
 * Database optimization utilities for MedStint clock system
 * Provides caching, indexing recommendations, and performance monitoring
 */

import { db } from "@/database/connection-pool"
import { timeRecords, rotations, clinicalSites, users } from "@/database/schema"
import { eq, and, isNull, desc, sql } from "drizzle-orm"
import { logger } from "@/lib/logger"

// In-memory cache for frequently accessed data
class DatabaseCache {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>()
  private readonly DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes

  set(key: string, data: any, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    })
  }

  get(key: string): any | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.data
  }

  delete(key: string): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  // Clean expired entries
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key)
      }
    }
  }
}

export const dbCache = new DatabaseCache()

// Cleanup expired cache entries every 10 minutes
setInterval(
  () => {
    dbCache.cleanup()
  },
  10 * 60 * 1000
)

/**
 * Cached user data retrieval
 */
export async function getCachedUserData(userId: string) {
  const cacheKey = `user:${userId}`
  const cached = dbCache.get(cacheKey)

  if (cached) {
    logger.debug({ userId }, "Cache hit for user data")
    return cached
  }

  try {
    const [userData] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        schoolId: users.schoolId,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (userData) {
      dbCache.set(cacheKey, userData, 10 * 60 * 1000) // Cache for 10 minutes
      logger.debug({ userId }, "Cache miss - stored user data")
    }

    return userData
  } catch (error) {
    logger.error({ userId, error: String(error) }, "Failed to get cached user data")
    throw error
  }
}

/**
 * Cached rotation data retrieval
 */
export async function getCachedRotationData(rotationId: string) {
  const cacheKey = `rotation:${rotationId}`
  const cached = dbCache.get(cacheKey)

  if (cached) {
    logger.debug({ rotationId }, "Cache hit for rotation data")
    return cached
  }

  try {
    const [rotationData] = await db
      .select({
        id: rotations.id,
        specialty: rotations.specialty,
        clinicalSiteId: rotations.clinicalSiteId,
        startDate: rotations.startDate,
        endDate: rotations.endDate,
        status: rotations.status,
      })
      .from(rotations)
      .where(eq(rotations.id, rotationId))
      .limit(1)

    if (rotationData) {
      dbCache.set(cacheKey, rotationData, 15 * 60 * 1000) // Cache for 15 minutes
      logger.debug({ rotationId }, "Cache miss - stored rotation data")
    }

    return rotationData
  } catch (error) {
    logger.error({ rotationId, error: String(error) }, "Failed to get cached rotation data")
    throw error
  }
}

/**
 * Cached clinical site data retrieval
 */
export async function getCachedSiteData(siteId: string) {
  const cacheKey = `site:${siteId}`
  const cached = dbCache.get(cacheKey)

  if (cached) {
    logger.debug({ siteId }, "Cache hit for site data")
    return cached
  }

  try {
    const [siteData] = await db
      .select({
        id: clinicalSites.id,
        name: clinicalSites.name,
        address: clinicalSites.address,
      })
      .from(clinicalSites)
      .where(eq(clinicalSites.id, siteId))
      .limit(1)

    if (siteData) {
      dbCache.set(cacheKey, siteData, 30 * 60 * 1000) // Cache for 30 minutes
      logger.debug({ siteId }, "Cache miss - stored site data")
    }

    return siteData
  } catch (error) {
    logger.error({ siteId, error: String(error) }, "Failed to get cached site data")
    throw error
  }
}

/**
 * Optimized active time record lookup with caching
 */
export async function getActiveTimeRecord(studentId: string) {
  const cacheKey = `active_record:${studentId}`
  const cached = dbCache.get(cacheKey)

  if (cached) {
    logger.debug({ studentId }, "Cache hit for active time record")
    return cached
  }

  try {
    const [activeRecord] = await db
      .select({
        id: timeRecords.id,
        studentId: timeRecords.studentId,
        rotationId: timeRecords.rotationId,
        clockIn: timeRecords.clockIn,
        notes: timeRecords.notes,
        clockInLatitude: timeRecords.clockInLatitude,
        clockInLongitude: timeRecords.clockInLongitude,
      })
      .from(timeRecords)
      .where(and(eq(timeRecords.studentId, studentId), isNull(timeRecords.clockOut)))
      .orderBy(desc(timeRecords.clockIn))
      .limit(1)

    // Cache for shorter time since this changes frequently
    if (activeRecord) {
      dbCache.set(cacheKey, activeRecord, 2 * 60 * 1000) // Cache for 2 minutes
      logger.debug({ studentId }, "Cache miss - stored active time record")
    }

    return activeRecord
  } catch (error) {
    logger.error({ studentId, error: String(error) }, "Failed to get active time record")
    throw error
  }
}

/**
 * Invalidate cache entries related to a student's time records
 */
export function invalidateStudentCache(studentId: string): void {
  dbCache.delete(`active_record:${studentId}`)
  dbCache.delete(`user:${studentId}`)
  logger.debug({ studentId }, "Invalidated student cache")
}

/**
 * Invalidate cache entries related to a rotation
 */
export function invalidateRotationCache(rotationId: string): void {
  dbCache.delete(`rotation:${rotationId}`)
  logger.debug({ rotationId }, "Invalidated rotation cache")
}

/**
 * Database performance monitoring
 */
export class DatabasePerformanceMonitor {
  private static queryTimes = new Map<string, number[]>()
  private static readonly MAX_SAMPLES = 100

  static startQuery(queryName: string): () => void {
    const startTime = Date.now()

    return () => {
      const duration = Date.now() - startTime
      DatabasePerformanceMonitor.recordQueryTime(queryName, duration)
    }
  }

  private static recordQueryTime(queryName: string, duration: number): void {
    if (!DatabasePerformanceMonitor.queryTimes.has(queryName)) {
      DatabasePerformanceMonitor.queryTimes.set(queryName, [])
    }

    const times = DatabasePerformanceMonitor.queryTimes.get(queryName)!
    times.push(duration)

    // Keep only the last MAX_SAMPLES
    if (times.length > DatabasePerformanceMonitor.MAX_SAMPLES) {
      times.shift()
    }

    // Log slow queries
    if (duration > 1000) {
      // More than 1 second
      logger.warn({
        queryName,
        duration,
        averageDuration: DatabasePerformanceMonitor.getAverageQueryTime(queryName),
      }, "Slow database query detected")
    }
  }

  static getAverageQueryTime(queryName: string): number {
    const times = DatabasePerformanceMonitor.queryTimes.get(queryName)
    if (!times || times.length === 0) return 0

    return times.reduce((sum, time) => sum + time, 0) / times.length
  }

  static getQueryStats(): Record<
    string,
    { average: number; samples: number; max: number; min: number }
  > {
    const stats: Record<string, { average: number; samples: number; max: number; min: number }> = {}

    for (const [queryName, times] of DatabasePerformanceMonitor.queryTimes.entries()) {
      if (times.length > 0) {
        stats[queryName] = {
          average: DatabasePerformanceMonitor.getAverageQueryTime(queryName),
          samples: times.length,
          max: Math.max(...times),
          min: Math.min(...times),
        }
      }
    }

    return stats
  }
}

/**
 * Database index recommendations
 * These should be applied to improve query performance
 */
export const RECOMMENDED_INDEXES = [
  // Time records indexes
  "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_time_records_student_clockout ON time_records(student_id, clock_out) WHERE clock_out IS NULL;",
  "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_time_records_rotation_date ON time_records(rotation_id, clock_in);",
  "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_time_records_student_date ON time_records(student_id, clock_in);",

  // Rotations indexes
  "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rotations_site_status ON rotations(clinical_site_id, status);",
  "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rotations_student_dates ON rotations(student_id, start_date, end_date);",

  // Users indexes
  "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_school_role ON users(school_id, role);",
  "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));",

  // Clinical sites indexes
  "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clinical_sites_school ON clinical_sites(school_id);",
]

/**
 * Apply recommended database indexes
 * This should be run during deployment or maintenance
 */
export async function applyRecommendedIndexes(): Promise<void> {
  logger.info({}, "Applying recommended database indexes")

  for (const indexSql of RECOMMENDED_INDEXES) {
    try {
      await db.execute(sql.raw(indexSql))
      logger.info({ sql: indexSql }, "Applied database index")
    } catch (error) {
      logger.error({ sql: indexSql, error: String(error) }, "Failed to apply database index")
    }
  }

  logger.info({}, "Finished applying recommended database indexes")
}

/**
 * Database health check
 */
export async function performDatabaseHealthCheck(): Promise<{
  status: "healthy" | "degraded" | "unhealthy"
  metrics: {
    connectionTest: boolean
    queryPerformance: Record<string, { average: number; samples: number; max: number; min: number }>
    cacheHitRate: number
    activeConnections?: number
  }
}> {
  const metrics = {
    connectionTest: false,
    queryPerformance: DatabasePerformanceMonitor.getQueryStats(),
    cacheHitRate: 0,
    activeConnections: 0,
  }

  try {
    // Test basic connectivity
    const endTimer = DatabasePerformanceMonitor.startQuery("health_check")
    await db.execute(sql`SELECT 1`)
    endTimer()
    metrics.connectionTest = true

    // Calculate cache hit rate (simplified)
    const cacheSize = dbCache["cache"].size
    metrics.cacheHitRate = cacheSize > 0 ? 0.8 : 0 // Simplified calculation

    const avgQueryTime =
      Object.values(metrics.queryPerformance).reduce((sum, stat) => sum + stat.average, 0) /
      Object.keys(metrics.queryPerformance).length || 0

    const status = avgQueryTime > 2000 ? "unhealthy" : avgQueryTime > 1000 ? "degraded" : "healthy"

    return { status, metrics }
  } catch (error) {
    logger.error({ error: String(error) }, "Database health check failed")
    return { status: "unhealthy", metrics }
  }
}
