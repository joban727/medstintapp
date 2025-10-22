/**
 * Transaction Batching Utilities
 * Implements intelligent transaction batching to minimize database overhead
 * and optimize resource utilization for cost-effective operations
 */

import type { ExtractTablesWithRelations } from "drizzle-orm"
import type { PgQueryResultHKT, PgTransaction } from "drizzle-orm/pg-core"
import { db } from "@/database/connection-pool"
import type * as schema from "@/database/schema"

// Transaction batch configuration
interface TransactionBatchConfig {
  maxBatchSize: number
  maxWaitTime: number // milliseconds
  maxRetries: number
  isolationLevel: "read uncommitted" | "read committed" | "repeatable read" | "serializable"
}

const DEFAULT_TRANSACTION_CONFIG: TransactionBatchConfig = {
  maxBatchSize: 50,
  maxWaitTime: 100, // 100ms max wait before executing batch
  maxRetries: 3,
  isolationLevel: "read committed",
}

// Transaction operation types
type DbTransaction = PgTransaction<
  PgQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>

type TransactionOperation<T = unknown> = {
  id: string
  operation: (tx: DbTransaction) => Promise<T>
  resolve: (value: T) => void
  reject: (error: Error) => void
  priority: "high" | "medium" | "low"
  timeout?: number
}

/**
 * Intelligent Transaction Batcher
 * Automatically batches database transactions to reduce overhead
 */
export class TransactionBatcher {
  private config: TransactionBatchConfig
  private pendingOperations: TransactionOperation[] = []
  private batchTimer: NodeJS.Timeout | null = null
  private isProcessing = false
  private metrics = {
    totalBatches: 0,
    totalOperations: 0,
    averageBatchSize: 0,
    averageExecutionTime: 0,
    successRate: 0,
  }

  constructor(config: Partial<TransactionBatchConfig> = {}) {
    this.config = { ...DEFAULT_TRANSACTION_CONFIG, ...config }
  }

