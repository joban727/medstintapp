import { auth } from "@clerk/nextjs/server"
import { and, count, desc, eq, ilike, or, sql, inArray } from "drizzle-orm"
import { type NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/database/connection-pool"
import { clinicalSites, rotations, siteAssignments, facilityManagement } from "@/database/schema"
import {
  createSuccessResponse,
  createErrorResponse,
  withErrorHandling,
  HTTP_STATUS,
  ERROR_MESSAGES,
} from "@/lib/api-response"
import { getSchoolContext } from "@/lib/school-utils"
// Ensure this route is always dynamic (no framework-level static caching)
export const dynamic = "force-dynamic"

const createClinicalSiteSchema = z.object({
  name: z.string().min(1, "Name is required"),
  address: z.string().min(1, "Address is required"),
  phone: z.string().min(1, "Phone is required"),
  email: z.string().email("Invalid email format"),
  type: z.enum(["HOSPITAL", "CLINIC", "NURSING_HOME", "OUTPATIENT", "OTHER"]),
  capacity: z.number().min(1, "Capacity must be at least 1"),
  specialties: z.array(z.string()).optional(),
  contactPersonName: z.string().optional(),
  contactPersonTitle: z.string().optional(),
  contactPersonPhone: z.string().optional(),
  contactPersonEmail: z.string().email().optional(),
  requirements: z.array(z.string()).optional(),
})

const updateClinicalSiteSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  email: z.string().email().optional(),
  type: z.enum(["HOSPITAL", "CLINIC", "NURSING_HOME", "OUTPATIENT", "OTHER"]).optional(),
  capacity: z.number().min(1).optional(),
  specialties: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  contactPersonName: z.string().optional(),
  contactPersonTitle: z.string().optional(),
  contactPersonPhone: z.string().optional(),
  contactPersonEmail: z.string().email().optional(),
  requirements: z.array(z.string()).optional(),
})

// GET /api/clinical-sites - Get clinical sites with filtering
export const GET = withErrorHandling(async (request: NextRequest) => {
  try {
    const context = await getSchoolContext()
    const { searchParams } = new URL(request.url)

    const search = searchParams.get("search")
    const type = searchParams.get("type")
    const specialty = searchParams.get("specialty")
    const isActive = searchParams.get("isActive")
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const offset = Number.parseInt(searchParams.get("offset") || "0")
    const includeStats = searchParams.get("includeStats") === "true"
    const debug = searchParams.get("debug") === "true" || searchParams.get("debug") === "1"

    const conditions: any[] = []
    if (search) conditions.push(ilike(clinicalSites.name, `%${search}%`))
    if (type) conditions.push(eq(clinicalSites.type, type as any))
    if (isActive !== null) conditions.push(eq(clinicalSites.isActive, isActive === "true"))
    if (specialty) conditions.push(ilike(clinicalSites.specialties, `%${specialty}%`))

    let sites: any[]
    let total = 0
    if (context.userRole !== "SUPER_ADMIN" && context.schoolId) {
      // For SCHOOL_ADMIN: Show only clinical sites belonging to their school
      sites = await db
        .select()
        .from(clinicalSites)
        .where(
          and(
            eq(clinicalSites.schoolId, context.schoolId),
            conditions.length > 0 ? and(...conditions) : undefined
          )
        )
        .orderBy(desc(clinicalSites.createdAt))
        .limit(limit)
        .offset(offset)

      // Get total count for pagination
      const [countResult] = await db
        .select({ count: count(clinicalSites.id) })
        .from(clinicalSites)
        .where(
          and(
            eq(clinicalSites.schoolId, context.schoolId),
            conditions.length > 0 ? and(...conditions) : undefined
          )
        )
      total = countResult?.count || sites.length
    } else {
      sites = await db
        .select()
        .from(clinicalSites)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(clinicalSites.createdAt))
        .limit(limit)
        .offset(offset)
      total = sites.length
    }

    if (includeStats) {
      const siteIds = sites.map((s) => s.id)
      if (siteIds.length > 0) {
        const rotationCounts = await db
          .select({
            clinicalSiteId: rotations.clinicalSiteId,
            totalRotations: count(rotations.id),
            activeRotations: sql<number>`SUM(CASE WHEN ${rotations.status} = 'ACTIVE' THEN 1 ELSE 0 END)`,
          })
          .from(rotations)
          .where(inArray(rotations.clinicalSiteId, siteIds))
          .groupBy(rotations.clinicalSiteId)

        const rotationMap = new Map(rotationCounts.map((rc) => [rc.clinicalSiteId, rc]))
        sites = sites.map((site) => {
          const stats = rotationMap.get(site.id) || { totalRotations: 0, activeRotations: 0 }
          const availableCapacity = site.capacity - (stats.activeRotations || 0)
          return {
            ...site,
            totalRotations: stats.totalRotations || 0,
            activeRotations: stats.activeRotations || 0,
            availableCapacity,
          }
        })
      }
    }

    if (debug) {
      console.info(
        "[LOG-2 ClinicalSitesAPI] role=%s schoolId=%s filters={search:%s,type:%s,specialty:%s,isActive:%s} total=%d",
        context.userRole,
        context.schoolId || null,
        search || null,
        type || null,
        specialty || null,
        isActive || null,
        Array.isArray(sites) ? sites.length : 0
      )
    }

    const parsedSites = sites.map((site) => ({
      ...site,
      specialties: (() => {
        try {
          return JSON.parse(site.specialties || "[]")
        } catch {
          return []
        }
      })(),
      requirements: (() => {
        try {
          return JSON.parse(site.requirements || "[]")
        } catch {
          return []
        }
      })(),
    }))

    return createSuccessResponse(
      {
        clinicalSites: parsedSites,
        pagination: { limit, offset, total },
      },
      "Clinical sites retrieved successfully"
    )
  } catch (error) {
    console.error("Clinical sites GET error:", error)
    // Surface a non-sensitive database error hint for integration tests
    return createErrorResponse("Database error occurred", HTTP_STATUS.INTERNAL_SERVER_ERROR)
  }
})

