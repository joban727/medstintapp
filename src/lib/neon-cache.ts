/**
 * Neon Database Cache Service
 * Replaces Redis with PostgreSQL-based caching using the cache_entries table
 */

import { db } from "@/database/connection-pool"
import { cacheEntries } from "@/database/schema"
import { eq, lt, sql } from "drizzle-orm"

// Cache configuration
const CACHE_CONFIG = {
  defaultTTL: 300, // 5 minutes
  longTTL: 3600, // 1 hour
  shortTTL: 120, // 2 minutes (was 1 minute) - optimized for dashboard
  maxRetries: 3,
} as const

// Cache key prefixes for different data types
const CACHE_PREFIXES = {
  ANALYTICS: "analytics",
  REPORTS: "reports",
  DASHBOARD: "dashboard",
  USER_PROGRESS: "user_progress",
  COMPETENCY_DATA: "competency_data",
  NOTIFICATIONS: "notifications",
  SESSION: "session",
} as const

// Neon-based Cache Manager
class NeonCacheManager {
  private static instance: NeonCacheManager

  private constructor() {
    // Start background cleanup job
    this.startCleanupJob()
  }

  public static getInstance(): NeonCacheManager {
    if (!NeonCacheManager.instance) {
      NeonCacheManager.instance = new NeonCacheManager()
    }
    return NeonCacheManager.instance
  }

  private cleanupTimer?: NodeJS.Timeout

