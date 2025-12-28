import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/database/connection-pool"
import { clinicalSiteLocations, clinicalSites } from "@/database/schema"
import { eq, and } from "drizzle-orm"
import {
  createSuccessResponse,
  createErrorResponse,
  HTTP_STATUS,
  ERROR_MESSAGES,
  withErrorHandling,
} from "@/lib/api-response"

interface CreateLocationRequest {
  name: string
  latitude: number
  longitude: number
  radius: number
  description?: string
  floor?: string
  department?: string
  isPrimary?: boolean
}

interface UpdateLocationRequest extends Partial<CreateLocationRequest> {
  isActive?: boolean
}

// GET /api/clinical-sites/[id]/locations - Get all locations for a clinical site
export const GET = withErrorHandling(
  async (request: NextRequest, { params }: { params: { id: string } }) => {
    const { userId } = await auth()

    if (!userId) {
      return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
    }

    const clinicalSiteId = params.id

    // Verify user has access to this clinical site
    const siteAccess = await db
      .select({ id: clinicalSites.id })
      .from(clinicalSites)
      .where(eq(clinicalSites.id, clinicalSiteId))
      .limit(1)

    if (siteAccess.length === 0) {
      return createErrorResponse(ERROR_MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND)
    }

    // Get all locations for the clinical site
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
      })
      .from(clinicalSiteLocations)
      .where(eq(clinicalSiteLocations.clinicalSiteId, clinicalSiteId))
      .orderBy(clinicalSiteLocations.isPrimary, clinicalSiteLocations.name)

    return createSuccessResponse({
      clinicalSiteId,
      locations: locations.map((location) => ({
        ...location,
        latitude: Number.parseFloat(location.latitude),
        longitude: Number.parseFloat(location.longitude),
      })),
      total: locations.length,
    })
  }
)

