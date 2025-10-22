import { and, asc, count, desc, eq, ilike, inArray, type SQL } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "../../../database/connection-pool"
import { competencyAssignments, competencyDeployments, users } from "../../../database/schema"
import { getCurrentUser } from "../../../lib/auth-clerk"
import { logAuditEvent } from "../../../lib/rbac-middleware"
import { getSchoolContext } from "../../../lib/school-utils"

// Validation schemas
const createAssignmentSchema = z.object({
  deploymentId: z.string().uuid(),
  competencyId: z.string().uuid(),
  userId: z.string(),
  dueDate: z.string().datetime().optional(),
  notes: z.string().optional(),
})

const bulkAssignmentSchema = z.object({
  deploymentId: z.string().uuid(),
  userIds: z.array(z.string()).min(1).max(100),
  dueDate: z.string().datetime().optional(),
  notes: z.string().optional(),
})

const updateAssignmentSchema = z.object({
  status: z.enum(["ASSIGNED", "IN_PROGRESS", "COMPLETED", "OVERDUE"]).optional(),
  dueDate: z.string().datetime().optional(),
  notes: z.string().optional(),
  progressPercentage: z.number().min(0).max(100).optional(),
})

// GET /api/competency-assignments - List assignments with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const _context = await getSchoolContext()
    const { searchParams } = new URL(request.url)

    // Parse query parameters
    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Math.min(Number.parseInt(searchParams.get("limit") || "20"), 100)
    const offset = (page - 1) * limit

    const search = searchParams.get("search") || ""
    const status = searchParams.get("status")
    const deploymentId = searchParams.get("deploymentId")
    const userId = searchParams.get("userId")
    const sortBy = searchParams.get("sortBy") || "createdAt"
    const sortOrder = searchParams.get("sortOrder") || "desc"

    // Build where conditions
    const whereConditions: SQL[] = []

    if (status) {
      whereConditions.push(
        eq(
          competencyAssignments.status,
          status as "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "OVERDUE"
        )
      )
    }

    if (deploymentId) {
      whereConditions.push(eq(competencyAssignments.deploymentId, deploymentId))
    }

    if (userId) {
      whereConditions.push(eq(competencyAssignments.userId, userId))
    }

    // Build where conditions including search
    const finalWhereConditions = [...whereConditions]
    if (search) {
      finalWhereConditions.push(ilike(users.name, `%${search}%`))
    }

    // Build sorting
    const orderBy = sortOrder === "asc" ? asc : desc
    let orderByClause: SQL
    switch (sortBy) {
      case "userName":
        orderByClause = orderBy(users.name)
        break
      case "status":
        orderByClause = orderBy(competencyAssignments.status)
        break
      case "dueDate":
        orderByClause = orderBy(competencyAssignments.dueDate)
        break
      case "progressPercentage":
        orderByClause = orderBy(competencyAssignments.progressPercentage)
        break
      default:
        orderByClause = orderBy(competencyAssignments.createdAt)
        break
    }

    // Get assignments with related data
    const assignmentsQuery = db
      .select({
        id: competencyAssignments.id,
        userId: competencyAssignments.userId,
        competencyId: competencyAssignments.competencyId,
        deploymentId: competencyAssignments.deploymentId,
        programId: competencyAssignments.programId,
        assignedBy: competencyAssignments.assignedBy,
        assignmentType: competencyAssignments.assignmentType,
        status: competencyAssignments.status,
        dueDate: competencyAssignments.dueDate,
        completionDate: competencyAssignments.completionDate,
        progressPercentage: competencyAssignments.progressPercentage,
        notes: competencyAssignments.notes,
        createdAt: competencyAssignments.createdAt,
        updatedAt: competencyAssignments.updatedAt,
        // Related data
        deploymentStatus: competencyDeployments.status,
        userName: users.name,
        userEmail: users.email,
      })
      .from(competencyAssignments)
      .leftJoin(
        competencyDeployments,
        eq(competencyAssignments.deploymentId, competencyDeployments.id)
      )
      .leftJoin(users, eq(competencyAssignments.userId, users.id))
      .where(and(...finalWhereConditions))
      .orderBy(orderByClause)

    // Get paginated results
    const assignments = await assignmentsQuery.limit(limit).offset(offset)

    // Get total count
    const [{ total }] = await db
      .select({ total: count() })
      .from(competencyAssignments)
      .leftJoin(users, eq(competencyAssignments.userId, users.id))
      .where(and(...finalWhereConditions))

    return NextResponse.json({
      success: true,
      data: assignments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Error fetching competency assignments:", error)
    return NextResponse.json({ error: "Failed to fetch assignments" }, { status: 500 })
  }
}

