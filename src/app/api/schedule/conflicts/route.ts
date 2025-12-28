import { type NextRequest } from "next/server"
import { and, eq, gte, lte } from "drizzle-orm"
import { db } from "@/database/connection-pool"
import { rotations, clinicalSites } from "@/database/schema"
import {
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
    const studentId = searchParams.get("studentId")
    const siteId = searchParams.get("siteId")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    const conditions: any[] = []
    if (studentId) conditions.push(eq(rotations.studentId, studentId))
    if (siteId) conditions.push(eq(rotations.clinicalSiteId, siteId))
    if (startDate) conditions.push(gte(rotations.startDate, new Date(startDate)))
    if (endDate) conditions.push(lte(rotations.endDate, new Date(endDate)))

    const schedule = await db
      .select({
        id: rotations.id,
        studentId: rotations.studentId,
        clinicalSiteId: rotations.clinicalSiteId,
        startDate: rotations.startDate,
        endDate: rotations.endDate,
        status: rotations.status,
        capacity: clinicalSites.capacity,
      })
      .from(rotations)
      .leftJoin(clinicalSites, eq(rotations.clinicalSiteId, clinicalSites.id))
      .where(conditions.length ? and(...conditions) : undefined)

    // Simple overlap + capacity checks (placeholder)
    const conflicts: Array<{ type: string; rotationId: string; details: any }> = []
    const byStudent: Record<string, typeof schedule> = {}
    for (const r of schedule) {
      const key = r.studentId || "unknown"
      byStudent[key] = byStudent[key] || []
      // Check overlap with existing entries for the student
      for (const o of byStudent[key]) {
        // Skip overlap check if any date is null
        if (r.startDate && r.endDate && o.startDate && o.endDate) {
          const overlap = r.startDate <= o.endDate && o.startDate <= r.endDate
          if (overlap) {
            conflicts.push({ type: "OVERLAP_STUDENT", rotationId: r.id!, details: { with: o.id } })
          }
        }
      }
      byStudent[key].push(r)
    }

    // Capacity checks can be expanded based on site assignments
    // Placeholder: flag if capacity is 0
    for (const r of schedule) {
      if ((r.capacity as number | null) === 0) {
        conflicts.push({ type: "SITE_CAPACITY", rotationId: r.id!, details: { capacity: 0 } })
      }
    }

    return createSuccessResponse({ conflicts })
  })
}

