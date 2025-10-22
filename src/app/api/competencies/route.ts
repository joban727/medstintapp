import { and, count, desc, eq, like } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "../../../database/connection-pool"
import { clinicalSites, rotations } from "../../../database/schema"
import { getSchoolContext } from "../../../lib/school-utils"
import { cacheIntegrationService } from '@/lib/cache-integration'


// Validation schemas
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
export async function GET(request: NextRequest) {
  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      'api:competencies/route.ts',
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
    console.warn('Cache error in competencies/route.ts:', cacheError)
    // Continue with original logic if cache fails
  }
  
  async function executeOriginalLogic() {

  try {
    const _context = await getSchoolContext()
    const { searchParams } = new URL(request.url)

    const search = searchParams.get("search")
    const type = searchParams.get("type")
    const specialty = searchParams.get("specialty")
    const isActive = searchParams.get("isActive")
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const offset = Number.parseInt(searchParams.get("offset") || "0")
    const includeStats = searchParams.get("includeStats") === "true"

    // Build query conditions
    const conditions = []

    if (search) {
      conditions.push(like(clinicalSites.name, `%${search}%`))
    }

    if (type) {
      conditions.push(
        eq(
          clinicalSites.type,
          type as "HOSPITAL" | "CLINIC" | "NURSING_HOME" | "OUTPATIENT" | "OTHER"
        )
      )
    }

    if (isActive !== null) {
      conditions.push(eq(clinicalSites.isActive, isActive === "true"))
    }

    if (specialty) {
      // Note: This is a simple contains check. In production, you might want more sophisticated JSON querying
      conditions.push(like(clinicalSites.specialties, `%${specialty}%`))
    }

    // Execute main query
    const sites = await db
      .select()
      .from(clinicalSites)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(clinicalSites.createdAt))
      .limit(limit)
      .offset(offset)

    // Include statistics if requested
    let sitesWithStats = sites
    if (includeStats) {
      sitesWithStats = await Promise.all(
        sites.map(async (site) => {
          const [stats] = await db
            .select({
              totalRotations: count(rotations.id),
            })
            .from(rotations)
            .where(eq(rotations.clinicalSiteId, site.id))

          const [activeRotations] = await db
            .select({
              activeRotations: count(rotations.id),
            })
            .from(rotations)
            .where(and(eq(rotations.clinicalSiteId, site.id), eq(rotations.status, "ACTIVE")))

          return {
            ...site,
            specialties: site.specialties ? JSON.parse(site.specialties) : [],
            requirements: site.requirements ? JSON.parse(site.requirements) : [],
            stats: {
              totalRotations: stats?.totalRotations || 0,
              activeRotations: activeRotations?.activeRotations || 0,
              availableCapacity: site.capacity - (activeRotations?.activeRotations || 0),
            },
          }
        })
      )
    } else {
      sitesWithStats = sites.map((site) => ({
        ...site,
        specialties: site.specialties ? JSON.parse(site.specialties) : [],
        requirements: site.requirements ? JSON.parse(site.requirements) : [],
      }))
    }

    return NextResponse.json({
      success: true,
      data: sitesWithStats,
      pagination: {
        limit,
        offset,
        total: sites.length,
      },
    })
  } catch (error) {
    console.error("Error fetching clinical sites:", error)
    return NextResponse.json({ error: "Failed to fetch clinical sites" }, { status: 500 })
  }

  }
}

