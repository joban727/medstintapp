import { and, count, desc, eq, inArray } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "../../../database/connection-pool"
import {
  competencyAssignments,
  competencyDeployments,
  competencyTemplates,
  programs,
} from "../../../database/schema"
import { getCurrentUser } from "../../../lib/auth-clerk"
import { logAuditEvent } from "../../../lib/rbac-middleware"
import { getSchoolContext } from "../../../lib/school-utils"
import { cacheIntegrationService } from '@/lib/cache-integration'


// Validation schemas
const createDeploymentSchema = z.object({
  templateId: z.string().min(1, "Template ID is required"),
  name: z.string().min(1, "Deployment name is required"),
  description: z.string().optional(),
  scope: z.enum(["SCHOOL_WIDE", "PROGRAM_SPECIFIC", "SELECTIVE"]),
  targetPrograms: z.array(z.string()).optional(),
  targetUsers: z.array(z.string()).optional(),
  scheduledDate: z.string().datetime().optional(),
  autoAssign: z.boolean().default(true),
  notifyUsers: z.boolean().default(true),
  rollbackEnabled: z.boolean().default(true),
})

const updateDeploymentSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(["DRAFT", "SCHEDULED", "ACTIVE", "PAUSED", "COMPLETED", "ROLLED_BACK"]).optional(),
  scheduledDate: z.string().datetime().optional(),
  autoAssign: z.boolean().optional(),
  notifyUsers: z.boolean().optional(),
  rollbackEnabled: z.boolean().optional(),
})

