import { and, count, desc, eq, like } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"
import { z } from "zod"
import { db } from "../../../../database/connection-pool"
import { assessments, competencies, programs } from "../../../../database/schema"
import { getSchoolContext } from "../../../../lib/school-utils"

// Validation schemas
const createCompetencySchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  category: z.string().min(1, "Category is required"),
  level: z.enum(["FUNDAMENTAL", "INTERMEDIATE", "ADVANCED", "EXPERT"]),
  isRequired: z.boolean().default(false),
  programId: z.string().optional(),
  criteria: z.array(z.string()).optional(),
})

const updateCompetencySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  level: z.enum(["FUNDAMENTAL", "INTERMEDIATE", "ADVANCED", "EXPERT"]).optional(),
  isRequired: z.boolean().optional(),
  programId: z.string().optional(),
  criteria: z.array(z.string()).optional(),
})

// GET /api/competencies - Get competencies with filtering
export async function GET(request: NextRequest) {
  try {
    const _context = await getSchoolContext()
    const { searchParams } = new URL(request.url)

    const programId = searchParams.get("programId")
    const category = searchParams.get("category")
    const level = searchParams.get("level")
    const isRequired = searchParams.get("isRequired")
    const search = searchParams.get("search")
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const offset = Number.parseInt(searchParams.get("offset") || "0")
    const includeStats = searchParams.get("includeStats") === "true"

    // Build query conditions
    const conditions = []

    if (programId) {
      conditions.push(eq(competencies.programId, programId))
    }

    if (category) {
      conditions.push(eq(competencies.category, category))
    }

    if (level) {
      conditions.push(
        eq(competencies.level, level as "FUNDAMENTAL" | "INTERMEDIATE" | "ADVANCED" | "EXPERT")
      )
    }

    if (isRequired !== null) {
      conditions.push(eq(competencies.isRequired, isRequired === "true"))
    }

    if (search) {
      conditions.push(like(competencies.name, `%${search}%`))
    }

    // Execute main query with program information
    const competencyList = await db
      .select({
        id: competencies.id,
        name: competencies.name,
        description: competencies.description,
        category: competencies.category,
        level: competencies.level,
        isRequired: competencies.isRequired,
        programId: competencies.programId,
        createdAt: competencies.createdAt,
        updatedAt: competencies.updatedAt,
        programName: programs.name,
      })
      .from(competencies)
      .leftJoin(programs, eq(competencies.programId, programs.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(competencies.createdAt))
      .limit(limit)
      .offset(offset)

    // Include statistics if requested
    let competenciesWithStats = competencyList
    if (includeStats) {
      competenciesWithStats = await Promise.all(
        competencyList.map(async (competency) => {
          const [totalAssessments] = await db
            .select({
              total: count(assessments.id),
            })
            .from(assessments)
            .where(eq(assessments.competencyId, competency.id))

          const [passedAssessments] = await db
            .select({
              passed: count(assessments.id),
            })
            .from(assessments)
            .where(and(eq(assessments.competencyId, competency.id), eq(assessments.passed, true)))

          const passRate =
            totalAssessments.total > 0
              ? Math.round((passedAssessments.passed / totalAssessments.total) * 100)
              : 0

          return {
            ...competency,
            stats: {
              totalAssessments: totalAssessments.total || 0,
              passedAssessments: passedAssessments.passed || 0,
              passRate,
            },
          }
        })
      )
    } else {
      competenciesWithStats = competencyList
    }

    return NextResponse.json({
      success: true,
      data: competenciesWithStats,
      pagination: {
        limit,
        offset,
        total: competencyList.length,
      },
    })
  } catch (error) {
    console.error("Error fetching competencies:", error)
    return NextResponse.json({ error: "Failed to fetch competencies" }, { status: 500 })
  }
}

// POST /api/competencies - Create new competency
export async function POST(request: NextRequest) {
  try {
    const context = await getSchoolContext()

    // Only admins and supervisors can create competencies
    if (!["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_SUPERVISOR"].includes(context.userRole)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createCompetencySchema.parse(body)

    // Verify program exists if provided
    if (validatedData.programId) {
      const [program] = await db
        .select()
        .from(programs)
        .where(eq(programs.id, validatedData.programId))
        .limit(1)

      if (!program) {
        return NextResponse.json({ error: "Program not found" }, { status: 404 })
      }

      // School admins can only create competencies for their school's programs
      if (context.userRole === "SCHOOL_ADMIN") {
        if (!context.schoolId || program.schoolId !== context.schoolId) {
          return NextResponse.json({ error: "Access denied to this program" }, { status: 403 })
        }
      }
    }

    // Check if competency with same name exists in the program
    if (validatedData.programId) {
      const [existingCompetency] = await db
        .select()
        .from(competencies)
        .where(
          and(
            eq(competencies.name, validatedData.name),
            eq(competencies.programId, validatedData.programId)
          )
        )
        .limit(1)

      if (existingCompetency) {
        return NextResponse.json(
          { error: "Competency with this name already exists in this program" },
          { status: 400 }
        )
      }
    }

    // Create competency
    const [newCompetency] = await db
      .insert(competencies)
      .values({
        id: uuidv4(),
        name: validatedData.name,
        description: validatedData.description,
        category: validatedData.category,
        level: validatedData.level,
        isRequired: validatedData.isRequired,
        programId: validatedData.programId,
      })
      .returning()

    return NextResponse.json({
      success: true,
      data: newCompetency,
      message: "Competency created successfully",
    })
  } catch (error) {
    console.error("Error creating competency:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: "Failed to create competency" }, { status: 500 })
  }
}

// PUT /api/competencies - Update competency
export async function PUT(request: NextRequest) {
  try {
    const context = await getSchoolContext()
    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: "Competency ID is required" }, { status: 400 })
    }

    // Only admins and supervisors can update competencies
    if (!["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_SUPERVISOR"].includes(context.userRole)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const validatedData = updateCompetencySchema.parse(updateData)

    // Get existing competency
    const [existingCompetency] = await db
      .select({
        id: competencies.id,
        name: competencies.name,
        programId: competencies.programId,
        schoolId: programs.schoolId,
      })
      .from(competencies)
      .leftJoin(programs, eq(competencies.programId, programs.id))
      .where(eq(competencies.id, id))
      .limit(1)

    if (!existingCompetency) {
      return NextResponse.json({ error: "Competency not found" }, { status: 404 })
    }

    // Validate school access
    if (context.userRole === "SCHOOL_ADMIN") {
      if (!context.schoolId || existingCompetency.schoolId !== context.schoolId) {
        return NextResponse.json({ error: "Access denied to this competency" }, { status: 403 })
      }
    }

    // Verify new program if being changed
    if (validatedData.programId && validatedData.programId !== existingCompetency.programId) {
      const [newProgram] = await db
        .select()
        .from(programs)
        .where(eq(programs.id, validatedData.programId))
        .limit(1)

      if (!newProgram) {
        return NextResponse.json({ error: "Program not found" }, { status: 404 })
      }

      // School admins can only move to their school's programs
      if (context.userRole === "SCHOOL_ADMIN") {
        if (!context.schoolId || newProgram.schoolId !== context.schoolId) {
          return NextResponse.json({ error: "Access denied to target program" }, { status: 403 })
        }
      }
    }

    // Check if name is being changed and if it conflicts
    if (validatedData.name && validatedData.name !== existingCompetency.name) {
      const targetProgramId = validatedData.programId || existingCompetency.programId

      if (targetProgramId) {
        const [nameConflict] = await db
          .select()
          .from(competencies)
          .where(
            and(
              eq(competencies.name, validatedData.name),
              eq(competencies.programId, targetProgramId)
            )
          )
          .limit(1)

        if (nameConflict && nameConflict.id !== id) {
          return NextResponse.json(
            { error: "Competency with this name already exists in this program" },
            { status: 400 }
          )
        }
      }
    }

    // Prepare update values
    const updateValues: Record<string, unknown> = {
      updatedAt: new Date(),
    }

    // Set fields that are provided
    if (validatedData.name) updateValues.name = validatedData.name
    if (validatedData.description) updateValues.description = validatedData.description
    if (validatedData.category) updateValues.category = validatedData.category
    if (validatedData.level) updateValues.level = validatedData.level
    if (validatedData.isRequired !== undefined) updateValues.isRequired = validatedData.isRequired
    if (validatedData.programId !== undefined) updateValues.programId = validatedData.programId

    // Note: criteria field is not available in SQLite schema

    const [updatedCompetency] = await db
      .update(competencies)
      .set(updateValues)
      .where(eq(competencies.id, id))
      .returning()

    return NextResponse.json({
      success: true,
      data: updatedCompetency,
      message: "Competency updated successfully",
    })
  } catch (error) {
    console.error("Error updating competency:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: "Failed to update competency" }, { status: 500 })
  }
}

// DELETE /api/competencies - Delete competency
export async function DELETE(request: NextRequest) {
  try {
    const context = await getSchoolContext()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Competency ID is required" }, { status: 400 })
    }

    // Only super admins and school admins can delete competencies
    if (!["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(context.userRole)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Get existing competency with program info
    const [existingCompetency] = await db
      .select({
        id: competencies.id,
        name: competencies.name,
        programId: competencies.programId,
        schoolId: programs.schoolId,
      })
      .from(competencies)
      .leftJoin(programs, eq(competencies.programId, programs.id))
      .where(eq(competencies.id, id))
      .limit(1)

    if (!existingCompetency) {
      return NextResponse.json({ error: "Competency not found" }, { status: 404 })
    }

    // Validate school access
    if (context.userRole === "SCHOOL_ADMIN") {
      if (!context.schoolId || existingCompetency.schoolId !== context.schoolId) {
        return NextResponse.json({ error: "Access denied to this competency" }, { status: 403 })
      }
    }

    // Check if competency has assessments
    const [existingAssessments] = await db
      .select({ count: count(assessments.id) })
      .from(assessments)
      .where(eq(assessments.competencyId, id))

    if (existingAssessments.count > 0) {
      return NextResponse.json(
        { error: "Cannot delete competency with existing assessments" },
        { status: 400 }
      )
    }

    await db.delete(competencies).where(eq(competencies.id, id))

    return NextResponse.json({
      success: true,
      message: "Competency deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting competency:", error)
    return NextResponse.json({ error: "Failed to delete competency" }, { status: 500 })
  }
}