  /**
   * Add operation to batch queue
   */
  async addOperation<T>(
    operation: (tx: DbTransaction) => Promise<T>,
    priority: "high" | "medium" | "low" = "medium",
    timeout?: number
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const operationId = this.generateOperationId()

      const transactionOp: TransactionOperation<T> = {
        id: operationId,
        operation,
        resolve,
        reject,
        priority,
        timeout,
      }

      // Insert operation based on priority
      this.insertByPriority(transactionOp)

      // Set timeout if specified
      if (timeout) {
        setTimeout(() => {
          this.removeOperation(operationId)
          reject(new Error(`Transaction operation timed out after ${timeout}ms`))
        }, timeout)
      }

      // Trigger batch processing
      this.scheduleBatchExecution()
    })
  }

  /**
   * Execute immediate transaction (bypasses batching)
   */
  async executeImmediate<T>(operation: (tx: DbTransaction) => Promise<T>): Promise<T> {
    const startTime = Date.now()

    try {
      const result = await db.transaction(
        async (tx) => {
          return await operation(tx)
        },
        {
          isolationLevel: this.config.isolationLevel,
        }
      )

      const duration = Date.now() - startTime
      console.log(`🚀 Immediate transaction executed in ${duration}ms`)

      return result
    } catch (error) {
      console.error("❌ Immediate transaction failed:", error)
      throw error
    }
  }

  /**
   * Schedule batch execution
   */
  private scheduleBatchExecution(): void {
    // Execute immediately if batch is full
    if (this.pendingOperations.length >= this.config.maxBatchSize) {
      this.executeBatch()
      return
    }

    // Schedule execution if not already scheduled
    if (!this.batchTimer && !this.isProcessing) {
      this.batchTimer = setTimeout(() => {
        this.executeBatch()
      }, this.config.maxWaitTime)
    }
  }

  /**
   * Execute pending operations in a single transaction
   */
  private async executeBatch(): Promise<void> {
    if (this.isProcessing || this.pendingOperations.length === 0) {
      return
    }

    this.isProcessing = true

    // Clear timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }

    // Get operations to process
    const operations = this.pendingOperations.splice(0, this.config.maxBatchSize)
    const startTime = Date.now()

    console.log(`🔄 Executing transaction batch with ${operations.length} operations`)

    let retryCount = 0
    let success = false

    while (!success && retryCount < this.config.maxRetries) {
      try {
        await this.executeBatchOperations(operations)
        success = true

        const duration = Date.now() - startTime
        this.updateMetrics(operations.length, duration, true)

        console.log(
          `✅ Transaction batch completed in ${duration}ms (${operations.length} operations)`
        )
      } catch (error) {
        retryCount++
        console.warn(
          `⚠️ Transaction batch failed (attempt ${retryCount}/${this.config.maxRetries}):`,
          error
        )

        if (retryCount >= this.config.maxRetries) {
          // Reject all operations
          operations.forEach((op) => {
            op.reject(error as Error)
          })

          this.updateMetrics(operations.length, Date.now() - startTime, false)
        } else {
          // Wait before retry
          await this.delay(2 ** retryCount * 100) // Exponential backoff
        }
      }
    }

    this.isProcessing = false

    // Process remaining operations if any
    if (this.pendingOperations.length > 0) {
      this.scheduleBatchExecution()
    }
  }

  /**
   * Execute batch operations within a single transaction
   */
  private async executeBatchOperations(operations: TransactionOperation[]): Promise<void> {
    await db.transaction(
      async (tx) => {
        const results = await Promise.allSettled(
          operations.map(async (op) => {
            try {
              const result = await op.operation(tx)
              op.resolve(result)
              return result
            } catch (error) {
              op.reject(error as Error)
              throw error
            }
          })
        )

        // Check if any operation failed
        const failures = results.filter((result) => result.status === "rejected")
        if (failures.length > 0) {
          throw new Error(`${failures.length} operations failed in batch`)
        }
      },
      {
        isolationLevel: this.config.isolationLevel,
      }
    )
  }

  /**
   * Insert operation by priority
   */
  private insertByPriority<T>(operation: TransactionOperation<T>): void {
    const priorityOrder = { high: 0, medium: 1, low: 2 }

    let insertIndex = this.pendingOperations.length

    for (let i = 0; i < this.pendingOperations.length; i++) {
      if (priorityOrder[operation.priority] < priorityOrder[this.pendingOperations[i].priority]) {
        insertIndex = i
        break
      }
    }

    this.pendingOperations.splice(insertIndex, 0, operation as TransactionOperation)
  }

  /**
   * Remove operation from queue
   */
  private removeOperation(operationId: string): void {
    const index = this.pendingOperations.findIndex((op) => op.id === operationId)
    if (index !== -1) {
      this.pendingOperations.splice(index, 1)
    }
  }

  /**
   * Generate unique operation ID
   */
  private generateOperationId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(batchSize: number, duration: number, success: boolean): void {
    this.metrics.totalBatches++
    this.metrics.totalOperations += batchSize

    // Update averages
    this.metrics.averageBatchSize = this.metrics.totalOperations / this.metrics.totalBatches
    this.metrics.averageExecutionTime =
      (this.metrics.averageExecutionTime * (this.metrics.totalBatches - 1) + duration) /
      this.metrics.totalBatches

    // Update success rate
    const successfulBatches = success ? 1 : 0
    this.metrics.successRate =
      ((this.metrics.successRate * (this.metrics.totalBatches - 1) + successfulBatches) /
        this.metrics.totalBatches) *
      100
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      pendingOperations: this.pendingOperations.length,
      isProcessing: this.isProcessing,
    }
  }

  /**
   * Flush all pending operations immediately
   */
  async flush(): Promise<void> {
    if (this.pendingOperations.length > 0) {
      await this.executeBatch()
    }
  }

  /**
   * Graceful shutdown - complete all pending operations
   */
  async shutdown(): Promise<void> {
    console.log("🔄 Shutting down transaction batcher...")

    // Clear timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }

    // Process remaining operations
    while (this.pendingOperations.length > 0 || this.isProcessing) {
      if (!this.isProcessing) {
        await this.executeBatch()
      }
      await this.delay(10) // Small delay to prevent busy waiting
    }

    console.log("✅ Transaction batcher shutdown complete")
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

// Specialized transaction batchers for different use cases
export class AnalyticsTransactionBatcher extends TransactionBatcher {
  constructor() {
    super({
      maxBatchSize: 100, // Larger batches for analytics
      maxWaitTime: 200, // Longer wait time for better batching
      isolationLevel: "read committed",
    })
  }
}

export class CriticalTransactionBatcher extends TransactionBatcher {
  constructor() {
    super({
      maxBatchSize: 10, // Smaller batches for critical operations
      maxWaitTime: 50, // Shorter wait time for responsiveness
      isolationLevel: "repeatable read",
    })
  }
}

// Export singleton instances
export const defaultTransactionBatcher = new TransactionBatcher()
export const analyticsTransactionBatcher = new AnalyticsTransactionBatcher()
export const criticalTransactionBatcher = new CriticalTransactionBatcher()

// Utility functions for common transaction patterns
export const transactionUtils = {
  /**
   * Batch multiple insert operations
   */
  async batchInserts<T>(
    operations: Array<(tx: DbTransaction) => Promise<T>>,
    priority: "high" | "medium" | "low" = "medium"
  ): Promise<T[]> {
    const results = await Promise.all(
      operations.map((op) => defaultTransactionBatcher.addOperation(op, priority))
    )
    return results
  },

  /**
   * Execute operations with automatic retry
   */
  async withRetry<T>(operation: (tx: DbTransaction) => Promise<T>, maxRetries = 3): Promise<T> {
    let lastError: Error = new Error("Transaction failed after all retries")

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await defaultTransactionBatcher.addOperation(operation)
      } catch (error) {
        lastError = error as Error

        if (attempt < maxRetries) {
          console.warn(`⚠️ Transaction attempt ${attempt} failed, retrying...`)
          await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 100))
        }
      }
    }

    throw lastError
  },
}
