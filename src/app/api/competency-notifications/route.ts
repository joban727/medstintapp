import { auth } from "@clerk/nextjs/server"
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm"
import { nanoid } from "nanoid"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "../../../database/connection-pool"
import {
  competencies,
  competencyAssignments,
  notificationQueue,
  users,
} from "../../../database/schema"
import { cacheIntegrationService } from '@/lib/cache-integration'


// Validation schemas
const notificationQuerySchema = z.object({
  userId: z.string().optional(),
  type: z
    .enum([
      "ASSIGNMENT_DUE",
      "ASSESSMENT_SUBMITTED",
      "ASSESSMENT_APPROVED",
      "ASSESSMENT_REJECTED",
      "PROGRESS_MILESTONE",
      "SYSTEM_ALERT",
    ])
    .optional(),
  status: z.enum(["PENDING", "SENT", "FAILED", "READ"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.string().transform(Number).optional().default(50),
  offset: z.string().transform(Number).optional().default(0),
})

const notificationCreateSchema = z.object({
  userId: z.string(),
  type: z.enum([
    "ASSIGNMENT_DUE",
    "ASSESSMENT_SUBMITTED",
    "ASSESSMENT_APPROVED",
    "ASSESSMENT_REJECTED",
    "PROGRESS_MILESTONE",
    "SYSTEM_ALERT",
  ]),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  scheduledFor: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  channels: z.array(z.enum(["EMAIL", "SMS", "IN_APP", "PUSH"])).default(["IN_APP"]),
})

const bulkNotificationSchema = z.object({
  userIds: z.array(z.string()),
  type: z.enum([
    "ASSIGNMENT_DUE",
    "ASSESSMENT_SUBMITTED",
    "ASSESSMENT_APPROVED",
    "ASSESSMENT_REJECTED",
    "PROGRESS_MILESTONE",
    "SYSTEM_ALERT",
  ]),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  scheduledFor: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  channels: z.array(z.enum(["EMAIL", "SMS", "IN_APP", "PUSH"])).default(["IN_APP"]),
})

const notificationUpdateSchema = z.object({
  status: z.enum(["PENDING", "SENT", "FAILED", "READ"]).optional(),
  readAt: z.string().optional(),
  sentAt: z.string().optional(),
  failureReason: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
})

// Helper function to check permissions
async function checkPermissions(userId: string, targetUserId?: string) {
  const { userId: clerkUserId } = await auth()
  if (!clerkUserId) {
    throw new Error("Unauthorized")
  }

  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1)

  if (!user.length) {
    throw new Error("User not found")
  }

  const userRole = user[0].role
  const isAdmin = ["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(userRole)
  const isSupervisor = ["CLINICAL_SUPERVISOR", "CLINICAL_PRECEPTOR"].includes(userRole)
  const isStudent = userRole === "STUDENT"
  const isOwnData = userId === targetUserId

  return {
    canView: isAdmin || isSupervisor || (isStudent && isOwnData),
    canCreate: isAdmin || isSupervisor,
    canModify: isAdmin || isSupervisor,
    canDelete: isAdmin,
    userRole,
    schoolId: user[0].schoolId,
  }
}

// Helper function to generate automatic notifications
async function _generateAutomaticNotifications() {
  const now = new Date()
  const _tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)

  // Find assignments due soon
  const dueSoonAssignments = await db
    .select({
      id: competencyAssignments.id,
      userId: competencyAssignments.userId,
      competencyId: competencyAssignments.competencyId,
      dueDate: competencyAssignments.dueDate,
      competencyName: competencies.name,
      userName: users.name,
      userEmail: users.email,
    })
    .from(competencyAssignments)
    .leftJoin(competencies, eq(competencyAssignments.competencyId, competencies.id))
    .leftJoin(users, eq(competencyAssignments.userId, users.id))
    .where(
      and(
        eq(competencyAssignments.status, "ASSIGNED"),
        gte(competencyAssignments.dueDate, now),
        lte(competencyAssignments.dueDate, threeDaysFromNow)
      )
    )

  const notifications = []

  for (const assignment of dueSoonAssignments) {
    if (!assignment.dueDate) continue

    const daysUntilDue = Math.ceil(
      (assignment.dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
    )

    let priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT" = "MEDIUM"
    let title = ""
    let message = ""

    if (daysUntilDue <= 1) {
      priority = "URGENT"
      title = "Competency Assignment Due Tomorrow"
      message = `Your competency assignment "${assignment.competencyName}" is due tomorrow. Please complete it as soon as possible.`
    } else if (daysUntilDue <= 3) {
      priority = "HIGH"
      title = "Competency Assignment Due Soon"
      message = `Your competency assignment "${assignment.competencyName}" is due in ${daysUntilDue} days. Please plan to complete it soon.`
    }

    if (title && message) {
      notifications.push({
        id: nanoid(),
        userId: assignment.userId,
        type: "ASSIGNMENT_DUE" as const,
        title,
        message,
        priority,
        status: "PENDING" as const,
        channels: ["EMAIL", "IN_APP"],
        scheduledFor: now,
        metadata: {
          assignmentId: assignment.id,
          competencyId: assignment.competencyId,
          dueDate: assignment.dueDate,
          daysUntilDue,
        },
        createdAt: now,
        updatedAt: now,
      })
    }
  }

  return notifications
}

// GET /api/competency-notifications - Get notifications
export async function GET(request: NextRequest) {
  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      'api:competency-notifications/route.ts',
      async () => {
        // Original function logic will be wrapped here
        return await executeOriginalLogic()
      },
      300 // 5 minutes TTL
    )
    
    if (cached) {
      return cached
    }
  } catch (cacheError) {
    console.warn('Cache error in competency-notifications/route.ts:', cacheError)
    // Continue with original logic if cache fails
  }
  
  async function executeOriginalLogic() {

  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = notificationQuerySchema.parse(Object.fromEntries(searchParams.entries()))

    // Check permissions
    const permissions = await checkPermissions(userId, query.userId)
    if (!permissions.canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Build query conditions
    const conditions = []

    if (query.userId) {
      conditions.push(eq(notificationQueue.userId, query.userId))
    } else if (permissions.userRole === "STUDENT") {
      // Students can only see their own notifications
      conditions.push(eq(notificationQueue.userId, userId))
    } else if (permissions.schoolId && !permissions.userRole.includes("SUPER_ADMIN")) {
      // School-level filtering for non-super admins
      conditions.push(eq(users.schoolId, permissions.schoolId))
    }

    if (query.type) {
      conditions.push(eq(notificationQueue.notificationType, query.type))
    }

    if (query.status) {
      conditions.push(eq(notificationQueue.status, query.status))
    }

    if (query.priority) {
      conditions.push(eq(notificationQueue.priority, query.priority))
    }

    if (query.startDate) {
      conditions.push(gte(notificationQueue.createdAt, new Date(query.startDate)))
    }

    if (query.endDate) {
      conditions.push(lte(notificationQueue.createdAt, new Date(query.endDate)))
    }

    // Execute query with joins
    const results = await db
      .select({
        id: notificationQueue.id,
        userId: notificationQueue.userId,
        type: notificationQueue.notificationType,
        title: notificationQueue.title,
        message: notificationQueue.message,
        priority: notificationQueue.priority,
        status: notificationQueue.status,
        // channels: notificationQueue.channels, // Field doesn't exist in schema
        scheduledFor: notificationQueue.scheduledFor,
        sentAt: notificationQueue.sentAt,
        readAt: notificationQueue.readAt,
        // failureReason: notificationQueue.failureReason, // Field doesn't exist in schema
        metadata: notificationQueue.metadata,
        createdAt: notificationQueue.createdAt,
        updatedAt: notificationQueue.updatedAt,
        // User info
        userName: users.name,
        userEmail: users.email,
      })
      .from(notificationQueue)
      .leftJoin(users, eq(notificationQueue.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(notificationQueue.createdAt))
      .limit(query.limit)
      .offset(query.offset)

    // Get total count for pagination
    const totalCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(notificationQueue)
      .leftJoin(users, eq(notificationQueue.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)

    // Get unread count for the user
    const unreadCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(notificationQueue)
      .where(
        and(
          eq(notificationQueue.userId, query.userId || userId),
          eq(notificationQueue.status, "SENT"),
          sql`${notificationQueue.readAt} IS NULL`
        )
      )

    return NextResponse.json({
      data: results,
      pagination: {
        total: totalCount[0]?.count || 0,
        limit: query.limit,
        offset: query.offset,
        hasMore: query.offset + query.limit < (totalCount[0]?.count || 0),
      },
      unreadCount: unreadCount[0]?.count || 0,
    })
  } catch (error) {
    console.error("Error fetching notifications:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }

  }
}

// POST /api/competency-notifications - Create notification(s)
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()

    // Check if it's a bulk notification request
    const isBulk = Array.isArray(body.userIds)

    if (isBulk) {
      const data = bulkNotificationSchema.parse(body)

      // Check permissions
      const permissions = await checkPermissions(userId)
      if (!permissions.canCreate) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      // Create notifications for all users
      const notifications = data.userIds.map((targetUserId) => ({
        id: nanoid(),
        userId: targetUserId,
        notificationType: data.type,
        title: data.title,
        message: data.message,
        priority: data.priority,
        status: "PENDING" as const,
        scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : new Date(),
        metadata: JSON.stringify(data.metadata || {}),
        createdAt: new Date(),
        updatedAt: new Date(),
      }))

      const results = await db.insert(notificationQueue).values(notifications).returning()

      // Log bulk notification creation for monitoring
      console.log(`Created ${results.length} bulk notifications for users:`, data.userIds)

      return NextResponse.json({
        message: `Created ${results.length} notifications`,
        data: results,
      })
    }
    const data = notificationCreateSchema.parse(body)

    // Check permissions
    const permissions = await checkPermissions(userId, data.userId)
    if (!permissions.canCreate) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Create single notification
    const notification = {
      id: nanoid(),
      userId: data.userId,
      notificationType: data.type,
      title: data.title,
      message: data.message,
      priority: data.priority,
      status: "PENDING" as const,
      scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : new Date(),
      metadata: JSON.stringify(data.metadata || {}),
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = await db.insert(notificationQueue).values(notification).returning()

    // Log single notification creation for monitoring
    console.log(`Created notification for user ${data.userId}:`, {
      id: result[0].id,
      type: data.type,
      title: data.title
    })

    return NextResponse.json({
      message: "Notification created successfully",
      data: result[0],
    })
  } catch (error) {
    console.error("Error creating notification:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      )
    }
    
    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateCompetencyCache()
    } catch (cacheError) {
      console.warn('Cache invalidation error in competency-notifications/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT /api/competency-notifications - Update notification status
export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { notificationIds, ...updateData } = z
      .object({
        notificationIds: z.array(z.string()),
        ...notificationUpdateSchema.shape,
      })
      .parse(body)

    // Check permissions
    const permissions = await checkPermissions(userId)
    if (!permissions.canModify && updateData.status !== "READ") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // For students, only allow marking as read and only their own notifications
    const conditions = [inArray(notificationQueue.id, notificationIds)]
    if (permissions.userRole === "STUDENT") {
      conditions.push(eq(notificationQueue.userId, userId))
      if (updateData.status && updateData.status !== "READ") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    // Prepare update data (exclude fields that need special handling)
    const { metadata, readAt, sentAt, ...restUpdateData } = updateData
    const updates: Partial<typeof notificationQueue.$inferInsert> = {
      ...restUpdateData,
      updatedAt: new Date(),
    }

    // Handle metadata field - ensure it's stringified if it exists
    if (metadata) {
      updates.metadata = typeof metadata === "object" ? JSON.stringify(metadata) : metadata
    }

    // Handle date fields
    if (readAt) {
      updates.readAt = new Date(readAt)
    }
    if (sentAt) {
      updates.sentAt = new Date(sentAt)
    }

    if (updateData.sentAt) {
      updates.sentAt = new Date(updateData.sentAt)
    }

    // If marking as read, set readAt timestamp
    if (updateData.status === "READ" && !updateData.readAt) {
      updates.readAt = new Date()
    }

    const results = await db
      .update(notificationQueue)
      .set(updates)
      .where(and(...conditions))
      .returning()

    // Log notification status updates for monitoring
    if (results.length > 0) {
      console.log(`Updated ${results.length} notifications status to:`, updateData.status)
    }

    return NextResponse.json({
      message: `Updated ${results.length} notifications`,
      data: results,
    })
  } catch (error) {
    console.error("Error updating notifications:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      )
    }
    
    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateCompetencyCache()
    } catch (cacheError) {
      console.warn('Cache invalidation error in competency-notifications/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/competency-notifications - Delete notifications
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check permissions - only admins can delete notifications
    const permissions = await checkPermissions(userId)
    if (!permissions.canDelete) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const notificationIds = searchParams.get("ids")?.split(",") || []
    const daysOld = Number.parseInt(searchParams.get("daysOld") || "0")

    const conditions = []

    if (notificationIds.length > 0) {
      conditions.push(inArray(notificationQueue.id, notificationIds))
    }

    if (daysOld > 0) {
      const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000)
      conditions.push(lte(notificationQueue.createdAt, cutoffDate))
    }

    if (conditions.length === 0) {
      return NextResponse.json({ error: "No deletion criteria specified" }, { status: 400 })
    }

    const result = await db
      .delete(notificationQueue)
      .where(and(...conditions))
      .returning({ id: notificationQueue.id })

    return NextResponse.json({
      message: `Deleted ${result.length} notifications`,
      deletedCount: result.length,
    })
  } catch (error) {
    console.error("Error deleting notifications:", error)
    
    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateCompetencyCache()
    } catch (cacheError) {
      console.warn('Cache invalidation error in competency-notifications/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
