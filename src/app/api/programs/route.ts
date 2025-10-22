import { and, count, desc, eq, like } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "../../../database/connection-pool"
import { programs, schools, users } from "../../../database/schema"
import { getSchoolContext } from "../../../lib/school-utils"
import { cacheIntegrationService } from '@/lib/cache-integration'


// Validation schemas
const createProgramSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  duration: z.number().min(1, "Duration must be at least 1 month"),
  schoolId: z.string().min(1, "School ID is required"),
  requirements: z.array(z.string()).optional(),
})

const updateProgramSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  duration: z.number().min(1).optional(),
  isActive: z.boolean().optional(),
  requirements: z.array(z.string()).optional(),
})

// GET /api/programs - Get programs with filtering
export async function GET(request: NextRequest) {
  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      'api:programs/route.ts',
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
    console.warn('Cache error in programs/route.ts:', cacheError)
    // Continue with original logic if cache fails
  }
  
  async function executeOriginalLogic() {

  try {
    const context = await getSchoolContext()
    const { searchParams } = new URL(request.url)

    const schoolId = searchParams.get("schoolId")
    const search = searchParams.get("search")
    const isActive = searchParams.get("isActive")
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const offset = Number.parseInt(searchParams.get("offset") || "0")
    const includeStats = searchParams.get("includeStats") === "true"

    // Build query conditions
    const conditions = []

    // Role-based filtering
    if (context.userRole === "SCHOOL_ADMIN" && context.schoolId) {
      conditions.push(eq(programs.schoolId, context.schoolId))
    } else if (schoolId) {
      conditions.push(eq(programs.schoolId, schoolId))
    }

    if (search) {
      conditions.push(like(programs.name, `%${search}%`))
    }

    if (isActive !== null) {
      conditions.push(eq(programs.isActive, isActive === "true"))
    }

    // Execute main query with school information
    const programList = await db
      .select({
        id: programs.id,
        name: programs.name,
        description: programs.description,
        duration: programs.duration,
        schoolId: programs.schoolId,
        isActive: programs.isActive,
        requirements: programs.requirements,
        createdAt: programs.createdAt,
        updatedAt: programs.updatedAt,
        schoolName: schools.name,
      })
      .from(programs)
      .leftJoin(schools, eq(programs.schoolId, schools.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(programs.createdAt))
      .limit(limit)
      .offset(offset)

    // Include statistics if requested
    let programsWithStats = programList
    if (includeStats) {
      programsWithStats = await Promise.all(
        programList.map(async (program) => {
          const [studentCount] = await db
            .select({
              totalStudents: count(users.id),
            })
            .from(users)
            .where(and(eq(users.programId, program.id), eq(users.role, "STUDENT")))

          const [activeStudents] = await db
            .select({
              activeStudents: count(users.id),
            })
            .from(users)
            .where(
              and(
                eq(users.programId, program.id),
                eq(users.role, "STUDENT"),
                eq(users.academicStatus, "ACTIVE")
              )
            )

          return {
            ...program,
            requirements: program.requirements ? JSON.parse(program.requirements) : [],
            stats: {
              totalStudents: studentCount?.totalStudents || 0,
              activeStudents: activeStudents?.activeStudents || 0,
            },
          }
        })
      )
    } else {
      programsWithStats = programList.map((program) => ({
        ...program,
        requirements: program.requirements ? JSON.parse(program.requirements) : [],
      }))
    }

    return NextResponse.json({
      success: true,
      data: programsWithStats,
      pagination: {
        limit,
        offset,
        total: programList.length,
      },
    })
  } catch (error) {
    console.error("Error fetching programs:", error)
    return NextResponse.json({ error: "Failed to fetch programs" }, { status: 500 })
  }

  }
}

