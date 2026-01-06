import crypto from "node:crypto"
import { and, eq, like, or } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { db } from "../../../database/connection-pool"
import { programs, schools } from "../../../database/schema"
import { getCurrentUser } from "../../../lib/auth-clerk"
import { cacheIntegrationService } from "@/lib/cache-integration"
import type { UserRole } from "@/types"
import { withCSRF } from "@/lib/csrf-middleware"
import {
  createSuccessResponse,
  createErrorResponse,
  withErrorHandling,
  withErrorHandlingAsync,
  HTTP_STATUS,
  ERROR_MESSAGES,
} from "@/lib/api-response"

// Role validation utilities
const hasRole = (userRole: UserRole, allowedRoles: UserRole[]): boolean => {
  return allowedRoles.includes(userRole)
}

const isAdmin = (userRole: UserRole): boolean => {
  return hasRole(userRole, ["ADMIN" as UserRole, "SUPER_ADMIN" as UserRole])
}

const isSchoolAdmin = (userRole: UserRole): boolean => {
  return hasRole(userRole, [
    "SCHOOL_ADMIN" as UserRole,
    "ADMIN" as UserRole,
    "SUPER_ADMIN" as UserRole,
  ])
}
export async function GET(request: NextRequest) {
  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      "api:schools/route.ts",
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
    console.warn("Cache error in schools/route.ts:", cacheError)
    // Continue with original logic if cache fails
  }

  async function executeOriginalLogic() {
    return withErrorHandlingAsync(async () => {
      // Require authentication for school data
      const user = await getCurrentUser()
      if (!user) {
        return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
      }

      const { searchParams } = new URL(request.url)
      const search = searchParams.get("search")
      const includePrograms = searchParams.get("includePrograms") === "true"
      const activeOnly = searchParams.get("activeOnly") !== "false" // Default to true

      // Build the base query
      let whereCondition = activeOnly ? eq(schools.isActive, true) : undefined

      // Add search functionality
      if (search?.trim()) {
        const searchTerm = `%${search.trim()}%`
        const searchCondition = or(
          like(schools.name, searchTerm),
          like(schools.address, searchTerm)
        )

        whereCondition = whereCondition ? and(whereCondition, searchCondition) : searchCondition
      }

      // Fetch schools
      const schoolsData = await db
        .select({
          id: schools.id,
          name: schools.name,
          address: schools.address,
          phone: schools.phone,
          email: schools.email,
          website: schools.website,
          isActive: schools.isActive,
          createdAt: schools.createdAt,
        })
        .from(schools)
        .where(whereCondition)
        .orderBy(schools.name)

      // If programs are requested, fetch them for each school
      if (includePrograms) {
        const schoolsWithPrograms = await Promise.all(
          schoolsData.map(async (school) => {
            const schoolPrograms = await db
              .select({
                id: programs.id,
                name: programs.name,
                description: programs.description,
                duration: programs.duration,
                requirements: programs.requirements,
                isActive: programs.isActive,
              })
              .from(programs)
              .where(
                activeOnly
                  ? and(eq(programs.schoolId, school.id), eq(programs.isActive, true))
                  : eq(programs.schoolId, school.id)
              )
              .orderBy(programs.name)

            return {
              ...school,
              programs: schoolPrograms,
            }
          })
        )

        return createSuccessResponse({
          schools: schoolsWithPrograms,
          count: schoolsWithPrograms.length,
        })
      }

      return createSuccessResponse({
        schools: schoolsData,
        count: schoolsData.length,
      })
    })
  }
}

// POST endpoint for creating new schools (admin only) - CSRF protected
export const POST = withCSRF(async (request: NextRequest) => {
  return withErrorHandlingAsync(async () => {
    // Only super admins can create schools
    const user = await getCurrentUser()
    if (!user || user.role !== ("SUPER_ADMIN" as UserRole as UserRole as UserRole)) {
      return createErrorResponse(ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS, HTTP_STATUS.FORBIDDEN)
    }

    const body = await request.json()

    // Basic validation
    if (!body.name || !body.address) {
      return createErrorResponse("Name and address are required", HTTP_STATUS.BAD_REQUEST)
    }

    try {
      const newSchool = await db
        .insert(schools)
        .values({
          id: crypto.randomUUID(),
          name: body.name,
          address: body.address,
          phone: body.phone || null,
          email: body.email || null,
          website: body.website || null,
          accreditation: body.accreditation || "Other",
          isActive: body.isActive ?? true,
        })
        .returning()

      // Invalidate cache
      try {
        await cacheIntegrationService.invalidateByTags(["schools"])
      } catch (cacheError) {
        console.warn("Cache invalidation failed:", cacheError)
      }

      return createSuccessResponse(
        { school: (newSchool as (typeof schools.$inferSelect)[])[0] },
        undefined,
        HTTP_STATUS.CREATED
      )
    } catch (error: any) {
      if (error.code === "23505") {
        // Unique constraint violation
        return createErrorResponse("A school with this name already exists", HTTP_STATUS.CONFLICT)
      }
      throw error
    }
  })
})
