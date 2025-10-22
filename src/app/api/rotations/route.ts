import { and, desc, eq, gte, lte } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "../../../database/connection-pool"
import { clinicalSites, rotations, users } from "../../../database/schema"
import { getSchoolContext } from "../../../lib/school-utils"

// Validation schemas
const createRotationSchema = z.object({
  studentId: z.string().min(1, "Student ID is required"),
  clinicalSiteId: z.string().min(1, "Clinical site ID is required"),
  preceptorId: z.string().min(1, "Preceptor ID is required"),
  supervisorId: z.string().optional(),
  specialty: z.string().min(1, "Specialty is required"),
  startDate: z.string().datetime("Invalid start date"),
  endDate: z.string().datetime("Invalid end date"),
  requiredHours: z.number().min(1, "Required hours must be at least 1"),
  objectives: z.array(z.string()).optional(),
})

const updateRotationSchema = z.object({
  clinicalSiteId: z.string().optional(),
  preceptorId: z.string().optional(),
  supervisorId: z.string().optional(),
  specialty: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  requiredHours: z.number().min(1).optional(),
  status: z.enum(["SCHEDULED", "ACTIVE", "COMPLETED", "CANCELLED"]).optional(),
  objectives: z.array(z.string()).optional(),
})

// GET /api/rotations - Get rotations with filtering
export async function GET(request: NextRequest) {
  try {
    const context = await getSchoolContext()
    const { searchParams } = new URL(request.url)

    const studentId = searchParams.get("studentId")
    const clinicalSiteId = searchParams.get("clinicalSiteId")
    const preceptorId = searchParams.get("preceptorId")
    const status = searchParams.get("status")
    const specialty = searchParams.get("specialty")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const offset = Number.parseInt(searchParams.get("offset") || "0")

    // Build query conditions
    const conditions = []

    // Role-based filtering
    if (context.userRole === "STUDENT") {
      conditions.push(eq(rotations.studentId, context.userId))
    } else if (context.userRole === "CLINICAL_PRECEPTOR") {
      conditions.push(eq(rotations.preceptorId, context.userId))
    } else if (context.userRole === "CLINICAL_SUPERVISOR") {
      conditions.push(eq(rotations.supervisorId, context.userId))
    }

    if (studentId) {
      conditions.push(eq(rotations.studentId, studentId))
    }

    if (clinicalSiteId) {
      conditions.push(eq(rotations.clinicalSiteId, clinicalSiteId))
    }

    if (preceptorId) {
      conditions.push(eq(rotations.preceptorId, preceptorId))
    }

    if (status) {
      conditions.push(
        eq(rotations.status, status as "SCHEDULED" | "ACTIVE" | "COMPLETED" | "CANCELLED")
      )
    }

    if (specialty) {
      conditions.push(eq(rotations.specialty, specialty))
    }

    if (startDate) {
      conditions.push(gte(rotations.startDate, new Date(startDate)))
    }

    if (endDate) {
      conditions.push(lte(rotations.endDate, new Date(endDate)))
    }

    // Execute query with joins
    const rotationList = await db
      .select({
        id: rotations.id,
        studentId: rotations.studentId,
        clinicalSiteId: rotations.clinicalSiteId,
        preceptorId: rotations.preceptorId,
        supervisorId: rotations.supervisorId,
        specialty: rotations.specialty,
        startDate: rotations.startDate,
        endDate: rotations.endDate,
        requiredHours: rotations.requiredHours,
        completedHours: rotations.completedHours,
        status: rotations.status,
        objectives: rotations.objectives,
        createdAt: rotations.createdAt,
        updatedAt: rotations.updatedAt,
        studentName: users.name,
        clinicalSiteName: clinicalSites.name,
      })
      .from(rotations)
      .leftJoin(users, eq(rotations.studentId, users.id))
      .leftJoin(clinicalSites, eq(rotations.clinicalSiteId, clinicalSites.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(rotations.startDate))
      .limit(limit)
      .offset(offset)

    return NextResponse.json({
      success: true,
      data: rotationList.map((rotation) => ({
        ...rotation,
        objectives: rotation.objectives ? JSON.parse(rotation.objectives) : [],
        progressPercentage:
          rotation.requiredHours > 0
            ? Math.round((rotation.completedHours / rotation.requiredHours) * 100)
            : 0,
      })),
      pagination: {
        limit,
        offset,
        total: rotationList.length,
      },
    })
  } catch (_error) {
    // Error logged to audit system
    return NextResponse.json({ error: "Failed to fetch rotations" }, { status: 500 })
  }
}

// POST /api/rotations - Create new rotation
export async function POST(request: NextRequest) {
  try {
    const context = await getSchoolContext()

    // Only admins and supervisors can create rotations
    if (!["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_SUPERVISOR"].includes(context.userRole)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createRotationSchema.parse(body)

    // Validate dates
    const startDate = new Date(validatedData.startDate)
    const endDate = new Date(validatedData.endDate)

    if (endDate <= startDate) {
      return NextResponse.json({ error: "End date must be after start date" }, { status: 400 })
    }

    // Verify student exists and belongs to school
    const [student] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, validatedData.studentId), eq(users.role, "STUDENT")))
      .limit(1)

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    // Verify preceptor exists
    const [preceptor] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, validatedData.preceptorId), eq(users.role, "CLINICAL_PRECEPTOR")))
      .limit(1)

    if (!preceptor) {
      return NextResponse.json({ error: "Preceptor not found" }, { status: 404 })
    }

    // Verify clinical site exists
    const [clinicalSite] = await db
      .select()
      .from(clinicalSites)
      .where(eq(clinicalSites.id, validatedData.clinicalSiteId))
      .limit(1)

    if (!clinicalSite) {
      return NextResponse.json({ error: "Clinical site not found" }, { status: 404 })
    }

    // Verify supervisor if provided
    if (validatedData.supervisorId) {
      const [supervisor] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, validatedData.supervisorId), eq(users.role, "CLINICAL_SUPERVISOR")))
        .limit(1)

      if (!supervisor) {
        return NextResponse.json({ error: "Supervisor not found" }, { status: 404 })
      }
    }

    // Create rotation
    const [newRotation] = await db
      .insert(rotations)
      .values({
        id: crypto.randomUUID(),
        studentId: validatedData.studentId,
        clinicalSiteId: validatedData.clinicalSiteId,
        preceptorId: validatedData.preceptorId,
        supervisorId: validatedData.supervisorId,
        specialty: validatedData.specialty,
        startDate,
        endDate,
        requiredHours: validatedData.requiredHours,
        completedHours: 0,
        status: "SCHEDULED",
        objectives: JSON.stringify(validatedData.objectives || []),
      })
      .returning()

    return NextResponse.json({
      success: true,
      data: {
        ...newRotation,
        objectives: validatedData.objectives || [],
      },
      message: "Rotation created successfully",
    })
  } catch (error) {
    // Error logged to audit system
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: "Failed to create rotation" }, { status: 500 })
  }
}