// POST /api/clinical-sites - Create new clinical site
export async function POST(request: NextRequest) {
  try {
    const context = await getSchoolContext()

    // Only admins can create clinical sites
    if (!["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(context.userRole)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createClinicalSiteSchema.parse(body)

    // Check if site with same name already exists
    const [existingSite] = await db
      .select()
      .from(clinicalSites)
      .where(eq(clinicalSites.name, validatedData.name))
      .limit(1)

    if (existingSite) {
      return NextResponse.json(
        { error: "Clinical site with this name already exists" },
        { status: 400 }
      )
    }

    // Create clinical site
    const [newSite] = await db
      .insert(clinicalSites)
      .values({
        id: crypto.randomUUID(),
        name: validatedData.name,
        address: validatedData.address,
        phone: validatedData.phone,
        email: validatedData.email,
        type: validatedData.type,
        capacity: validatedData.capacity,
        specialties: JSON.stringify(validatedData.specialties || []),
        isActive: true,
        contactPersonName: validatedData.contactPersonName,
        contactPersonTitle: validatedData.contactPersonTitle,
        contactPersonPhone: validatedData.contactPersonPhone,
        contactPersonEmail: validatedData.contactPersonEmail,
        requirements: JSON.stringify(validatedData.requirements || []),
      })
      .returning()

    return NextResponse.json({
      success: true,
      data: {
        ...newSite,
        specialties: validatedData.specialties || [],
        requirements: validatedData.requirements || [],
      },
      message: "Clinical site created successfully",
    })
  } catch (error) {
    console.error("Error creating clinical site:", error)
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
      console.warn('Cache invalidation error in competencies/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Failed to create clinical site" }, { status: 500 })
  }
}

// PUT /api/clinical-sites - Update clinical site
export async function PUT(request: NextRequest) {
  try {
    const context = await getSchoolContext()
    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: "Clinical site ID is required" }, { status: 400 })
    }

    // Only admins can update clinical sites
    if (!["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(context.userRole)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const validatedData = updateClinicalSiteSchema.parse(updateData)

    // Get existing site
    const [existingSite] = await db
      .select()
      .from(clinicalSites)
      .where(eq(clinicalSites.id, id))
      .limit(1)

    if (!existingSite) {
      return NextResponse.json({ error: "Clinical site not found" }, { status: 404 })
    }

    // Check if name is being changed and if it conflicts
    if (validatedData.name && validatedData.name !== existingSite.name) {
      const [nameConflict] = await db
        .select()
        .from(clinicalSites)
        .where(
          and(
            eq(clinicalSites.name, validatedData.name),
            eq(clinicalSites.id, id) // Exclude current site
          )
        )
        .limit(1)

      if (nameConflict) {
        return NextResponse.json(
          { error: "Clinical site with this name already exists" },
          { status: 400 }
        )
      }
    }

    // Prepare update values
    const updateValues: Record<string, unknown> = {
      updatedAt: new Date(),
    }

    // Set fields that are provided
    if (validatedData.name) updateValues.name = validatedData.name
    if (validatedData.address) updateValues.address = validatedData.address
    if (validatedData.phone) updateValues.phone = validatedData.phone
    if (validatedData.email) updateValues.email = validatedData.email
    if (validatedData.type) updateValues.type = validatedData.type
    if (validatedData.capacity) updateValues.capacity = validatedData.capacity
    if (validatedData.isActive !== undefined) updateValues.isActive = validatedData.isActive
    if (validatedData.contactPersonName !== undefined)
      updateValues.contactPersonName = validatedData.contactPersonName
    if (validatedData.contactPersonTitle !== undefined)
      updateValues.contactPersonTitle = validatedData.contactPersonTitle
    if (validatedData.contactPersonPhone !== undefined)
      updateValues.contactPersonPhone = validatedData.contactPersonPhone
    if (validatedData.contactPersonEmail !== undefined)
      updateValues.contactPersonEmail = validatedData.contactPersonEmail

    if (validatedData.specialties) {
      updateValues.specialties = JSON.stringify(validatedData.specialties)
    }

    if (validatedData.requirements) {
      updateValues.requirements = JSON.stringify(validatedData.requirements)
    }

    const [updatedSite] = await db
      .update(clinicalSites)
      .set(updateValues)
      .where(eq(clinicalSites.id, id))
      .returning()

    return NextResponse.json({
      success: true,
      data: {
        ...updatedSite,
        specialties: updatedSite.specialties ? JSON.parse(updatedSite.specialties) : [],
        requirements: updatedSite.requirements ? JSON.parse(updatedSite.requirements) : [],
      },
      message: "Clinical site updated successfully",
    })
  } catch (error) {
    console.error("Error updating clinical site:", error)
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
      console.warn('Cache invalidation error in competencies/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Failed to update clinical site" }, { status: 500 })
  }
}

// DELETE /api/clinical-sites - Delete clinical site
export async function DELETE(request: NextRequest) {
  try {
    const context = await getSchoolContext()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Clinical site ID is required" }, { status: 400 })
    }

    // Only super admins can delete clinical sites
    if (context.userRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Check if site has active rotations
    const [activeRotations] = await db
      .select({ count: count(rotations.id) })
      .from(rotations)
      .where(and(eq(rotations.clinicalSiteId, id), eq(rotations.status, "ACTIVE")))

    if (activeRotations.count > 0) {
      return NextResponse.json(
        { error: "Cannot delete clinical site with active rotations" },
        { status: 400 }
      )
    }

    // Get existing site
    const [existingSite] = await db
      .select()
      .from(clinicalSites)
      .where(eq(clinicalSites.id, id))
      .limit(1)

    if (!existingSite) {
      return NextResponse.json({ error: "Clinical site not found" }, { status: 404 })
    }

    await db.delete(clinicalSites).where(eq(clinicalSites.id, id))

    return NextResponse.json({
      success: true,
      message: "Clinical site deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting clinical site:", error)
    
    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateCompetencyCache()
    } catch (cacheError) {
      console.warn('Cache invalidation error in competencies/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Failed to delete clinical site" }, { status: 500 })
  }
}
