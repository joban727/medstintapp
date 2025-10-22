import { eq } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "../../../database/connection-pool"
import { programs, schools, users } from "../../../database/schema"
import { getCurrentUser } from "../../../lib/auth-clerk"
import { cacheIntegrationService } from '@/lib/cache-integration'


// Validation schema for school registration
const schoolRegistrationSchema = z.object({
  // School Information
  schoolName: z.string().min(1, "School name is required"),
  schoolType: z.enum(["university", "college", "institute", "hospital", "other"]),
  address: z.string().min(1, "Address is required").optional(),
  city: z.string().min(1, "City is required").optional(),
  state: z.string().min(1, "State is required").optional(),
  zipCode: z.string().min(1, "ZIP code is required").optional(),
  country: z.string().min(1, "Country is required").optional(),
  phone: z.string().min(1, "Phone number is required"),
  website: z.string().url("Please enter a valid website URL").optional().or(z.literal("")),

  // Accreditation
  accreditationBody: z.string().min(1, "Accreditation body is required"),
  accreditationNumber: z.string().min(1, "Accreditation number is required"),
  accreditationExpiry: z.string().min(1, "Accreditation expiry date is required"),

  // Administrator Information
  adminFirstName: z.string().min(1, "Administrator first name is required"),
  adminLastName: z.string().min(1, "Administrator last name is required"),
  adminEmail: z.string().email("Please enter a valid email address"),
  adminPhone: z.string().min(1, "Administrator phone number is required"),
  adminTitle: z.string().min(1, "Administrator title is required"),

  // Programs
  programs: z
    .array(
      z.object({
        name: z.string().min(1, "Program name is required"),
        description: z.string().min(1, "Program description is required"),
        duration: z.number().min(1, "Program duration must be at least 1 month"),
        capacity: z.number().min(1, "Program capacity must be at least 1"),
        requirements: z.array(z.string()).min(1, "At least one requirement is needed"),
      })
    )
    .min(1, "At least one program is required"),
})

export async function POST(request: NextRequest) {
  try {
    // Parse request body with proper error handling
    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch (jsonError) {
      console.error("JSON parsing error:", jsonError)
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 })
    }

    // Get the current user
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Validate request body
    const validatedData = schoolRegistrationSchema.parse(body)

    // Check if user already has a school associated
    const [existingUser] = await db
      .select({ schoolId: users.schoolId, role: users.role })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1)

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (existingUser.schoolId) {
      return NextResponse.json({ error: "User already has a school associated" }, { status: 400 })
    }

    // Start a transaction to create school, update user, and create programs
    const result = await db.transaction(async (tx) => {
      // Create the school
      const schoolId = crypto.randomUUID()
      const [newSchool] = await tx
        .insert(schools)
        .values({
          id: schoolId,
          name: validatedData.schoolName,
          address:
            [
              validatedData.address,
              validatedData.city,
              validatedData.state,
              validatedData.zipCode,
              validatedData.country,
            ]
              .filter(Boolean)
              .join(", ") || "Not provided",
          phone: validatedData.phone,
          email: validatedData.adminEmail,
          website: validatedData.website || null,
          accreditation: `${validatedData.accreditationBody} - ${validatedData.accreditationNumber} (Expires: ${validatedData.accreditationExpiry})`,
          isActive: true,
          adminId: user.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning({
          id: schools.id,
          name: schools.name,
        })

      if (!newSchool) {
        throw new Error("Failed to create school")
      }

      // Update user to be school admin and associate with the school
      await tx
        .update(users)
        .set({
          role: "SCHOOL_ADMIN",
          schoolId: newSchool.id,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id))

      // Create programs for the school
      const createdPrograms = []
      for (const programData of validatedData.programs) {
        const programId = crypto.randomUUID()
        const [newProgram] = await tx
          .insert(programs)
          .values({
            id: programId,
            schoolId: newSchool.id,
            name: programData.name,
            description: programData.description,
            duration: programData.duration,
            classYear: new Date().getFullYear() + Math.ceil(programData.duration / 12),
            requirements: JSON.stringify(programData.requirements),
          })
          .returning({
            id: programs.id,
            name: programs.name,
            description: programs.description,
            duration: programs.duration,
          })

        if (newProgram) {
          createdPrograms.push(newProgram)
        }
      }

      return {
        school: newSchool,
        programs: createdPrograms,
      }
    })

    // Return success response with created data
    return NextResponse.json({
      success: true,
      message: "School registration completed successfully",
      data: {
        schoolId: result.school.id,
        schoolName: result.school.name,
        programsCreated: result.programs.length,
        programs: result.programs,
        adminFirstName: validatedData.adminFirstName,
        adminLastName: validatedData.adminLastName,
        adminEmail: validatedData.adminEmail,
      },
    })
  } catch (error) {
    console.error("School registration error:", error)

    // Handle validation errors
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

    // Handle database errors
    if (error instanceof Error) {
      if (error.message.includes("unique constraint")) {
        return NextResponse.json(
          { error: "A school with this information already exists" },
          { status: 409 }
        )
      }
    }

    
    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateEvaluationCache()
    } catch (cacheError) {
      console.warn('Cache invalidation error in evaluations/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
