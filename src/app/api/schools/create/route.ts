import { currentUser } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { nanoid } from "nanoid"
import { type NextRequest, NextResponse } from "next/server"
import { db } from "../../../../database/connection-pool"
import { programs, schools, users } from "../../../../database/schema"
import { cacheIntegrationService } from '@/lib/cache-integration'


export async function POST(request: NextRequest) {
  try {
    const clerkUser = await currentUser()

    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, address, phone, email, website, accreditation, programs: schoolPrograms } = body

    if (!name) {
      return NextResponse.json({ error: "School name is required" }, { status: 400 })
    }

    // Create the school
    const schoolId = nanoid()
    const [school] = await db
      .insert(schools)
      .values({
        id: schoolId,
        name,
        address: address?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        website: website || null,
        accreditation: accreditation || "LCME",
        isActive: true,
        adminId: clerkUser.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()

    // Create programs if provided
    const createdPrograms = []
    if (schoolPrograms && Array.isArray(schoolPrograms) && schoolPrograms.length > 0) {
      for (const program of schoolPrograms) {
        if (program.name?.trim()) {
          const programId = nanoid()
          const [createdProgram] = await db
            .insert(programs)
            .values({
              id: programId,
              name: program.name,
              description: program.description || "",
              duration: program.duration || 48,
              classYear: new Date().getFullYear() + Math.ceil((program.duration || 48) / 12),
              requirements:
                typeof program.requirements === "string"
                  ? program.requirements
                  : JSON.stringify(program.requirements || []),
              schoolId: schoolId,
            })
            .returning()

          createdPrograms.push(createdProgram)
        }
      }
    }

    // Update the user's schoolId to link them to the created school
    await db
      .update(users)
      .set({
        schoolId: schoolId,
        updatedAt: new Date(),
      })
      .where(eq(users.id, clerkUser.id))

    return NextResponse.json({
      id: schoolId,
      name: school.name,
      email: school.email,
      programs: createdPrograms,
    })
  } catch (error) {
    console.error("Error creating school:", error)
    
    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateAllCache()
    } catch (cacheError) {
      console.warn('Cache invalidation error in schools/create/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Failed to create school" }, { status: 500 })
  }
}
