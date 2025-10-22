import { and, eq } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "../../../../database/connection-pool"
import { programs, schools, users } from "../../../../database/schema"
import { getCurrentUser } from "../../../../lib/auth-clerk"
import { cacheIntegrationService } from '@/lib/cache-integration'


// Validation schema for student registration
const studentRegistrationSchema = z.object({
  // Personal Information
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(1, "Phone number is required"),
  address: z.string().min(1, "Address is required"),
  studentId: z.string().min(1, "Student ID is required"),

  // School and Program Selection
  schoolId: z.string().min(1, "School selection is required"),
  programId: z.string().min(1, "Program selection is required"),

  // Enrollment Information
  enrollmentDate: z.string().min(1, "Enrollment date is required"),
  expectedGraduation: z.string().optional(),
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

    // Validate request body (already parsed above)
    const validatedData = studentRegistrationSchema.parse(body)

    // Check if user already has school/program associated
    const [existingUser] = await db
      .select({
        schoolId: users.schoolId,
        programId: users.programId,
        role: users.role,
        studentId: users.studentId,
      })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1)

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (existingUser.schoolId && existingUser.programId) {
      return NextResponse.json(
        { error: "User already has school and program associated" },
        { status: 400 }
      )
    }

    // Verify that the selected school exists and is active
    const [selectedSchool] = await db
      .select({
        id: schools.id,
        name: schools.name,
        isActive: schools.isActive,
      })
      .from(schools)
      .where(eq(schools.id, validatedData.schoolId))
      .limit(1)

    if (!selectedSchool) {
      return NextResponse.json({ error: "Selected school not found" }, { status: 404 })
    }

    if (!selectedSchool.isActive) {
      return NextResponse.json(
        { error: "Selected school is not currently accepting students" },
        { status: 400 }
      )
    }

    // Verify that the selected program exists, is active, and belongs to the selected school
    const [selectedProgram] = await db
      .select({
        id: programs.id,
        name: programs.name,
        schoolId: programs.schoolId,
        isActive: programs.isActive,
        duration: programs.duration,
      })
      .from(programs)
      .where(
        and(eq(programs.id, validatedData.programId), eq(programs.schoolId, validatedData.schoolId))
      )
      .limit(1)

    if (!selectedProgram) {
      return NextResponse.json(
        { error: "Selected program not found or does not belong to the selected school" },
        { status: 404 }
      )
    }

    if (!selectedProgram.isActive) {
      return NextResponse.json(
        { error: "Selected program is not currently accepting students" },
        { status: 400 }
      )
    }

    // Check if student ID is already taken within the same school
    const [existingStudentId] = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.schoolId, validatedData.schoolId),
          eq(users.studentId, validatedData.studentId),
          eq(users.role, "STUDENT")
        )
      )
      .limit(1)

    if (existingStudentId) {
      return NextResponse.json(
        { error: "Student ID is already taken at this school" },
        { status: 409 }
      )
    }

    // Calculate expected graduation date if not provided
    let expectedGraduation = validatedData.expectedGraduation
    if (!expectedGraduation && validatedData.enrollmentDate) {
      const enrollmentDate = new Date(validatedData.enrollmentDate)
      const graduationDate = new Date(enrollmentDate)
      graduationDate.setMonth(graduationDate.getMonth() + selectedProgram.duration)
      expectedGraduation = graduationDate.toISOString().split("T")[0]
    }

    // Update user with student information
    const [updatedUser] = await db
      .update(users)
      .set({
        role: "STUDENT",
        schoolId: validatedData.schoolId,
        programId: validatedData.programId,
        studentId: validatedData.studentId,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))
      .returning({
        id: users.id,
        role: users.role,
        schoolId: users.schoolId,
        programId: users.programId,
        studentId: users.studentId,
      })

    if (!updatedUser) {
      return NextResponse.json({ error: "Failed to update user information" }, { status: 500 })
    }

    // Return success response with enrollment data
    return NextResponse.json({
      success: true,
      message: "Student registration completed successfully",
      data: {
        userId: updatedUser.id,
        studentId: updatedUser.studentId,
        schoolId: updatedUser.schoolId,
        schoolName: selectedSchool.name,
        programId: updatedUser.programId,
        programName: selectedProgram.name,
        enrollmentDate: validatedData.enrollmentDate,
        expectedGraduation,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        email: validatedData.email,
        phone: validatedData.phone,
        address: validatedData.address,
      },
    })
  } catch (error) {
    console.error("Student registration error:", error)

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
          { error: "Student information conflicts with existing records" },
          { status: 409 }
        )
      }
    }

    
    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateAllCache()
    } catch (cacheError) {
      console.warn('Cache invalidation error in onboarding/student/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
