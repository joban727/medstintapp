// Use Web Crypto API for browser compatibility
const createHash =
  typeof window !== "undefined"
    ? null // Will use alternative hashing in browser
    : require("node:crypto").createHash

import { and, count, eq } from "drizzle-orm"
import type { NextResponse } from "next/server"
import { db } from "@/database/db"
import {
  auditLogs,
  competencies,
  competencyAssignments,
  competencyDeployments,
  competencySubmissions,
} from "@/database/schema"

/**
 * Rate limiting store (in production, use Redis or similar distributed cache)
 * Maps client identifiers to their request count and reset time
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

/**
 * Rate limiting helper function for competency submissions
 * @param identifier - Client identifier (IP address, user ID, etc.)
 * @param maxRequests - Maximum number of requests allowed in the time window
 * @param windowMs - Time window in milliseconds
 * @returns true if request is allowed, false if rate limit exceeded
 */
export const rateLimit = (identifier: string, maxRequests = 50, windowMs = 60000): boolean => {
  const now = Date.now()
  const key = identifier
  const current = rateLimitStore.get(key)

  if (!current || now > current.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs })
    return true
  }

  if (current.count >= maxRequests) {
    return false
  }

  current.count++
  return true
}

/**
 * Input validation helper with sanitization
 * @param data - Data object to validate
 * @param schema - Zod schema for validation
 * @returns Validated and sanitized data
 */
export const validateInput = <T>(data: unknown, schema: any): T => {
  const result = schema.safeParse(data)
  if (!result.success) {
    throw new Error(`Validation failed: ${result.error.message}`)
  }
  return result.data
}

/**
 * Sanitizes string input to prevent XSS attacks
 * @param str - String to sanitize
 * @returns Sanitized string
 */
export const sanitizeString = (str: string): string => {
  return str.trim().replace(/[<>"'&]/g, (match) => {
    const entities: Record<string, string> = {
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#x27;",
      "&": "&amp;",
    }
    return entities[match] || match
  })
}

/**
 * Creates an audit log entry for competency submission activities
 * @param action - Action performed (e.g., 'COMPETENCY_SUBMITTED', 'BATCH_SUBMISSION')
 * @param details - Additional details about the action
 * @param userId - ID of the user performing the action
 * @param targetUserId - ID of the user being affected (student)
 * @param resourceId - ID of the competency or assignment
 * @param metadata - Additional metadata
 */
export const createAuditLog = async ({
  action,
  details,
  userId,
  targetUserId,
  resourceId,
  metadata = {},
}: {
  action: string
  details: string
  userId: string
  targetUserId?: string
  resourceId?: string
  metadata?: Record<string, unknown>
}) => {
  try {
    const auditData = {
      id: crypto.randomUUID(),
      userId,
      action,
      details,
      resourceType: "COMPETENCY_SUBMISSION",
      resourceId: resourceId || null,
      targetUserId: targetUserId || null,
      ipAddress: null, // Will be set by the calling function
      userAgent: null, // Will be set by the calling function
      timestamp: new Date(),
      severity: "MEDIUM" as const,
      status: "SUCCESS" as const,
      metadata: JSON.stringify(metadata),
      integrityHash: generateIntegrityHash({
        userId,
        action,
        details,
        resourceId,
        targetUserId,
        timestamp: new Date().toISOString(),
      }),
    }

    await db.insert(auditLogs).values(auditData)
    return auditData
  } catch (error) {
    console.error("Failed to create audit log:", error)
    throw error
  }
}

/**
 * Generates integrity hash for audit log data
 * @param logData - Data object to generate hash for
 * @returns SHA256 hash string for data integrity verification
 */
const generateIntegrityHash = (logData: Record<string, unknown>): string => {
  const dataString = JSON.stringify(logData, Object.keys(logData).sort())

  if (typeof window !== "undefined") {
    // Browser environment - use a simple string hash
    let hash = 0
    for (let i = 0; i < dataString.length; i++) {
      const char = dataString.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16)
  }
  // Node.js environment
  return createHash("sha256").update(dataString).digest("hex")
}

/**
 * Checks if a user has permission to submit competencies on behalf of students
 * @param userRole - User's role
 * @returns boolean indicating if user can submit competencies
 */
export const canSubmitCompetencies = (userRole: string): boolean => {
  return ["CLINICAL_PRECEPTOR", "CLINICAL_SUPERVISOR", "SUPER_ADMIN", "SCHOOL_ADMIN"].includes(
    userRole
  )
}

