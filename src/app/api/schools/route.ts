import { and, eq, like, or } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { db } from "../../../database/connection-pool"
import { programs, schools } from "../../../database/schema"
import { getCurrentUser } from "../../../lib/auth-clerk"
import { cacheIntegrationService } from '@/lib/cache-integration'


export async function GET(request: NextRequest) {
  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      'api:schools/route.ts',
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
    console.warn('Cache error in schools/route.ts:', cacheError)
    // Continue with original logic if cache fails
  }
  
  async function executeOriginalLogic() {

  try {
    // Require authentication for school data
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")
    const includePrograms = searchParams.get("includePrograms") === "true"
    const activeOnly = searchParams.get("activeOnly") !== "false" // Default to true

    // Build the base query
    let whereCondition = activeOnly ? eq(schools.isActive, true) : undefined

    // Add search functionality
    if (search?.trim()) {
      const searchTerm = `%${search.trim()}%`
      const searchCondition = or(like(schools.name, searchTerm), like(schools.address, searchTerm))

      whereCondition = whereCondition ? and(whereCondition, searchCondition) : searchCondition
    }

    // Fetch schools
    const schoolsData = await db
      .select({
        id: schools.id,
        name: schools.name,
        address: schools.address,
        phone: schools.phone,
        email: schools.email,
        website: schools.website,
        accreditation: schools.accreditation,
        isActive: schools.isActive,
        createdAt: schools.createdAt,
      })
      .from(schools)
      .where(whereCondition)
      .orderBy(schools.name)

    // If programs are requested, fetch them for each school
    if (includePrograms) {
      const schoolsWithPrograms = await Promise.all(
        schoolsData.map(async (school) => {
          const schoolPrograms = await db
            .select({
              id: programs.id,
              name: programs.name,
              description: programs.description,
              duration: programs.duration,
              requirements: programs.requirements,
              isActive: programs.isActive,
            })
            .from(programs)
            .where(
              activeOnly
                ? and(eq(programs.schoolId, school.id), eq(programs.isActive, true))
                : eq(programs.schoolId, school.id)
            )
            .orderBy(programs.name)

          return {
            ...school,
            programs: schoolPrograms,
          }
        })
      )

      return NextResponse.json({
        success: true,
        schools: schoolsWithPrograms,
        count: schoolsWithPrograms.length,
      })
    }

    return NextResponse.json({
      success: true,
      schools: schoolsData,
      count: schoolsData.length,
    })
  } catch (error) {
    console.error("Error fetching schools:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }

  }
}

// POST endpoint for creating new schools (admin only)
export async function POST(request: NextRequest) {
  try {
    // Require super admin authentication
    const user = await getCurrentUser()
    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()

    // Basic validation
    if (!body.name) {
      return NextResponse.json({ error: "Missing required field: name" }, { status: 400 })
    }

    const schoolId = crypto.randomUUID()
    const [newSchool] = await db
      .insert(schools)
      .values({
        id: schoolId,
        name: body.name,
        address: body.address,
        phone: body.phone,
        email: body.email,
        website: body.website || null,
        accreditation: body.accreditation || "Not specified",
        isActive: body.isActive !== false, // Default to true
        adminId: body.adminId || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({
        id: schools.id,
        name: schools.name,
        address: schools.address,
        phone: schools.phone,
        email: schools.email,
        website: schools.website,
        isActive: schools.isActive,
      })

    return NextResponse.json(
      {
        success: true,
        message: "School created successfully",
        data: newSchool,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error creating school:", error)

    if (error instanceof Error && error.message.includes("unique constraint")) {
      return NextResponse.json({ error: "A school with this name already exists" }, { status: 409 })
    }

    
    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateAllCache()
    } catch (cacheError) {
      console.warn('Cache invalidation error in schools/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