  private startCleanupJob() {
    // Run cleanup every 5 minutes
    this.cleanupTimer = setInterval(
      () => {
        this.cleanupExpired().catch(console.error)
      },
      5 * 60 * 1000
    )

    // Allow process to exit
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref()
    }
  }

  private async cleanupExpired(): Promise<void> {
    try {
      await db.delete(cacheEntries).where(lt(cacheEntries.expiresAt, new Date()))
    } catch (error) {
      console.error("Cache cleanup error:", error)
    }
  }

  private generateKey(prefix: string, identifier: string): string {
    return `${prefix}:${identifier}`
  }

  private generateHashKey(data: Record<string, unknown>): string {
    const sortedKeys = Object.keys(data).sort()
    const hashString = sortedKeys.map((key) => `${key}:${data[key]}`).join("|")
    return Buffer.from(hashString).toString("base64")
  }

  // Generic cache operations
  async get<T>(key: string): Promise<T | null> {
    try {
      const result = await db.select().from(cacheEntries).where(eq(cacheEntries.key, key)).limit(1)

      if (result.length === 0) {
        return null
      }

      const entry = result[0]

      // Check if expired
      if (new Date(entry.expiresAt) < new Date()) {
        // Delete expired entry in background
        this.del(key).catch(console.error)
        return null
      }

      return entry.value as T
    } catch (error) {
      console.error("Cache get error:", error)
      return null
    }
  }

  async set(key: string, value: unknown, ttl: number = CACHE_CONFIG.defaultTTL): Promise<boolean> {
    try {
      const expiresAt = new Date(Date.now() + ttl * 1000)
      const now = new Date()

      await db
        .insert(cacheEntries)
        .values({
          key,
          value: value as object,
          expiresAt,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: cacheEntries.key,
          set: {
            value: value as object,
            expiresAt,
            updatedAt: now,
          },
        })

      return true
    } catch (error) {
      console.error("Cache set error:", error)
      return false
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      await db.delete(cacheEntries).where(eq(cacheEntries.key, key))
      return true
    } catch (error) {
      console.error("Cache delete error:", error)
      return false
    }
  }

  async delPattern(pattern: string): Promise<boolean> {
    try {
      // Convert glob pattern to SQL LIKE pattern
      const likePattern = pattern.replace(/\*/g, "%")
      await db.delete(cacheEntries).where(sql`${cacheEntries.key} LIKE ${likePattern}`)
      return true
    } catch (error) {
      console.error("Cache delete pattern error:", error)
      return false
    }
  }

  // Analytics caching
  async getAnalytics<T = unknown>(params: {
    userId?: string
    schoolId?: string
    competencyId?: string
    analyticsType: string
    startDate?: string
    endDate?: string
  }): Promise<T | null> {
    const keyHash = this.generateHashKey(params)
    const key = this.generateKey(CACHE_PREFIXES.ANALYTICS, keyHash)
    return this.get(key)
  }

  async setAnalytics(
    params: {
      userId?: string
      schoolId?: string
      competencyId?: string
      analyticsType: string
      startDate?: string
      endDate?: string
    },
    data: unknown
  ): Promise<boolean> {
    const keyHash = this.generateHashKey(params)
    const key = this.generateKey(CACHE_PREFIXES.ANALYTICS, keyHash)
    return this.set(key, data, CACHE_CONFIG.defaultTTL)
  }

  // Report caching
  async getReport<T = unknown>(params: {
    reportType: string
    userId?: string
    schoolId?: string
    programId?: string
    filters?: Record<string, unknown>
  }): Promise<T | null> {
    const keyHash = this.generateHashKey(params)
    const key = this.generateKey(CACHE_PREFIXES.REPORTS, keyHash)
    return this.get(key)
  }

  async setReport(
    params: {
      reportType: string
      userId?: string
      schoolId?: string
      programId?: string
      filters?: Record<string, unknown>
    },
    data: unknown
  ): Promise<boolean> {
    const keyHash = this.generateHashKey(params)
    const key = this.generateKey(CACHE_PREFIXES.REPORTS, keyHash)
    return this.set(key, data, CACHE_CONFIG.longTTL)
  }

  async invalidateReports(_schoolId?: string, _programId?: string): Promise<void> {
    await this.delPattern(`${CACHE_PREFIXES.REPORTS}:*`)
  }

  // Dashboard caching
  async getDashboardData<T = unknown>(userId: string, type: string): Promise<T | null> {
    const key = this.generateKey(CACHE_PREFIXES.DASHBOARD, `${userId}:${type}`)
    return this.get(key)
  }

  async setDashboardData(userId: string, type: string, data: unknown): Promise<boolean> {
    const key = this.generateKey(CACHE_PREFIXES.DASHBOARD, `${userId}:${type}`)
    return this.set(key, data, CACHE_CONFIG.shortTTL)
  }

  async invalidateDashboard(userId: string): Promise<void> {
    await this.delPattern(`${CACHE_PREFIXES.DASHBOARD}:${userId}:%`)
  }

  // User progress caching
  async getUserProgress<T = unknown>(userId: string, competencyId?: string): Promise<T | null> {
    const identifier = competencyId ? `${userId}:${competencyId}` : userId
    const key = this.generateKey(CACHE_PREFIXES.USER_PROGRESS, identifier)
    return this.get(key)
  }

  async setUserProgress(userId: string, data: unknown, competencyId?: string): Promise<boolean> {
    const identifier = competencyId ? `${userId}:${competencyId}` : userId
    const key = this.generateKey(CACHE_PREFIXES.USER_PROGRESS, identifier)
    return this.set(key, data, CACHE_CONFIG.defaultTTL)
  }

  async invalidateUserProgress(userId: string, competencyId?: string): Promise<void> {
    if (competencyId) {
      const key = this.generateKey(CACHE_PREFIXES.USER_PROGRESS, `${userId}:${competencyId}`)
      await this.del(key)
    } else {
      await this.delPattern(`${CACHE_PREFIXES.USER_PROGRESS}:${userId}:%`)
    }
  }

  // Competency data caching
  async getCompetencyData<T = unknown>(competencyId: string, schoolId?: string): Promise<T | null> {
    const identifier = schoolId ? `${competencyId}:${schoolId}` : competencyId
    const key = this.generateKey(CACHE_PREFIXES.COMPETENCY_DATA, identifier)
    return this.get(key)
  }

  async setCompetencyData(
    competencyId: string,
    data: unknown,
    schoolId?: string
  ): Promise<boolean> {
    const identifier = schoolId ? `${competencyId}:${schoolId}` : competencyId
    const key = this.generateKey(CACHE_PREFIXES.COMPETENCY_DATA, identifier)
    return this.set(key, data, CACHE_CONFIG.longTTL)
  }

  async invalidateCompetencyData(competencyId: string, schoolId?: string): Promise<void> {
    if (schoolId) {
      const key = this.generateKey(CACHE_PREFIXES.COMPETENCY_DATA, `${competencyId}:${schoolId}`)
      await this.del(key)
    } else {
      await this.delPattern(`${CACHE_PREFIXES.COMPETENCY_DATA}:${competencyId}:%`)
    }
  }

  async invalidateAnalytics(
    userId?: string,
    schoolId?: string,
    competencyId?: string
  ): Promise<void> {
    // For simplicity, invalidate all analytics when any related entity changes
    await this.delPattern(`${CACHE_PREFIXES.ANALYTICS}:%`)
  }

  // Notification caching
  async getUserNotifications<T = unknown>(userId: string): Promise<T | null> {
    const key = this.generateKey(CACHE_PREFIXES.NOTIFICATIONS, userId)
    return this.get(key)
  }

  async setUserNotifications(userId: string, data: unknown): Promise<boolean> {
    const key = this.generateKey(CACHE_PREFIXES.NOTIFICATIONS, userId)
    return this.set(key, data, CACHE_CONFIG.shortTTL)
  }

  async invalidateUserNotifications(userId: string): Promise<void> {
    const key = this.generateKey(CACHE_PREFIXES.NOTIFICATIONS, userId)
    await this.del(key)
  }

  // Health check - always healthy since we're using the database
  async isHealthy(): Promise<boolean> {
    try {
      await db.execute(sql`SELECT 1`)
      return true
    } catch (error) {
      console.error("Cache health check failed:", error)
      return false
    }
  }

  // Session activity tracking (simplified for database)
  async markSessionActive(sessionId: string, userId?: string, expiresAtMs?: number): Promise<void> {
    if (!sessionId) return

    try {
      const now = Date.now()
      const expirationMs = expiresAtMs && expiresAtMs > now ? expiresAtMs : now + 8 * 60 * 60 * 1000
      const key = this.generateKey(CACHE_PREFIXES.SESSION, `active:${sessionId}`)

      await this.set(
        key,
        { sessionId, userId, expiresAt: expirationMs, lastSeen: now },
        Math.ceil((expirationMs - now) / 1000)
      )
    } catch (error) {
      console.error("Failed to mark session active:", error)
    }
  }

  async getActiveSessionCount(): Promise<number> {
    try {
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(cacheEntries)
        .where(
          sql`${cacheEntries.key} LIKE ${`${CACHE_PREFIXES.SESSION}:active:%`} AND ${cacheEntries.expiresAt} > NOW()`
        )

      return Number(result[0]?.count) || 0
    } catch (error) {
      console.error("Failed to get active session count:", error)
      return 0
    }
  }

  // Graceful shutdown
  async disconnect(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = undefined
    }
  }
}

