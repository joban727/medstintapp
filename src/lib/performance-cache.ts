/**
 * Performance Caching Layer
 * Provides intelligent caching for user data, role checks, and database queries
 * with TTL, invalidation strategies, and memory management
 */

import type { User, UserRole } from "../database/schema"
import { logger } from "./logger"

// Cache entry interface
interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
  accessCount: number
  lastAccessed: number
  tags: string[]
}

// Cache statistics
interface CacheStats {
  hits: number
  misses: number
  sets: number
  deletes: number
  evictions: number
  memoryUsage: number
  hitRate: number
}

// Cache configuration
interface CacheConfig {
  maxSize: number
  defaultTTL: number
  cleanupInterval: number
  maxMemoryUsage: number // in bytes
  enableStats: boolean
  enableCompression: boolean
}

// Cache key patterns
export enum CacheKeyPattern {
  USER_DATA = "user:data:{userId}",
  USER_ROLE = "user:role:{userId}",
  USER_PERMISSIONS = "user:permissions:{userId}",
  USER_ONBOARDING = "user:onboarding:{userId}",
  SCHOOL_DATA = "school:data:{schoolId}",
  PROGRAM_DATA = "program:data:{programId}",
  SESSION_DATA = "session:data:{sessionId}",
  ROLE_PERMISSIONS = "role:permissions:{role}",
  QUERY_RESULT = "query:result:{hash}",
  API_RESPONSE = "api:response:{endpoint}:{hash}",
}

// Cache tags for invalidation
export enum CacheTag {
  USER = "user",
  ROLE = "role",
  PERMISSION = "permission",
  SCHOOL = "school",
  PROGRAM = "program",
  SESSION = "session",
  ONBOARDING = "onboarding",
  QUERY = "query",
  API = "api",
}