// POST /api/programs - Create new program
export async function POST(request: NextRequest) {
  try {
    const context = await getSchoolContext()

    // Only admins can create programs
    if (!["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(context.userRole)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createProgramSchema.parse(body)

    // Validate school access
    if (context.userRole === "SCHOOL_ADMIN") {
      if (!context.schoolId || validatedData.schoolId !== context.schoolId) {
        return NextResponse.json({ error: "Access denied to this school" }, { status: 403 })
      }
    }

    // Verify school exists
    const [school] = await db
      .select()
      .from(schools)
      .where(eq(schools.id, validatedData.schoolId))
      .limit(1)

    if (!school) {
      return NextResponse.json({ error: "School not found" }, { status: 404 })
    }

    // Check if program with same name exists in the school
    const [existingProgram] = await db
      .select()
      .from(programs)
      .where(
        and(eq(programs.name, validatedData.name), eq(programs.schoolId, validatedData.schoolId))
      )
      .limit(1)

    if (existingProgram) {
      return NextResponse.json(
        { error: "Program with this name already exists in this school" },
        { status: 400 }
      )
    }

    // Create program
    const [newProgram] = await db
      .insert(programs)
      .values({
        id: crypto.randomUUID(),
        name: validatedData.name,
        description: validatedData.description,
        duration: validatedData.duration,
        classYear: new Date().getFullYear() + Math.ceil(validatedData.duration / 12),
        schoolId: validatedData.schoolId,
        requirements: JSON.stringify(validatedData.requirements || []),
      })
      .returning()

    return NextResponse.json({
      success: true,
      data: {
        ...newProgram,
        requirements: validatedData.requirements || [],
      },
      message: "Program created successfully",
    })
  } catch (error) {
    console.error("Error creating program:", error)
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
      console.warn('Cache invalidation error in programs/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Failed to create program" }, { status: 500 })
  }
}

// PUT /api/programs - Update program
export async function PUT(request: NextRequest) {
  try {
    const context = await getSchoolContext()
    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: "Program ID is required" }, { status: 400 })
    }

    // Only admins can update programs
    if (!["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(context.userRole)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const validatedData = updateProgramSchema.parse(updateData)

    // Get existing program
    const [existingProgram] = await db.select().from(programs).where(eq(programs.id, id)).limit(1)

    if (!existingProgram) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 })
    }

    // Validate school access
    if (context.userRole === "SCHOOL_ADMIN") {
      if (!context.schoolId || existingProgram.schoolId !== context.schoolId) {
        return NextResponse.json({ error: "Access denied to this program" }, { status: 403 })
      }
    }

    // Check if name is being changed and if it conflicts
    if (validatedData.name && validatedData.name !== existingProgram.name) {
      const [nameConflict] = await db
        .select()
        .from(programs)
        .where(
          and(
            eq(programs.name, validatedData.name),
            eq(programs.schoolId, existingProgram.schoolId)
            // Exclude current program
          )
        )
        .limit(1)

      if (nameConflict && nameConflict.id !== id) {
        return NextResponse.json(
          { error: "Program with this name already exists in this school" },
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
    if (validatedData.description) updateValues.description = validatedData.description
    if (validatedData.duration) updateValues.duration = validatedData.duration
    if (validatedData.isActive !== undefined) updateValues.isActive = validatedData.isActive

    if (validatedData.requirements) {
      updateValues.requirements = JSON.stringify(validatedData.requirements)
    }

    const [updatedProgram] = await db
      .update(programs)
      .set(updateValues)
      .where(eq(programs.id, id))
      .returning()

    return NextResponse.json({
      success: true,
      data: {
        ...updatedProgram,
        requirements: updatedProgram.requirements ? JSON.parse(updatedProgram.requirements) : [],
      },
      message: "Program updated successfully",
    })
  } catch (error) {
    console.error("Error updating program:", error)
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
      console.warn('Cache invalidation error in programs/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Failed to update program" }, { status: 500 })
  }
}

// DELETE /api/programs - Delete program
export async function DELETE(request: NextRequest) {
  try {
    const context = await getSchoolContext()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Program ID is required" }, { status: 400 })
    }

    // Only super admins and school admins can delete programs
    if (!["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(context.userRole)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Get existing program
    const [existingProgram] = await db.select().from(programs).where(eq(programs.id, id)).limit(1)

    if (!existingProgram) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 })
    }

    // Validate school access
    if (context.userRole === "SCHOOL_ADMIN") {
      if (!context.schoolId || existingProgram.schoolId !== context.schoolId) {
        return NextResponse.json({ error: "Access denied to this program" }, { status: 403 })
      }
    }

    // Check if program has enrolled students
    const [enrolledStudents] = await db
      .select({ count: count(users.id) })
      .from(users)
      .where(and(eq(users.programId, id), eq(users.role, "STUDENT")))

    if (enrolledStudents.count > 0) {
      return NextResponse.json(
        { error: "Cannot delete program with enrolled students" },
        { status: 400 }
      )
    }

    await db.delete(programs).where(eq(programs.id, id))

    return NextResponse.json({
      success: true,
      message: "Program deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting program:", error)
    
    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateAllCache()
    } catch (cacheError) {
      console.warn('Cache invalidation error in programs/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Failed to delete program" }, { status: 500 })
  }
}
