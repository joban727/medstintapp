import { type NextRequest } from "next/server"
import { and, eq, gte, lte } from "drizzle-orm"
import { db } from "@/database/connection-pool"
import { rotations, users, clinicalSites } from "@/database/schema"
import {
  withErrorHandling,
  withErrorHandlingAsync,
  createSuccessResponse,
  createErrorResponse,
  HTTP_STATUS,
} from "@/lib/api-response"
import { apiAuthMiddleware } from "@/lib/rbac-middleware"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  return withErrorHandlingAsync(async () => {
    const auth = await apiAuthMiddleware(request, {
      requiredRoles: ["SCHOOL_ADMIN", "SUPER_ADMIN"],
    })
    if (!auth.success) {
      return createErrorResponse(
        auth.error || "Unauthorized",
        auth.status || HTTP_STATUS.UNAUTHORIZED
      )
    }

    const { searchParams } = new URL(request.url)
    const programId = searchParams.get("programId")
    const siteId = searchParams.get("siteId")
    const studentId = searchParams.get("studentId")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const limit = Number.parseInt(searchParams.get("limit") || "100")
    const offset = Number.parseInt(searchParams.get("offset") || "0")

    const conditions: any[] = []
    if (programId) conditions.push(eq(users.programId, programId))
    if (siteId) conditions.push(eq(rotations.clinicalSiteId, siteId))
    if (studentId) conditions.push(eq(rotations.studentId, studentId))
    if (startDate) conditions.push(gte(rotations.startDate, new Date(startDate)))
    if (endDate) conditions.push(lte(rotations.endDate, new Date(endDate)))

    const items = await db
      .select({
        id: rotations.id,
        studentId: rotations.studentId,
        clinicalSiteId: rotations.clinicalSiteId,
        preceptorId: rotations.preceptorId,
        specialty: rotations.specialty,
        startDate: rotations.startDate,
        endDate: rotations.endDate,
        status: rotations.status,
        studentName: users.name,
        clinicalSiteName: clinicalSites.name,
      })
      .from(rotations)
      .leftJoin(users, eq(rotations.studentId, users.id))
      .leftJoin(clinicalSites, eq(rotations.clinicalSiteId, clinicalSites.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .limit(limit)
      .offset(offset)

    return createSuccessResponse({
      items,
      pagination: {
        total: items.length,
        limit,
        offset,
        hasMore: items.length === limit,
      },
    })
  })
}

