import { Redis } from "ioredis"

// Cache configuration
const CACHE_CONFIG = {
  defaultTTL: 300, // 5 minutes
  longTTL: 3600, // 1 hour
  shortTTL: 60, // 1 minute
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

// Redis client singleton
class CacheManager {
  private static instance: CacheManager
  private redis: Redis | null = null
  private isConnected = false

  private constructor() {
    this.initializeRedis()
  }

  public static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager()
    }
    return CacheManager.instance
  }

  private initializeRedis() {
    try {
      // Use Redis URL from environment or fallback to local Redis
      const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL

      if (redisUrl) {
        this.redis = new Redis(redisUrl, {
          maxRetriesPerRequest: CACHE_CONFIG.maxRetries,
          enableReadyCheck: true,
          lazyConnect: true,
        })
      } else {
        // Local Redis configuration
        this.redis = new Redis({
          host: process.env.REDIS_HOST || "localhost",
          port: Number.parseInt(process.env.REDIS_PORT || "6379"),
          password: process.env.REDIS_PASSWORD,
          maxRetriesPerRequest: CACHE_CONFIG.maxRetries,
          enableReadyCheck: true,
          lazyConnect: true,
        })
      }

      this.redis.on("connect", () => {
        this.isConnected = true
        console.log("Redis connected successfully")
      })

      this.redis.on("error", (error) => {
        this.isConnected = false
        console.error("Redis connection error:", error)
      })

      this.redis.on("close", () => {
        this.isConnected = false
        console.log("Redis connection closed")
      })
    } catch (error) {
      console.error("Failed to initialize Redis:", error)
      this.redis = null
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
    if (!this.redis || !this.isConnected) {
      return null
    }

    try {
      const cached = await this.redis.get(key)
      if (cached) {
        return JSON.parse(cached) as T
      }
      return null
    } catch (error) {
      console.error("Cache get error:", error)
      return null
    }
  }

  async set(key: string, value: unknown, ttl: number = CACHE_CONFIG.defaultTTL): Promise<boolean> {
    if (!this.redis || !this.isConnected) {
      return false
    }

    try {
      const serialized = JSON.stringify(value)
      await this.redis.setex(key, ttl, serialized)
      return true
    } catch (error) {
      console.error("Cache set error:", error)
      return false
    }
  }

  async del(key: string): Promise<boolean> {
    if (!this.redis || !this.isConnected) {
      return false
    }

    try {
      await this.redis.del(key)
      return true
    } catch (error) {
      console.error("Cache delete error:", error)
      return false
    }
  }

  async delPattern(pattern: string): Promise<boolean> {
    if (!this.redis || !this.isConnected) {
      return false
    }

    try {
      const keys = await this.redis.keys(pattern)
      if (keys.length > 0) {
        await this.redis.del(...keys)
      }
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
    const patterns = [`${CACHE_PREFIXES.REPORTS}:*`]

    for (const pattern of patterns) {
      await this.delPattern(pattern)
    }
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
    await this.delPattern(`${CACHE_PREFIXES.DASHBOARD}:${userId}:*`)
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
      await this.delPattern(`${CACHE_PREFIXES.USER_PROGRESS}:${userId}:*`)
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
      await this.delPattern(`${CACHE_PREFIXES.COMPETENCY_DATA}:${competencyId}:*`)
    }
  }

  async invalidateAnalytics(
    userId?: string,
    schoolId?: string,
    competencyId?: string
  ): Promise<void> {
    const patterns = [`${CACHE_PREFIXES.ANALYTICS}:*`]

    if (userId) {
      patterns.push(`${CACHE_PREFIXES.ANALYTICS}:*:${userId}:*`)
    }
    if (schoolId) {
      patterns.push(`${CACHE_PREFIXES.ANALYTICS}:*:*:${schoolId}:*`)
    }
    if (competencyId) {
      patterns.push(`${CACHE_PREFIXES.ANALYTICS}:*:*:*:${competencyId}:*`)
    }

    for (const pattern of patterns) {
      await this.delPattern(pattern)
    }
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

  // Health check
  async isHealthy(): Promise<boolean> {
    if (!this.redis || !this.isConnected) {
      return false
    }

    try {
      const result = await this.redis.ping()
      return result === "PONG"
    } catch (error) {
      console.error("Cache health check failed:", error)
      return false
    }
  }

  // Graceful shutdown
  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit()
      this.redis = null
      this.isConnected = false
    }
  }
}

// Export singleton instance
export const cache = CacheManager.getInstance()

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
