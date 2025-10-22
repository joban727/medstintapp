import { and, eq, inArray } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "../../../../database/connection-pool"
import { competencyTemplates, importExportLogs, rubricCriteria } from "../../../../database/schema"
import { getCurrentUser } from "../../../../lib/auth-clerk"
import { logAuditEvent } from "../../../../lib/rbac-middleware"
import { getSchoolContext } from "../../../../lib/school-utils"
import { cacheIntegrationService } from '@/lib/cache-integration'


// Validation schemas
const templateImportSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  category: z.string().min(1, "Category is required"),
  level: z.enum(["FUNDAMENTAL", "INTERMEDIATE", "ADVANCED", "EXPERT"]),
  type: z.enum(["COMPETENCY", "RUBRIC"]),
  content: z.record(z.string(), z.any()).optional(),
  tags: z.array(z.string()).optional(),
  rubricCriteria: z
    .array(
      z.object({
        name: z.string().optional(),
        criterionName: z.string().optional(),
        description: z.string(),
        weight: z.number().min(0).max(100),
        levels: z
          .array(
            z.object({
              name: z.string(),
              description: z.string(),
              points: z.number(),
            })
          )
          .optional(),
        performanceLevels: z
          .array(
            z.object({
              name: z.string(),
              description: z.string(),
              points: z.number(),
            })
          )
          .optional(),
        order: z.number().optional(),
        orderIndex: z.number().optional(),
      })
    )
    .optional(),
})

const bulkImportSchema = z.object({
  templates: z.array(templateImportSchema),
  source: z.string().optional(),
  overwriteExisting: z.boolean().default(false),
  validateOnly: z.boolean().default(false),
})

