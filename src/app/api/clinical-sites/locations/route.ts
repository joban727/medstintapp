import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/database/connection-pool"
import { clinicalSiteLocations, clinicalSites } from "@/database/schema"
import { eq, and, or, like } from "drizzle-orm"
import {
  createSuccessResponse,
  createErrorResponse,
  HTTP_STATUS,
  ERROR_MESSAGES,
  withErrorHandling,
} from "@/lib/api-response"

// GET /api/clinical-sites/locations - Get all clinical site locations
export const GET = withErrorHandling(async (request: NextRequest) => {
  const { userId } = await auth()

  if (!userId) {
    return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
  }

  const { searchParams } = new URL(request.url)
  const activeOnly = searchParams.get("activeOnly") === "true"
  const primaryOnly = searchParams.get("primaryOnly") === "true"
  const search = searchParams.get("search")
  const clinicalSiteId = searchParams.get("clinicalSiteId")

  // Build query conditions
  const conditions = []

  if (activeOnly) {
    conditions.push(eq(clinicalSiteLocations.isActive, true))
  }

  if (primaryOnly) {
    conditions.push(eq(clinicalSiteLocations.isPrimary, true))
  }

  if (clinicalSiteId) {
    conditions.push(eq(clinicalSiteLocations.clinicalSiteId, clinicalSiteId))
  }

  if (search) {
    conditions.push(
      or(
        like(clinicalSiteLocations.name, `%${search}%`),
        like(clinicalSiteLocations.description, `%${search}%`),
        like(clinicalSiteLocations.department, `%${search}%`),
        like(clinicalSites.name, `%${search}%`)
      )
    )
  }

  // Get locations with clinical site information
  const locations = await db
    .select({
      id: clinicalSiteLocations.id,
      clinicalSiteId: clinicalSiteLocations.clinicalSiteId,
      name: clinicalSiteLocations.name,
      latitude: clinicalSiteLocations.latitude,
      longitude: clinicalSiteLocations.longitude,
      radius: clinicalSiteLocations.radius,
      isActive: clinicalSiteLocations.isActive,
      isPrimary: clinicalSiteLocations.isPrimary,
      description: clinicalSiteLocations.description,
      floor: clinicalSiteLocations.floor,
      department: clinicalSiteLocations.department,
      createdAt: clinicalSiteLocations.createdAt,
      updatedAt: clinicalSiteLocations.updatedAt,
      // Clinical site information
      siteName: clinicalSites.name,
      siteAddress: clinicalSites.address,
      sitePhone: clinicalSites.phone,
      siteEmail: clinicalSites.email,
    })
    .from(clinicalSiteLocations)
    .leftJoin(clinicalSites, eq(clinicalSiteLocations.clinicalSiteId, clinicalSites.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(clinicalSiteLocations.isPrimary, clinicalSites.name, clinicalSiteLocations.name)

  // Format response
  const formattedLocations = locations.map((location) => ({
    id: location.id,
    clinicalSiteId: location.clinicalSiteId,
    name: location.name,
    latitude: Number.parseFloat(location.latitude),
    longitude: Number.parseFloat(location.longitude),
    radius: location.radius,
    isActive: location.isActive,
    isPrimary: location.isPrimary,
    description: location.description,
    floor: location.floor,
    department: location.department,
    createdAt: location.createdAt,
    updatedAt: location.updatedAt,
    clinicalSite: {
      name: location.siteName,
      address: location.siteAddress,
      phone: location.sitePhone,
      email: location.siteEmail,
    },
  }))

  // Group by clinical site if requested
  const groupBySite = searchParams.get("groupBySite") === "true"

  if (groupBySite) {
    const grouped = formattedLocations.reduce(
      (acc, location) => {
        const siteId = location.clinicalSiteId
        if (!acc[siteId]) {
          acc[siteId] = {
            clinicalSiteId: siteId,
            clinicalSiteName: location.clinicalSite.name,
            clinicalSiteAddress: location.clinicalSite.address,
            locations: [],
          }
        }
        acc[siteId].locations.push(location)
        return acc
      },
      {} as Record<
        string,
        {
          clinicalSiteId: string
          clinicalSiteName: string | null
          clinicalSiteAddress: string | null
          locations: typeof formattedLocations
        }
      >
    )

    return createSuccessResponse({
      groupedBySite: true,
      sites: Object.values(grouped),
      totalLocations: formattedLocations.length,
      totalSites: Object.keys(grouped).length,
    })
  }

  return createSuccessResponse({
    locations: formattedLocations,
    total: formattedLocations.length,
    filters: {
      activeOnly,
      primaryOnly,
      search,
      clinicalSiteId,
    },
  })
})
