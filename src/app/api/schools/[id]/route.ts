import { currentUser } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { db } from "../../../../database/connection-pool"
import { schools } from "../../../../database/schema"
import { cacheIntegrationService } from '@/lib/cache-integration'


export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const clerkUser = await currentUser()

    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, address, phone, email, website, accreditation } = body

    if (!name || !email) {
      return NextResponse.json({ error: "School name and email are required" }, { status: 400 })
    }

    const [updatedSchool] = await db
      .update(schools)
      .set({
        name,
        address: address || "",
        phone: phone || "",
        email,
        website: website || null,
        accreditation: accreditation || "LCME",
        updatedAt: new Date(),
      })
      .where(eq(schools.id, id))
      .returning()

    if (!updatedSchool) {
      return NextResponse.json({ error: "School not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: "School updated successfully",
      data: updatedSchool,
    })
  } catch (error) {
    console.error("Error updating school:", error)
    
    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateAllCache()
    } catch (cacheError) {
      console.warn('Cache invalidation error in schools/[id]/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Failed to update school" }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const clerkUser = await currentUser()

    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Soft delete by setting isActive to false
    const [deactivatedSchool] = await db
      .update(schools)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(schools.id, id))
      .returning()

    if (!deactivatedSchool) {
      return NextResponse.json({ error: "School not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: "School deactivated successfully",
      data: deactivatedSchool,
    })
  } catch (error) {
    console.error("Error deactivating school:", error)
    
    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateAllCache()
    } catch (cacheError) {
      console.warn('Cache invalidation error in schools/[id]/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Failed to deactivate school" }, { status: 500 })
  }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      'api:schools/[id]/route.ts',
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
    console.warn('Cache error in schools/[id]/route.ts:', cacheError)
    // Continue with original logic if cache fails
  }
  
  async function executeOriginalLogic() {

  const { id } = await params
  try {
    const school = await db.select().from(schools).where(eq(schools.id, id)).limit(1)

    if (school.length === 0) {
      return NextResponse.json({ error: "School not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: school[0],
    })
  } catch (error) {
    console.error("Error fetching school:", error)
    return NextResponse.json({ error: "Failed to fetch school" }, { status: 500 })
  }

  }
}
