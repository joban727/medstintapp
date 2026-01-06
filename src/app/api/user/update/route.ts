import { auth } from "@clerk/nextjs/server"
import { eq, sql } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { db } from "../../../../database/connection-pool"

// Role validation utilities
const hasRole = (userRole: UserRole, allowedRoles: UserRole[]): boolean => {
  return allowedRoles.includes(userRole)
}

const isAdmin = (userRole: UserRole): boolean => {
  return hasRole(userRole, ["SUPER_ADMIN" as UserRole])
}

const isSchoolAdmin = (userRole: UserRole): boolean => {
  return hasRole(userRole, ["SCHOOL_ADMIN" as UserRole, "SUPER_ADMIN" as UserRole])
}
import {
  createSuccessResponse,
  createErrorResponse,
  HTTP_STATUS,
  ERROR_MESSAGES,
  withErrorHandling,
} from "../../../../lib/api-response"
import { cacheIntegrationService } from "@/lib/cache-integration"
import {
  accounts,
  assessments,
  auditLogs,
  evaluations,
  rotations,
  schools,
  sessions,
  timeRecords,
  users,
} from "../../../../database/schema"
import type { UserRole } from "../../../../types"

interface DatabaseError extends Error {
  code?: string
  constraint?: string
  detail?: string
}

import { generalApiLimiter } from "@/lib/rate-limiter"