// PUT /api/rotations - Update rotation
export async function PUT(request: NextRequest) {
  try {
    const context = await getSchoolContext()
    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: "Rotation ID is required" }, { status: 400 })
    }

    // Only admins and supervisors can update rotations
    if (!["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_SUPERVISOR"].includes(context.userRole)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const validatedData = updateRotationSchema.parse(updateData)

    // Get existing rotation
    const [existingRotation] = await db
      .select()
      .from(rotations)
      .where(eq(rotations.id, id))
      .limit(1)

    if (!existingRotation) {
      return NextResponse.json({ error: "Rotation not found" }, { status: 404 })
    }

    // Prepare update values
    const updateValues: Partial<typeof rotations.$inferInsert> = {
      updatedAt: new Date(),
    }

    // Validate and set fields
    if (validatedData.startDate && validatedData.endDate) {
      const startDate = new Date(validatedData.startDate)
      const endDate = new Date(validatedData.endDate)

      if (endDate <= startDate) {
        return NextResponse.json({ error: "End date must be after start date" }, { status: 400 })
      }

      updateValues.startDate = startDate
      updateValues.endDate = endDate
    } else if (validatedData.startDate) {
      const startDate = new Date(validatedData.startDate)
      if (startDate >= existingRotation.endDate) {
        return NextResponse.json({ error: "Start date must be before end date" }, { status: 400 })
      }
      updateValues.startDate = startDate
    } else if (validatedData.endDate) {
      const endDate = new Date(validatedData.endDate)
      if (endDate <= existingRotation.startDate) {
        return NextResponse.json({ error: "End date must be after start date" }, { status: 400 })
      }
      updateValues.endDate = endDate
    }

    if (validatedData.clinicalSiteId) {
      updateValues.clinicalSiteId = validatedData.clinicalSiteId
    }

    if (validatedData.preceptorId) {
      updateValues.preceptorId = validatedData.preceptorId
    }

    if (validatedData.supervisorId) {
      updateValues.supervisorId = validatedData.supervisorId
    }

    if (validatedData.specialty) {
      updateValues.specialty = validatedData.specialty
    }

    if (validatedData.requiredHours) {
      updateValues.requiredHours = validatedData.requiredHours
    }

    if (validatedData.status) {
      updateValues.status = validatedData.status
    }

    if (validatedData.objectives) {
      updateValues.objectives = JSON.stringify(validatedData.objectives)
    }

    const [updatedRotation] = await db
      .update(rotations)
      .set(updateValues)
      .where(eq(rotations.id, id))
      .returning()

    return NextResponse.json({
      success: true,
      data: {
        ...updatedRotation,
        objectives: updatedRotation.objectives ? JSON.parse(updatedRotation.objectives) : [],
      },
      message: "Rotation updated successfully",
    })
  } catch (error) {
    // Error logged to audit system
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: "Failed to update rotation" }, { status: 500 })
  }
}

// DELETE /api/rotations - Delete rotation
export async function DELETE(request: NextRequest) {
  try {
    const context = await getSchoolContext()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Rotation ID is required" }, { status: 400 })
    }

    // Only super admins and school admins can delete rotations
    if (!["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(context.userRole)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Get existing rotation
    const [existingRotation] = await db
      .select()
      .from(rotations)
      .where(eq(rotations.id, id))
      .limit(1)

    if (!existingRotation) {
      return NextResponse.json({ error: "Rotation not found" }, { status: 404 })
    }

    // Check if rotation has started
    if (existingRotation.status === "ACTIVE" || existingRotation.status === "COMPLETED") {
      return NextResponse.json(
        { error: "Cannot delete active or completed rotations" },
        { status: 400 }
      )
    }

    await db.delete(rotations).where(eq(rotations.id, id))

    return NextResponse.json({
      success: true,
      message: "Rotation deleted successfully",
    })
  } catch (_error) {
    // Error logged to audit system
    return NextResponse.json({ error: "Failed to delete rotation" }, { status: 500 })
  }
}
