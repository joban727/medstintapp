import { and, count, eq } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { db } from "../../../../database/connection-pool"
import {
  competencyDeployments,
  competencyTemplates,
  rubricCriteria,
} from "../../../../database/schema"
import { getCurrentUser } from "../../../../lib/auth-clerk"
import { logAuditEvent } from "../../../../lib/rbac-middleware"
import { getSchoolContext } from "../../../../lib/school-utils"
import { cacheIntegrationService } from '@/lib/cache-integration'


// GET /api/competency-templates/[id] - Get single template with details
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      'api:competency-templates/[id]/route.ts',
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
    console.warn('Cache error in competency-templates/[id]/route.ts:', cacheError)
    // Continue with original logic if cache fails
  }
  
  async function executeOriginalLogic() {

  try {
    const context = await getSchoolContext()
    const { id } = await params

    // Only school admins can access templates
    if (!["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(context.userRole)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Get template with related data
    const [template] = await db
      .select()
      .from(competencyTemplates)
      .where(eq(competencyTemplates.id, id))
      .limit(1)

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 })
    }

    // School admins can only see public templates or their own
    if (context.userRole === "SCHOOL_ADMIN") {
      if (!template.isPublic && template.createdBy !== context.schoolId) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 })
      }
    }

    // Get rubric criteria if it's a rubric template
    let criteria: (typeof rubricCriteria.$inferSelect)[] = []
    if (template.type === "RUBRIC") {
      criteria = await db.select().from(rubricCriteria).where(eq(rubricCriteria.templateId, id))
    }

    // Get deployment statistics
    const [deploymentStats] = await db
      .select({
        totalDeployments: count(competencyDeployments.id),
      })
      .from(competencyDeployments)
      .where(eq(competencyDeployments.templateId, id))

    return NextResponse.json({
      success: true,
      data: {
        ...template,
        content: template.content ? JSON.parse(template.content) : {},
        tags: template.tags ? JSON.parse(template.tags) : [],
        rubricCriteria: criteria.map((criterion) => ({
          ...criterion,
          levels: criterion.performanceLevels ? JSON.parse(criterion.performanceLevels) : [],
        })),
        stats: {
          deployments: deploymentStats?.totalDeployments || 0,
        },
      },
    })
  } catch (error) {
    console.error("Error fetching template:", error)
    return NextResponse.json({ error: "Failed to fetch template" }, { status: 500 })
  }

  }
}

// POST /api/competency-templates/[id]/duplicate - Duplicate template
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getSchoolContext()
    const user = await getCurrentUser()
    const { id } = await params
    const body = await request.json()

    // Only school admins can duplicate templates
    if (!["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(context.userRole)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { name, description } = body
    if (!name) {
      return NextResponse.json({ error: "Name is required for duplicate" }, { status: 400 })
    }

    // Get original template
    const [originalTemplate] = await db
      .select()
      .from(competencyTemplates)
      .where(eq(competencyTemplates.id, id))
      .limit(1)

    if (!originalTemplate) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 })
    }

    // School admins can only duplicate public templates or their own
    if (context.userRole === "SCHOOL_ADMIN") {
      if (!originalTemplate.isPublic && originalTemplate.createdBy !== context.schoolId) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 })
      }
    }

    // Check if template with new name already exists
    const [existingTemplate] = await db
      .select()
      .from(competencyTemplates)
      .where(
        and(
          eq(competencyTemplates.name, name),
          eq(competencyTemplates.createdBy, context.schoolId || "")
        )
      )
      .limit(1)

    if (existingTemplate) {
      return NextResponse.json({ error: "Template with this name already exists" }, { status: 400 })
    }

    // Create duplicate template
    const newTemplateId = crypto.randomUUID()
    const [newTemplate] = await db
      .insert(competencyTemplates)
      .values({
        id: newTemplateId,
        name,
        description: description || `Copy of ${originalTemplate.description}`,
        category: originalTemplate.category,
        level: originalTemplate.level,
        type: originalTemplate.type,
        content: originalTemplate.content,
        tags: originalTemplate.tags,
        isPublic: false, // Duplicates are private by default
        source: "CUSTOM",
        version: "1.0.0",
        createdBy: context.schoolId || "",
        isActive: true,
      })
      .returning()

    // Duplicate rubric criteria if it's a rubric template
    if (originalTemplate.type === "RUBRIC") {
      const originalCriteria = await db
        .select()
        .from(rubricCriteria)
        .where(eq(rubricCriteria.templateId, id))

      if (originalCriteria.length > 0) {
        await db.insert(rubricCriteria).values(
          originalCriteria.map((criterion) => ({
            id: crypto.randomUUID(),
            templateId: newTemplateId,
            criterionName: criterion.criterionName,
            description: criterion.description,
            weight: criterion.weight.toString(),
            performanceLevels: criterion.performanceLevels,
            orderIndex: criterion.orderIndex,
          }))
        )
      }
    }

    // Log audit event
    await logAuditEvent({
      userId: user?.id || "unknown",
      action: "DUPLICATE_TEMPLATE",
      resource: "competency_templates",
      resourceId: newTemplateId,
      details: {
        originalTemplateId: id,
        originalTemplateName: originalTemplate.name,
        newTemplateName: name,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        ...newTemplate,
        content: newTemplate.content ? JSON.parse(newTemplate.content) : {},
        tags: newTemplate.tags ? JSON.parse(newTemplate.tags) : [],
      },
      message: "Template duplicated successfully",
    })
  } catch (error) {
    console.error("Error duplicating template:", error)
    
    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateCompetencyCache()
    } catch (cacheError) {
      console.warn('Cache invalidation error in competency-templates/[id]/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Failed to duplicate template" }, { status: 500 })
  }
}
