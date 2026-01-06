import { logger } from "@/lib/logger"

// API Response Caching Utility
// Implements in-memory caching with TTL for better performance

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number // Time to live in milliseconds
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>()
  private cleanupInterval: NodeJS.Timeout

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(
      () => {
        this.cleanup()
      },
      5 * 60 * 1000
    )

    // Only use unref in Node.js environment to prevent process hanging
    if (typeof process !== "undefined" && process.versions?.node) {
      ;(this.cleanupInterval as any).unref?.()
    }
  }

  set<T>(key: string, data: T, ttlMs: number = 5 * 60 * 1000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
    })
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    const now = Date.now()
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false

    const now = Date.now()
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return false
    }

    return true
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key)
      }
    }
  }

  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval)
    this.clear()
  }
}

// Global cache instance
export const apiCache = new MemoryCache()

// Cache key generators for consistent naming
export const cacheKeys = {
  user: (userId: string) => `user:${userId}`,
  userRotations: (userId: string) => `user:${userId}:rotations`,
  userTimeRecords: (userId: string, date?: string) =>
    `user:${userId}:time-records${date ? `:${date}` : ""}`,
  rotationDetails: (rotationId: string) => `rotation:${rotationId}`,
  clinicalSites: () => "clinical-sites:all",
  schoolUsers: (schoolId: string) => `school:${schoolId}:users`,
  competencies: (programId?: string) => `competencies${programId ? `:${programId}` : ":all"}`,
  evaluations: (studentId: string, rotationId?: string) =>
    `evaluations:${studentId}${rotationId ? `:${rotationId}` : ""}`,
  assessments: (studentId: string) => `assessments:${studentId}`,
  auditLogs: (page = 1) => `audit-logs:page:${page}`,
  dashboardStats: (userId: string, role: string) => `dashboard:${role}:${userId}:stats`,
}

// Cache TTL constants (in milliseconds)
export const cacheTTL = {
  short: 1 * 60 * 1000, // 1 minute
  medium: 5 * 60 * 1000, // 5 minutes
  long: 15 * 60 * 1000, // 15 minutes
  hour: 60 * 60 * 1000, // 1 hour
  day: 24 * 60 * 60 * 1000, // 24 hours
}

// Cache invalidation helpers
export const invalidateCache = {
  user: (userId: string) => {
    apiCache.delete(cacheKeys.user(userId))
    apiCache.delete(cacheKeys.userRotations(userId))
    apiCache.delete(cacheKeys.userTimeRecords(userId))
  },

  rotation: (rotationId: string, studentId?: string) => {
    apiCache.delete(cacheKeys.rotationDetails(rotationId))
    if (studentId) {
      apiCache.delete(cacheKeys.userRotations(studentId))
    }
  },

  timeRecord: (studentId: string, date?: string) => {
    apiCache.delete(cacheKeys.userTimeRecords(studentId, date))
    apiCache.delete(cacheKeys.userTimeRecords(studentId)) // Clear general cache too
  },

  school: (schoolId: string) => {
    apiCache.delete(cacheKeys.schoolUsers(schoolId))
  },

  evaluation: (studentId: string, rotationId?: string) => {
    apiCache.delete(cacheKeys.evaluations(studentId, rotationId))
    apiCache.delete(cacheKeys.evaluations(studentId)) // Clear general cache too
  },

  assessment: (studentId: string) => {
    apiCache.delete(cacheKeys.assessments(studentId))
  },

  dashboard: (userId: string, role: string) => {
    apiCache.delete(cacheKeys.dashboardStats(userId, role))
  },

  all: () => {
    apiCache.clear()
  },
}

// Cached API wrapper function
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = cacheTTL.medium
): Promise<T> {
  // Try to get from cache first
  const cached = apiCache.get<T>(key)
  if (cached !== null) {
    return cached
  }

  // Fetch fresh data
  const data = await fetcher()

  // Store in cache
  apiCache.set(key, data, ttl)

  return data
}

// Cache warming functions for critical data
export const warmCache = {
  async userDashboard(userId: string, role: string) {
    try {
      // Pre-load common dashboard data
      const key = cacheKeys.dashboardStats(userId, role)
      if (!apiCache.has(key)) {
        // This would be implemented based on specific dashboard needs
        if (process.env.NODE_ENV === "development" && process.env.DEBUG_CACHE === "true") {
          // Cache warming for user dashboard
        }
      }
    } catch (error) {
      logger.error({ error: error as any }, "Cache warming failed for user dashboard")
    }
  },

  async clinicalSites() {
    try {
      const key = cacheKeys.clinicalSites()
      if (!apiCache.has(key)) {
        if (process.env.NODE_ENV === "development" && process.env.DEBUG_CACHE === "true") {
          // Cache warming for clinical sites
        }
      }
    } catch (error) {
      logger.error({ error: error as any }, "Cache warming failed for clinical sites")
    }
  },
}

// Cache monitoring for development
if (process.env.NODE_ENV === "development" && process.env.DEBUG_CACHE === "true") {
  setInterval(() => {
    const _stats = apiCache.getStats()
    // Cache stats available for debugging when DEBUG_CACHE=true
    // Cache stats available for debugging if needed
  }, 60000) // Log every minute
}

// Cleanup on process exit
process.on("SIGTERM", () => {
  apiCache.destroy()
})

process.on("SIGINT", () => {
  apiCache.destroy()
})
