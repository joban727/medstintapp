import { and, eq } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "../../../database/connection-pool"
import { accreditationOptions } from "../../../database/schema"
import { getCurrentUser } from "../../../lib/auth-clerk"
import { cacheIntegrationService } from '@/lib/cache-integration'


const createAccreditationOptionSchema = z.object({
  id: z.string().min(1, "ID is required"),
  name: z.string().min(1, "Name is required"),
  abbreviation: z.string().min(1, "Abbreviation is required"),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
})

const updateAccreditationOptionSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  abbreviation: z.string().min(1, "Abbreviation is required").optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
})

// GET /api/accreditation-options - Get all accreditation options
export async function GET(request: NextRequest) {
  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      'api:clinical-sites/route.ts',
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
    console.warn('Cache error in clinical-sites/route.ts:', cacheError)
    // Continue with original logic if cache fails
  }
  
  async function executeOriginalLogic() {

  try {
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get("activeOnly") !== "false" // Default to true
    const includeInactive = searchParams.get("includeInactive") === "true"

    // Build query conditions
    const conditions = []
    if (activeOnly && !includeInactive) {
      conditions.push(eq(accreditationOptions.isActive, true))
    }

    const options = await db
      .select()
      .from(accreditationOptions)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(accreditationOptions.sortOrder, accreditationOptions.name)

    return NextResponse.json({ accreditationOptions: options })
  } catch (error) {
    console.error("Error fetching accreditation options:", error)
    return NextResponse.json({ error: "Failed to fetch accreditation options" }, { status: 500 })
  }

  }
}

// POST /api/accreditation-options - Create new accreditation option
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    // Only super admins can create accreditation options
    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createAccreditationOptionSchema.parse(body)

    // Check if option with same ID already exists
    const [existingOption] = await db
      .select()
      .from(accreditationOptions)
      .where(eq(accreditationOptions.id, validatedData.id))
      .limit(1)

    if (existingOption) {
      return NextResponse.json(
        { error: "Accreditation option with this ID already exists" },
        { status: 409 }
      )
    }

    // If this is set as default, remove default from others
    if (validatedData.isDefault) {
      await db
        .update(accreditationOptions)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(accreditationOptions.isDefault, true))
    }

    const [newOption] = await db
      .insert(accreditationOptions)
      .values({
        ...validatedData,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()

    return NextResponse.json({ accreditationOption: newOption }, { status: 201 })
  } catch (error) {
    console.error("Error creating accreditation option:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.issues }, { status: 400 })
    }

    
    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateAllCache()
    } catch (cacheError) {
      console.warn('Cache invalidation error in clinical-sites/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Failed to create accreditation option" }, { status: 500 })
  }
}

// PUT /api/accreditation-options - Update accreditation option
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    // Only super admins can update accreditation options
    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: "Accreditation option ID is required" }, { status: 400 })
    }

    const validatedData = updateAccreditationOptionSchema.parse(updateData)

    // Check if option exists
    const [existingOption] = await db
      .select()
      .from(accreditationOptions)
      .where(eq(accreditationOptions.id, id))
      .limit(1)

    if (!existingOption) {
      return NextResponse.json({ error: "Accreditation option not found" }, { status: 404 })
    }

    // If this is being set as default, remove default from others
    if (validatedData.isDefault) {
      await db
        .update(accreditationOptions)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(accreditationOptions.isDefault, true))
    }

    const [updatedOption] = await db
      .update(accreditationOptions)
      .set({
        ...validatedData,
        updatedAt: new Date(),
      })
      .where(eq(accreditationOptions.id, id))
      .returning()

    return NextResponse.json({ accreditationOption: updatedOption })
  } catch (error) {
    console.error("Error updating accreditation option:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.issues }, { status: 400 })
    }

    
    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateAllCache()
    } catch (cacheError) {
      console.warn('Cache invalidation error in clinical-sites/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Failed to update accreditation option" }, { status: 500 })
  }
}

// DELETE /api/accreditation-options - Delete accreditation option
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    // Only super admins can delete accreditation options
    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Accreditation option ID is required" }, { status: 400 })
    }

    // Check if option exists
    const [existingOption] = await db
      .select()
      .from(accreditationOptions)
      .where(eq(accreditationOptions.id, id))
      .limit(1)

    if (!existingOption) {
      return NextResponse.json({ error: "Accreditation option not found" }, { status: 404 })
    }

    // Check if this option is being used by any schools
    // Note: You might want to add this check based on your business logic
    // For now, we'll allow deletion but you could add a soft delete instead

    await db.delete(accreditationOptions).where(eq(accreditationOptions.id, id))

    return NextResponse.json({ message: "Accreditation option deleted successfully" })
  } catch (error) {
    console.error("Error deleting accreditation option:", error)
    
    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateAllCache()
    } catch (cacheError) {
      console.warn('Cache invalidation error in clinical-sites/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Failed to delete accreditation option" }, { status: 500 })
  }
}
