import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/database/connection-pool"
import {
  timeRecords,
  clinicalSites,
  clinicalSiteLocations,
  locationVerifications,
  locationAccuracyLogs,
  rotations,
} from "@/database/schema"
import { eq, and } from "drizzle-orm"
import { withErrorHandling } from "@/lib/api-response"

interface LocationVerificationRequest {
  timeRecordId: string
  verificationType: "clock_in" | "clock_out"
  userLatitude: number
  userLongitude: number
  userAccuracy: number
  locationSource: "gps" | "network" | "manual"
  clinicalSiteLocationId?: string
  distanceFromSite: number
  isWithinGeofence: boolean
  verificationStatus: "approved" | "flagged" | "rejected"
  flagReason?: string
  metadata?: any
}

interface ProximityCheck {
  isWithinRange: boolean
  distance: number
  allowedRadius: number
  siteName?: string
  siteAddress?: string
}

interface VerificationResult {
  isValid: boolean
  proximity: ProximityCheck
  accuracy: {
    level: "high" | "medium" | "low"
    acceptable: boolean
    value: number
  }
  warnings: string[]
  errors: string[]
}

// Calculate distance between two points using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3 // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c // Distance in meters
}

async function verifyLocationProximity(
  timeRecordId: string,
  userLatitude: number,
  userLongitude: number,
  userId: string
): Promise<ProximityCheck> {
  try {
    // Get the time record with rotation and site information
    const recordWithSite = await db
      .select({
        rotationId: timeRecords.rotationId,
        siteName: clinicalSites.name,
        siteAddress: clinicalSites.address,
      })
      .from(timeRecords)
      .leftJoin(clinicalSites, eq(timeRecords.rotationId, clinicalSites.id))
      .where(and(eq(timeRecords.id, timeRecordId), eq(timeRecords.studentId, userId)))
      .limit(1)

    if (recordWithSite.length === 0) {
      return {
        isWithinRange: false,
        distance: 0,
        allowedRadius: 0,
      }
    }

    const siteData = recordWithSite[0]

    // Try to get location data from clinicalSiteLocations if the site has one
    if (siteData.rotationId) {
      const siteLocations = await db
        .select({
          latitude: clinicalSiteLocations.latitude,
          longitude: clinicalSiteLocations.longitude,
          radius: clinicalSiteLocations.radius,
        })
        .from(clinicalSiteLocations)
        .where(eq(clinicalSiteLocations.clinicalSiteId, siteData.rotationId))
        .limit(1)

      if (siteLocations.length > 0) {
        const loc = siteLocations[0]
        const siteLatitude = Number.parseFloat(loc.latitude)
        const siteLongitude = Number.parseFloat(loc.longitude)
        const allowedRadius = loc.radius || 100

        // Calculate distance between user location and site
        const distance = calculateDistance(userLatitude, userLongitude, siteLatitude, siteLongitude)

        return {
          isWithinRange: distance <= allowedRadius,
          distance: Math.round(distance),
          allowedRadius,
          siteName: siteData.siteName || undefined,
          siteAddress: siteData.siteAddress || undefined,
        }
      }
    }

    // If no site coordinates are available, allow clock in/out
    return {
      isWithinRange: true, // Allow if no site coordinates
      distance: 0,
      allowedRadius: 0,
      siteName: siteData.siteName || undefined,
      siteAddress: siteData.siteAddress || undefined,
    }
  } catch (error) {
    console.error("Proximity verification error:", error)
    return {
      isWithinRange: false,
      distance: 0,
      allowedRadius: 0,
    }
  }
}

function validateLocationAccuracy(accuracy: number): {
  level: "high" | "medium" | "low"
  acceptable: boolean
} {
  if (accuracy <= 10) {
    return { level: "high", acceptable: true }
  }
  if (accuracy <= 50) {
    return { level: "medium", acceptable: true }
  }
  if (accuracy <= 100) {
    return { level: "low", acceptable: true }
  }
  return { level: "low", acceptable: false }
}

