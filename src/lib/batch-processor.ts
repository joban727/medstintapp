/**
 * Batch Processing Utilities
 * Implements efficient batch operations to minimize database transactions
 * and reduce network overhead for optimal performance and cost reduction
 */

import { sql } from "drizzle-orm"
import type { PgTable } from "drizzle-orm/pg-core"
import { db } from "../database/connection-pool"

// Batch configuration with dynamic sizing support
interface BatchConfig {
  batchSize: number
  maxConcurrency: number
  retryAttempts: number
  retryDelay: number
  dynamicSizing?: boolean
  minBatchSize?: number
  maxBatchSize?: number
  adaptiveThreshold?: number
}

// Performance metrics for adaptive sizing
interface PerformanceMetrics {
  avgProcessingTime: number
  errorRate: number
  memoryUsage: number
  throughput: number
}

const DEFAULT_BATCH_CONFIG: BatchConfig = {
  batchSize: 100, // Initial batch size
  maxConcurrency: 3, // Maximum concurrent batches
  retryAttempts: 3, // Retry failed batches 3 times
  retryDelay: 1000, // 1 second delay between retries
  dynamicSizing: true, // Enable adaptive batch sizing
  minBatchSize: 10, // Minimum batch size
  maxBatchSize: 1000, // Maximum batch size
  adaptiveThreshold: 500, // Processing time threshold in ms
}

// Batch operation result
interface BatchResult<T = unknown> {
  success: boolean
  processedCount: number
  failedCount: number
  errors: Error[]
  results?: T[]
  duration: number
}

// Generic batch processor class with dynamic sizing
export class BatchProcessor<T = unknown> {
  private config: BatchConfig
  private performanceHistory: PerformanceMetrics[] = []
  private currentBatchSize: number

  constructor(config: Partial<BatchConfig> = {}) {
    this.config = { ...DEFAULT_BATCH_CONFIG, ...config }
    this.currentBatchSize = this.config.batchSize
  }