// LRU Cache implementation with advanced features
export class PerformanceCache {
  private cache = new Map<string, CacheEntry<unknown>>()
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    evictions: 0,
    memoryUsage: 0,
    hitRate: 0,
  }
  private config: CacheConfig
  private cleanupTimer?: NodeJS.Timeout

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: config.maxSize || 10000,
      defaultTTL: config.defaultTTL || 5 * 60 * 1000, // 5 minutes
      cleanupInterval: config.cleanupInterval || 60 * 1000, // 1 minute
      maxMemoryUsage: config.maxMemoryUsage || 100 * 1024 * 1024, // 100MB
      enableStats: config.enableStats ?? true,
      enableCompression: config.enableCompression ?? false,
    }

    this.startCleanupTimer()
  }

  /**
   * Get value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)

    if (!entry) {
      this.updateStats("miss")
      return null
    }

    // Check if expired
    if (this.isExpired(entry)) {
      this.cache.delete(key)
      this.updateStats("miss")
      return null
    }

    // Update access information
    entry.accessCount++
    entry.lastAccessed = Date.now()

    this.updateStats("hit")
    return this.deserializeData(entry.data)
  }

  /**
   * Set value in cache
   */
  set<T>(
    key: string,
    value: T,
    options: {
      ttl?: number
      tags?: string[]
    } = {}
  ): void {
    const ttl = options.ttl || this.config.defaultTTL
    const tags = options.tags || []

    // Check memory usage before adding
    if (this.shouldEvict()) {
      this.evictLRU()
    }

    const entry: CacheEntry<T> = {
      data: this.serializeData(value),
      timestamp: Date.now(),
      ttl,
      accessCount: 0,
      lastAccessed: Date.now(),
      tags,
    }

    this.cache.set(key, entry)
    this.updateStats("set")
    this.updateMemoryUsage()
  }

  /**
   * Delete specific key
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key)
    if (deleted) {
      this.updateStats("delete")
      this.updateMemoryUsage()
    }
    return deleted
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear()
    this.resetStats()
  }

  /**
   * Invalidate cache entries by tag
   */
  invalidateByTag(tag: string): number {
    let invalidated = 0

    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags.includes(tag)) {
        this.cache.delete(key)
        invalidated++
      }
    }

    this.updateStats("delete", invalidated)
    this.updateMemoryUsage()

    logger.info({}, `Invalidated ${invalidated} cache entries with tag: ${tag}`)
    return invalidated
  }

  /**
   * Invalidate cache entries by pattern
   */
  invalidateByPattern(pattern: RegExp): number {
    let invalidated = 0

    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key)
        invalidated++
      }
    }

    this.updateStats("delete", invalidated)
    this.updateMemoryUsage()

    logger.info({}, `Invalidated ${invalidated} cache entries matching pattern: ${pattern}`)
    return invalidated
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    this.calculateHitRate()
    return { ...this.stats }
  }

  /**
   * Get cache size information
   */
  getSizeInfo(): {
    entryCount: number
    memoryUsage: number
    maxSize: number
    maxMemoryUsage: number
  } {
    return {
      entryCount: this.cache.size,
      memoryUsage: this.stats.memoryUsage,
      maxSize: this.config.maxSize,
      maxMemoryUsage: this.config.maxMemoryUsage,
    }
  }

  /**
   * Get or set with fallback function
   */
  async getOrSet<T>(
    key: string,
    fallback: () => Promise<T>,
    options: {
      ttl?: number
      tags?: string[]
    } = {}
  ): Promise<T> {
    const cached = this.get<T>(key)

    if (cached !== null) {
      return cached
    }

    try {
      const value = await fallback()
      this.set(key, value, options)
      return value
    } catch (error) {
      logger.error({ key, error: String(error) }, "Cache fallback function failed")
      throw error
    }
  }

  /**
   * Batch get multiple keys
   */
  mget<T>(keys: string[]): Map<string, T | null> {
    const results = new Map<string, T | null>()

    for (const key of keys) {
      results.set(key, this.get<T>(key))
    }

    return results
  }

  /**
   * Batch set multiple key-value pairs
   */
  mset<T>(
    entries: Map<string, T>,
    options: {
      ttl?: number
      tags?: string[]
    } = {}
  ): void {
    for (const [key, value] of entries) {
      this.set(key, value, options)
    }
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key)
    return entry !== undefined && !this.isExpired(entry)
  }

  /**
   * Get all keys matching pattern
   */
  keys(pattern?: RegExp): string[] {
    const keys = Array.from(this.cache.keys())

    if (pattern) {
      return keys.filter((key) => pattern.test(key))
    }

    return keys
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): number {
    let cleaned = 0
    const _now = Date.now()

    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key)
        cleaned++
      }
    }

    if (cleaned > 0) {
      this.updateStats("delete", cleaned)
      this.updateMemoryUsage()
      logger.debug({}, `Cleaned up ${cleaned} expired cache entries`)
    }

    return cleaned
  }

  /**
   * Destroy cache and cleanup resources
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }
    this.clear()
  }

  // Private methods
  private isExpired(entry: CacheEntry<unknown>): boolean {
    return Date.now() - entry.timestamp > entry.ttl
  }

  private shouldEvict(): boolean {
    return (
      this.cache.size >= this.config.maxSize || this.stats.memoryUsage >= this.config.maxMemoryUsage
    )
  }

  private evictLRU(): void {
    let oldestKey: string | null = null
    let oldestTime = Date.now()

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey)
      this.updateStats("eviction")
      logger.debug({}, `Evicted LRU cache entry: ${oldestKey}`)
    }
  }

  private serializeData<T>(data: T): T {
    if (this.config.enableCompression) {
      // In a real implementation, you might use compression here
      return JSON.stringify(data) as unknown as T
    }
    return data
  }

  private deserializeData<T>(data: unknown): T {
    if (this.config.enableCompression && typeof data === "string") {
      return JSON.parse(data)
    }
    return data as T
  }

  private updateStats(operation: "hit" | "miss" | "set" | "delete" | "eviction", count = 1): void {
    if (!this.config.enableStats) return

    switch (operation) {
      case "hit":
        this.stats.hits += count
        break
      case "miss":
        this.stats.misses += count
        break
      case "set":
        this.stats.sets += count
        break
      case "delete":
        this.stats.deletes += count
        break
      case "eviction":
        this.stats.evictions += count
        break
    }
  }

  private calculateHitRate(): void {
    const total = this.stats.hits + this.stats.misses
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0
  }

  private updateMemoryUsage(): void {
    // Rough estimation of memory usage
    let usage = 0
    for (const [key, entry] of this.cache.entries()) {
      usage += key.length * 2 // UTF-16 characters
      usage += this.estimateObjectSize(entry)
    }
    this.stats.memoryUsage = usage
  }

  private estimateObjectSize(obj: unknown): number {
    const jsonString = JSON.stringify(obj)
    return jsonString.length * 2 // UTF-16 characters
  }

  private resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      memoryUsage: 0,
      hitRate: 0,
    }
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup()
    }, this.config.cleanupInterval)

    // Only use unref in Node.js environment to prevent process hanging
    if (typeof process !== "undefined" && process.versions?.node && this.cleanupTimer) {
      ; (this.cleanupTimer as any).unref?.()
    }
  }
}

// Specialized cache managers
export class UserDataCache {
  private cache: PerformanceCache

  constructor(cache: PerformanceCache) {
    this.cache = cache
  }

  async getUserData(userId: string, fallback: () => Promise<User | null>): Promise<User | null> {
    const key = this.formatKey(CacheKeyPattern.USER_DATA, { userId })
    return this.cache.getOrSet(key, fallback, {
      ttl: 10 * 60 * 1000, // 10 minutes
      tags: [CacheTag.USER],
    })
  }

  async getUserRole(
    userId: string,
    fallback: () => Promise<UserRole | null>
  ): Promise<UserRole | null> {
    const key = this.formatKey(CacheKeyPattern.USER_ROLE, { userId })
    return this.cache.getOrSet(key, fallback, {
      ttl: 15 * 60 * 1000, // 15 minutes
      tags: [CacheTag.USER, CacheTag.ROLE],
    })
  }

  async getUserOnboardingStatus(
    userId: string,
    fallback: () => Promise<boolean>
  ): Promise<boolean> {
    const key = this.formatKey(CacheKeyPattern.USER_ONBOARDING, { userId })
    return this.cache.getOrSet(key, fallback, {
      ttl: 5 * 60 * 1000, // 5 minutes
      tags: [CacheTag.USER, CacheTag.ONBOARDING],
    })
  }

  invalidateUser(userId: string): void {
    const escapedId = this.escapeRegExp(userId)
    // eslint-disable-next-line security/detect-non-literal-regexp
    const patterns = [new RegExp(`user:.*:${escapedId}`), new RegExp(`session:.*:${escapedId}`)]

    patterns.forEach((pattern) => {
      this.cache.invalidateByPattern(pattern)
    })
  }

  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  }

  private formatKey(pattern: CacheKeyPattern, params: Record<string, string>): string {
    let key = pattern as string
    for (const [param, value] of Object.entries(params)) {
      key = key.replace(`{${param}}`, value)
    }
    return key
  }
}

export class QueryCache {
  private cache: PerformanceCache

  constructor(cache: PerformanceCache) {
    this.cache = cache
  }

  async cacheQuery<T>(
    query: string,
    params: unknown[],
    fallback: () => Promise<T>,
    ttl = 5 * 60 * 1000 // 5 minutes
  ): Promise<T> {
    const hash = this.hashQuery(query, params)
    const key = this.formatKey(CacheKeyPattern.QUERY_RESULT, { hash })

    return this.cache.getOrSet(key, fallback, {
      ttl,
      tags: [CacheTag.QUERY],
    })
  }

  invalidateQueriesByTable(_tableName: string): void {
    // This would require more sophisticated query analysis
    // For now, invalidate all queries
    this.cache.invalidateByTag(CacheTag.QUERY)
  }

  private hashQuery(query: string, params: unknown[]): string {
    const content = query + JSON.stringify(params)
    // Simple hash function - in production, use a proper hash function
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36)
  }

  private formatKey(pattern: CacheKeyPattern, params: Record<string, string>): string {
    let key = pattern as string
    for (const [param, value] of Object.entries(params)) {
      key = key.replace(`{${param}}`, value)
    }
    return key
  }
}

// Export singleton instances
export const performanceCache = new PerformanceCache({
  maxSize: 10000,
  defaultTTL: 5 * 60 * 1000, // 5 minutes
  maxMemoryUsage: 100 * 1024 * 1024, // 100MB
  enableStats: true,
})

export const userDataCache = new UserDataCache(performanceCache)
export const queryCache = new QueryCache(performanceCache)

// Utility functions
export const invalidateUserCache = (userId: string): void => {
  userDataCache.invalidateUser(userId)
}

export const invalidateRoleCache = (): void => {
  performanceCache.invalidateByTag(CacheTag.ROLE)
}

export const getCacheStats = (): CacheStats => {
  return performanceCache.getStats()
}

export const clearAllCache = (): void => {
  performanceCache.clear()
}
