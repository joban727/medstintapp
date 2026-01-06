import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/database/connection-pool"
import {
  facilityManagement,
  schools,
  users,
  clinicalSites,
  clinicalSiteLocations,
} from "@/database/schema"
import { getSchoolContext } from "@/lib/school-utils"
import { eq, and, desc, sql } from "drizzle-orm"
import { z } from "zod"
import { withCSRF } from "@/lib/csrf-middleware"
import { logger } from "@/lib/logger"

// Request validation schemas
const facilityManagementSchema = z.object({
  facilityName: z.string().min(1).max(200),
  facilityType: z.enum([
    "hospital",
    "clinic",
    "nursing_home",
    "outpatient",
    "emergency",
    "pharmacy",
    "laboratory",
    "other",
  ]),
  address: z.string().min(1).max(500),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  geofenceRadius: z.number().min(10).max(1000).optional().default(100),
  strictGeofence: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
  isCustom: z.boolean().optional().default(false),
  osmId: z.string().optional(),
  priority: z.number().min(0).max(100).optional().default(0),
  contactInfo: z
    .record(z.string(), z.union([z.string(), z.null()]))
    .optional()
    .default({}),
  operatingHours: z
    .record(z.string(), z.union([z.string(), z.null()]))
    .optional()
    .default({}),
  specialties: z.array(z.string()).optional().default([]),
  notes: z.string().optional(),
  clinicalSiteId: z.string().optional(),
})

const updateFacilitySchema = facilityManagementSchema.partial()