  /**
   * Process items in batches with dynamic sizing and configurable concurrency
   */
  async processBatches<R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    options: Partial<BatchConfig> = {}
  ): Promise<BatchResult<R>> {
    const config = { ...this.config, ...options }
    const startTime = Date.now()

    // Determine optimal batch size
    const optimalBatchSize = config.dynamicSizing
      ? this.calculateOptimalBatchSize(items.length, processor)
      : config.batchSize

    const batches = this.createBatches(items, optimalBatchSize)
    const results: R[] = []
    const errors: Error[] = []
    let processedCount = 0
    let failedCount = 0
    const batchMetrics: PerformanceMetrics[] = []

    // Process batches with controlled concurrency
    const semaphore = new Semaphore(config.maxConcurrency)

    const batchPromises = batches.map(async (batch, index) => {
      await semaphore.acquire()

      const batchStartTime = Date.now()
      try {
        const batchResult = await this.processBatchWithRetry(
          batch,
          processor,
          config.retryAttempts,
          config.retryDelay
        )
        const batchDuration = Date.now() - batchStartTime

        // Collect performance metrics for adaptive sizing
        batchMetrics.push({
          avgProcessingTime: batchDuration,
          errorRate: 0,
          memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
          throughput: batch.length / (batchDuration / 1000), // items/sec
        })

        results.push(...batchResult)
        processedCount += batch.length

        console.log(
          `✅ Batch ${index + 1}/${batches.length} completed (${batch.length} items, ${batchDuration}ms)`
        )
      } catch (error) {
        const batchDuration = Date.now() - batchStartTime

        // Record failed batch metrics
        batchMetrics.push({
          avgProcessingTime: batchDuration,
          errorRate: 1,
          memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
          throughput: 0,
        })

        errors.push(error as Error)
        failedCount += batch.length
        console.error(`❌ Batch ${index + 1}/${batches.length} failed:`, error)
      } finally {
        semaphore.release()
      }
    })

    await Promise.all(batchPromises)

    const duration = Date.now() - startTime

    // Update performance history for future optimizations
    if (config.dynamicSizing && batchMetrics.length > 0) {
      this.updatePerformanceHistory(batchMetrics, optimalBatchSize)
    }

    return {
      success: errors.length === 0,
      processedCount,
      failedCount,
      errors,
      results,
      duration,
    }
  }

  /**
   * Process a single batch with retry logic
   */
  private async processBatchWithRetry<R>(
    batch: T[],
    processor: (batch: T[]) => Promise<R[]>,
    retryAttempts: number,
    retryDelay: number
  ): Promise<R[]> {
    let lastError: Error

    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
      try {
        return await processor(batch)
      } catch (error) {
        lastError = error as Error

        if (attempt < retryAttempts) {
          console.warn(`⚠️ Batch attempt ${attempt} failed, retrying in ${retryDelay}ms...`)
          await this.delay(retryDelay)
        }
      }
    }

    throw lastError!
  }

  /**
   * Split items into batches of specified size
   */
  private createBatches(items: T[], batchSize: number): T[][] {
    const batches: T[][] = []

    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize))
    }

    return batches
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Calculate optimal batch size based on historical performance and current conditions
   */
  private calculateOptimalBatchSize<R>(
    totalItems: number,
    _processor: (batch: T[]) => Promise<R[]>
  ): number {
    const { minBatchSize = 10, maxBatchSize = 1000, adaptiveThreshold = 500 } = this.config

    // If no performance history, use current batch size
    if (this.performanceHistory.length === 0) {
      return Math.min(Math.max(this.currentBatchSize, minBatchSize), maxBatchSize)
    }

    // Calculate average metrics from recent performance
    const recentMetrics = this.performanceHistory.slice(-5) // Last 5 batches
    const avgProcessingTime =
      recentMetrics.reduce((sum, m) => sum + m.avgProcessingTime, 0) / recentMetrics.length
    const avgErrorRate =
      recentMetrics.reduce((sum, m) => sum + m.errorRate, 0) / recentMetrics.length
    const _avgThroughput =
      recentMetrics.reduce((sum, m) => sum + m.throughput, 0) / recentMetrics.length
    const avgMemoryUsage =
      recentMetrics.reduce((sum, m) => sum + m.memoryUsage, 0) / recentMetrics.length

    let optimalSize = this.currentBatchSize

    // Adaptive sizing logic
    if (avgProcessingTime > adaptiveThreshold) {
      // Processing is slow, reduce batch size
      optimalSize = Math.max(Math.floor(this.currentBatchSize * 0.8), minBatchSize)
      console.log(`🔽 Reducing batch size due to slow processing (${avgProcessingTime}ms avg)`)
    } else if (avgProcessingTime < adaptiveThreshold * 0.5 && avgErrorRate < 0.1) {
      // Processing is fast and stable, increase batch size
      optimalSize = Math.min(Math.floor(this.currentBatchSize * 1.2), maxBatchSize)
      console.log(`🔼 Increasing batch size due to fast processing (${avgProcessingTime}ms avg)`)
    }

    // Memory-based adjustments
    if (avgMemoryUsage > 100) {
      // > 100MB
      optimalSize = Math.max(Math.floor(optimalSize * 0.7), minBatchSize)
      console.log(
        `🔽 Reducing batch size due to high memory usage (${avgMemoryUsage.toFixed(1)}MB avg)`
      )
    }

    // Error rate adjustments
    if (avgErrorRate > 0.2) {
      // > 20% error rate
      optimalSize = Math.max(Math.floor(optimalSize * 0.6), minBatchSize)
      console.log(
        `🔽 Reducing batch size due to high error rate (${(avgErrorRate * 100).toFixed(1)}% avg)`
      )
    }

    // Consider total items for very small datasets
    if (totalItems < optimalSize * 2) {
      optimalSize = Math.max(Math.floor(totalItems / 2), minBatchSize)
    }

    this.currentBatchSize = optimalSize
    return optimalSize
  }

  /**
   * Update performance history with new metrics
   */
  private updatePerformanceHistory(batchMetrics: PerformanceMetrics[], _batchSize: number): void {
    // Calculate aggregate metrics for this batch run
    const aggregateMetrics: PerformanceMetrics = {
      avgProcessingTime:
        batchMetrics.reduce((sum, m) => sum + m.avgProcessingTime, 0) / batchMetrics.length,
      errorRate: batchMetrics.reduce((sum, m) => sum + m.errorRate, 0) / batchMetrics.length,
      memoryUsage: batchMetrics.reduce((sum, m) => sum + m.memoryUsage, 0) / batchMetrics.length,
      throughput: batchMetrics.reduce((sum, m) => sum + m.throughput, 0) / batchMetrics.length,
    }

    this.performanceHistory.push(aggregateMetrics)

    // Keep only recent history (last 20 batch runs)
    if (this.performanceHistory.length > 20) {
      this.performanceHistory = this.performanceHistory.slice(-20)
    }

    console.log(
      `📊 Performance metrics updated: ${aggregateMetrics.avgProcessingTime.toFixed(0)}ms avg, ${aggregateMetrics.throughput.toFixed(0)} items/sec, ${aggregateMetrics.memoryUsage.toFixed(1)}MB`
    )
  }

  /**
   * Get current performance statistics
   */
  public getPerformanceStats(): {
    currentBatchSize: number
    avgProcessingTime: number
    avgThroughput: number
    avgMemoryUsage: number
    avgErrorRate: number
  } | null {
    if (this.performanceHistory.length === 0) {
      return null
    }

    const recentMetrics = this.performanceHistory.slice(-5)
    return {
      currentBatchSize: this.currentBatchSize,
      avgProcessingTime:
        recentMetrics.reduce((sum, m) => sum + m.avgProcessingTime, 0) / recentMetrics.length,
      avgThroughput: recentMetrics.reduce((sum, m) => sum + m.throughput, 0) / recentMetrics.length,
      avgMemoryUsage:
        recentMetrics.reduce((sum, m) => sum + m.memoryUsage, 0) / recentMetrics.length,
      avgErrorRate: recentMetrics.reduce((sum, m) => sum + m.errorRate, 0) / recentMetrics.length,
    }
  }
}

