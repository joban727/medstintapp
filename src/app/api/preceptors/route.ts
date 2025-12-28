import crypto from "node:crypto"
import { auth } from "@clerk/nextjs/server"
import { and, asc, eq } from "drizzle-orm"
import { type NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/database/connection-pool"
import type { UserRole } from "@/types"
import { clinicalPreceptors, users } from "@/database/schema"
import {
  createSuccessResponse,
  createErrorResponse,
  withErrorHandling,
  HTTP_STATUS,
  ERROR_MESSAGES,
} from "@/lib/api-response"

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

export const POST = withErrorHandling(async (request: NextRequest) => {
  const { userId } = await auth()
  if (!userId) {
    return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
  }

  // Get the current user and verify they are a school admin
  const currentUser = await db.select().from(users).where(eq(users.id, userId)).limit(1)

  if (!currentUser.length || currentUser[0].role !== ("SCHOOL_ADMIN" as UserRole)) {
    return createErrorResponse(
      "Only school administrators can create preceptors",
      HTTP_STATUS.FORBIDDEN
    )
  }

  const schoolAdmin = currentUser[0]
  if (!schoolAdmin.schoolId) {
    return createErrorResponse(
      "School administrator must be associated with a school",
      HTTP_STATUS.BAD_REQUEST
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
    return createErrorResponse(
      "A user with this email address already exists",
      HTTP_STATUS.CONFLICT
    )
  }

  // Create the preceptor user
  const result = await db.transaction(async (tx) => {
    const [newUser] = await tx
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        email: validatedData.email,
        name: validatedData.name,
        role: "CLINICAL_PRECEPTOR" as UserRole,
        schoolId: currentUser[0].schoolId || "",
        department: validatedData.department,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()

    if (!newUser) {
      throw new Error("Failed to create user")
    }

    await tx.insert(clinicalPreceptors).values({
      userId: newUser.id,
      licenseNumber: "PENDING", // TODO: Add field to form
      licenseType: "MD", // TODO: Add field to form
      licenseState: "CA", // TODO: Add field to form
      licenseExpirationDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)), // Default 1 year
      specialty: validatedData.specialty,
      yearsOfExperience: validatedData.yearsExperience,
      clinicalSiteId: validatedData.clinicalSite,
      maxStudents: validatedData.maxCapacity,
      department: validatedData.department,
      isActive: true,
    })

    return newUser
  })

  return createSuccessResponse(
    {
      message: "Preceptor created successfully",
      preceptor: {
        id: result.id,
        name: result.name,
        email: result.email,
        department: result.department,
        role: result.role,
      },
    },
    undefined,
    HTTP_STATUS.CREATED
  )
})

export const GET = withErrorHandling(async (_request: NextRequest) => {
  const { userId } = await auth()
  if (!userId) {
    return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
  }

  // Get the current user
  const currentUser = await db.select().from(users).where(eq(users.id, userId)).limit(1)

  if (!currentUser.length) {
    return createErrorResponse(ERROR_MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND)
  }

  const user = currentUser[0]

  // Only school admins and supervisors can view all preceptors
  if (user.role === null || !["SCHOOL_ADMIN" as UserRole, "CLINICAL_SUPERVISOR" as UserRole].includes(user.role as UserRole)) {
    return createErrorResponse(ERROR_MESSAGES.ACCESS_DENIED, HTTP_STATUS.FORBIDDEN)
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

  return createSuccessResponse({ preceptors })
})

