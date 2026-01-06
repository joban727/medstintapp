import { eq } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "../../../database/connection-pool"
import { programs, schools, users } from "../../../database/schema"
import { getCurrentUser } from "../../../lib/auth-clerk"
import { cacheIntegrationService } from "@/lib/cache-integration"
import {
  createSuccessResponse,
  createErrorResponse,
  createValidationErrorResponse,
  withErrorHandling,
  HTTP_STATUS,
  ERROR_MESSAGES,
} from "../../../lib/api-response"

import type { UserRole } from "@/types"
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

export const POST = withErrorHandling(async (request: NextRequest) => {
  // Parse request body with proper error handling
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch (jsonError) {
    console.error("JSON parsing error:", jsonError)
    return createErrorResponse("Invalid JSON in request body", HTTP_STATUS.BAD_REQUEST)
  }

  // Get the current user
  const user = await getCurrentUser()

  if (!user) {
    return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
  }

  // Validate request body
  let validatedData
  try {
    validatedData = schoolRegistrationSchema.parse(body)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createValidationErrorResponse(
        "Validation failed",
        error.issues.map((e) => ({ field: e.path.join("."), code: e.code, details: e.message }))
      )
    }
    throw error
  }

  // Check if user already has a school associated
  const [existingUser] = await db
    .select({ schoolId: users.schoolId, role: users.role })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1)

  if (!existingUser) {
    return createErrorResponse("User not found", HTTP_STATUS.NOT_FOUND)
  }

  if (existingUser.schoolId) {
    return createErrorResponse("User already has a school associated", HTTP_STATUS.BAD_REQUEST)
  }

  // Start a transaction to create school, update user, and create programs
  try {
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
          role: "SCHOOL_ADMIN" as UserRole,
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
    return createSuccessResponse(
      {
        schoolId: result.school.id,
        schoolName: result.school.name,
        programsCreated: result.programs.length,
        programs: result.programs,
        adminFirstName: validatedData.adminFirstName,
        adminLastName: validatedData.adminLastName,
        adminEmail: validatedData.adminEmail,
      },
      "School registration completed successfully",
      HTTP_STATUS.CREATED
    )
  } catch (error) {
    // Handle database errors
    if (error instanceof Error) {
      if (error.message.includes("unique constraint")) {
        return createErrorResponse(
          "A school with this information already exists",
          HTTP_STATUS.CONFLICT
        )
      }
    }
    throw error
  }
})
