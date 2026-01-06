import { db } from "@/database/connection-pool"
import {
  clinicalSites,
  clinicalSiteLocations,
  locationVerifications,
  locationPermissions,
  timeRecords,
  rotations
} from '@/database/schema'
import { sql, desc, and, eq } from "drizzle-orm"
import { calculateDistance } from "@/lib/geo-utils"
import { encryptLocationForStorage } from "@/lib/encryption"
import { logger } from "@/lib/logger"

export type PermissionStatus = 'granted' | 'denied' | 'prompt' | 'unknown' | 'not_requested'

export interface LocationValidationResult {
  isValid: boolean
  isWithinGeofence: boolean
  distanceFromSite: number
  nearestSite?: {
    id: string
    name: string
    address: string
    allowedRadius: number
  }
  accuracy: {
    level: 'high' | 'medium' | 'low'
    acceptable: boolean
    value: number
  }
  warnings: string[]
  errors: string[]
  metadata?: any
}

export interface ProximityCheckResult {
  isWithinRange: boolean
  distance: number
  siteName?: string
  siteId?: string
  allowedRadius: number
  clinicalSiteLocationId?: string
}

export interface GeofenceValidationOptions {
  userId: string
  latitude: number
  longitude: number
  accuracy: number
  timeRecordId?: string
  clinicalSiteId?: string
  strictMode?: boolean
}

/**
 * Validate location accuracy level
 */
export function validateLocationAccuracy(accuracy: number): {
  level: 'high' | 'medium' | 'low'
  acceptable: boolean
  value: number
} {
  if (accuracy <= 10) {
    return { level: 'high', acceptable: true, value: accuracy }
  }
  if (accuracy <= 50) {
    return { level: 'medium', acceptable: true, value: accuracy }
  }
  if (accuracy <= 100) {
    return { level: 'low', acceptable: true, value: accuracy }
  }
  return { level: 'low', acceptable: false, value: accuracy }
}

/**
 * Find the nearest clinical site location to given coordinates
 */
export async function findNearestClinicalSite(
  latitude: number,
  longitude: number,
  clinicalSiteId?: string
): Promise<{
  site: any
  location: any
  distance: number
} | null> {
  try {
    const query = db
      .select({
        site: clinicalSites,
        location: clinicalSiteLocations,
        distance: sql<number>`
          6371000 * acos(
            cos(radians(${latitude})) * 
            cos(radians(CAST(${clinicalSiteLocations.latitude} AS DECIMAL))) * 
            cos(radians(CAST(${clinicalSiteLocations.longitude} AS DECIMAL)) - radians(${longitude})) + 
            sin(radians(${latitude})) * 
            sin(radians(CAST(${clinicalSiteLocations.latitude} AS DECIMAL)))
          )
        `
      })
      .from(clinicalSiteLocations)
      .innerJoin(clinicalSites, eq(clinicalSites.id, clinicalSiteLocations.clinicalSiteId))
      .where(
        and(
          eq(clinicalSiteLocations.isActive, true),
          clinicalSiteId ? eq(clinicalSites.id, clinicalSiteId) : undefined
        )
      )

    const results = await query
      .orderBy(sql`distance`)
      .limit(1)

    if (results.length === 0) {
      return null
    }

    return results[0]
  } catch (error) {
    logger.error({ error }, 'Error finding nearest clinical site')
    return null
  }
}

/**
 * Verify if user location is within allowed proximity to clinical site
 */
export async function verifyLocationProximity(
  timeRecordId: string,
  userLatitude: number,
  userLongitude: number,
  userId: string
): Promise<ProximityCheckResult> {
  try {
    // Get time record with clinical site information
    const timeRecord = await db
      .select({
        timeRecord: timeRecords,
        site: clinicalSites,
      })
      .from(timeRecords)
      .innerJoin(rotations, eq(timeRecords.rotationId, rotations.id))
      .innerJoin(clinicalSites, eq(rotations.clinicalSiteId, clinicalSites.id))
      .where(and(
        eq(timeRecords.id, timeRecordId),
        eq(timeRecords.studentId, userId)
      ))
      .limit(1)

    if (timeRecord.length === 0) {
      return {
        isWithinRange: false,
        distance: 0,
        allowedRadius: 0,
      }
    }

    const { site } = timeRecord[0]

    // Find nearest location for this clinical site
    const nearestLocation = await findNearestClinicalSite(
      userLatitude,
      userLongitude,
      site.id
    )

    if (!nearestLocation) {
      return {
        isWithinRange: false,
        distance: 0,
        siteName: site.name,
        siteId: site.id,
        allowedRadius: 0,
      }
    }

    const { location, distance } = nearestLocation
    const isWithinRange = distance <= location.allowedRadius

    return {
      isWithinRange,
      distance: Math.round(distance),
      siteName: site.name,
      siteId: site.id,
      allowedRadius: location.allowedRadius,
      clinicalSiteLocationId: location.id,
    }
  } catch (error) {
    logger.error({ error }, 'Error verifying location proximity')
    return {
      isWithinRange: false,
      distance: 0,
      allowedRadius: 0,
    }
  }
}

/**
 * Comprehensive location validation with geofencing
 */
/**
 * Comprehensive location validation with geofencing
 */
