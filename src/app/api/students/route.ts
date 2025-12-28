import { auth } from "@clerk/nextjs/server"
import { and, asc, eq, ilike, or, type SQL } from "drizzle-orm"
import { type NextRequest } from "next/server"
import { db } from "@/database/connection-pool"
import type { UserRole } from "@/types"
import { users, schools } from "@/database/schema"
import { cacheIntegrationService } from "@/lib/cache-integration"
import {
  createSuccessResponse,
  createErrorResponse,
  withErrorHandling,
  withErrorHandlingAsync,
  HTTP_STATUS,
  ERROR_MESSAGES,
} from "@/lib/api-response"

// GET /api/students - List students (school-scoped for admins/supervisors/preceptors)
export async function GET(request: NextRequest) {
  // Try cached response first
  try {
    // Normalize cache key to avoid caching sensitive params
    const { searchParams } = new URL(request.url)
    const cacheParams = {
      active: searchParams.get("active"),
      limit: searchParams.get("limit"),
      search: (searchParams.get("search") || "").slice(0, 50), // Truncate for cache key
    }
    const cacheKey = `api:students:list:${JSON.stringify(cacheParams)}`
    const cached = await cacheIntegrationService.cachedApiResponse(
      cacheKey,
      async () => {
        return await execute()
      },
      300
    )

    if (cached) {
      return cached
    }
  } catch (cacheError) {
    console.warn("Cache error in students/route.ts:", cacheError)
  }

  async function execute() {
    return withErrorHandlingAsync(async () => {
      const { userId } = await auth()
      if (!userId) {
        return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
      }

      const [currentUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
      if (!currentUser) {
        return createErrorResponse(ERROR_MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND)
      }

      // Only allow admin, supervisor, and preceptor roles to list students
      const allowedRoles: UserRole[] = [
        "SUPER_ADMIN" as UserRole,
        "SCHOOL_ADMIN" as UserRole,
        "CLINICAL_SUPERVISOR" as UserRole,
        "CLINICAL_PRECEPTOR" as UserRole,
      ]
      if (!allowedRoles.includes(currentUser.role as UserRole)) {
        return createErrorResponse(ERROR_MESSAGES.ACCESS_DENIED, HTTP_STATUS.FORBIDDEN)
      }

      const { searchParams } = new URL(request.url)
      const active = searchParams.get("active")
      const limitParam = searchParams.get("limit")
      const search = (searchParams.get("search") || "").slice(0, 100) // Limit search length for security
      const limit = Math.max(1, Math.min(500, Number.parseInt(limitParam || "200", 10)))

      // Build where condition
      const baseConditions: SQL[] = [eq(users.role, "STUDENT")]
      if (active === "true") {
        baseConditions.push(eq(users.isActive, true))
      }
      if (search) {
        // Match name OR email
        baseConditions.push(
          or(ilike(users.name, `%${search}%`), ilike(users.email, `%${search}%`)) as SQL
        )
      }

      // School scoping: school admins, preceptors, supervisors see their school; super admins see all
      let whereCondition: SQL | undefined
      if (currentUser.schoolId) {
        whereCondition = and(eq(users.schoolId, currentUser.schoolId), ...baseConditions)
      } else {
        whereCondition = and(...baseConditions)
      }

      const rows = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          isActive: users.isActive,
          schoolId: users.schoolId,
          programId: users.programId,
          studentId: users.studentId,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
          schoolName: schools.name,
        })
        .from(users)
        .leftJoin(schools, eq(users.schoolId, schools.id))
        .where(whereCondition)
        .orderBy(asc(users.name))
        .limit(limit)

      const students = rows.map((r) => ({
        id: r.id,
        name: r.name || "Unnamed",
        email: r.email,
        role: r.role,
        isActive: r.isActive ?? true,
        schoolId: r.schoolId || undefined,
        programId: r.programId || undefined,
        studentId: r.studentId || undefined,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        schoolName: r.schoolName || undefined,
      }))

      return createSuccessResponse({ students })
    })
  }

  return await execute()
}

