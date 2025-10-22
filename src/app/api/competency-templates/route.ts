import { and, count, desc, eq, like } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "../../../database/connection-pool"
import {
  competencyDeployments,
  competencyTemplates,
  rubricCriteria,
} from "../../../database/schema"
import { getCurrentUser } from "../../../lib/auth-clerk"
import { logAuditEvent } from "../../../lib/rbac-middleware"
import { getSchoolContext } from "../../../lib/school-utils"
import { cacheIntegrationService } from '@/lib/cache-integration'


// Validation schemas
const createTemplateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  category: z.string().min(1, "Category is required"),
  level: z.enum(["FUNDAMENTAL", "INTERMEDIATE", "ADVANCED", "EXPERT"]),
  type: z.enum(["COMPETENCY", "RUBRIC"]),
  content: z.record(z.string(), z.any()).optional(),
  tags: z.array(z.string()).optional(),
  isPublic: z.boolean().default(false),
  source: z.enum(["STANDARD", "CUSTOM"]).default("CUSTOM"),
})

const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  level: z.enum(["FUNDAMENTAL", "INTERMEDIATE", "ADVANCED", "EXPERT"]).optional(),
  type: z.enum(["COMPETENCY", "RUBRIC"]).optional(),
  content: z.record(z.string(), z.any()).optional(),
  tags: z.array(z.string()).optional(),
  isPublic: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

const _bulkImportSchema = z.object({
  templates: z.array(createTemplateSchema),
  source: z.string().optional(),
  overwriteExisting: z.boolean().default(false),
})

// GET /api/competency-templates - Get templates with filtering
export async function GET(request: NextRequest) {
  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      'api:competency-templates/route.ts',
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
    console.warn('Cache error in competency-templates/route.ts:', cacheError)
    // Continue with original logic if cache fails
  }
  
  async function executeOriginalLogic() {

  try {
    const context = await getSchoolContext()
    const { searchParams } = new URL(request.url)

    // Only school admins can access templates
    if (!["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(context.userRole)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const category = searchParams.get("category")
    const level = searchParams.get("level")
    const type = searchParams.get("type")
    const source = searchParams.get("source")
    const _isPublic = searchParams.get("isPublic")
    const search = searchParams.get("search")
    const _tags = searchParams.get("tags")?.split(",")
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const offset = Number.parseInt(searchParams.get("offset") || "0")
    const includeStats = searchParams.get("includeStats") === "true"

    // Build query conditions
    const conditions = []

    // School admin can only see their own school's templates
    if (context.userRole === "SCHOOL_ADMIN") {
      conditions.push(eq(competencyTemplates.createdBy, context.schoolId || ""))
    }
    // Super admin can see all templates - no additional conditions needed

    if (category) {
      conditions.push(eq(competencyTemplates.category, category))
    }

    if (level) {
      conditions.push(
        eq(
          competencyTemplates.level,
          level as "FUNDAMENTAL" | "INTERMEDIATE" | "ADVANCED" | "EXPERT"
        )
      )
    }

    if (type) {
      conditions.push(eq(competencyTemplates.type, type as "COMPETENCY" | "RUBRIC"))
    }

    if (source) {
      conditions.push(eq(competencyTemplates.source, source as "STANDARD" | "CUSTOM"))
    }

    if (search) {
      conditions.push(like(competencyTemplates.name, `%${search}%`))
    }

    // Execute main query
    const templates = await db
      .select()
      .from(competencyTemplates)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(competencyTemplates.createdAt))
      .limit(limit)
      .offset(offset)

    // Include statistics if requested
    let templatesWithStats = templates
    if (includeStats) {
      templatesWithStats = await Promise.all(
        templates.map(async (template) => {
          const [deploymentCount] = await db
            .select({
              count: count(competencyDeployments.id),
            })
            .from(competencyDeployments)
            .where(eq(competencyDeployments.templateId, template.id))

          const [rubricCount] = await db
            .select({
              count: count(rubricCriteria.id),
            })
            .from(rubricCriteria)
            .where(eq(rubricCriteria.templateId, template.id))

          return {
            ...template,
            content: template.content ? JSON.parse(template.content) : {},
            tags: template.tags ? JSON.parse(template.tags) : [],
            stats: {
              deployments: deploymentCount?.count || 0,
              rubricCriteria: rubricCount?.count || 0,
            },
          }
        })
      )
    } else {
      templatesWithStats = templates.map((template) => ({
        ...template,
        content: template.content ? JSON.parse(template.content) : {},
        tags: template.tags ? JSON.parse(template.tags) : [],
      }))
    }

    return NextResponse.json({
      success: true,
      data: templatesWithStats,
      pagination: {
        limit,
        offset,
        total: templates.length,
      },
    })
  } catch (error) {
    console.error("Error fetching competency templates:", error)
    return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 })
  }

  }
}

