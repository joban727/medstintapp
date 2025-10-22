import { auth } from "@clerk/nextjs/server"
import { and, desc, eq, gte, lte, sql } from "drizzle-orm"
import { nanoid } from "nanoid"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "../../../database/connection-pool"
import {
  competencies,
  competencyAssignments,
  progressSnapshots,
  users,
} from "../../../database/schema"
import { cache, invalidateRelatedCaches } from "../../../lib/redis-cache"
import { cacheIntegrationService } from '@/lib/cache-integration'


// Validation schemas
const progressQuerySchema = z.object({
  userId: z.string().optional(),
  competencyId: z.string().optional(),
  assignmentId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(["ACTIVE", "COMPLETED", "OVERDUE"]).optional(),
  limit: z.string().transform(Number).optional().default(50),
  offset: z.string().transform(Number).optional().default(0),
})

const progressCreateSchema = z.object({
  userId: z.string(),
  competencyId: z.string(),
  assignmentId: z.string(),
  progressPercentage: z.number().min(0).max(100),
  status: z.enum(["ACTIVE", "COMPLETED", "OVERDUE"]).default("ACTIVE"),
  metadata: z.record(z.string(), z.any()).optional(),
})

const progressUpdateSchema = z.object({
  progressPercentage: z.number().min(0).max(100).optional(),
  status: z.enum(["ACTIVE", "COMPLETED", "OVERDUE"]).optional(),
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
  const isOwnData = userId === targetUserId

  return {
    canView: isAdmin || isSupervisor || isOwnData,
    canModify: isAdmin || isSupervisor,
    userRole,
    schoolId: user[0].schoolId,
  }
}

// GET /api/competency-progress - Get progress snapshots
export async function GET(request: NextRequest) {
  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      'api:competency-progress/route.ts',
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
    console.warn('Cache error in competency-progress/route.ts:', cacheError)
    // Continue with original logic if cache fails
  }
  
  async function executeOriginalLogic() {

  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = progressQuerySchema.parse(Object.fromEntries(searchParams))

    // Check permissions
    const permissions = await checkPermissions(userId, query.userId)
    if (!permissions.canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Try to get from cache first
    const _cacheParams = {
      userId: query.userId || (permissions.userRole === "STUDENT" ? userId : undefined),
      competencyId: query.competencyId,
      assignmentId: query.assignmentId,
      status: query.status,
      startDate: query.startDate,
      endDate: query.endDate,
      limit: query.limit,
      offset: query.offset,
    }

    const cachedProgress = await cache.getUserProgress(query.userId || userId, query.competencyId)
    if (cachedProgress) {
      return NextResponse.json(cachedProgress)
    }

    // Build query conditions
    const conditions = []

    if (query.userId) {
      conditions.push(eq(progressSnapshots.userId, query.userId))
    } else if (permissions.userRole === "STUDENT") {
      // Students can only see their own progress
      conditions.push(eq(progressSnapshots.userId, userId))
    } else if (permissions.schoolId && !permissions.userRole.includes("SUPER_ADMIN")) {
      // School-level filtering for non-super admins
      conditions.push(eq(users.schoolId, permissions.schoolId))
    }

    if (query.competencyId) {
      conditions.push(eq(progressSnapshots.competencyId, query.competencyId))
    }

    if (query.assignmentId) {
      conditions.push(eq(progressSnapshots.assignmentId, query.assignmentId))
    }

    if (query.status) {
      conditions.push(eq(progressSnapshots.status, query.status))
    }

    if (query.startDate) {
      conditions.push(gte(progressSnapshots.snapshotDate, new Date(query.startDate)))
    }

    if (query.endDate) {
      conditions.push(lte(progressSnapshots.snapshotDate, new Date(query.endDate)))
    }

    // Execute query with joins
    const results = await db
      .select({
        id: progressSnapshots.id,
        userId: progressSnapshots.userId,
        competencyId: progressSnapshots.competencyId,
        assignmentId: progressSnapshots.assignmentId,
        progressPercentage: progressSnapshots.progressPercentage,
        status: progressSnapshots.status,
        snapshotDate: progressSnapshots.snapshotDate,
        metadata: progressSnapshots.metadata,
        createdAt: progressSnapshots.createdAt,
        updatedAt: progressSnapshots.updatedAt,
        // User info
        userName: users.name,
        userEmail: users.email,
        // Competency info
        competencyName: competencies.name,
        competencyCategory: competencies.category,
        // Assignment info
        assignmentDueDate: competencyAssignments.dueDate,
        assignmentStatus: competencyAssignments.status,
      })
      .from(progressSnapshots)
      .leftJoin(users, eq(progressSnapshots.userId, users.id))
      .leftJoin(competencies, eq(progressSnapshots.competencyId, competencies.id))
      .leftJoin(competencyAssignments, eq(progressSnapshots.assignmentId, competencyAssignments.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(progressSnapshots.snapshotDate))
      .limit(query.limit)
      .offset(query.offset)

    // Get total count for pagination
    const totalCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(progressSnapshots)
      .leftJoin(users, eq(progressSnapshots.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)

    const responseData = {
      data: results,
      pagination: {
        total: totalCount[0]?.count || 0,
        limit: query.limit,
        offset: query.offset,
        hasMore: query.offset + query.limit < (totalCount[0]?.count || 0),
      },
    }

    // Cache the result
    await cache.setUserProgress(query.userId || userId, responseData, query.competencyId)

    return NextResponse.json(responseData)
  } catch (error) {
    console.error("Error fetching progress snapshots:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }

  }
}

// POST /api/competency-progress - Create progress snapshot
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const data = progressCreateSchema.parse(body)

    // Check permissions
    const permissions = await checkPermissions(userId, data.userId)
    if (!permissions.canModify) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Verify the assignment exists and belongs to the user
    const assignment = await db
      .select()
      .from(competencyAssignments)
      .where(
        and(
          eq(competencyAssignments.id, data.assignmentId),
          eq(competencyAssignments.userId, data.userId),
          eq(competencyAssignments.competencyId, data.competencyId)
        )
      )
      .limit(1)

    if (!assignment.length) {
      return NextResponse.json({ error: "Assignment not found or invalid" }, { status: 404 })
    }

    // Create progress snapshot
    const progressSnapshot = {
      id: nanoid(),
      ...data,
      progressPercentage: data.progressPercentage.toString(),
      metadata: data.metadata ? JSON.stringify(data.metadata) : undefined,
      snapshotDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = await db.insert(progressSnapshots).values(progressSnapshot).returning()

    // Log progress creation for monitoring
    console.log("Progress created:", {
      type: "progress_created",
      snapshot: result[0],
      userId: data.userId,
      competencyId: data.competencyId,
    })

    // Invalidate related caches
    await invalidateRelatedCaches({
      userId: data.userId,
      competencyId: data.competencyId,
    })

    return NextResponse.json({
      message: "Progress snapshot created successfully",
      data: result[0],
    })
  } catch (error) {
    console.error("Error creating progress snapshot:", error)
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
      console.warn('Cache invalidation error in competency-progress/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT /api/competency-progress - Bulk update progress snapshots
export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const updates = z
      .array(
        z.object({
          id: z.string(),
          ...progressUpdateSchema.shape,
        })
      )
      .parse(body)

    // Check permissions for each update
    const permissions = await checkPermissions(userId)
    if (!permissions.canModify) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const results = []

    for (const update of updates) {
      const { id, ...updateData } = update

      const result = await db
        .update(progressSnapshots)
        .set({
          ...updateData,
          progressPercentage:
            updateData.progressPercentage !== undefined
              ? updateData.progressPercentage.toString()
              : undefined,
          metadata: updateData.metadata ? JSON.stringify(updateData.metadata) : updateData.metadata,
          updatedAt: new Date(),
        })
        .where(eq(progressSnapshots.id, id))
        .returning()

      if (result.length > 0) {
        results.push(result[0])
      }
    }

    // Log bulk progress updates for monitoring
    if (results.length > 0) {
      console.log("Bulk progress updated:", {
        type: "progress_bulk_updated",
        snapshots: results,
        count: results.length,
      })

      // Invalidate related caches for all updated snapshots
      const uniqueUserIds = [...new Set(results.map((r) => r.userId))]
      const uniqueCompetencyIds = [...new Set(results.map((r) => r.competencyId))]

      for (const userId of uniqueUserIds) {
        for (const competencyId of uniqueCompetencyIds) {
          await invalidateRelatedCaches({
            userId,
            competencyId,
          })
        }
      }
    }

    return NextResponse.json({
      message: `Updated ${results.length} progress snapshots`,
      data: results,
    })
  } catch (error) {
    console.error("Error updating progress snapshots:", error)
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
      console.warn('Cache invalidation error in competency-progress/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
