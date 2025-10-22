import { and, eq, inArray } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "../../../../../database/connection-pool"
import {
  competencies,
  competencyAssignments,
  competencyDeployments,
  users,
} from "../../../../../database/schema"
import { getCurrentUser } from "../../../../../lib/auth-clerk"
import { logAuditEvent } from "../../../../../lib/rbac-middleware"
import { getSchoolContext } from "../../../../../lib/school-utils"
import { cacheIntegrationService } from '@/lib/cache-integration'


// Validation schemas
const actionSchema = z.object({
  action: z.enum(["ACTIVATE", "PAUSE", "RESUME", "ROLLBACK", "COMPLETE"]),
  reason: z.string().optional(),
  notifyUsers: z.boolean().default(true),
})

// POST /api/competency-deployments/[id]/actions - Execute deployment actions
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getSchoolContext()
    const user = await getCurrentUser()
    const { id } = await params
    const body = await request.json()

    // Only school admins can execute deployment actions
    if (!["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(context.userRole)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const validatedData = actionSchema.parse(body)

    // Get existing deployment
    const [existingDeployment] = await db
      .select()
      .from(competencyDeployments)
      .where(
        and(
          eq(competencyDeployments.id, id),
          eq(competencyDeployments.schoolId, context.schoolId || "")
        )
      )
      .limit(1)

    if (!existingDeployment) {
      return NextResponse.json({ error: "Deployment not found" }, { status: 404 })
    }

    // Validate action based on current status
    const validTransitions: Record<string, string[]> = {
      DRAFT: ["ACTIVATE"],
      SCHEDULED: ["ACTIVATE", "PAUSE"],
      ACTIVE: ["PAUSE", "COMPLETE", "ROLLBACK"],
      PAUSED: ["RESUME", "ROLLBACK"],
      COMPLETED: ["ROLLBACK"],
      ROLLED_BACK: ["ACTIVATE"],
      PENDING: ["ACTIVATE"],
      INACTIVE: ["ACTIVATE"],
      ARCHIVED: [],
    }

    if (!validTransitions[existingDeployment.status]?.includes(validatedData.action)) {
      return NextResponse.json(
        {
          error: `Cannot ${validatedData.action.toLowerCase()} deployment with status ${existingDeployment.status}`,
          validActions: validTransitions[existingDeployment.status] || [],
        },
        { status: 400 }
      )
    }

    let newStatus: "ACTIVE" | "PENDING" | "INACTIVE" | "ARCHIVED"
    const updateData: Partial<typeof competencyDeployments.$inferInsert> = {
      updatedAt: new Date(),
    }

    // Execute action-specific logic
    switch (validatedData.action) {
      case "ACTIVATE":
        newStatus = "ACTIVE"
        updateData.deployedAt = new Date()
        updateData.status = newStatus

        // Create assignments for deployment activation
        // Note: Auto-assignment logic can be added here based on deployment configuration
        // await createDeploymentAssignments(id, existingDeployment, context.schoolId || "")
        break

      case "PAUSE":
        newStatus = "INACTIVE"
        updateData.status = newStatus

        // Pause all active assignments (set to ASSIGNED status)
        await db
          .update(competencyAssignments)
          .set({ status: "ASSIGNED", updatedAt: new Date() })
          .where(
            and(
              eq(competencyAssignments.deploymentId, id),
              eq(competencyAssignments.status, "IN_PROGRESS")
            )
          )
        break

      case "RESUME":
        newStatus = "ACTIVE"
        updateData.status = newStatus

        // Resume paused assignments (set to IN_PROGRESS)
        await db
          .update(competencyAssignments)
          .set({ status: "IN_PROGRESS", updatedAt: new Date() })
          .where(
            and(
              eq(competencyAssignments.deploymentId, id),
              eq(competencyAssignments.status, "ASSIGNED")
            )
          )
        break

      case "ROLLBACK":
        // Check if rollback data exists
        if (!existingDeployment.rollbackData) {
          return NextResponse.json(
            { error: "Rollback not available for this deployment" },
            { status: 400 }
          )
        }

        newStatus = "INACTIVE"
        updateData.status = newStatus

        // Deactivate all assignments (set to OVERDUE status)
        await db
          .update(competencyAssignments)
          .set({ status: "OVERDUE", updatedAt: new Date() })
          .where(eq(competencyAssignments.deploymentId, id))

        // Mark competencies as inactive
        if (existingDeployment.competencyId) {
          await db
            .update(competencies)
            .set({ isDeployed: false, updatedAt: new Date() })
            .where(eq(competencies.id, existingDeployment.competencyId))
        }
        break

      case "COMPLETE":
        newStatus = "ARCHIVED"
        updateData.status = newStatus

        // Mark all assignments as completed
        await db
          .update(competencyAssignments)
          .set({ status: "COMPLETED", updatedAt: new Date() })
          .where(
            and(
              eq(competencyAssignments.deploymentId, id),
              inArray(competencyAssignments.status, ["IN_PROGRESS", "ASSIGNED"])
            )
          )
        break

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    // Update deployment
    const [updatedDeployment] = await db
      .update(competencyDeployments)
      .set(updateData)
      .where(eq(competencyDeployments.id, id))
      .returning()

    // Log audit event
    if (user) {
      await logAuditEvent({
        userId: user.id,
        action: `DEPLOYMENT_${validatedData.action}`,
        resource: "competency_deployments",
        resourceId: id,
        details: {
          deploymentId: existingDeployment.id,
          previousStatus: existingDeployment.status,
          newStatus,
          reason: validatedData.reason,
          notifyUsers: validatedData.notifyUsers,
        },
      })
    }

    // TODO: Send notifications if notifyUsers is true
    // This would integrate with your notification system

    return NextResponse.json({
      success: true,
      data: updatedDeployment,
      message: `Deployment ${validatedData.action.toLowerCase()}d successfully`,
    })
  } catch (error) {
    console.error("Error executing deployment action:", error)
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
      console.warn('Cache invalidation error in competency-deployments/[id]/actions/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Failed to execute deployment action" }, { status: 500 })
  }
}

// Helper function to create deployment assignments
async function _createDeploymentAssignments(
  deploymentId: string,
  deployment: {
    scope: string
    targetPrograms?: string
    targetUsers?: string
    competencyId?: string
  },
  schoolId: string
) {
  try {
    let targetUserIds: string[] = []

    // Determine target users based on deployment scope
    switch (deployment.scope) {
      case "SCHOOL_WIDE": {
        // Get all users in the school
        const schoolUsers = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.schoolId, schoolId))

        targetUserIds = schoolUsers.map((user) => user.id)
        break
      }

      case "PROGRAM_SPECIFIC":
        if (deployment.targetPrograms) {
          const _programIds = JSON.parse(deployment.targetPrograms)

          // Get users enrolled in target programs
          // This would require a user-program relationship table
          // For now, we'll use a placeholder implementation
          const programUsers = await db
            .select({ id: users.id })
            .from(users)
            .where(
              and(
                eq(users.schoolId, schoolId)
                // Add program filtering logic here
              )
            )

          targetUserIds = programUsers.map((user) => user.id)
        }
        break

      case "SELECTIVE":
        if (deployment.targetUsers) {
          targetUserIds = JSON.parse(deployment.targetUsers)
        }
        break
    }

    // Create assignments for target users
    if (targetUserIds.length > 0) {
      const assignments = targetUserIds.map((userId) => ({
        id: crypto.randomUUID(),
        deploymentId,
        userId,
        competencyId: deployment.competencyId || "", // Add competencyId from deployment
        schoolId,
        assignedBy: deploymentId, // Using deployment ID for system assignments
        assignmentType: "REQUIRED" as const, // Add required assignmentType
        status: "ASSIGNED" as const,
        dueDate: null,
      }))

      // Insert assignments in batches to avoid overwhelming the database
      const batchSize = 100
      for (let i = 0; i < assignments.length; i += batchSize) {
        const batch = assignments.slice(i, i + batchSize)
        await db.insert(competencyAssignments).values(batch)
      }
    }

    return targetUserIds.length
  } catch (error) {
    console.error("Error creating deployment assignments:", error)
    throw error
  }
}
