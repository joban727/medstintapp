import { and, eq, lte, gte, isNull, or } from "drizzle-orm"
import { type NextRequest } from "next/server"
import { db } from "@/database/connection-pool"
import { clinicalSites, rotations, siteAssignments, facilityManagement } from "@/database/schema"
import {
  createSuccessResponse,
  createErrorResponse,
  withErrorHandling,
  HTTP_STATUS,
  ERROR_MESSAGES,
} from "@/lib/api-response"
import { apiAuthMiddleware } from "@/lib/rbac-middleware"
import { cacheIntegrationService } from "@/lib/cache-integration"
// Ensure this route is always dynamic (no framework-level static caching)
export const dynamic = "force-dynamic"

export const GET = withErrorHandling(async (request: NextRequest) => {
  const authResult = await apiAuthMiddleware(request, { requiredRoles: ["STUDENT"] })
  if (!authResult.success || !authResult.user) {
    return createErrorResponse(
      authResult.error || ERROR_MESSAGES.UNAUTHORIZED,
      authResult.status || HTTP_STATUS.UNAUTHORIZED
    )
  }

  const { user } = authResult
  const userId = user.id
  const debug = request.nextUrl.searchParams.get("debug") === "1"
  const noCache = request.nextUrl.searchParams.get("noCache") === "1"

  const cacheKey = `sites_available:${userId}`
  const computeResult = async () => {
    // Get all active site assignments for the student, filtered by date range in SQL
    const now = new Date()
    const rows = await db
      .select({
        siteId: clinicalSites.id,
        siteName: clinicalSites.name,
        siteAddress: clinicalSites.address,
        sitePhone: clinicalSites.phone,
        siteEmail: clinicalSites.email,
        siteType: clinicalSites.type,
        assignmentId: siteAssignments.id,
        assignmentStatus: siteAssignments.status,
        startDate: siteAssignments.startDate,
        endDate: siteAssignments.endDate,
        rotationName: rotations.specialty,
        rotationId: rotations.id,
        capacity: clinicalSites.capacity,
        specialties: clinicalSites.specialties,
      })
      .from(siteAssignments)
      .innerJoin(clinicalSites, eq(siteAssignments.clinicalSiteId, clinicalSites.id))
      .leftJoin(rotations, eq(siteAssignments.rotationId, rotations.id))
      .where(
        and(
          eq(siteAssignments.studentId, userId),
          eq(siteAssignments.status, "ACTIVE"),
          // Include current and upcoming assignments; exclude only those already ended
          or(lte(siteAssignments.startDate, now), gte(siteAssignments.startDate, now)),
          or(isNull(siteAssignments.endDate), gte(siteAssignments.endDate, now))
        )
      )
      .orderBy(clinicalSites.name)

    // Runtime filter: include only currently active assignments (start <= now, end null or >= now)
    const activeRows = rows.filter((row) => {
      const start = row.startDate ? new Date(row.startDate as any) : null
      const end = row.endDate ? new Date(row.endDate as any) : null
      const started = !start || start <= now
      const notEnded = !end || end >= now
      return started && notEnded
    })

    // Deduplicate by siteId to avoid repeated site entries from multiple assignments
    const bySiteId = new Map<string, (typeof activeRows)[number]>()
    for (const row of activeRows) {
      if (!bySiteId.has(row.siteId)) {
        bySiteId.set(row.siteId, row)
      }
    }

    let formattedSites: Array<{
      id: string
      name: string
      address: string
      phone: string
      email: string
      type: "HOSPITAL" | "CLINIC" | "NURSING_HOME" | "OUTPATIENT" | "OTHER"
      capacity: number
      specialties: string | null
      assignment: {
        id: string
        status: "ACTIVE" | "INACTIVE" | "COMPLETED" | "CANCELLED"
        startDate: Date | null
        endDate: Date | null
      } | null
      rotation: {
        id: string
        name: string | null
      } | null
    }> = Array.from(bySiteId.values()).map((site) => ({
      id: site.siteId,
      name: site.siteName,
      address: site.siteAddress,
      phone: site.sitePhone,
      email: site.siteEmail,
      type: site.siteType,
      capacity: site.capacity,
      specialties: site.specialties,
      assignment: {
        id: site.assignmentId,
        status: site.assignmentStatus,
        startDate: site.startDate,
        endDate: site.endDate,
      },
      rotation: site.rotationId
        ? {
          id: site.rotationId,
          name: site.rotationName,
        }
        : null,
    }))

    // Fallback: if student has no personal assignments, return school-level sites
    // Broadened to include any active clinical sites linked to the school,
    // regardless of assignment status or dates, to match School Admin visibility.
    let fallbackUsed = false
    let fallbackCount = 0
    if (formattedSites.length === 0 && user.schoolId) {
      // Sites linked via siteAssignments at school level
      const schoolRows = await db
        .selectDistinct({
          siteId: clinicalSites.id,
          siteName: clinicalSites.name,
          siteAddress: clinicalSites.address,
          sitePhone: clinicalSites.phone,
          siteEmail: clinicalSites.email,
          siteType: clinicalSites.type,
          capacity: clinicalSites.capacity,
          specialties: clinicalSites.specialties,
        })
        .from(clinicalSites)
        .innerJoin(siteAssignments, eq(siteAssignments.clinicalSiteId, clinicalSites.id))
        .where(and(eq(siteAssignments.schoolId, user.schoolId), eq(clinicalSites.isActive, true)))
        .orderBy(clinicalSites.name)

      // Sites linked via facilityManagement (school-managed facilities)
      const facilityRows = await db
        .selectDistinct({
          siteId: clinicalSites.id,
          siteName: clinicalSites.name,
          siteAddress: clinicalSites.address,
          sitePhone: clinicalSites.phone,
          siteEmail: clinicalSites.email,
          siteType: clinicalSites.type,
          capacity: clinicalSites.capacity,
          specialties: clinicalSites.specialties,
        })
        .from(facilityManagement)
        .innerJoin(clinicalSites, eq(facilityManagement.clinicalSiteId, clinicalSites.id))
        .where(
          and(
            eq(facilityManagement.schoolId, user.schoolId),
            eq(facilityManagement.isActive, true),
            eq(clinicalSites.isActive, true)
          )
        )
        .orderBy(clinicalSites.name)

      const schoolBySite = new Map<string, (typeof schoolRows)[number]>()
      for (const row of schoolRows) {
        if (!schoolBySite.has(row.siteId)) {
          schoolBySite.set(row.siteId, row)
        }
      }

      // Merge in facility-managed sites
      for (const row of facilityRows) {
        if (!schoolBySite.has(row.siteId)) {
          schoolBySite.set(row.siteId, row)
        }
      }

      formattedSites = Array.from(schoolBySite.values()).map((site) => ({
        id: site.siteId,
        name: site.siteName,
        address: site.siteAddress,
        phone: site.sitePhone,
        email: site.siteEmail,
        type: site.siteType,
        capacity: site.capacity,
        specialties: site.specialties,
        // School-level context: not tied to this student
        assignment: null,
        rotation: null,
      }))

      fallbackUsed = true
      fallbackCount = formattedSites.length
    }

    return {
      sites: formattedSites,
      total: formattedSites.length,
      meta: {
        source: fallbackUsed ? "school_fallback" : "assignments",
        assignmentsCount: rows.length,
        fallbackCount,
        schoolId: user.schoolId || null,
      },
    }
  }

  const result = noCache
    ? await computeResult()
    : await cacheIntegrationService.cachedApiResponse(cacheKey, computeResult, 120) // cache for 2 minutes per user

  if (debug) {
    const r: any = result
    console.info(
      "[LOG-1 SitesAvailableAPI] userId=%s schoolId=%s total=%d source=%s assignments=%d fallback=%d",
      userId,
      r?.meta?.schoolId,
      r?.total,
      r?.meta?.source,
      r?.meta?.assignmentsCount,
      r?.meta?.fallbackCount
    )
  }

  return createSuccessResponse(result)
})