// POST /api/competency-assignments - Create new assignment or bulk assignments
export async function POST(request: NextRequest) {
  try {
    const context = await getSchoolContext()
    const user = await getCurrentUser()
    const body = await request.json()

    // Only admins and supervisors can create assignments
    if (!["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_SUPERVISOR"].includes(context.userRole)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Check if this is a bulk assignment
    const isBulk = Array.isArray(body.userIds)
    const validatedData = isBulk
      ? bulkAssignmentSchema.parse(body)
      : createAssignmentSchema.parse(body)

    // Verify deployment exists and is active
    const [deployment] = await db
      .select()
      .from(competencyDeployments)
      .where(
        and(
          eq(competencyDeployments.id, validatedData.deploymentId),
          eq(competencyDeployments.schoolId, context.schoolId || "")
        )
      )
      .limit(1)

    if (!deployment) {
      return NextResponse.json({ error: "Deployment not found" }, { status: 404 })
    }

    if (deployment.status !== "ACTIVE") {
      return NextResponse.json({ error: "Cannot assign from inactive deployment" }, { status: 400 })
    }

    if (!deployment.competencyId) {
      return NextResponse.json(
        { error: "Deployment does not have an associated competency" },
        { status: 400 }
      )
    }

    let createdAssignments: Array<typeof competencyAssignments.$inferInsert> = []

    if (isBulk) {
      // Handle bulk assignment
      const bulkData = validatedData as z.infer<typeof bulkAssignmentSchema>

      // Check for existing assignments
      const existingAssignments = await db
        .select({ userId: competencyAssignments.userId })
        .from(competencyAssignments)
        .where(
          and(
            eq(competencyAssignments.deploymentId, bulkData.deploymentId),
            inArray(competencyAssignments.userId, bulkData.userIds)
          )
        )

      const existingUserIds = existingAssignments.map((a) => a.userId)
      const newUserIds = bulkData.userIds.filter((id) => !existingUserIds.includes(id))

      if (newUserIds.length === 0) {
        return NextResponse.json(
          { error: "All users already have assignments for this deployment" },
          { status: 400 }
        )
      }

      // Create assignments for new users
      const assignmentsToCreate = newUserIds.map((userId) => ({
        id: crypto.randomUUID(),
        userId,
        competencyId: deployment.competencyId || "",
        deploymentId: bulkData.deploymentId,
        assignedBy: user?.id || "unknown",
        assignmentType: "REQUIRED" as const,
        status: "ASSIGNED" as const,
        dueDate: bulkData.dueDate ? new Date(bulkData.dueDate) : null,
        completionDate: null,
        progressPercentage: "0.0",
        notes: bulkData.notes,
        createdAt: new Date(),
        updatedAt: new Date(),
      }))

      createdAssignments = await db
        .insert(competencyAssignments)
        .values(assignmentsToCreate)
        .returning()

      // Log audit event
      await logAuditEvent({
        userId: user?.id || "unknown",
        action: "BULK_ASSIGNMENT_CREATE",
        resource: "competency_assignments",
        resourceId: bulkData.deploymentId,
        details: {
          deploymentId: deployment.id,
          assignedUserCount: newUserIds.length,
          skippedUserCount: existingUserIds.length,
        },
      })

      return NextResponse.json({
        success: true,
        data: createdAssignments,
        message: `Created ${newUserIds.length} assignments. ${existingUserIds.length} users already assigned.`,
      })
    }
    // Handle single assignment
    const singleData = validatedData as z.infer<typeof createAssignmentSchema>

    // Check for existing assignment
    const [existingAssignment] = await db
      .select()
      .from(competencyAssignments)
      .where(
        and(
          eq(competencyAssignments.deploymentId, singleData.deploymentId),
          eq(competencyAssignments.userId, singleData.userId)
        )
      )
      .limit(1)

    if (existingAssignment) {
      return NextResponse.json(
        { error: "User already has an assignment for this deployment" },
        { status: 400 }
      )
    }

    // Create single assignment
    const assignmentData = {
      id: crypto.randomUUID(),
      userId: singleData.userId,
      competencyId: singleData.competencyId,
      deploymentId: singleData.deploymentId || null,
      programId: null,
      assignedBy: user?.id || "unknown",
      assignmentType: "REQUIRED" as const,
      status: "ASSIGNED" as const,
      dueDate: singleData.dueDate ? new Date(singleData.dueDate) : null,
      completionDate: null,
      progressPercentage: "0",
      notes: singleData.notes || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const [createdAssignment] = await db
      .insert(competencyAssignments)
      .values(assignmentData)
      .returning()

    // Log audit event
    await logAuditEvent({
      userId: user?.id || "unknown",
      action: "ASSIGNMENT_CREATE",
      resource: "competency_assignments",
      resourceId: createdAssignment.id,
      details: {
        deploymentId: deployment.id,
        assignedUserId: singleData.userId,
      },
    })

    return NextResponse.json({
      success: true,
      data: createdAssignment,
      message: "Assignment created successfully",
    })
  } catch (error) {
    console.error("Error creating competency assignment:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: "Failed to create assignment" }, { status: 500 })
  }
}

// PUT /api/competency-assignments - Bulk update assignments
export async function PUT(request: NextRequest) {
  try {
    const context = await getSchoolContext()
    const user = await getCurrentUser()
    const body = await request.json()

    // Only admins and supervisors can update assignments
    if (!["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_SUPERVISOR"].includes(context.userRole)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { assignmentIds, updates } = z
      .object({
        assignmentIds: z.array(z.string().uuid()).min(1).max(50),
        updates: updateAssignmentSchema,
      })
      .parse(body)

    // Verify assignments exist and belong to school
    const existingAssignments = await db
      .select()
      .from(competencyAssignments)
      .where(inArray(competencyAssignments.id, assignmentIds))

    if (existingAssignments.length !== assignmentIds.length) {
      return NextResponse.json(
        { error: "Some assignments not found or not accessible" },
        { status: 404 }
      )
    }

    // Update assignments
    const updateData = {
      ...updates,
      dueDate: updates.dueDate ? new Date(updates.dueDate) : undefined,
      progressPercentage:
        updates.progressPercentage !== undefined
          ? updates.progressPercentage.toString()
          : undefined,
      updatedAt: new Date(),
    }

    const updatedAssignments = await db
      .update(competencyAssignments)
      .set(updateData)
      .where(inArray(competencyAssignments.id, assignmentIds))
      .returning()

    // Log audit event
    await logAuditEvent({
      userId: user?.id || "unknown",
      action: "BULK_ASSIGNMENT_UPDATE",
      resource: "competency_assignments",
      resourceId: assignmentIds.join(","),
      details: {
        assignmentCount: assignmentIds.length,
        updates,
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedAssignments,
      message: `Updated ${updatedAssignments.length} assignments successfully`,
    })
  } catch (error) {
    console.error("Error updating competency assignments:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: "Failed to update assignments" }, { status: 500 })
  }
}
