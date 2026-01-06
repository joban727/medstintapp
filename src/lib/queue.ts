import { db } from "@/database/connection-pool"
import { jobs } from "@/database/schema"
import { eq, lt, and, asc, sql } from "drizzle-orm"

export type JobType = "EMAIL" | "REPORT"

export interface JobPayload {
  [key: string]: any
}

export class QueueManager {
  /**
   * Add a job to the queue
   */
  static async add(type: JobType, payload: JobPayload, options?: { runAt?: Date }) {
    const [job] = await db
      .insert(jobs)
      .values({
        type,
        payload,
        runAt: options?.runAt || new Date(),
      })
      .returning()
    return job
  }

  /**
   * Fetch and lock the next available job
   * Uses "SKIP LOCKED" for concurrency safety if supported, or simple update
   */
  static async getNextJob(types?: JobType[]) {
    return await db.transaction(async (tx) => {
      // Find pending jobs that are due
      // Note: Drizzle doesn't fully support "FOR UPDATE SKIP LOCKED" in all drivers easily yet,
      // but we can try a raw query or a simple update-returning pattern.
      // For Neon/Postgres, this pattern is robust:

      const now = new Date()

      // 1. Find a candidate ID
      const pendingJob = await tx.query.jobs.findFirst({
        where: (jobs, { eq, and, lte, inArray }) =>
          and(
            eq(jobs.status, "PENDING"),
            lte(jobs.runAt, now),
            types ? inArray(jobs.type, types) : undefined
          ),
        orderBy: (jobs, { asc }) => [asc(jobs.runAt)],
      })

      if (!pendingJob) return null

      // 2. Lock and update it
      const [lockedJob] = await tx
        .update(jobs)
        .set({
          status: "PROCESSING",
          updatedAt: new Date(),
          attempts: sql`${jobs.attempts} + 1`,
        })
        .where(
          and(
            eq(jobs.id, pendingJob.id),
            eq(jobs.status, "PENDING") // Double check to avoid race condition
          )
        )
        .returning()

      return lockedJob
    })
  }

  /**
   * Mark job as completed
   */
  static async complete(jobId: string) {
    await db
      .update(jobs)
      .set({
        status: "COMPLETED",
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, jobId))
  }

  /**
   * Mark job as failed
   */
  static async fail(jobId: string, error: string) {
    await db
      .update(jobs)
      .set({
        status: "FAILED",
        lastError: error,
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, jobId))
  }
}

export const emailQueue = {
  add: (payload: any) => QueueManager.add("EMAIL", payload),
}

export const reportsQueue = {
  add: (payload: any) => QueueManager.add("REPORT", payload),
}
