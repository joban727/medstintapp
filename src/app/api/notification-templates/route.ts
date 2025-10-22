import { and, desc, eq } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "../../../database/connection-pool"
import { notificationTemplates } from "../../../database/schema"
import { getCurrentUser } from "../../../lib/auth-clerk"
import { logAuditEvent } from "../../../lib/rbac-middleware"
import { getSchoolContext } from "../../../lib/school-utils"
import { cacheIntegrationService } from '@/lib/cache-integration'


// Validation schemas
const createNotificationTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  type: z.enum(["EMAIL", "SMS", "IN_APP", "PUSH"]),
  subject: z.string().min(1, "Subject is required"),
  content: z.string().min(1, "Content is required"),
  triggerEvent: z.enum([
    "DEPLOYMENT_CREATED",
    "DEPLOYMENT_UPDATED",
    "ASSIGNMENT_DUE",
    "ASSESSMENT_COMPLETED",
    "REMINDER",
  ]),
  recipientType: z.enum(["STUDENT", "SUPERVISOR", "ADMIN", "ALL"]),
  isActive: z.boolean().default(true),
  variables: z.array(z.string()).optional(),
})

const _updateNotificationTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  subject: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  variables: z.array(z.string()).optional(),
})

// GET /api/notification-templates - Get notification templates with filtering
export async function GET(request: NextRequest) {
  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      'api:notification-templates/route.ts',
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
    console.warn('Cache error in notification-templates/route.ts:', cacheError)
    // Continue with original logic if cache fails
  }
  
  async function executeOriginalLogic() {

  try {
    const context = await getSchoolContext()
    const { searchParams } = new URL(request.url)

    // Only school admins can access notification templates
    if (!["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(context.userRole)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const type = searchParams.get("type")
    const triggerEvent = searchParams.get("triggerEvent")
    const recipientType = searchParams.get("recipientType")
    const isActive = searchParams.get("isActive")
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const offset = Number.parseInt(searchParams.get("offset") || "0")

    // Build query conditions
    const conditions = [eq(notificationTemplates.schoolId, context.schoolId || "")]

    if (type) {
      conditions.push(eq(notificationTemplates.type, type as "EMAIL" | "SMS" | "IN_APP" | "PUSH"))
    }

    if (triggerEvent) {
      conditions.push(
        eq(
          notificationTemplates.triggerEvent,
          triggerEvent as
            | "DEPLOYMENT_CREATED"
            | "DEPLOYMENT_UPDATED"
            | "ASSIGNMENT_DUE"
            | "ASSESSMENT_COMPLETED"
            | "REMINDER"
        )
      )
    }

    if (recipientType) {
      conditions.push(
        eq(
          notificationTemplates.recipientType,
          recipientType as "STUDENT" | "SUPERVISOR" | "ADMIN" | "ALL"
        )
      )
    }

    if (isActive !== null) {
      conditions.push(eq(notificationTemplates.isActive, isActive === "true"))
    }

    // Execute query
    const templates = await db
      .select({
        id: notificationTemplates.id,
        name: notificationTemplates.name,
        type: notificationTemplates.type,
        subject: notificationTemplates.subject,
        content: notificationTemplates.content,
        triggerEvent: notificationTemplates.triggerEvent,
        recipientType: notificationTemplates.recipientType,
        isActive: notificationTemplates.isActive,
        variables: notificationTemplates.variables,
        createdAt: notificationTemplates.createdAt,
        updatedAt: notificationTemplates.updatedAt,
      })
      .from(notificationTemplates)
      .where(and(...conditions))
      .orderBy(desc(notificationTemplates.createdAt))
      .limit(limit)
      .offset(offset)

    // Parse variables JSON
    const templatesWithParsedVariables = templates.map((template) => ({
      ...template,
      variables: template.variables ? JSON.parse(template.variables) : [],
    }))

    return NextResponse.json({
      success: true,
      data: templatesWithParsedVariables,
      pagination: {
        limit,
        offset,
        total: templates.length,
      },
    })
  } catch (error) {
    console.error("Error fetching notification templates:", error)
    return NextResponse.json({ error: "Failed to fetch notification templates" }, { status: 500 })
  }

  }
}

// POST /api/notification-templates - Create new notification template
export async function POST(request: NextRequest) {
  try {
    const context = await getSchoolContext()
    const user = await getCurrentUser()

    // Only school admins can create notification templates
    if (!["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(context.userRole)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createNotificationTemplateSchema.parse(body)

    // Create notification template
    const templateId = crypto.randomUUID()
    const [newTemplate] = await db
      .insert(notificationTemplates)
      .values({
        id: templateId,
        schoolId: context.schoolId || "",
        name: validatedData.name,
        type: validatedData.type,
        subject: validatedData.subject,
        content: validatedData.content,
        triggerEvent: validatedData.triggerEvent,
        recipientType: validatedData.recipientType,
        isActive: validatedData.isActive,
        variables: validatedData.variables ? JSON.stringify(validatedData.variables) : null,
        createdBy: user?.id || "unknown",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()

    // Log audit event
    await logAuditEvent({
      userId: user?.id || "unknown",
      action: "CREATE",
      resource: "NOTIFICATION_TEMPLATE",
      resourceId: templateId,
      details: {
        templateName: validatedData.name,
        type: validatedData.type,
        triggerEvent: validatedData.triggerEvent,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        ...newTemplate,
        variables: newTemplate.variables ? JSON.parse(newTemplate.variables) : [],
      },
    })
  } catch (error) {
    console.error("Error creating notification template:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      )
    }
    
    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateAllCache()
    } catch (cacheError) {
      console.warn('Cache invalidation error in notification-templates/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Failed to create notification template" }, { status: 500 })
  }
}