// POST /api/competency-templates - Create new template
export async function POST(request: NextRequest) {
  try {
    const context = await getSchoolContext()
    const user = await getCurrentUser()

    // Only school admins can create templates
    if (!["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(context.userRole)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createTemplateSchema.parse(body)

    // Check if template with same name already exists
    const [existingTemplate] = await db
      .select()
      .from(competencyTemplates)
      .where(
        and(
          eq(competencyTemplates.name, validatedData.name),
          eq(competencyTemplates.createdBy, context.schoolId || "")
        )
      )
      .limit(1)

    if (existingTemplate) {
      return NextResponse.json({ error: "Template with this name already exists" }, { status: 400 })
    }

    // Create template
    const [newTemplate] = await db
      .insert(competencyTemplates)
      .values({
        id: crypto.randomUUID(),
        name: validatedData.name,
        description: validatedData.description,
        category: validatedData.category,
        level: validatedData.level,
        type: validatedData.type,
        content: JSON.stringify(validatedData.content || {}),
        tags: JSON.stringify(validatedData.tags || []),
        isPublic: validatedData.isPublic,
        source: validatedData.source,
        version: "1.0.0",
        createdBy: context.schoolId || "",
        isActive: true,
      })
      .returning()

    // Log audit event
    await logAuditEvent({
      userId: user?.id || "unknown",
      action: "CREATE_TEMPLATE",
      resource: "competency_templates",
      resourceId: newTemplate.id,
      details: {
        templateName: newTemplate.name,
        type: newTemplate.type,
        category: newTemplate.category,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        ...newTemplate,
        content: validatedData.content || {},
        tags: validatedData.tags || [],
      },
      message: "Template created successfully",
    })
  } catch (error) {
    console.error("Error creating template:", error)
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
      console.warn('Cache invalidation error in competency-templates/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Failed to create template" }, { status: 500 })
  }
}

// PUT /api/competency-templates - Update template
export async function PUT(request: NextRequest) {
  try {
    const context = await getSchoolContext()
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: "Template ID is required" }, { status: 400 })
    }

    // Only school admins can update templates
    if (!["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(context.userRole)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const validatedData = updateTemplateSchema.parse(updateData)

    // Get existing template
    const [existingTemplate] = await db
      .select()
      .from(competencyTemplates)
      .where(eq(competencyTemplates.id, id))
      .limit(1)

    if (!existingTemplate) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 })
    }

    // School admins can only update their own templates
    if (context.userRole === "SCHOOL_ADMIN" && existingTemplate.createdBy !== context.schoolId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Update template
    const [updatedTemplate] = await db
      .update(competencyTemplates)
      .set({
        ...validatedData,
        content: validatedData.content ? JSON.stringify(validatedData.content) : undefined,
        tags: validatedData.tags ? JSON.stringify(validatedData.tags) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(competencyTemplates.id, id))
      .returning()

    // Log audit event
    await logAuditEvent({
      userId: user?.id || "unknown",
      action: "UPDATE_TEMPLATE",
      resource: "competency_templates",
      resourceId: id,
      details: {
        templateName: updatedTemplate.name,
        changes: Object.keys(validatedData),
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        ...updatedTemplate,
        content: updatedTemplate.content ? JSON.parse(updatedTemplate.content) : {},
        tags: updatedTemplate.tags ? JSON.parse(updatedTemplate.tags) : [],
      },
      message: "Template updated successfully",
    })
  } catch (error) {
    console.error("Error updating template:", error)
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
      console.warn('Cache invalidation error in competency-templates/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Failed to update template" }, { status: 500 })
  }
}

// DELETE /api/competency-templates - Delete template
export async function DELETE(request: NextRequest) {
  try {
    const context = await getSchoolContext()
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Template ID is required" }, { status: 400 })
    }

    // Only school admins can delete templates
    if (!["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(context.userRole)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Get existing template
    const [existingTemplate] = await db
      .select()
      .from(competencyTemplates)
      .where(eq(competencyTemplates.id, id))
      .limit(1)

    if (!existingTemplate) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 })
    }

    // School admins can only delete their own templates
    if (context.userRole === "SCHOOL_ADMIN" && existingTemplate.createdBy !== context.schoolId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Check if template is being used in deployments
    const [deploymentCount] = await db
      .select({ count: count(competencyDeployments.id) })
      .from(competencyDeployments)
      .where(eq(competencyDeployments.templateId, id))

    if (deploymentCount.count > 0) {
      return NextResponse.json(
        { error: "Cannot delete template with active deployments" },
        { status: 400 }
      )
    }

    // Delete associated rubric criteria first
    await db.delete(rubricCriteria).where(eq(rubricCriteria.templateId, id))

    // Delete template
    await db.delete(competencyTemplates).where(eq(competencyTemplates.id, id))

    // Log audit event
    await logAuditEvent({
      userId: user?.id || "unknown",
      action: "DELETE_TEMPLATE",
      resource: "competency_templates",
      resourceId: id,
      details: {
        templateName: existingTemplate.name,
        type: existingTemplate.type,
      },
    })

    return NextResponse.json({
      success: true,
      message: "Template deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting template:", error)
    
    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateCompetencyCache()
    } catch (cacheError) {
      console.warn('Cache invalidation error in competency-templates/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Failed to delete template" }, { status: 500 })
  }
}
