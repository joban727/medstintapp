import crypto from "node:crypto"
import { auth } from "@clerk/nextjs/server"
import { and, asc, eq } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/database/db"
import { users } from "@/database/schema"
import { cacheIntegrationService } from '@/lib/cache-integration'


const createPreceptorSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  specialty: z.string().min(1, "Please select a specialty"),
  clinicalSite: z.string().min(1, "Clinical site is required"),
  yearsExperience: z.number().min(1, "Years of experience is required"),
  maxCapacity: z.number().min(1, "Maximum student capacity is required"),
  department: z.string().optional(),
  bio: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get the current user and verify they are a school admin
    const currentUser = await db.select().from(users).where(eq(users.id, userId)).limit(1)

    if (!currentUser.length || currentUser[0].role !== "SCHOOL_ADMIN") {
      return NextResponse.json(
        { error: "Only school administrators can create preceptors" },
        { status: 403 }
      )
    }

    const schoolAdmin = currentUser[0]
    if (!schoolAdmin.schoolId) {
      return NextResponse.json(
        { error: "School administrator must be associated with a school" },
        { status: 400 }
      )
    }

    // Parse and validate the request body
    const body = await request.json()
    const validatedData = createPreceptorSchema.parse(body)

    // Check if a user with this email already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, validatedData.email))
      .limit(1)

    if (existingUser.length > 0) {
      return NextResponse.json(
        { error: "A user with this email address already exists" },
        { status: 409 }
      )
    }

    // Create the preceptor user
    const newPreceptorResult = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        email: validatedData.email,
        name: validatedData.name,
        role: "CLINICAL_PRECEPTOR" as const,
        schoolId: currentUser[0].schoolId || "",
        department: validatedData.department,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()

    const newPreceptor = newPreceptorResult[0]

    // TODO: Send invitation email to the new preceptor
    // This would typically involve sending an email with a link to set up their account
    console.log(`Preceptor invitation should be sent to: ${validatedData.email}`)

    return NextResponse.json(
      {
        message: "Preceptor created successfully",
        preceptor: {
          id: newPreceptor.id,
          name: newPreceptor.name,
          email: newPreceptor.email,
          department: newPreceptor.department,
          role: newPreceptor.role,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error creating preceptor:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: error.issues.map((err) => ({
            field: err.path.join("."),
            message: err.message,
          })),
        },
        { status: 400 }
      )
    }

    
    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateAllCache()
    } catch (cacheError) {
      console.warn('Cache invalidation error in preceptors/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(_request: NextRequest) {
  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      'api:preceptors/route.ts',
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
    console.warn('Cache error in preceptors/route.ts:', cacheError)
    // Continue with original logic if cache fails
  }
  
  async function executeOriginalLogic() {

  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get the current user
    const currentUser = await db.select().from(users).where(eq(users.id, userId)).limit(1)

    if (!currentUser.length) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const user = currentUser[0]

    // Only school admins and supervisors can view all preceptors
    if (!["SCHOOL_ADMIN", "CLINICAL_SUPERVISOR"].includes(user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Build where conditions - if user has a school_id, filter by it, otherwise show all
    let whereCondition: ReturnType<typeof and> | ReturnType<typeof eq>
    if (user.schoolId) {
      whereCondition = and(
        eq(users.isActive, true),
        eq(users.role, "CLINICAL_PRECEPTOR"),
        eq(users.schoolId, user.schoolId)
      )
    } else {
      // If admin has no school_id (super admin), show all active preceptors
      whereCondition = and(eq(users.isActive, true), eq(users.role, "CLINICAL_PRECEPTOR"))
    }

    const preceptors = await db
      .select({
        id: users.id,
        userId: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        department: users.department,
        isActive: users.isActive,
        schoolId: users.schoolId,
      })
      .from(users)
      .where(whereCondition)
      .orderBy(asc(users.name))

    return NextResponse.json({ preceptors })
  } catch (error) {
    console.error("Error fetching preceptors:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }

  }
}