// Export singleton instance
export const cache = NeonCacheManager.getInstance()

// Cache wrapper function for easy integration
export async function withCache<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number = CACHE_CONFIG.defaultTTL
): Promise<T> {
  // Try to get from cache first
  const cached = await cache.get<T>(key)
  if (cached !== null) {
    return cached
  }

  // Fetch fresh data
  const data = await fetchFn()

  // Cache the result
  await cache.set(key, data, ttl)

  return data
}

// Cache invalidation helper
export async function invalidateRelatedCaches({
  userId,
  schoolId,
  competencyId,
  programId,
}: {
  userId?: string
  schoolId?: string
  competencyId?: string
  programId?: string
}) {
  const promises = []

  if (userId) {
    promises.push(
      cache.invalidateUserProgress(userId),
      cache.invalidateDashboard(userId),
      cache.invalidateUserNotifications(userId)
    )
  }

  if (schoolId || competencyId) {
    promises.push(cache.invalidateAnalytics(userId, schoolId, competencyId))
  }

  if (schoolId || programId) {
    promises.push(cache.invalidateReports(schoolId, programId))
  }

  if (competencyId) {
    promises.push(cache.invalidateCompetencyData(competencyId, schoolId))
  }

  await Promise.all(promises)
}

export { CACHE_CONFIG, CACHE_PREFIXES }
