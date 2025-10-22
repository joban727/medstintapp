import { auth } from "@clerk/nextjs/server"
import { eq, sql } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/database/connection-pool"
import { rotations, users } from "@/database/schema"
import { cacheIntegrationService } from '@/lib/cache-integration'


const createRotationSchema = z.object({
  studentId: z.string().min(1, "Student ID is required"),
  clinicalSiteId: z.string().min(1, "Clinical site ID is required"),
  preceptorId: z.string().min(1, "Preceptor ID is required"),
  supervisorId: z.string().optional(),
  specialty: z.string().min(1, "Specialty is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  requiredHours: z.number().min(1, "Required hours must be at least 1"),
  objectives: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    // Get the current user to verify they are a school admin
    const currentUser = await db.select().from(users).where(eq(users.id, userId)).limit(1)

    if (!currentUser.length || currentUser[0].role !== "SCHOOL_ADMIN") {
      return NextResponse.json(
        { message: "Only school administrators can create rotation templates" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validatedData = createRotationSchema.parse(body)

    // Check if preceptor exists and belongs to the same school
    const preceptor = await db
      .select()
      .from(users)
      .where(
        sql`${users.id} = ${validatedData.preceptorId} AND ${users.schoolId} = ${currentUser[0].schoolId}`
      )
      .limit(1)

    if (!preceptor.length) {
      return NextResponse.json(
        { message: "Invalid preceptor or preceptor not found in your school" },
        { status: 400 }
      )
    }

    // Create the rotation
    const newRotation = await db
      .insert(rotations)
      .values({
        id: crypto.randomUUID(),
        studentId: validatedData.studentId,
        clinicalSiteId: validatedData.clinicalSiteId,
        preceptorId: validatedData.preceptorId,
        supervisorId: validatedData.supervisorId,
        specialty: validatedData.specialty,
        startDate: new Date(validatedData.startDate),
        endDate: new Date(validatedData.endDate),
        requiredHours: validatedData.requiredHours,
        objectives: validatedData.objectives,
        status: "SCHEDULED",
        completedHours: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()

    return NextResponse.json(newRotation[0], { status: 201 })
  } catch (error) {
    console.error("Error creating rotation template:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          message: "Validation error",
          errors: error.issues,
        },
        { status: 400 }
      )
    }

    
    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateRotationCache()
    } catch (cacheError) {
      console.warn('Cache invalidation error in rotation-templates/route.ts:', cacheError)
    }
    
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}

export async function GET() {
  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      'api:rotation-templates/route.ts',
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
    console.warn('Cache error in rotation-templates/route.ts:', cacheError)
    // Continue with original logic if cache fails
  }
  
  async function executeOriginalLogic() {

  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get current user with role
    const currentUser = await db.select().from(users).where(eq(users.id, userId)).limit(1)

    if (!currentUser.length) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Return rotations based on user role
    let rotationsList:
      | (typeof rotations.$inferSelect)[]
      | {
          id: string
          studentId: string
          clinicalSiteId: string
          preceptorId: string
          supervisorId: string | null
          specialty: string
          startDate: Date
          endDate: Date
          requiredHours: number
          completedHours: number
          status: string
          objectives: string | null
          createdAt: Date
          updatedAt: Date
        }[]
    switch (currentUser[0].role) {
      case "SCHOOL_ADMIN":
        // Get rotations where any participant belongs to the admin's school
        rotationsList = await db
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
          })
          .from(rotations)
          .innerJoin(users, eq(rotations.studentId, users.id))
          .where(eq(users.schoolId, currentUser[0].schoolId || ""))
        break
      case "CLINICAL_PRECEPTOR":
        // Preceptors can see rotations they're assigned to
        rotationsList = await db
          .select()
          .from(rotations)
          .where(eq(rotations.preceptorId, currentUser[0].id))
        break
      default:
        // For students and supervisors, show their own rotations
        rotationsList = await db
          .select()
          .from(rotations)
          .where(
            sql`${rotations.studentId} = ${currentUser[0].id} OR ${rotations.preceptorId} = ${currentUser[0].id} OR ${rotations.supervisorId} = ${currentUser[0].id}`
          )
        break
    }
    return NextResponse.json(rotationsList)
  } catch (error) {
    console.error("Error fetching rotations:", error)
    return NextResponse.json({ error: "Failed to fetch rotations" }, { status: 500 })
  }

  }
}