export async function validateLocationWithGeofence(
  options: GeofenceValidationOptions
): Promise<LocationValidationResult> {
  const {
    latitude,
    longitude,
    accuracy,
    clinicalSiteId,
    strictMode = false
  } = options

  const result: LocationValidationResult = {
    isValid: false,
    isWithinGeofence: false,
    distanceFromSite: 0,
    accuracy: validateLocationAccuracy(accuracy),
    warnings: [],
    errors: [],
  }

  try {
    // Find nearest clinical site
    const nearestSite = await findNearestClinicalSite(
      latitude,
      longitude,
      clinicalSiteId
    )

    if (!nearestSite) {
      // If no site location is found, we can't validate geofence.
      // Policy: If site has no location set, we allow it but flag it?
      // For now, we'll treat it as valid but add a warning.
      result.isValid = true
      result.warnings.push('Clinical site has no location coordinates configured.')
      return result
    }

    const { site, location, distance } = nearestSite
    result.distanceFromSite = Math.round(distance)
    result.nearestSite = {
      id: site.id,
      name: site.name,
      address: site.address,
      allowedRadius: location.radius, // Use radius from location table
    }

    // Check geofence
    result.isWithinGeofence = distance <= location.radius

    // Validate accuracy
    if (!result.accuracy.acceptable) {
      result.errors.push(
        `Location accuracy is too poor (±${Math.round(accuracy)}m). Please try again with better GPS signal.`
      )
    }

    // Determine strict mode: either global env var OR site-specific setting
    const isStrict = strictMode || location.strictGeofence

    // Check proximity
    if (!result.isWithinGeofence) {
      const message = `Location is ${result.distanceFromSite}m away from ${site.name} (allowed: ${location.radius}m)`
      if (isStrict) {
        result.errors.push(message)
        if (location.strictGeofence) {
          result.errors.push("This clinical site enforces strict geofencing.")
        }
      } else {
        result.warnings.push(message)
      }
    }

    // Add warnings for edge cases
    if (result.accuracy.level === 'low' && result.accuracy.acceptable) {
      result.warnings.push(
        `Location accuracy is low (±${Math.round(accuracy)}m). Consider moving to an area with better GPS signal.`
      )
    }

    if (distance > location.allowedRadius * 0.8 && result.isWithinGeofence) {
      result.warnings.push(
        `You are near the edge of the allowed area (${result.distanceFromSite}m from site)`
      )
    }

    // Determine overall validity
    // In non-strict mode, being out of geofence is just a warning (flagged), so it's "valid" for processing but "flagged" in status
    if (isStrict) {
      result.isValid = result.isWithinGeofence && result.accuracy.acceptable
    } else {
      // In soft mode, we only fail if accuracy is completely unacceptable
      result.isValid = result.accuracy.acceptable
    }

    return result
  } catch (error) {
    logger.error({ error }, 'Error validating location with geofence')
    result.errors.push('Failed to validate location due to system error')
    return result
  }
}

/**
 * Check user's location permissions
 */
export async function checkLocationPermissions(userId: string): Promise<{
  hasPermission: boolean
  permissionStatus: PermissionStatus
  lastUpdated?: Date
}> {
  try {
    const permissions = await db
      .select()
      .from(locationPermissions)
      .where(eq(locationPermissions.userId, userId))
      .orderBy(desc(locationPermissions.updatedAt))
      .limit(1)

    if (permissions.length === 0) {
      return {
        hasPermission: false,
        permissionStatus: 'unknown',
      }
    }

    const permission = permissions[0]
    return {
      hasPermission: permission.permissionStatus === 'granted',
      permissionStatus: permission.permissionStatus as PermissionStatus,
      lastUpdated: permission.updatedAt,
    }
  } catch (error) {
    logger.error({ error }, 'Error checking location permissions')
    return {
      hasPermission: false,
      permissionStatus: 'unknown',
    }
  }
}

/**
 * Save location verification result to database
 */
export async function saveLocationVerification(
  timeRecordId: string,
  verificationType: 'clock_in' | 'clock_out',
  validationResult: LocationValidationResult,
  userLatitude: number,
  userLongitude: number,
  userAccuracy: number,
  locationSource: 'gps' | 'network' | 'manual', // Fixed enum to match schema
  metadata?: any
): Promise<string> {
  try {
    const verificationStatus = validationResult.isValid
      ? 'approved'
      : validationResult.warnings.length > 0 && validationResult.errors.length === 0
        ? 'flagged'
        : 'rejected'

    const flagReason = validationResult.errors.length > 0
      ? validationResult.errors.join('; ')
      : validationResult.warnings.length > 0
        ? validationResult.warnings.join('; ')
        : undefined

    // Encrypt location coordinates before storage
    const encryptedLocation = encryptLocationForStorage(userLatitude, userLongitude)

    const verificationRecord = await db
      .insert(locationVerifications)
      .values({
        timeRecordId,
        verificationType,
        userLatitude: encryptedLocation,
        userLongitude: 'ENCRYPTED_V1', // Marker indicating encrypted data
        userAccuracy: userAccuracy.toString(),
        locationSource,
        clinicalSiteLocationId: validationResult.nearestSite?.id,
        distanceFromSite: validationResult.distanceFromSite.toString(),
        isWithinGeofence: validationResult.isWithinGeofence,
        verificationStatus,
        flagReason,
        metadata: {
          ...(metadata ?? {}),
          encrypted: true,
          encryptionVersion: 1
        },
      })
      .returning({ id: locationVerifications.id })

    return verificationRecord[0].id
  } catch (error) {
    logger.error({ error }, 'Error saving location verification')
    throw new Error('Failed to save location verification')
  }
}