// POST /api/clinical-sites/[id]/locations - Create a new location for a clinical site
export const POST = withErrorHandling(
  async (request: NextRequest, { params }: { params: { id: string } }) => {
    const { userId } = await auth()

    if (!userId) {
      return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
    }

    const clinicalSiteId = params.id
    const body = await request.json()

    const {
      name,
      latitude,
      longitude,
      radius,
      description,
      floor,
      department,
      isPrimary = false,
    }: CreateLocationRequest = body

    // Validate required fields
    if (
      !name ||
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      typeof radius !== "number"
    ) {
      return createErrorResponse(
        "Missing required fields: name, latitude, longitude, radius",
        HTTP_STATUS.BAD_REQUEST
      )
    }

    // Validate coordinate ranges
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return createErrorResponse("Invalid coordinates", HTTP_STATUS.BAD_REQUEST)
    }

    // Validate radius
    if (radius <= 0 || radius > 10000) {
      return createErrorResponse(
        "Radius must be between 1 and 10000 meters",
        HTTP_STATUS.BAD_REQUEST
      )
    }

    // Verify clinical site exists
    const siteExists = await db
      .select({ id: clinicalSites.id })
      .from(clinicalSites)
      .where(eq(clinicalSites.id, clinicalSiteId))
      .limit(1)

    if (siteExists.length === 0) {
      return createErrorResponse(ERROR_MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND)
    }

    // If this is set as primary, unset other primary locations
    if (isPrimary) {
      await db
        .update(clinicalSiteLocations)
        .set({ isPrimary: false })
        .where(
          and(
            eq(clinicalSiteLocations.clinicalSiteId, clinicalSiteId),
            eq(clinicalSiteLocations.isPrimary, true)
          )
        )
    }

    // Create the new location
    const newLocation = await db
      .insert(clinicalSiteLocations)
      .values({
        clinicalSiteId,
        name,
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        radius,
        description,
        floor,
        department,
        isPrimary,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()

    const location = newLocation[0]

    return createSuccessResponse(
      {
        location: {
          ...location,
          latitude: Number.parseFloat(location.latitude),
          longitude: Number.parseFloat(location.longitude),
        },
      },
      "Location created successfully",
      HTTP_STATUS.CREATED
    )
  }
)

// PUT /api/clinical-sites/[id]/locations - Update a location
export const PUT = withErrorHandling(
  async (request: NextRequest, { params }: { params: { id: string } }) => {
    const { userId } = await auth()

    if (!userId) {
      return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
    }

    const clinicalSiteId = params.id
    const body = await request.json()

    const {
      locationId,
      name,
      latitude,
      longitude,
      radius,
      description,
      floor,
      department,
      isPrimary,
      isActive,
    } = body

    if (!locationId) {
      return createErrorResponse("Location ID is required", HTTP_STATUS.BAD_REQUEST)
    }

    // Validate coordinates if provided
    if (latitude !== undefined && (latitude < -90 || latitude > 90)) {
      return createErrorResponse("Invalid latitude", HTTP_STATUS.BAD_REQUEST)
    }

    if (longitude !== undefined && (longitude < -180 || longitude > 180)) {
      return createErrorResponse("Invalid longitude", HTTP_STATUS.BAD_REQUEST)
    }

    // Validate radius if provided
    if (radius !== undefined && (radius <= 0 || radius > 10000)) {
      return createErrorResponse(
        "Radius must be between 1 and 10000 meters",
        HTTP_STATUS.BAD_REQUEST
      )
    }

    // Verify location exists and belongs to the clinical site
    const existingLocation = await db
      .select()
      .from(clinicalSiteLocations)
      .where(
        and(
          eq(clinicalSiteLocations.id, locationId),
          eq(clinicalSiteLocations.clinicalSiteId, clinicalSiteId)
        )
      )
      .limit(1)

    if (existingLocation.length === 0) {
      return createErrorResponse("Location not found", HTTP_STATUS.NOT_FOUND)
    }

    // If setting as primary, unset other primary locations
    if (isPrimary === true) {
      await db
        .update(clinicalSiteLocations)
        .set({ isPrimary: false })
        .where(
          and(
            eq(clinicalSiteLocations.clinicalSiteId, clinicalSiteId),
            eq(clinicalSiteLocations.isPrimary, true)
          )
        )
    }

    // Prepare update data
    const updateData: any = { updatedAt: new Date() }

    if (name !== undefined) updateData.name = name
    if (latitude !== undefined) updateData.latitude = latitude.toString()
    if (longitude !== undefined) updateData.longitude = longitude.toString()
    if (radius !== undefined) updateData.radius = radius
    if (description !== undefined) updateData.description = description
    if (floor !== undefined) updateData.floor = floor
    if (department !== undefined) updateData.department = department
    if (isPrimary !== undefined) updateData.isPrimary = isPrimary
    if (isActive !== undefined) updateData.isActive = isActive

    // Update the location
    const updatedLocation = await db
      .update(clinicalSiteLocations)
      .set(updateData)
      .where(eq(clinicalSiteLocations.id, locationId))
      .returning()

    const location = updatedLocation[0]

    return createSuccessResponse(
      {
        location: {
          ...location,
          latitude: Number.parseFloat(location.latitude),
          longitude: Number.parseFloat(location.longitude),
        },
      },
      "Location updated successfully"
    )
  }
)

// DELETE /api/clinical-sites/[id]/locations - Delete a location
export const DELETE = withErrorHandling(
  async (request: NextRequest, { params }: { params: { id: string } }) => {
    const { userId } = await auth()

    if (!userId) {
      return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
    }

    const clinicalSiteId = params.id
    const { searchParams } = new URL(request.url)
    const locationId = searchParams.get("locationId")

    if (!locationId) {
      return createErrorResponse("Location ID is required", HTTP_STATUS.BAD_REQUEST)
    }

    // Verify location exists and belongs to the clinical site
    const existingLocation = await db
      .select()
      .from(clinicalSiteLocations)
      .where(
        and(
          eq(clinicalSiteLocations.id, locationId),
          eq(clinicalSiteLocations.clinicalSiteId, clinicalSiteId)
        )
      )
      .limit(1)

    if (existingLocation.length === 0) {
      return createErrorResponse("Location not found", HTTP_STATUS.NOT_FOUND)
    }

    // Delete the location
    await db.delete(clinicalSiteLocations).where(eq(clinicalSiteLocations.id, locationId))

    return createSuccessResponse({ success: true }, "Location deleted successfully")
  }
)