/**
 * Validates that a user is not trying to submit competencies for themselves
 * @param submitterId - ID of the user submitting
 * @param studentId - ID of the student the competency is being submitted for
 * @param submitterRole - Role of the submitter
 * @returns boolean indicating if the submission is valid
 */
export const validateSubmissionTarget = (
  submitterId: string,
  studentId: string,
  submitterRole: string
): boolean => {
  // Super admins and school admins can submit for anyone (for testing/admin purposes)
  if (["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(submitterRole)) {
    return true
  }

  // Clinical preceptors and supervisors cannot submit for themselves
  return submitterId !== studentId
}

export function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("X-XSS-Protection", "1; mode=block")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
  )
  return response
}

/**
 * Updates competency assignment progress based on submissions
 */
export async function updateAssignmentProgress(
  studentId: string,
  competencyId: string,
  _submissionStatus: "submitted" | "completed" | "reviewed"
): Promise<void> {
  try {
    // Find the competency assignment for this student and competency
    const assignment = await db
      .select({
        id: competencyAssignments.id,
        deploymentId: competencyAssignments.deploymentId,
        progress: competencyAssignments.progressPercentage,
        status: competencyAssignments.status,
      })
      .from(competencyAssignments)
      .innerJoin(
        competencyDeployments,
        eq(competencyDeployments.id, competencyAssignments.deploymentId)
      )
      .innerJoin(competencies, eq(competencies.id, competencyDeployments.competencyId))
      .where(and(eq(competencyAssignments.userId, studentId), eq(competencies.id, competencyId)))
      .limit(1)

    if (assignment.length === 0) {
      console.warn(`No assignment found for student ${studentId} and competency ${competencyId}`)
      return
    }

    const assignmentRecord = assignment[0]

    // Skip if no deployment ID
    if (!assignmentRecord.deploymentId) {
      console.warn(`No deployment ID found for assignment ${assignmentRecord.id}`)
      return
    }

    // Get all competencies for this deployment
    const deploymentCompetencies = await db
      .select({ id: competencies.id })
      .from(competencyDeployments)
      .innerJoin(competencies, eq(competencies.id, competencyDeployments.competencyId))
      .where(
        and(
          eq(competencyDeployments.id, assignmentRecord.deploymentId),
          eq(competencies.isDeployed, true)
        )
      )

    // Count submitted competencies for this student
    const submittedCompetencies = await db
      .select({ count: count() })
      .from(competencySubmissions)
      .innerJoin(competencies, eq(competencies.id, competencySubmissions.competencyId))
      .innerJoin(competencyDeployments, eq(competencyDeployments.competencyId, competencies.id))
      .where(
        and(
          eq(competencySubmissions.studentId, studentId),
          eq(competencyDeployments.id, assignmentRecord.deploymentId),
          eq(competencySubmissions.status, "SUBMITTED")
        )
      )
      .then((result) => result[0]?.count || 0)

    // Calculate new progress percentage
    const totalCompetencies = deploymentCompetencies.length
    const newProgress =
      totalCompetencies > 0 ? Math.round((submittedCompetencies / totalCompetencies) * 100) : 0

    // Determine new assignment status
    let newStatus = assignmentRecord.status
    if (newProgress === 100 && assignmentRecord.status === "IN_PROGRESS") {
      newStatus = "COMPLETED"
    } else if (newProgress > 0 && newProgress < 100 && assignmentRecord.status === "ASSIGNED") {
      newStatus = "IN_PROGRESS"
    }

    // Update the assignment if progress has changed
    const currentProgress = assignmentRecord.progress
      ? Number.parseFloat(assignmentRecord.progress)
      : 0
    if (newProgress !== currentProgress || newStatus !== assignmentRecord.status) {
      await db
        .update(competencyAssignments)
        .set({
          progressPercentage: newProgress.toString(),
          status: newStatus,
          updatedAt: new Date(),
        })
        .where(eq(competencyAssignments.id, assignmentRecord.id))

      console.log(
        `Updated assignment ${assignmentRecord.id} progress: ${currentProgress}% -> ${newProgress}%`
      )
    }
  } catch (error) {
    console.error("Error updating assignment progress:", error)
    // Don't throw - this is a background operation that shouldn't fail the main request
  }
}