export const POST = withErrorHandling(async (request: NextRequest) => {
  // Rate limiting check
  const limitResult = await generalApiLimiter.checkLimit(request)
  if (!limitResult.allowed) {
    return createErrorResponse("Too many requests", HTTP_STATUS.TOO_MANY_REQUESTS)
  }

  // Test database connection
  try {
    await db.execute(sql`SELECT 1 as test`)
  } catch (dbError) {
    console.error("[API] Database connection test failed:", dbError)
    return createErrorResponse(
      "Database connection failed",
      HTTP_STATUS.SERVICE_UNAVAILABLE,
      process.env.NODE_ENV === "development" ? { message: String(dbError) } : undefined
    )
  }

  const { userId, getToken } = await auth()

  if (!userId) {
    console.error("[API] No authenticated user found")
    return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
  }

  // Best-effort token presence check, but do not hard-block if missing when session is valid
  let token: string | null = null
  try {
    token = (await getToken?.()) ?? null
  } catch (e) {
    console.warn("[API] getToken threw, continuing with session auth:", e)
  }
  const authHeader = request.headers.get("authorization")
  if (!token && !authHeader) {
    console.warn(
      "[API] No token or Authorization header present; proceeding based on session cookies since userId is available"
    )
  }

  // Parse request body with proper error handling
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch (jsonError) {
    console.error("[API] JSON parsing error:", jsonError)
    return createErrorResponse("Invalid JSON in request body", HTTP_STATUS.BAD_REQUEST)
  }
  const updates = { ...body }

  // Database updates (Drizzle schema uses camelCase)
  // Handle date fields that might come as strings from JSON
  const processedUpdates = { ...updates }
  if (processedUpdates.enrollmentDate && typeof processedUpdates.enrollmentDate === "string") {
    processedUpdates.enrollmentDate = new Date(processedUpdates.enrollmentDate)
  }
  if (
    processedUpdates.expectedGraduation &&
    typeof processedUpdates.expectedGraduation === "string"
  ) {
    processedUpdates.expectedGraduation = new Date(processedUpdates.expectedGraduation)
  }

  const dbUpdates: Partial<typeof users.$inferInsert> = {
    updatedAt: new Date(),
    ...processedUpdates,
  }

  // Execute all database operations in a transaction for consistency
  let user: typeof users.$inferSelect
  try {
    user = await db.transaction(async (tx) => {
      // Check if user exists

      const [existingUser] = await tx
        .select({
          id: users.id,
          role: users.role,
          email: users.email,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)

      if (existingUser) {
        // Update existing user

        const [updatedUser] = await tx
          .update(users)
          .set(dbUpdates)
          .where(eq(users.id, userId))
          .returning()

        return updatedUser
      }
      // For new users, we need to get user info from Clerk

      const clerkResponse = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
        headers: {
          Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      })

      if (!clerkResponse.ok) {
        console.error("[API] Failed to fetch user from Clerk API")
        throw new Error("Failed to fetch user information")
      }

      const clerkUser = await clerkResponse.json()
      const email = clerkUser.email_addresses?.[0]?.email_address || ""
      const fullName = `${clerkUser.first_name || ""} ${clerkUser.last_name || ""}`.trim()

      // Before inserting, ensure there isn't an existing user with this email but a different id
      let linkedExisting = false
      if (email) {
        const [existingByEmail] = await db
          .select({
            id: users.id,
            email: users.email,
            name: users.name,
            role: users.role,
            emailVerified: users.emailVerified,
            image: users.image,
            avatar: users.avatar,
            avatarUrl: users.avatarUrl,
            isActive: users.isActive,
            onboardingCompleted: users.onboardingCompleted,
            onboardingCompletedAt: users.onboardingCompletedAt,
            schoolId: users.schoolId,
            programId: users.programId,
            studentId: users.studentId,
            department: users.department,
            phone: users.phone,
            address: users.address,
            enrollmentDate: users.enrollmentDate,
            expectedGraduation: users.expectedGraduation,
            academicStatus: users.academicStatus,
            gpa: users.gpa,
            totalClinicalHours: users.totalClinicalHours,
            completedRotations: users.completedRotations,
            stripeCustomerId: users.stripeCustomerId,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt,
          })
          .from(users)
          .where(eq(users.email, email))
          .limit(1)
        if (existingByEmail && existingByEmail.id !== userId) {
          console.warn(
            "[API] Email conflict with different user id detected. Attempting to migrate existing DB user to current Clerk user id",
            { existingUserId: existingByEmail.id, clerkUserId: userId }
          )
          try {
            await db.transaction(async (tx) => {
              const oldId = existingByEmail.id
              const now = new Date()

              // 1) Temporarily free the unique email on the old record
              const tempEmail = `${existingByEmail.email}__old_${Date.now()}`
              await tx
                .update(users)
                .set({ email: tempEmail, updatedAt: now })
                .where(eq(users.id, oldId))

              // 2) Insert a new user row with the Clerk id and original email, copying details
              const newUserData: typeof users.$inferInsert = {
                id: userId,
                email: existingByEmail.email,
                name: existingByEmail.name ?? (fullName || "User"),
                role: (existingByEmail.role as UserRole) ?? "STUDENT",
                emailVerified: existingByEmail.emailVerified ?? false,
                image: existingByEmail.image ?? null,
                avatar: existingByEmail.avatar ?? null,
                avatarUrl: existingByEmail.avatarUrl ?? null,
                isActive: existingByEmail.isActive ?? true,
                onboardingCompleted: existingByEmail.onboardingCompleted ?? false,
                onboardingCompletedAt: existingByEmail.onboardingCompletedAt ?? null,
                schoolId: existingByEmail.schoolId ?? null,
                programId: existingByEmail.programId ?? null,
                studentId: existingByEmail.studentId ?? null,
                department: existingByEmail.department ?? null,
                phone: existingByEmail.phone ?? null,
                address: existingByEmail.address ?? null,
                enrollmentDate: existingByEmail.enrollmentDate ?? null,
                expectedGraduation: existingByEmail.expectedGraduation ?? null,
                academicStatus: existingByEmail.academicStatus ?? null,
                gpa: existingByEmail.gpa ?? null,
                totalClinicalHours: existingByEmail.totalClinicalHours ?? 0,
                completedRotations: existingByEmail.completedRotations ?? 0,
                stripeCustomerId: existingByEmail.stripeCustomerId ?? null,
                createdAt: existingByEmail.createdAt ?? now,
                updatedAt: now,
              }
              await tx.insert(users).values(newUserData)

              // 3) Update all foreign key references to new id
              await tx.update(sessions).set({ userId }).where(eq(sessions.userId, oldId))
              await tx.update(accounts).set({ userId }).where(eq(accounts.userId, oldId))
              await tx.update(schools).set({ adminId: userId }).where(eq(schools.adminId, oldId))
              await tx
                .update(rotations)
                .set({ studentId: userId })
                .where(eq(rotations.studentId, oldId))
              await tx
                .update(rotations)
                .set({ preceptorId: userId })
                .where(eq(rotations.preceptorId, oldId))
              await tx
                .update(rotations)
                .set({ supervisorId: userId })
                .where(eq(rotations.supervisorId, oldId))
              await tx
                .update(timeRecords)
                .set({ studentId: userId })
                .where(eq(timeRecords.studentId, oldId))
              await tx
                .update(timeRecords)
                .set({ approvedBy: userId })
                .where(eq(timeRecords.approvedBy, oldId))
              await tx
                .update(assessments)
                .set({ studentId: userId })
                .where(eq(assessments.studentId, oldId))
              await tx
                .update(assessments)
                .set({ assessorId: userId })
                .where(eq(assessments.assessorId, oldId))
              await tx
                .update(evaluations)
                .set({ studentId: userId })
                .where(eq(evaluations.studentId, oldId))
              await tx
                .update(evaluations)
                .set({ evaluatorId: userId })
                .where(eq(evaluations.evaluatorId, oldId))
              await tx.update(auditLogs).set({ userId }).where(eq(auditLogs.userId, oldId))

              // 4) Remove the old user row
              await tx.delete(users).where(eq(users.id, oldId))
            })
            linkedExisting = true
          } catch (linkErr) {
            console.error(
              "[API] Failed to migrate existing DB user to current Clerk user id",
              linkErr
            )
            throw new Error(
              "An account with this email already exists. Please sign in with that account or contact support."
            )
          }
        }
      }

      if (linkedExisting) {
        // Update the now-migrated user with any incoming updates and return
        const [updatedUser] = await tx
          .update(users)
          .set({
            ...dbUpdates,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId))
          .returning()

        return updatedUser
      }
      // Create new user with all required fields (using camelCase for Drizzle schema)

      const userData: typeof users.$inferInsert = {
        id: userId,
        email: email,
        name: fullName || "User",
        role: "STUDENT" as UserRole as UserRole,
        emailVerified: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        onboardingCompleted: false,
        totalClinicalHours: 0,
        completedRotations: 0,
        ...dbUpdates,
      }

      // Perform a simple insert; avoid updating the primary key on conflict
      const result = (await tx
        .insert(users)
        .values(userData)
        .returning()) as (typeof users.$inferSelect)[]
      const newUser = result[0]

      return newUser
    })
  } catch (transactionError) {
    console.error("[API] Transaction failed, rolling back:", transactionError)

    // Enhanced error handling for transaction failures
    let errorMessage = "Failed to update user"
    let statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR

    const msg =
      transactionError instanceof Error ? transactionError.message : String(transactionError)
    const code = (transactionError as DatabaseError)?.code

    if (
      (typeof msg === "string" &&
        (msg.includes("duplicate key") || msg.includes("unique constraint"))) ||
      code === "23505"
    ) {
      errorMessage = "User already exists with this information"
      statusCode = HTTP_STATUS.CONFLICT
    } else if (
      typeof msg === "string" &&
      (msg.includes("foreign key") || msg.includes("violates"))
    ) {
      errorMessage = "Invalid data provided - foreign key constraint violation"
      statusCode = HTTP_STATUS.BAD_REQUEST
    } else if (typeof msg === "string" && (msg.includes("connection") || msg.includes("timeout"))) {
      errorMessage = "Database connection error during transaction"
      statusCode = HTTP_STATUS.SERVICE_UNAVAILABLE
    } else if (typeof msg === "string" && msg.includes("transaction")) {
      errorMessage = "Transaction failed - all changes have been rolled back"
      statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR
    }

    const errorDetails =
      process.env.NODE_ENV === "development"
        ? { message: msg, transactionRolledBack: true }
        : { transactionRolledBack: true }

    return createErrorResponse(errorMessage, statusCode, errorDetails)
  }

  // Return user data with camelCase fields for frontend
  const responseUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    schoolId: user.schoolId,
    programId: user.programId,
    studentId: user.studentId,
    phone: user.phone,
    address: user.address,
    department: user.department,
    enrollmentDate: user.enrollmentDate,
    onboardingCompleted: user.onboardingCompleted,
    onboardingCompletedAt: user.onboardingCompletedAt,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }

  // Invalidate cache
  try {
    await cacheIntegrationService.invalidateByTags(["users", "student-dashboard"])
  } catch (error) {
    console.warn("Failed to invalidate cache:", error)
  }

  return createSuccessResponse(responseUser)
})
