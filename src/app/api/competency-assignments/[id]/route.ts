import { eq } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "../../../../database/connection-pool"
import {
  competencies,
  competencyAssignments,
  competencyDeployments,
  users,
} from "../../../../database/schema"
import { getCurrentUser } from "../../../../lib/auth-clerk"
import { logAuditEvent } from "../../../../lib/rbac-middleware"
import { getSchoolContext } from "../../../../lib/school-utils"
import { cacheIntegrationService } from '@/lib/cache-integration'


// Validation schemas
const updateAssignmentSchema = z.object({
  status: z.enum(["ASSIGNED", "IN_PROGRESS", "COMPLETED", "OVERDUE"]).optional(),
  dueDate: z.string().optional(),
  progressPercentage: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
})

const _progressUpdateSchema = z.object({
  progressPercentage: z.number().min(0).max(100),
  notes: z.string().optional(),
  completedCompetencies: z.array(z.string().uuid()).optional(),
})

// GET /api/competency-assignments/[id] - Get assignment details
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      'api:competency-assignments/[id]/route.ts',
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
    console.warn('Cache error in competency-assignments/[id]/route.ts:', cacheError)
    // Continue with original logic if cache fails
  }
  
  async function executeOriginalLogic() {

  try {
    const context = await getSchoolContext()
    const user = await getCurrentUser()
    const { id } = await params

    // Get assignment with related data
    const [assignment] = await db
      .select({
        id: competencyAssignments.id,
        competencyId: competencyAssignments.competencyId,
        deploymentId: competencyAssignments.deploymentId,
        userId: competencyAssignments.userId,
        status: competencyAssignments.status,
        dueDate: competencyAssignments.dueDate,
        progressPercentage: competencyAssignments.progressPercentage,
        notes: competencyAssignments.notes,
        assignedBy: competencyAssignments.assignedBy,
        createdAt: competencyAssignments.createdAt,
        updatedAt: competencyAssignments.updatedAt,
        // Related deployment data
        deploymentStatus: competencyDeployments.status,
        deploymentType: competencyDeployments.deploymentType,
        // Related user data
        userName: users.name,
        userEmail: users.email,
      })
      .from(competencyAssignments)
      .leftJoin(
        competencyDeployments,
        eq(competencyAssignments.deploymentId, competencyDeployments.id)
      )
      .leftJoin(users, eq(competencyAssignments.userId, users.id))
      .where(eq(competencyAssignments.id, id))
      .limit(1)

    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 })
    }

    // Check permissions - users can view their own assignments, admins can view all
    const canView =
      ["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_SUPERVISOR"].includes(context.userRole) ||
      (user && assignment.userId === user.id)

    if (!canView) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Get the competency for this assignment
    const [competency] = await db
      .select({
        id: competencies.id,
        name: competencies.name,
        description: competencies.description,
        category: competencies.category,
        level: competencies.level,
        isRequired: competencies.isRequired,
      })
      .from(competencies)
      .where(eq(competencies.id, assignment.competencyId))
      .limit(1)

    return NextResponse.json({
      success: true,
      data: {
        ...assignment,
        competency: competency,
      },
    })
  } catch (error) {
    console.error("Error fetching competency assignment:", error)
    return NextResponse.json({ error: "Failed to fetch assignment" }, { status: 500 })
  }

  }
}

// PUT /api/competency-assignments/[id] - Update assignment
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getSchoolContext()
    const user = await getCurrentUser()
    const { id } = await params
    const body = await request.json()

    // Get existing assignment
    const [existingAssignment] = await db
      .select()
      .from(competencyAssignments)
      .where(eq(competencyAssignments.id, id))
      .limit(1)

    if (!existingAssignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 })
    }

    // Check permissions - users can update their own assignments, admins can update all
    const canUpdate =
      ["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_SUPERVISOR"].includes(context.userRole) ||
      (user && existingAssignment.userId === user.id)

    if (!canUpdate) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const validatedData = updateAssignmentSchema.parse(body)

    // Validate status transitions
    if (validatedData.status && validatedData.status !== existingAssignment.status) {
      const validTransitions: Record<string, string[]> = {
        ASSIGNED: ["IN_PROGRESS", "COMPLETED", "OVERDUE"],
        IN_PROGRESS: ["COMPLETED", "OVERDUE"],
        COMPLETED: [], // Cannot change from completed
        OVERDUE: ["IN_PROGRESS", "COMPLETED"], // Can resume overdue assignments
      }

      if (!validTransitions[existingAssignment.status]?.includes(validatedData.status)) {
        return NextResponse.json(
          {
            error: `Cannot change status from ${existingAssignment.status} to ${validatedData.status}`,
            validStatuses: validTransitions[existingAssignment.status] || [],
          },
          { status: 400 }
        )
      }
    }

    // Auto-complete if progress reaches 100%
    if (validatedData.progressPercentage === 100 && existingAssignment.status === "IN_PROGRESS") {
      validatedData.status = "COMPLETED"
    }

    // Update assignment
    const updateData = {
      ...validatedData,
      dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : undefined,
      progressPercentage:
        validatedData.progressPercentage !== undefined
          ? validatedData.progressPercentage.toString()
          : undefined,
      updatedAt: new Date(),
    }

    const [updatedAssignment] = await db
      .update(competencyAssignments)
      .set(updateData)
      .where(eq(competencyAssignments.id, id))
      .returning()

    // Log audit event
    await logAuditEvent({
      userId: user?.id || "unknown",
      action: "ASSIGNMENT_UPDATE",
      resource: "competency_assignments",
      resourceId: id,
      details: {
        previousStatus: existingAssignment.status,
        newStatus: updatedAssignment.status,
        previousProgress: existingAssignment.progressPercentage,
        newProgress: updatedAssignment.progressPercentage,
        changes: validatedData,
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedAssignment,
      message: "Assignment updated successfully",
    })
  } catch (error) {
    console.error("Error updating competency assignment:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      )
    }
    
    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateCompetencyCache()
    } catch (cacheError) {
      console.warn('Cache invalidation error in competency-assignments/[id]/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Failed to update assignment" }, { status: 500 })
  }
}

// DELETE /api/competency-assignments/[id] - Delete assignment
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getSchoolContext()
    const user = await getCurrentUser()
    const { id } = await params

    // Only admins and supervisors can delete assignments
    if (!["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_SUPERVISOR"].includes(context.userRole)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Get existing assignment
    const [existingAssignment] = await db
      .select()
      .from(competencyAssignments)
      .where(eq(competencyAssignments.id, id))
      .limit(1)

    if (!existingAssignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 })
    }

    // Prevent deletion of completed assignments (for audit trail)
    if (existingAssignment.status === "COMPLETED") {
      return NextResponse.json({ error: "Cannot delete completed assignments" }, { status: 400 })
    }

    // Delete assignment
    await db.delete(competencyAssignments).where(eq(competencyAssignments.id, id))

    // Log audit event
    await logAuditEvent({
      userId: user?.id || "unknown",
      action: "ASSIGNMENT_DELETE",
      resource: "competency_assignments",
      resourceId: id,
      details: {
        assignedUserId: existingAssignment.userId,
        deploymentId: existingAssignment.deploymentId,
        status: existingAssignment.status,
        progress: existingAssignment.progressPercentage,
      },
    })

    return NextResponse.json({
      success: true,
      message: "Assignment deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting competency assignment:", error)
    
    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateCompetencyCache()
    } catch (cacheError) {
      console.warn('Cache invalidation error in competency-assignments/[id]/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Failed to delete assignment" }, { status: 500 })
  }
}