// POST /api/clinical-sites - Create new clinical site
export const POST = withErrorHandling(async (request: NextRequest) => {
  const context = await getSchoolContext()
  if (!["SUPER_ADMIN" as any, "SCHOOL_ADMIN" as any].includes(context.userRole)) {
    return createErrorResponse(ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS, HTTP_STATUS.FORBIDDEN)
  }

  const body = await request.json()
  try {
    const validatedData = createClinicalSiteSchema.parse(body)

    // Check for existing site with same name within the same school
    const [existingSite] = await db
      .select()
      .from(clinicalSites)
      .where(
        and(
          eq(clinicalSites.name, validatedData.name),
          context.schoolId ? eq(clinicalSites.schoolId, context.schoolId) : undefined
        )
      )
      .limit(1)

    if (existingSite) {
      return createErrorResponse(
        "Clinical site with this name already exists",
        HTTP_STATUS.BAD_REQUEST
      )
    }

    const siteId = crypto.randomUUID()
    const [newSite] = await db
      .insert(clinicalSites)
      .values({
        id: siteId,
        schoolId: context.schoolId, // Link to school
        name: validatedData.name,
        address: validatedData.address,
        phone: validatedData.phone,
        email: validatedData.email,
        type: validatedData.type,
        capacity: validatedData.capacity,
        specialties: JSON.stringify(validatedData.specialties || []),
        contactPersonName: validatedData.contactPersonName,
        contactPersonTitle: validatedData.contactPersonTitle,
        contactPersonPhone: validatedData.contactPersonPhone,
        contactPersonEmail: validatedData.contactPersonEmail,
        requirements: JSON.stringify(validatedData.requirements || []),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()

    return createSuccessResponse(
      { clinicalSite: newSite },
      "Clinical site created successfully",
      HTTP_STATUS.CREATED
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse(error.message, HTTP_STATUS.BAD_REQUEST)
    }
    throw error
  }
})

// PUT /api/clinical-sites - Update clinical site
export const PUT = withErrorHandling(async (request: NextRequest) => {
  const context = await getSchoolContext()
  if (!["SUPER_ADMIN" as any, "SCHOOL_ADMIN" as any].includes(context.userRole)) {
    return createErrorResponse(ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS, HTTP_STATUS.FORBIDDEN)
  }

  const body = await request.json()
  const { id, ...updateData } = body
  if (!id) {
    return createErrorResponse("Clinical site ID is required", HTTP_STATUS.BAD_REQUEST)
  }

  try {
    const validatedData = updateClinicalSiteSchema.parse(updateData)

    const [existingSite] = await db
      .select()
      .from(clinicalSites)
      .where(eq(clinicalSites.id, id))
      .limit(1)

    if (!existingSite) {
      return createErrorResponse("Clinical site not found", HTTP_STATUS.NOT_FOUND)
    }

    if (validatedData.name && validatedData.name !== existingSite.name) {
      const [conflictSite] = await db
        .select()
        .from(clinicalSites)
        .where(eq(clinicalSites.name, validatedData.name))
        .limit(1)
      if (conflictSite) {
        return createErrorResponse(
          "Another site with this name already exists",
          HTTP_STATUS.CONFLICT
        )
      }
    }

    const [updatedSite] = await db
      .update(clinicalSites)
      .set({
        ...validatedData,
        specialties: validatedData.specialties
          ? JSON.stringify(validatedData.specialties)
          : existingSite.specialties,
        requirements: validatedData.requirements
          ? JSON.stringify(validatedData.requirements)
          : existingSite.requirements,
        updatedAt: new Date(),
      })
      .where(eq(clinicalSites.id, id))
      .returning()

    return createSuccessResponse(
      { clinicalSite: updatedSite },
      "Clinical site updated successfully"
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse(error.message, HTTP_STATUS.BAD_REQUEST)
    }
    throw error
  }
})

// DELETE /api/clinical-sites - Delete clinical site
export const DELETE = withErrorHandling(async (request: NextRequest) => {
  const context = await getSchoolContext()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  if (!id) {
    return createErrorResponse("Clinical site ID is required", HTTP_STATUS.BAD_REQUEST)
  }

  if (context.userRole !== ("SUPER_ADMIN" as any)) {
    return createErrorResponse(ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS, HTTP_STATUS.FORBIDDEN)
  }

  const [activeRotations] = await db
    .select({ count: count(rotations.id) })
    .from(rotations)
    .where(and(eq(rotations.clinicalSiteId, id), eq(rotations.status, "ACTIVE")))

  if ((activeRotations?.count || 0) > 0) {
    return createErrorResponse(
      "Cannot delete clinical site with active rotations",
      HTTP_STATUS.BAD_REQUEST
    )
  }

  const [existingSite] = await db
    .select()
    .from(clinicalSites)
    .where(eq(clinicalSites.id, id))
    .limit(1)
  if (!existingSite) {
    return createErrorResponse(ERROR_MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND)
  }

  await db.delete(clinicalSites).where(eq(clinicalSites.id, id))
  return createSuccessResponse(null, "Clinical site deleted successfully")
})