export const POST = withErrorHandling(async (request: NextRequest) => {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const {
    timeRecordId,
    verificationType,
    userLatitude,
    userLongitude,
    userAccuracy,
    locationSource,
    clinicalSiteLocationId,
  }: LocationVerificationRequest = body

  // Validate input
  if (
    !verificationType ||
    typeof userLatitude !== "number" ||
    typeof userLongitude !== "number" ||
    typeof userAccuracy !== "number"
  ) {
    return NextResponse.json({ error: "Invalid request data" }, { status: 400 })
  }

  // Validate coordinate ranges
  if (userLatitude < -90 || userLatitude > 90 || userLongitude < -180 || userLongitude > 180) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 })
  }

  // Get the time record to find the clinical site
  const timeRecord = await db
    .select({
      rotationId: timeRecords.rotationId,
    })
    .from(timeRecords)
    .where(and(eq(timeRecords.id, timeRecordId), eq(timeRecords.studentId, userId)))
    .limit(1)

  if (timeRecord.length === 0) {
    return NextResponse.json({ error: "Time record not found" }, { status: 404 })
  }

  // Get clinical site ID from rotation
  const [rotation] = await db
    .select({ clinicalSiteId: rotations.clinicalSiteId })
    .from(rotations)
    .where(eq(rotations.id, timeRecord[0].rotationId))
    .limit(1)

  if (!rotation) {
    return NextResponse.json({ error: "Rotation not found" }, { status: 404 })
  }

  // Perform server-side validation
  // Import dynamically to avoid circular dependencies if any (though here it should be fine)
  const { validateLocationWithGeofence, saveLocationVerification } = await import(
    "@/services/location-validation"
  )

  const validationResult = await validateLocationWithGeofence({
    userId,
    latitude: userLatitude,
    longitude: userLongitude,
    accuracy: userAccuracy,
    clinicalSiteId: rotation.clinicalSiteId,
    strictMode: false, // Soft validation for now
  })

  // Save the verification record
  const verificationId = await saveLocationVerification(
    timeRecordId,
    verificationType,
    validationResult,
    userLatitude,
    userLongitude,
    userAccuracy,
    locationSource || "manual"
  )

  return NextResponse.json(
    {
      success: true,
      verificationId: verificationId,
      status: validationResult.isValid ? "approved" : "flagged",
      isWithinGeofence: validationResult.isWithinGeofence,
      distanceFromSite: validationResult.distanceFromSite,
      flagReason: validationResult.errors.join("; ") || validationResult.warnings.join("; "),
      timestamp: new Date(),
    },
    { status: 200 }
  )
})

export const GET = withErrorHandling(async (request: NextRequest) => {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const timeRecordId = searchParams.get("timeRecordId")

  if (!timeRecordId) {
    return NextResponse.json({ error: "Time record ID is required" }, { status: 400 })
  }

  // Get site information for the time record
  const siteInfo = await db
    .select({
      siteName: clinicalSites.name,
      siteAddress: clinicalSites.address,
      sitePhone: clinicalSites.phone,
      siteEmail: clinicalSites.email,
      clinicalSiteId: clinicalSites.id,
    })
    .from(timeRecords)
    .leftJoin(clinicalSites, eq(timeRecords.rotationId, clinicalSites.id))
    .where(and(eq(timeRecords.id, timeRecordId), eq(timeRecords.studentId, userId)))
    .limit(1)

  if (siteInfo.length === 0) {
    return NextResponse.json({ error: "Time record not found or access denied" }, { status: 404 })
  }

  const site = siteInfo[0]

  // Get location data from clinicalSiteLocations if available
  let siteLatitude: string | null = null
  let siteLongitude: string | null = null
  let allowedRadius = 100

  if (site.clinicalSiteId) {
    const locations = await db
      .select({
        latitude: clinicalSiteLocations.latitude,
        longitude: clinicalSiteLocations.longitude,
        radius: clinicalSiteLocations.radius,
      })
      .from(clinicalSiteLocations)
      .where(eq(clinicalSiteLocations.clinicalSiteId, site.clinicalSiteId))
      .limit(1)

    if (locations.length > 0) {
      siteLatitude = locations[0].latitude
      siteLongitude = locations[0].longitude
      allowedRadius = locations[0].radius || 100
    }
  }

  const response = {
    timeRecordId,
    site: {
      name: site.siteName,
      address: site.siteAddress,
      coordinates:
        siteLatitude && siteLongitude
          ? {
              latitude: Number.parseFloat(siteLatitude),
              longitude: Number.parseFloat(siteLongitude),
            }
          : null,
      allowedRadius,
      contact: {
        phone: site.sitePhone,
        email: site.siteEmail,
      },
    },
    requirements: {
      maxAccuracy: 100, // meters
      proximityRequired: !!siteLatitude && !!siteLongitude,
    },
  }

  return NextResponse.json(response, { status: 200 })
})
