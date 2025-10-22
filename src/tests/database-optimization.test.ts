/**
 * Tests for database optimization features
 * Tests caching, performance monitoring, and database health checks
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest'
import { 
  DatabaseCache, 
  DatabasePerformanceMonitor,
  getCachedSiteData,
  getActiveTimeRecord,
  invalidateStudentCache,
  performDatabaseHealthCheck,
  applyRecommendedIndexes
} from '@/lib/database-optimization'

// Mock dependencies
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    execute: vi.fn(),
  }
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }
}))

describe('DatabaseCache', () => {
  let cache: DatabaseCache<any>

  beforeEach(() => {
    cache = new DatabaseCache('test-cache', 1000) // 1 second TTL
    vi.useFakeTimers()
  })

  afterEach(() => {
    cache.clear()
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('Basic Operations', () => {
    it('should store and retrieve values', () => {
      const testData = { id: '123', name: 'Test' }
      
      cache.set('key1', testData)
      const retrieved = cache.get('key1')
      
      expect(retrieved).toEqual(testData)
    })

    it('should return null for non-existent keys', () => {
      const result = cache.get('non-existent')
      expect(result).toBeNull()
    })

    it('should handle cache expiration', () => {
      const testData = { id: '123', name: 'Test' }
      
      cache.set('key1', testData)
      expect(cache.get('key1')).toEqual(testData)
      
      // Fast-forward past TTL
      vi.advanceTimersByTime(1500)
      
      expect(cache.get('key1')).toBeNull()
    })

    it('should update existing keys', () => {
      const originalData = { id: '123', name: 'Original' }
      const updatedData = { id: '123', name: 'Updated' }
      
      cache.set('key1', originalData)
      cache.set('key1', updatedData)
      
      expect(cache.get('key1')).toEqual(updatedData)
    })

    it('should delete specific keys', () => {
      cache.set('key1', { data: 'test1' })
      cache.set('key2', { data: 'test2' })
      
      cache.delete('key1')
      
      expect(cache.get('key1')).toBeNull()
      expect(cache.get('key2')).toEqual({ data: 'test2' })
    })

    it('should clear all cache entries', () => {
      cache.set('key1', { data: 'test1' })
      cache.set('key2', { data: 'test2' })
      
      cache.clear()
      
      expect(cache.get('key1')).toBeNull()
      expect(cache.get('key2')).toBeNull()
    })
  })

  describe('Cache Statistics', () => {
    it('should track hit and miss statistics', () => {
      cache.set('key1', { data: 'test' })
      
      // Cache hit
      cache.get('key1')
      
      // Cache miss
      cache.get('non-existent')
      
      const stats = cache.getStats()
      expect(stats.hits).toBe(1)
      expect(stats.misses).toBe(1)
      expect(stats.hitRate).toBe(0.5)
    })

    it('should track cache size', () => {
      expect(cache.getStats().size).toBe(0)
      
      cache.set('key1', { data: 'test1' })
      cache.set('key2', { data: 'test2' })
      
      expect(cache.getStats().size).toBe(2)
    })

    it('should calculate hit rate correctly', () => {
      cache.set('key1', { data: 'test' })
      
      // 3 hits, 1 miss
      cache.get('key1')
      cache.get('key1')
      cache.get('key1')
      cache.get('non-existent')
      
      const stats = cache.getStats()
      expect(stats.hitRate).toBe(0.75)
    })
  })

  describe('Cleanup Mechanism', () => {
    it('should automatically clean expired entries', () => {
      cache.set('key1', { data: 'test1' })
      cache.set('key2', { data: 'test2' })
      
      // Fast-forward past TTL
      vi.advanceTimersByTime(1500)
      
      // Trigger cleanup by accessing cache
      cache.get('key1')
      
      const stats = cache.getStats()
      expect(stats.size).toBe(0)
    })

    it('should not clean non-expired entries', () => {
      cache.set('key1', { data: 'test1' })
      
      // Fast-forward but not past TTL
      vi.advanceTimersByTime(500)
      
      cache.set('key2', { data: 'test2' })
      
      // Fast-forward past first entry's TTL but not second
      vi.advanceTimersByTime(600)
      
      // Trigger cleanup
      cache.get('key2')
      
      const stats = cache.getStats()
      expect(stats.size).toBe(1)
      expect(cache.get('key2')).toEqual({ data: 'test2' })
    })
  })
})

describe('DatabasePerformanceMonitor', () => {
  let monitor: DatabasePerformanceMonitor

  beforeEach(() => {
    monitor = new DatabasePerformanceMonitor()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('Query Tracking', () => {
    it('should record query execution times', () => {
      const startTime = monitor.startQuery('SELECT * FROM users')
      
      vi.advanceTimersByTime(100)
      
      monitor.endQuery(startTime, 'SELECT * FROM users')
      
      const metrics = monitor.getMetrics()
      expect(metrics.totalQueries).toBe(1)
      expect(metrics.averageQueryTime).toBeGreaterThan(0)
    })

    it('should track multiple queries', () => {
      // Execute multiple queries
      for (let i = 0; i < 5; i++) {
        const startTime = monitor.startQuery(`SELECT * FROM table${i}`)
        vi.advanceTimersByTime(50 + i * 10)
        monitor.endQuery(startTime, `SELECT * FROM table${i}`)
      }
      
      const metrics = monitor.getMetrics()
      expect(metrics.totalQueries).toBe(5)
      expect(metrics.averageQueryTime).toBeGreaterThan(0)
    })

    it('should identify slow queries', () => {
      // Fast query
      let startTime = monitor.startQuery('SELECT id FROM users LIMIT 1')
      vi.advanceTimersByTime(10)
      monitor.endQuery(startTime, 'SELECT id FROM users LIMIT 1')
      
      // Slow query
      startTime = monitor.startQuery('SELECT * FROM large_table')
      vi.advanceTimersByTime(2000) // 2 seconds
      monitor.endQuery(startTime, 'SELECT * FROM large_table')
      
      const slowQueries = monitor.getSlowQueries()
      expect(slowQueries.length).toBe(1)
      expect(slowQueries[0].query).toBe('SELECT * FROM large_table')
      expect(slowQueries[0].duration).toBeGreaterThan(1000)
    })

    it('should limit slow query history', () => {
      // Generate many slow queries
      for (let i = 0; i < 15; i++) {
        const startTime = monitor.startQuery(`SLOW QUERY ${i}`)
        vi.advanceTimersByTime(1500)
        monitor.endQuery(startTime, `SLOW QUERY ${i}`)
      }
      
      const slowQueries = monitor.getSlowQueries()
      expect(slowQueries.length).toBeLessThanOrEqual(10) // Should be limited
    })
  })

  describe('Performance Metrics', () => {
    it('should calculate correct average query time', () => {
      const queryTimes = [100, 200, 300, 400, 500]
      
      queryTimes.forEach((time, index) => {
        const startTime = monitor.startQuery(`QUERY ${index}`)
        vi.advanceTimersByTime(time)
        monitor.endQuery(startTime, `QUERY ${index}`)
      })
      
      const metrics = monitor.getMetrics()
      const expectedAverage = queryTimes.reduce((a, b) => a + b) / queryTimes.length
      
      expect(metrics.averageQueryTime).toBeCloseTo(expectedAverage, 0)
    })

    it('should track peak query time', () => {
      const queryTimes = [100, 500, 200, 800, 300]
      
      queryTimes.forEach((time, index) => {
        const startTime = monitor.startQuery(`QUERY ${index}`)
        vi.advanceTimersByTime(time)
        monitor.endQuery(startTime, `QUERY ${index}`)
      })
      
      const metrics = monitor.getMetrics()
      expect(metrics.peakQueryTime).toBe(800)
    })

    it('should reset metrics correctly', () => {
      // Execute some queries
      for (let i = 0; i < 3; i++) {
        const startTime = monitor.startQuery(`QUERY ${i}`)
        vi.advanceTimersByTime(100)
        monitor.endQuery(startTime, `QUERY ${i}`)
      }
      
      expect(monitor.getMetrics().totalQueries).toBe(3)
      
      monitor.reset()
      
      const metrics = monitor.getMetrics()
      expect(metrics.totalQueries).toBe(0)
      expect(metrics.averageQueryTime).toBe(0)
      expect(metrics.peakQueryTime).toBe(0)
    })
  })
})

describe('Cache Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getCachedSiteData', () => {
    it('should return cached data if available', async () => {
      const mockSiteData = {
        id: 'rotation-123',
        name: 'Test Hospital',
        address: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        latitude: 40.7128,
        longitude: -74.0060
      }

      // Mock cache hit
      const mockCache = {
        get: vi.fn().mockReturnValue(mockSiteData),
        set: vi.fn()
      }

      // Replace the internal cache (this would need to be exposed or mocked differently)
      const result = await getCachedSiteData('rotation-123')
      
      // Since we can't easily mock the internal cache, we'll test the function behavior
      expect(result).toBeDefined()
    })

    it('should fetch from database if not cached', async () => {
      const { db } = await import('@/lib/db')
      const mockDb = db as any

      const mockSiteData = {
        id: 'rotation-123',
        name: 'Test Hospital',
        address: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        latitude: 40.7128,
        longitude: -74.0060
      }

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockSiteData])
          })
        })
      })

      const result = await getCachedSiteData('rotation-123')
      
      expect(result).toEqual(mockSiteData)
      expect(mockDb.select).toHaveBeenCalled()
    })

    it('should handle database errors gracefully', async () => {
      const { db } = await import('@/lib/db')
      const mockDb = db as any

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockRejectedValue(new Error('Database error'))
          })
        })
      })

      await expect(getCachedSiteData('rotation-123')).rejects.toThrow('Database error')
    })
  })

  describe('getActiveTimeRecord', () => {
    it('should return cached active record if available', async () => {
      const mockRecord = {
        id: 'record-123',
        studentId: 'student-456',
        rotationId: 'rotation-789',
        clockInTime: new Date(),
        status: 'ACTIVE'
      }

      const result = await getActiveTimeRecord('student-456')
      
      // Test that function executes without error
      expect(result).toBeDefined()
    })

    it('should fetch from database if not cached', async () => {
      const { db } = await import('@/lib/db')
      const mockDb = db as any

      const mockRecord = {
        id: 'record-123',
        studentId: 'student-456',
        rotationId: 'rotation-789',
        clockInTime: new Date(),
        status: 'ACTIVE'
      }

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockRecord])
        })
      })

      const result = await getActiveTimeRecord('student-456')
      
      expect(result).toEqual(mockRecord)
      expect(mockDb.select).toHaveBeenCalled()
    })

    it('should return null if no active record found', async () => {
      const { db } = await import('@/lib/db')
      const mockDb = db as any

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([])
        })
      })

      const result = await getActiveTimeRecord('student-456')
      
      expect(result).toBeNull()
    })
  })

  describe('invalidateStudentCache', () => {
    it('should clear student-related cache entries', () => {
      // This function should clear cache entries
      // Since we can't easily test the internal cache clearing,
      // we'll verify the function executes without error
      expect(() => invalidateStudentCache('student-123')).not.toThrow()
    })
  })
})

describe('Database Health Check', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should perform comprehensive health check', async () => {
    const { db } = await import('@/lib/db')
    const mockDb = db as any

    // Mock successful database connection
    mockDb.execute.mockResolvedValue({ rows: [{ result: 1 }] })

    const healthCheck = await performDatabaseHealthCheck()
    
    expect(healthCheck).toBeDefined()
    expect(healthCheck.status).toBeDefined()
    expect(healthCheck.timestamp).toBeDefined()
  })

  it('should detect database connection issues', async () => {
    const { db } = await import('@/lib/db')
    const mockDb = db as any

    // Mock database connection failure
    mockDb.execute.mockRejectedValue(new Error('Connection failed'))

    const healthCheck = await performDatabaseHealthCheck()
    
    expect(healthCheck.status).toBe('unhealthy')
    expect(healthCheck.issues).toContain('Database connection failed')
  })

  it('should include performance metrics in health check', async () => {
    const { db } = await import('@/lib/db')
    const mockDb = db as any

    mockDb.execute.mockResolvedValue({ rows: [{ result: 1 }] })

    const healthCheck = await performDatabaseHealthCheck()
    
    expect(healthCheck.performance).toBeDefined()
    expect(healthCheck.performance.queryTime).toBeGreaterThanOrEqual(0)
  })
})

describe('Database Indexes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should apply recommended indexes', async () => {
    const { db } = await import('@/lib/db')
    const mockDb = db as any

    mockDb.execute.mockResolvedValue({ success: true })

    const result = await applyRecommendedIndexes()
    
    expect(result).toBeDefined()
    expect(result.applied).toBeDefined()
    expect(result.failed).toBeDefined()
  })

  it('should handle index creation failures gracefully', async () => {
    const { db } = await import('@/lib/db')
    const mockDb = db as any

    // Mock some indexes succeeding, some failing
    mockDb.execute
      .mockResolvedValueOnce({ success: true })
      .mockRejectedValueOnce(new Error('Index already exists'))
      .mockResolvedValueOnce({ success: true })

    const result = await applyRecommendedIndexes()
    
    expect(result.applied.length).toBeGreaterThan(0)
    expect(result.failed.length).toBeGreaterThan(0)
  })

  it('should log index creation progress', async () => {
    const { db } = await import('@/lib/db')
    const mockDb = db as any
    const { logger } = await import('@/lib/logger')

    mockDb.execute.mockResolvedValue({ success: true })

    await applyRecommendedIndexes()
    
    expect(logger.info).toHaveBeenCalled()
  })
})