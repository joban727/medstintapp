import { and, count, eq } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { db } from "../../../../database/connection-pool"
import {
  competencyAssignments,
  competencyDeployments,
  competencyTemplates,
} from "../../../../database/schema"
import { getCurrentUser } from "../../../../lib/auth-clerk"
import { logAuditEvent } from "../../../../lib/rbac-middleware"
import { getSchoolContext } from "../../../../lib/school-utils"
import { cacheIntegrationService } from '@/lib/cache-integration'


// GET /api/competency-deployments/[id] - Get single deployment with details
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  async function executeOriginalLogic() {
    try {
      const context = await getSchoolContext()
      const { id } = await params

      // Only school admins can access deployments
      if (!["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(context.userRole)) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
      }

      // Get deployment with template details
      const [deploymentData] = await db
        .select({
          deployment: competencyDeployments,
          template: competencyTemplates,
        })
        .from(competencyDeployments)
        .leftJoin(competencyTemplates, eq(competencyDeployments.templateId, competencyTemplates.id))
        .where(
          and(
            eq(competencyDeployments.id, id),
            eq(competencyDeployments.schoolId, context.schoolId || "")
          )
        )
        .limit(1)

      if (!deploymentData) {
        return NextResponse.json({ error: "Deployment not found" }, { status: 404 })
      }

      const { deployment, template } = deploymentData

      // Get deployment statistics
      const [assignmentStats] = await db
        .select({
          totalAssignments: count(competencyAssignments.id),
        })
        .from(competencyAssignments)
        .where(eq(competencyAssignments.deploymentId, id))

      const [competencyStats] = await db
        .select({
          totalCompetencies: count(competencyAssignments.competencyId),
        })
        .from(competencyAssignments)
        .where(eq(competencyAssignments.deploymentId, id))

      return NextResponse.json({
        success: true,
        data: {
          ...deployment,
          targetPrograms: deployment.targetPrograms ? JSON.parse(deployment.targetPrograms) : [],
          targetUsers: deployment.targetUsers ? JSON.parse(deployment.targetUsers) : [],
          template: template
            ? {
                ...template,
                metadata: template.metadata ? JSON.parse(template.metadata) : {},
              }
            : null,
          stats: {
            assignments: assignmentStats?.totalAssignments || 0,
            competencies: competencyStats?.totalCompetencies || 0,
          },
        },
      })
    } catch (error) {
      console.error("Error fetching deployment:", error)
      return NextResponse.json({ error: "Failed to fetch deployment" }, { status: 500 })
    }
  }

  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      'api:competency-deployments/[id]/route.ts',
      executeOriginalLogic,
      300 // 5 minutes TTL
    )
    
    if (cached) {
      return cached
    }
  } catch (cacheError) {
    console.warn('Cache error in competency-deployments/[id]/route.ts:', cacheError)
    // Continue with original logic if cache fails
  }
  
  // If cache fails or returns null, execute original logic
  return await executeOriginalLogic()
}

// DELETE /api/competency-deployments/[id] - Delete deployment
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getSchoolContext()
    const user = await getCurrentUser()
    const { id } = await params

    // Only school admins can delete deployments
    if (!["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(context.userRole)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

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

    // Check if deployment can be deleted (only draft or scheduled deployments)
    if (["ACTIVE", "COMPLETED"].includes(existingDeployment.status)) {
      return NextResponse.json(
        { error: "Cannot delete active or completed deployments. Use rollback instead." },
        { status: 400 }
      )
    }

    // Delete associated assignments first
    await db.delete(competencyAssignments).where(eq(competencyAssignments.deploymentId, id))

    // Delete deployment
    await db.delete(competencyDeployments).where(eq(competencyDeployments.id, id))

    // Log audit event
    if (user) {
      await logAuditEvent({
        userId: user.id,
        action: "DELETE_DEPLOYMENT",
        resource: "competency_deployments",
        resourceId: id,
        details: {
          deploymentId: existingDeployment.id,
          deploymentType: existingDeployment.deploymentType,
          status: existingDeployment.status,
        },
      })
    }

    return NextResponse.json({
      success: true,
      message: "Deployment deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting deployment:", error)
    
    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateCompetencyCache()
    } catch (cacheError) {
      console.warn('Cache invalidation error in competency-deployments/[id]/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Failed to delete deployment" }, { status: 500 })
  }
}