// GET /api/competency-deployments - Get deployments with filtering
export async function GET(request: NextRequest) {
  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      'api:competency-deployments/route.ts',
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
    console.warn('Cache error in competency-deployments/route.ts:', cacheError)
    // Continue with original logic if cache fails
  }
  
  async function executeOriginalLogic() {

  try {
    const context = await getSchoolContext()
    const { searchParams } = new URL(request.url)

    // Only school admins can access deployments
    if (!["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(context.userRole)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const status = searchParams.get("status")
    const _scope = searchParams.get("scope")
    const templateId = searchParams.get("templateId")
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const offset = Number.parseInt(searchParams.get("offset") || "0")
    const includeStats = searchParams.get("includeStats") === "true"

    // Build query conditions
    const conditions = [eq(competencyDeployments.schoolId, context.schoolId || "")]

    if (status) {
      conditions.push(
        eq(competencyDeployments.status, status as "PENDING" | "ACTIVE" | "INACTIVE" | "ARCHIVED")
      )
    }

    // Note: scope filtering removed as competencyDeployments table doesn't have a scope field

    if (templateId) {
      conditions.push(eq(competencyDeployments.templateId, templateId))
    }

    // Execute main query with template details
    const deployments = await db
      .select({
        deployment: competencyDeployments,
        template: {
          id: competencyTemplates.id,
          name: competencyTemplates.name,
          type: competencyTemplates.type,
          category: competencyTemplates.category,
          level: competencyTemplates.level,
        },
      })
      .from(competencyDeployments)
      .leftJoin(competencyTemplates, eq(competencyDeployments.templateId, competencyTemplates.id))
      .where(and(...conditions))
      .orderBy(desc(competencyDeployments.createdAt))
      .limit(limit)
      .offset(offset)

    // Include statistics if requested
    let deploymentsWithStats = deployments
    if (includeStats) {
      deploymentsWithStats = await Promise.all(
        deployments.map(async ({ deployment, template }) => {
          const [assignmentCount] = await db
            .select({
              total: count(competencyAssignments.id),
            })
            .from(competencyAssignments)
            .where(eq(competencyAssignments.deploymentId, deployment.id))

          const [competencyCount] = await db
            .select({
              total: count(),
            })
            .from(competencyAssignments)
            .where(eq(competencyAssignments.deploymentId, deployment.id))

          return {
            deployment: {
              ...deployment,
              targetPrograms: deployment.targetPrograms
                ? JSON.parse(deployment.targetPrograms)
                : [],
              targetUsers: deployment.targetUsers ? JSON.parse(deployment.targetUsers) : [],
            },
            template,
            stats: {
              assignments: assignmentCount?.total || 0,
              competencies: competencyCount?.total || 0,
            },
          }
        })
      )
    } else {
      deploymentsWithStats = deployments.map(({ deployment, template }) => ({
        deployment: {
          ...deployment,
          targetPrograms: deployment.targetPrograms ? JSON.parse(deployment.targetPrograms) : [],
          targetUsers: deployment.targetUsers ? JSON.parse(deployment.targetUsers) : [],
        },
        template,
      }))
    }

    return NextResponse.json({
      success: true,
      data: deploymentsWithStats,
      pagination: {
        limit,
        offset,
        total: deployments.length,
      },
    })
  } catch (error) {
    console.error("Error fetching deployments:", error)
    return NextResponse.json({ error: "Failed to fetch deployments" }, { status: 500 })
  }

  }
}

// POST /api/competency-deployments - Create new deployment
export async function POST(request: NextRequest) {
  try {
    const context = await getSchoolContext()
    const user = await getCurrentUser()

    // Only school admins can create deployments
    if (!["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(context.userRole)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createDeploymentSchema.parse(body)

    // Verify template exists and is accessible
    const [template] = await db
      .select()
      .from(competencyTemplates)
      .where(eq(competencyTemplates.id, validatedData.templateId))
      .limit(1)

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 })
    }

    // School admins can only deploy templates they have access to
    if (context.userRole === "SCHOOL_ADMIN") {
      if (template.source === "CUSTOM" && template.createdBy !== context.userId) {
        return NextResponse.json({ error: "Access denied to template" }, { status: 403 })
      }
    }

    // Validate target programs if scope is program-specific
    if (validatedData.scope === "PROGRAM_SPECIFIC" && validatedData.targetPrograms) {
      const programCount = await db
        .select({ count: count(programs.id) })
        .from(programs)
        .where(
          and(
            inArray(programs.id, validatedData.targetPrograms),
            eq(programs.schoolId, context.schoolId || "")
          )
        )

      if (programCount[0].count !== validatedData.targetPrograms.length) {
        return NextResponse.json(
          { error: "Some target programs are invalid or not accessible" },
          { status: 400 }
        )
      }
    }

    // Create deployment
    const deploymentId = crypto.randomUUID()

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const [newDeployment] = await db
      .insert(competencyDeployments)
      .values({
        id: deploymentId,
        templateId: validatedData.templateId,
        schoolId: context.schoolId || "",
        deploymentType: "TEMPLATE_IMPORT",
        targetPrograms: validatedData.targetPrograms
          ? JSON.stringify(validatedData.targetPrograms)
          : null,
        targetUsers: validatedData.targetUsers ? JSON.stringify(validatedData.targetUsers) : null,
        status: validatedData.scheduledDate ? "PENDING" : "PENDING",
        effectiveDate: validatedData.scheduledDate ? new Date(validatedData.scheduledDate) : null,
        deployedBy: user.id,
        notes: validatedData.description || null,
      })
      .returning()

    // If auto-assign is enabled and deployment is active, create assignments
    if (validatedData.autoAssign && !validatedData.scheduledDate) {
      await createDeploymentAssignments(deploymentId, validatedData, context.schoolId || "")

      // Update deployment status to active
      await db
        .update(competencyDeployments)
        .set({
          status: "ACTIVE",
          deployedAt: new Date(),
        })
        .where(eq(competencyDeployments.id, deploymentId))
    }

    // Log audit event
    await logAuditEvent({
      userId: user.id,
      action: "CREATE_DEPLOYMENT",
      resource: "competency_deployments",
      resourceId: deploymentId,
      details: {
        deploymentId: deploymentId,
        templateId: validatedData.templateId,
        templateName: template.name,
        deploymentType: "TEMPLATE_IMPORT",
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        ...newDeployment,
        targetPrograms: newDeployment.targetPrograms
          ? JSON.parse(newDeployment.targetPrograms)
          : [],
        targetUsers: newDeployment.targetUsers ? JSON.parse(newDeployment.targetUsers) : [],
      },
      message: "Deployment created successfully",
    })
  } catch (error) {
    console.error("Error creating deployment:", error)
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
      console.warn('Cache invalidation error in competency-deployments/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Failed to create deployment" }, { status: 500 })
  }
}

// PUT /api/competency-deployments - Update deployment
export async function PUT(request: NextRequest) {
  try {
    const context = await getSchoolContext()
    const user = await getCurrentUser()
    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: "Deployment ID is required" }, { status: 400 })
    }

    // Only school admins can update deployments
    if (!["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(context.userRole)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const validatedData = updateDeploymentSchema.parse(updateData)

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

    // Update deployment
    const [updatedDeployment] = await db
      .update(competencyDeployments)
      .set({
        effectiveDate: validatedData.scheduledDate
          ? new Date(validatedData.scheduledDate)
          : undefined,
        notes: validatedData.description || undefined,
        updatedAt: new Date(),
      })
      .where(eq(competencyDeployments.id, id))
      .returning()

    // Log audit event
    if (user) {
      await logAuditEvent({
        userId: user.id,
        action: "UPDATE_DEPLOYMENT",
        resource: "competency_deployments",
        resourceId: id,
        details: {
          deploymentId: updatedDeployment.id,
          changes: Object.keys(validatedData),
          previousStatus: existingDeployment.status,
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        ...updatedDeployment,
        targetPrograms: updatedDeployment.targetPrograms
          ? JSON.parse(updatedDeployment.targetPrograms)
          : [],
        targetUsers: updatedDeployment.targetUsers ? JSON.parse(updatedDeployment.targetUsers) : [],
      },
      message: "Deployment updated successfully",
    })
  } catch (error) {
    console.error("Error updating deployment:", error)
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
      console.warn('Cache invalidation error in competency-deployments/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Failed to update deployment" }, { status: 500 })
  }
}

// Helper function to create deployment assignments
async function createDeploymentAssignments(
  _deploymentId: string,
  _deploymentData: z.infer<typeof createDeploymentSchema>,
  _schoolId: string
) {
  // This would contain logic to create competency assignments based on deployment scope
  // For now, we'll create a placeholder implementation

  const _assignmentId = crypto.randomUUID()

  // Note: competencyAssignments table doesn't have schoolId field
  // This is a placeholder implementation that would need proper user and competency IDs
}