// Semaphore for controlling concurrency
class Semaphore {
  private permits: number
  private waitQueue: (() => void)[] = []

  constructor(permits: number) {
    this.permits = permits
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--
      return
    }

    return new Promise((resolve) => {
      this.waitQueue.push(resolve)
    })
  }

  release(): void {
    this.permits++

    if (this.waitQueue.length > 0) {
      const resolve = this.waitQueue.shift()!
      this.permits--
      resolve()
    }
  }
}

// Specialized batch operations for common use cases
export class DatabaseBatchOperations {
  private processor: BatchProcessor

  constructor(config: Partial<BatchConfig> = {}) {
    this.processor = new BatchProcessor({
      // Enable dynamic sizing by default for database operations
      dynamicSizing: true,
      minBatchSize: 10,
      maxBatchSize: 1000,
      adaptiveThreshold: 500,
      ...config,
    })
  }

  /**
   * Batch insert operations with transaction support
   */
  async batchInsert<T extends Record<string, unknown>>(
    table: PgTable,
    records: T[],
    options: Partial<BatchConfig> = {}
  ): Promise<BatchResult> {
    return this.processor.processBatches(
      records,
      async (batch) => {
        return await db.transaction(async (tx) => {
          const results = []

          for (const record of batch) {
            const result = await tx
              .insert(table)
              .values(record as Record<string, unknown>)
              .returning()
            results.push(result[0])
          }

          return results
        })
      },
      options
    )
  }

  /**
   * Batch update operations with optimized queries
   */
  async batchUpdate<T extends Record<string, unknown>>(
    table: PgTable,
    updates: Array<{ where: unknown; set: Partial<T> }>,
    options: Partial<BatchConfig> = {}
  ): Promise<BatchResult> {
    return this.processor.processBatches(
      updates,
      async (batch) => {
        return await db.transaction(async (tx) => {
          const results = []

          for (const update of batch) {
            const { where, set } = update as { where: unknown; set: Record<string, unknown> }
            const result = await tx
              .update(table)
              .set(set as Record<string, unknown>)
              .where(where as unknown)
              .returning()
            results.push(result[0])
          }

          return results
        })
      },
      options
    )
  }

  /**
   * Batch upsert operations (insert or update)
   */
  async batchUpsert<T extends Record<string, unknown>>(
    table: PgTable,
    records: T[],
    conflictColumns: string[],
    options: Partial<BatchConfig> = {}
  ): Promise<BatchResult> {
    return this.processor.processBatches(
      records,
      async (batch) => {
        return await db.transaction(async (tx) => {
          const results = []

          for (const record of batch) {
            const result = await tx
              .insert(table)
              .values(record as Record<string, unknown>)
              .onConflictDoUpdate({
                target: conflictColumns as never,
                set: record as Record<string, unknown>,
              })
              .returning()

            results.push(result[0])
          }

          return results
        })
      },
      options
    )
  }

  /**
   * Batch delete operations
   */
  async batchDelete(
    table: PgTable,
    conditions: unknown[],
    options: Partial<BatchConfig> = {}
  ): Promise<BatchResult> {
    return this.processor.processBatches(
      conditions,
      async (batch) => {
        return await db.transaction(async (tx) => {
          const results = []

          for (const condition of batch) {
            const result = await tx
              .delete(table)
              .where(condition as unknown)
              .returning()
            results.push(result[0])
          }

          return results
        })
      },
      options
    )
  }

  /**
   * Optimized bulk insert using COPY-like operations
   */
  async bulkInsert<T extends Record<string, unknown>>(
    tableName: string,
    records: T[],
    options: Partial<BatchConfig> = {}
  ): Promise<BatchResult> {
    const config = { ...DEFAULT_BATCH_CONFIG, ...options }

    return this.processor.processBatches(
      records,
      async (batch) => {
        // Use raw SQL for maximum performance
        const columns = Object.keys(batch[0] as Record<string, unknown>)
        const values = batch.map((record) =>
          columns.map((col) => (record as Record<string, unknown>)[col])
        )

        const placeholders = values
          .map(
            (row) =>
              `(${row.map((val) => (typeof val === "string" ? `'${val.replace(/'/g, "''")}'` : val)).join(", ")})`
          )
          .join(", ")

        const query = `
          INSERT INTO ${tableName} (${columns.join(", ")})
          VALUES ${placeholders}
          RETURNING *
        `

        const result = await db.execute(sql.raw(query))

        return result.rows
      },
      { ...config, batchSize: Math.min(config.batchSize, 50) } // Smaller batches for raw SQL
    )
  }
}

// Export singleton instance
export const batchOperations = new DatabaseBatchOperations()
