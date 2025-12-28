/**
 * Cache Integration Service
 * Provides caching functionality for API routes and database operations
 */

interface CacheOptions {
  ttl?: number // Time to live in seconds
  tags?: string[]
}

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
  tags: string[]
}

class CacheIntegrationService {
  private cache = new Map<string, CacheEntry<any>>()
  private defaultTTL = 300 // 5 minutes

  /**
   * Get cached data by key
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key)

    if (!entry) {
      return null
    }

    // Check if entry has expired
    const now = Date.now()
    if (now - entry.timestamp > entry.ttl * 1000) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  /**
   * Set cached data with key
   */
  async set<T>(key: string, data: T, options: CacheOptions = {}): Promise<void> {
    const ttl = options.ttl || this.defaultTTL
    const tags = options.tags || []

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      tags,
    }

    this.cache.set(key, entry)
  }

  /**
   * Delete cached data by key
   */
  async delete(key: string): Promise<void> {
    this.cache.delete(key)
  }

  /**
   * Clear all cached data
   */
  async clear(): Promise<void> {
    this.cache.clear()
  }

  /**
   * Invalidate cache entries by tags
   */
  async invalidateByTags(tags: string[]): Promise<void> {
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags.some((tag) => tags.includes(tag))) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    }
  }

  /**
   * Wrap a function with caching
   */
  async cached<T>(key: string, fn: () => Promise<T>, options: CacheOptions = {}): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key)
    if (cached !== null) {
      return cached
    }

    // Execute function and cache result
    const result = await fn()
    await this.set(key, result, options)
    return result
  }

  /**
   * Cache API responses with NextResponse handling
   */
  async cachedApiResponse<T>(key: string, fn: () => Promise<T>, ttl = 300): Promise<T> {
    return this.cached(key, fn, { ttl })
  }
}

// Export singleton instance
export const cacheIntegrationService = new CacheIntegrationService()

// Export types
export type { CacheOptions }