// GET /api/facility-management - Get managed facilities for school
export async function GET(request: NextRequest) {
  try {
    // Get school context
    const context = await getSchoolContext()
    const { userRole, schoolId } = context

    // Check if user has admin permissions
    if (!["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_SUPERVISOR"].includes(userRole)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Parse query parameters
    const url = new URL(request.url)
    const isActive = url.searchParams.get("active")
    const facilityType = url.searchParams.get("type")
    const limit = Number.parseInt(url.searchParams.get("limit") || "50")
    const offset = Number.parseInt(url.searchParams.get("offset") || "0")

    // Require a school association
    if (!schoolId) {
      return NextResponse.json({ error: "User must be associated with a school" }, { status: 400 })
    }

    // Build query conditions
    const conditions = [eq(facilityManagement.schoolId, schoolId)]

    if (isActive !== null) {
      conditions.push(eq(facilityManagement.isActive, isActive === "true"))
    }

    if (facilityType) {
      conditions.push(
        eq(
          facilityManagement.facilityType,
          facilityType as
            | "hospital"
            | "clinic"
            | "nursing_home"
            | "outpatient"
            | "emergency"
            | "pharmacy"
            | "laboratory"
            | "other"
        )
      )
    }

    // Get facilities
    const facilities = await db
      .select()
      .from(facilityManagement)
      .where(and(...conditions))
      .orderBy(desc(facilityManagement.priority), desc(facilityManagement.createdAt))
      .limit(limit)
      .offset(offset)

    // Get total count
    const [totalCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(facilityManagement)
      .where(and(...conditions))

    return NextResponse.json({
      success: true,
      data: {
        facilities: facilities.map((facility) => ({
          id: facility.id,
          facilityName: facility.facilityName,
          facilityType: facility.facilityType,
          address: facility.address,
          latitude: Number.parseFloat(facility.latitude),
          longitude: Number.parseFloat(facility.longitude),
          geofenceRadius: facility.geofenceRadius,
          strictGeofence: facility.strictGeofence,
          isActive: facility.isActive,
          isCustom: facility.isCustom,
          osmId: facility.osmId,
          priority: facility.priority,
          contactInfo: facility.contactInfo,
          operatingHours: facility.operatingHours,
          specialties: facility.specialties,
          notes: facility.notes,
          clinicalSiteId: facility.clinicalSiteId,
          createdAt: facility.createdAt,
          updatedAt: facility.updatedAt,
        })),
        pagination: {
          total: totalCount.count,
          limit,
          offset,
          hasMore: offset + limit < totalCount.count,
        },
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error("Facility management GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/facility-management - Create new managed facility
export const POST = withCSRF(async (request: NextRequest) => {
  try {
    // Try to get school context, but handle authentication errors gracefully
    let context
    try {
      context = await getSchoolContext()
    } catch (authError) {
      console.error("Facility management POST error:", authError)
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const { userRole, userId, schoolId } = context

    // Check if user has admin permissions
    if (!["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(userRole)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Require a school context for facility creation
    if (!schoolId) {
      console.log("Error: User must be associated with a school")
      return NextResponse.json({ error: "User must be associated with a school" }, { status: 400 })
    }

    // Validate associated school exists
    const [school] = await db
      .select({ id: schools.id })
      .from(schools)
      .where(eq(schools.id, schoolId))
      .limit(1)

    if (!school) {
      console.log("Error: Associated school not found")
      return NextResponse.json({ error: "Associated school not found" }, { status: 400 })
    }

    // Check creator exists; allow null if missing
    const [creator] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    // Parse request body with JSON safety
    let body: unknown
    try {
      body = await request.json()
    } catch (parseErr) {
      console.log("Invalid JSON in request body:", parseErr)
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    // Normalize potential coordinate wrapper to latitude/longitude
    const raw = body as Record<string, unknown>
    const normalizedBody =
      raw && raw.coordinates
        ? {
            ...raw,
            latitude: (raw.coordinates as Record<string, number>).latitude,
            longitude: (raw.coordinates as Record<string, number>).longitude,
          }
        : raw

    // Simple validation
    const validationResult = facilityManagementSchema.safeParse(normalizedBody)

    if (!validationResult.success) {
      console.log("Validation error:", JSON.stringify(validationResult.error.issues, null, 2))
      return NextResponse.json(
        { error: "Invalid request body", details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const facilityData = validationResult.data
    console.error("Facility Data (stderr):", JSON.stringify(facilityData, null, 2))

    // Validate clinical site if provided
    if (facilityData.clinicalSiteId) {
      const [site] = await db
        .select({ id: clinicalSites.id })
        .from(clinicalSites)
        .where(eq(clinicalSites.id, facilityData.clinicalSiteId))
        .limit(1)

      if (!site) {
        console.log("Error: Selected clinical site not found")
        return NextResponse.json({ error: "Selected clinical site not found" }, { status: 400 })
      }
    }
    // Create new facility
    const sanitizedValues = {
      schoolId: schoolId,
      createdBy: userId,
      updatedBy: userId,
      facilityName: facilityData.facilityName,
      facilityType: facilityData.facilityType,
      address: facilityData.address,
      latitude: facilityData.latitude.toString(),
      longitude: facilityData.longitude.toString(),
      geofenceRadius: facilityData.geofenceRadius,
      strictGeofence: facilityData.strictGeofence,
      isActive: facilityData.isActive ?? true,
      isCustom: facilityData.isCustom ?? false,
      osmId: facilityData.osmId,
      priority: facilityData.priority,
      contactInfo:
        facilityData.contactInfo && Object.keys(facilityData.contactInfo).length > 0
          ? facilityData.contactInfo
          : undefined,
      operatingHours:
        facilityData.operatingHours && Object.keys(facilityData.operatingHours).length > 0
          ? facilityData.operatingHours
          : undefined,
      specialties:
        facilityData.specialties && facilityData.specialties.length > 0
          ? facilityData.specialties
          : undefined,
      notes: facilityData.notes,
      clinicalSiteId: facilityData.clinicalSiteId,
    }

    // Use a transaction to ensure atomic creation and allow clearer error handling
    const newFacility = await db.transaction(async (tx) => {
      const [created] = await tx.insert(facilityManagement).values(sanitizedValues).returning()

      // Sync to clinical site location if linked
      if (sanitizedValues.clinicalSiteId && sanitizedValues.strictGeofence) {
        // Find primary location or just update all locations for this site?
        // For now, let's update all locations for this site to match the facility settings
        // This assumes 1:1 or 1:many where all share the same policy

        // Check if location exists
        const [existingLocation] = await tx
          .select()
          .from(clinicalSiteLocations)
          .where(eq(clinicalSiteLocations.clinicalSiteId, sanitizedValues.clinicalSiteId))
          .limit(1)

        if (!existingLocation) {
          logger.info(
            { facilityId: sanitizedValues.facilityName },
            "Creating new location for facility"
          )
          await tx.insert(clinicalSiteLocations).values({
            clinicalSiteId: sanitizedValues.clinicalSiteId,
            name: sanitizedValues.facilityName, // Use facility name as location name
            latitude: sanitizedValues.latitude,
            longitude: sanitizedValues.longitude,
            radius: sanitizedValues.geofenceRadius,
            strictGeofence: true,
          })
        } else {
          await tx
            .update(clinicalSiteLocations)
            .set({
              radius: sanitizedValues.geofenceRadius,
              strictGeofence: sanitizedValues.strictGeofence,
            })
            .where(eq(clinicalSiteLocations.clinicalSiteId, sanitizedValues.clinicalSiteId))
        }
      }

      return created
    })

    return NextResponse.json({
      success: true,
      data: {
        facility: {
          id: newFacility.id,
          facilityName: newFacility.facilityName,
          facilityType: newFacility.facilityType,
          address: newFacility.address,
          latitude: Number.parseFloat(newFacility.latitude),
          longitude: Number.parseFloat(newFacility.longitude),
          geofenceRadius: newFacility.geofenceRadius,
          strictGeofence: newFacility.strictGeofence,
          isActive: newFacility.isActive,
          isCustom: newFacility.isCustom,
          osmId: newFacility.osmId,
          priority: newFacility.priority,
          contactInfo: newFacility.contactInfo,
          operatingHours: newFacility.operatingHours,
          specialties: newFacility.specialties,
          notes: newFacility.notes,
          clinicalSiteId: newFacility.clinicalSiteId,
          createdAt: newFacility.createdAt,
          updatedAt: newFacility.updatedAt,
        },
        message: "Facility created successfully",
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    logger.error({ error }, "Facility management POST error")

    const isDevelopment = process.env.NODE_ENV === "development"
    const isTransactionError = error instanceof Error && /transaction/i.test(error.message)
    const message = isTransactionError ? "Transaction error occurred" : "Internal server error"

    return NextResponse.json(
      {
        error: message,
        // Only include verbose details for non-transaction errors in development
        ...(isDevelopment &&
          !isTransactionError && {
            details: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          }),
      },
      { status: 500 }
    )
  }
})

// PUT /api/facility-management/[id] - Update managed facility
export const PUT = withCSRF(async (request: NextRequest) => {
  try {
    // Get school context
    const context = await getSchoolContext()
    const { userRole, schoolId } = context

    // Check if user has admin permissions
    if (!["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(userRole)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Require a school association
    if (!schoolId) {
      return NextResponse.json({ error: "User must be associated with a school" }, { status: 400 })
    }

    // Extract facility ID from URL
    const url = new URL(request.url)
    const facilityId = url.pathname.split("/").pop()

    if (!facilityId) {
      return NextResponse.json({ error: "Facility ID required" }, { status: 400 })
    }

    // Parse request body
    const body = await request.json()
    const validationResult = updateFacilitySchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const updates = validationResult.data

    // Convert latitude/longitude to strings if provided
    const updateData: any = { ...updates }
    if (updates.latitude !== undefined) {
      updateData.latitude = updates.latitude.toString()
    }
    if (updates.longitude !== undefined) {
      updateData.longitude = updates.longitude.toString()
    }

    // Update facility
    const [updatedFacility] = await db
      .update(facilityManagement)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(and(eq(facilityManagement.id, facilityId), eq(facilityManagement.schoolId, schoolId)))
      .returning()

    // Sync updates to clinical site locations if linked
    if (updatedFacility && updatedFacility.clinicalSiteId) {
      const shouldSync =
        updates.geofenceRadius !== undefined || updates.strictGeofence !== undefined

      if (shouldSync) {
        const updatePayload: any = {}
        if (updates.geofenceRadius !== undefined) updatePayload.radius = updates.geofenceRadius
        if (updates.strictGeofence !== undefined)
          updatePayload.strictGeofence = updates.strictGeofence

        await db
          .update(clinicalSiteLocations)
          .set(updatePayload)
          .where(eq(clinicalSiteLocations.clinicalSiteId, updatedFacility.clinicalSiteId))
      }
    }

    if (!updatedFacility) {
      return NextResponse.json({ error: "Facility not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        facility: {
          id: updatedFacility.id,
          facilityName: updatedFacility.facilityName,
          facilityType: updatedFacility.facilityType,
          address: updatedFacility.address,
          latitude: Number.parseFloat(updatedFacility.latitude),
          longitude: Number.parseFloat(updatedFacility.longitude),
          geofenceRadius: updatedFacility.geofenceRadius,
          strictGeofence: updatedFacility.strictGeofence,
          isActive: updatedFacility.isActive,
          isCustom: updatedFacility.isCustom,
          osmId: updatedFacility.osmId,
          priority: updatedFacility.priority,
          contactInfo: updatedFacility.contactInfo,
          operatingHours: updatedFacility.operatingHours,
          specialties: updatedFacility.specialties,
          notes: updatedFacility.notes,
          clinicalSiteId: updatedFacility.clinicalSiteId,
          createdAt: updatedFacility.createdAt,
          updatedAt: updatedFacility.updatedAt,
        },
        message: "Facility updated successfully",
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    logger.error({ error }, "Facility management PUT error")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})

// DELETE /api/facility-management/[id] - Delete managed facility
export const DELETE = withCSRF(async (request: NextRequest) => {
  try {
    // Get school context
    const context = await getSchoolContext()
    const { userRole, schoolId } = context

    // Check if user has admin permissions
    if (!["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(userRole)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Require a school association
    if (!schoolId) {
      return NextResponse.json({ error: "User must be associated with a school" }, { status: 400 })
    }

    // Extract facility ID from URL
    const url = new URL(request.url)
    const facilityId = url.pathname.split("/").pop()

    if (!facilityId) {
      return NextResponse.json({ error: "Facility ID required" }, { status: 400 })
    }

    // Delete facility
    const deleted = await db
      .delete(facilityManagement)
      .where(and(eq(facilityManagement.id, facilityId), eq(facilityManagement.schoolId, schoolId)))

    if (deleted.rowCount === 0) {
      return NextResponse.json({ error: "Facility not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        message: "Facility deleted successfully",
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    logger.error({ error }, "Facility management DELETE error")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})