// POST /api/competency-templates/bulk/import - Bulk import templates
export async function POST(request: NextRequest) {
  try {
    const context = await getSchoolContext()
    const user = await getCurrentUser()

    // Only school admins can import templates
    if (!["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(context.userRole)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = bulkImportSchema.parse(body)

    const results = {
      successful: [] as Array<{ index: number; name: string; id: string; action: string }>,
      failed: [] as Array<{ index: number; name: string; error: string }>,
      skipped: [] as Array<{ index: number; name: string; reason: string }>,
      validation: [] as Array<{ index: number; name: string; status: string; issues: string[] }>,
    }

    // Start transaction for bulk import
    await db.transaction(async (tx) => {
      for (let i = 0; i < validatedData.templates.length; i++) {
        const templateData = validatedData.templates[i]

        try {
          // Check if template already exists
          const [existingTemplate] = await tx
            .select()
            .from(competencyTemplates)
            .where(
              and(
                eq(competencyTemplates.name, templateData.name),
                eq(competencyTemplates.createdBy, context.schoolId || "")
              )
            )
            .limit(1)

          if (existingTemplate && !validatedData.overwriteExisting) {
            results.skipped.push({
              index: i,
              name: templateData.name,
              reason: "Template already exists",
            })
            continue
          }

          // Validation only mode
          if (validatedData.validateOnly) {
            results.validation.push({
              index: i,
              name: templateData.name,
              status: "valid",
              issues: [],
            })
            continue
          }

          const templateId = crypto.randomUUID()

          // Create or update template
          if (existingTemplate && validatedData.overwriteExisting) {
            await tx
              .update(competencyTemplates)
              .set({
                description: templateData.description,
                category: templateData.category,
                level: templateData.level,
                type: templateData.type,
                content: JSON.stringify(templateData.content || {}),
                tags: JSON.stringify(templateData.tags || []),
                updatedAt: new Date(),
              })
              .where(eq(competencyTemplates.id, existingTemplate.id))

            // Delete existing rubric criteria if updating
            if (templateData.type === "RUBRIC") {
              await tx
                .delete(rubricCriteria)
                .where(eq(rubricCriteria.templateId, existingTemplate.id))
            }
          } else {
            // Create new template
            await tx.insert(competencyTemplates).values({
              id: templateId,
              name: templateData.name,
              description: templateData.description,
              category: templateData.category,
              level: templateData.level,
              type: templateData.type,
              content: JSON.stringify(templateData.content || {}),
              tags: JSON.stringify(templateData.tags || []),
              isPublic: false,
              source: "CUSTOM",
              version: "1.0.0",
              createdBy: context.schoolId || "",
              isActive: true,
            })
          }

          // Create rubric criteria if provided
          if (templateData.type === "RUBRIC" && templateData.rubricCriteria) {
            const criteriaToInsert = templateData.rubricCriteria.map((criterion, index) => ({
              id: crypto.randomUUID(),
              templateId: existingTemplate?.id || templateId,
              criterionName: criterion.criterionName || criterion.name || `Criterion ${index + 1}`,
              description: criterion.description || "",
              weight: (criterion.weight || 1).toString(),
              performanceLevels: JSON.stringify(
                criterion.performanceLevels || criterion.levels || []
              ),
              orderIndex: criterion.orderIndex || criterion.order || index + 1,
            }))

            await tx.insert(rubricCriteria).values(criteriaToInsert)
          }

          results.successful.push({
            index: i,
            name: templateData.name,
            id: existingTemplate?.id || templateId,
            action: existingTemplate ? "updated" : "created",
          })
        } catch (error) {
          results.failed.push({
            index: i,
            name: templateData.name,
            error: error instanceof Error ? error.message : "Unknown error",
          })
        }
      }
    })

    // Log import activity
    if (!validatedData.validateOnly) {
      await db.insert(importExportLogs).values({
        id: crypto.randomUUID(),
        operationType: "IMPORT",
        fileName: "bulk_import.json",
        status: results.failed.length === 0 ? "COMPLETED" : "FAILED",
        recordsProcessed: validatedData.templates.length,
        recordsSuccessful: results.successful.length,
        recordsFailed: results.failed.length,
        errorDetails: JSON.stringify({
          successful: results.successful.length,
          failed: results.failed.length,
          skipped: results.skipped.length,
        }),
        processedBy: user?.id || "unknown",
        schoolId: context.schoolId || "",
      })

      // Log audit event
      await logAuditEvent({
        userId: user?.id || "unknown",
        action: "BULK_IMPORT_TEMPLATES",
        resource: "competency_templates",
        details: {
          totalTemplates: validatedData.templates.length,
          successful: results.successful.length,
          failed: results.failed.length,
          skipped: results.skipped.length,
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: results,
      message: validatedData.validateOnly
        ? "Validation completed"
        : `Import completed: ${results.successful.length} successful, ${results.failed.length} failed, ${results.skipped.length} skipped`,
    })
  } catch (error) {
    console.error("Error importing templates:", error)
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
      console.warn('Cache invalidation error in competency-templates/bulk/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Failed to import templates" }, { status: 500 })
  }
}

// GET /api/competency-templates/bulk/export - Bulk export templates
export async function GET(request: NextRequest) {
  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      'api:competency-templates/bulk/route.ts',
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
    console.warn('Cache error in competency-templates/bulk/route.ts:', cacheError)
    // Continue with original logic if cache fails
  }
  
  async function executeOriginalLogic() {

  try {
    const context = await getSchoolContext()
    const user = await getCurrentUser()
    const { searchParams } = new URL(request.url)

    // Only school admins can export templates
    if (!["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(context.userRole)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const templateIds = searchParams.get("templateIds")?.split(",")
    const category = searchParams.get("category")
    const type = searchParams.get("type")
    const includeRubricCriteria = searchParams.get("includeRubricCriteria") !== "false"
    const format = (searchParams.get("format") || "JSON") as "JSON" | "CSV" | "EXCEL"

    // Build query conditions
    const conditions = []

    // School admins can only export their own templates
    if (context.userRole === "SCHOOL_ADMIN" && context.schoolId) {
      conditions.push(eq(competencyTemplates.createdBy, context.schoolId))
    }

    if (templateIds && templateIds.length > 0) {
      conditions.push(inArray(competencyTemplates.id, templateIds))
    }

    if (category) {
      conditions.push(eq(competencyTemplates.category, category))
    }

    if (type) {
      conditions.push(eq(competencyTemplates.type, type as "COMPETENCY" | "RUBRIC"))
    }

    // Get templates
    const templates = await db
      .select()
      .from(competencyTemplates)
      .where(conditions.length > 0 ? and(...conditions) : undefined)

    // Get rubric criteria if requested
    const templatesWithCriteria = await Promise.all(
      templates.map(async (template) => {
        let criteriaList: (typeof rubricCriteria.$inferSelect)[] = []

        if (includeRubricCriteria && template.type === "RUBRIC") {
          criteriaList = await db
            .select()
            .from(rubricCriteria)
            .where(eq(rubricCriteria.templateId, template.id))
        }

        return {
          ...template,
          content: template.content ? JSON.parse(template.content) : {},
          tags: template.tags ? JSON.parse(template.tags) : [],
          rubricCriteria: criteriaList.map((criterion) => ({
            ...criterion,
            levels: criterion.performanceLevels ? JSON.parse(criterion.performanceLevels) : [],
          })),
        }
      })
    )

    // Log export activity
    await db.insert(importExportLogs).values({
      id: crypto.randomUUID(),
      operationType: "EXPORT",
      fileName: `templates_export_${format.toLowerCase()}.${format.toLowerCase()}`,
      status: "COMPLETED",
      recordsProcessed: templatesWithCriteria.length,
      recordsSuccessful: templatesWithCriteria.length,
      recordsFailed: 0,
      errorDetails: JSON.stringify({
        format,
        includeRubricCriteria,
        filters: { category, type, templateIds: templateIds?.length || 0 },
      }),
      processedBy: user?.id || "unknown",
      schoolId: context.schoolId || "",
    })

    // Log audit event
    await logAuditEvent({
      userId: user?.id || "unknown",
      action: "BULK_EXPORT_TEMPLATES",
      resource: "competency_templates",
      details: {
        totalTemplates: templatesWithCriteria.length,
        format,
        includeRubricCriteria,
      },
    })

    // Format response based on requested format
    if (format === "JSON") {
      return NextResponse.json({
        success: true,
        data: {
          templates: templatesWithCriteria,
          exportedAt: new Date().toISOString(),
          totalCount: templatesWithCriteria.length,
        },
        message: `Exported ${templatesWithCriteria.length} templates successfully`,
      })
    }

    // For CSV/Excel formats, we'll return a simplified structure
    // In a real implementation, you'd use libraries like csv-writer or exceljs
    const simplifiedData = templatesWithCriteria.map((template) => ({
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      level: template.level,
      type: template.type,
      tags: template.tags.join(", "),
      isPublic: template.isPublic,
      source: template.source,
      version: template.version,
      createdAt: template.createdAt,
      rubricCriteriaCount: template.rubricCriteria.length,
    }))

    return NextResponse.json({
      success: true,
      data: {
        templates: simplifiedData,
        exportedAt: new Date().toISOString(),
        totalCount: simplifiedData.length,
        format,
      },
      message: `Exported ${simplifiedData.length} templates in ${format} format`,
    })
  } catch (error) {
    console.error("Error exporting templates:", error)
    return NextResponse.json({ error: "Failed to export templates" }, { status: 500 })
  }

  }
}
