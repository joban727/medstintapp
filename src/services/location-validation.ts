import { db } from '@/database/db'
import { 
  clinicalSites, 
  clinicalSiteLocations, 
  locationVerifications,
  locationPermissions,
  timeRecords 
} from '@/database/schema'
import { eq, and, sql } from 'drizzle-orm'

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
 * Calculate distance between two coordinates using Haversine formula
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000 // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

/**
 * Validate location accuracy level
 */
export function validateLocationAccuracy(accuracy: number): {
  level: 'high' | 'medium' | 'low'
  acceptable: boolean
} {
  if (accuracy <= 10) {
    return { level: 'high', acceptable: true }
  }if (accuracy <= 50) {
    return { level: 'medium', acceptable: true }
  }if (accuracy <= 100) {
    return { level: 'low', acceptable: true }
  }
    return { level: 'low', acceptable: false }
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
    let query = db
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
      .where(eq(clinicalSiteLocations.isActive, true))

    if (clinicalSiteId) {
      query = query.where(eq(clinicalSites.id, clinicalSiteId))
    }

    const results = await query
      .orderBy(sql`distance`)
      .limit(1)

    if (results.length === 0) {
      return null
    }

    return results[0]
  } catch (error) {
    console.error('Error finding nearest clinical site:', error)
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
      .innerJoin(clinicalSites, eq(clinicalSites.id, timeRecords.clinicalSiteId))
      .where(and(
        eq(timeRecords.id, timeRecordId),
        eq(timeRecords.userId, userId)
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
    console.error('Error verifying location proximity:', error)
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
export async function validateLocationWithGeofence(
  options: GeofenceValidationOptions
): Promise<LocationValidationResult> {
  const {
    userId,
    latitude,
    longitude,
    accuracy,
    timeRecordId,
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
      result.errors.push('No clinical site locations found')
      return result
    }

    const { site, location, distance } = nearestSite
    result.distanceFromSite = Math.round(distance)
    result.nearestSite = {
      id: site.id,
      name: site.name,
      address: site.address,
      allowedRadius: location.allowedRadius,
    }

    // Check geofence
    result.isWithinGeofence = distance <= location.allowedRadius

    // Validate accuracy
    if (!result.accuracy.acceptable) {
      result.errors.push(
        `Location accuracy is too poor (±${Math.round(accuracy)}m). Please try again with better GPS signal.`
      )
    }

    // Check proximity
    if (!result.isWithinGeofence) {
      result.errors.push(
        `Location is ${result.distanceFromSite}m away from ${site.name} (allowed: ${location.allowedRadius}m)`
      )
    }

    // Add warnings
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
    result.isValid = result.isWithinGeofence && result.accuracy.acceptable

    // In strict mode, require high accuracy
    if (strictMode && result.accuracy.level !== 'high') {
      result.isValid = false
      result.errors.push('High accuracy GPS required in strict mode')
    }

    return result
  } catch (error) {
    console.error('Error validating location with geofence:', error)
    result.errors.push('Failed to validate location')
    return result
  }
}

/**
 * Check user's location permissions
 */
export async function checkLocationPermissions(userId: string): Promise<{
  hasPermission: boolean
  permissionStatus: 'granted' | 'denied' | 'prompt' | 'unknown'
  lastUpdated?: Date
}> {
  try {
    const permissions = await db
      .select()
      .from(locationPermissions)
      .where(eq(locationPermissions.userId, userId))
      .orderBy(sql`${locationPermissions.updatedAt} DESC`)
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
      permissionStatus: permission.permissionStatus as any,
      lastUpdated: permission.updatedAt,
    }
  } catch (error) {
    console.error('Error checking location permissions:', error)
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
  userId: string,
  verificationType: 'clock_in' | 'clock_out',
  validationResult: LocationValidationResult,
  userLatitude: number,
  userLongitude: number,
  userAccuracy: number,
  locationSource: 'gps' | 'network' | 'passive',
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

    const verificationRecord = await db
      .insert(locationVerifications)
      .values({
        userId,
        verificationType,
        userLatitude: userLatitude.toString(),
        userLongitude: userLongitude.toString(),
        userAccuracy,
        locationSource,
        clinicalSiteLocationId: validationResult.nearestSite?.id,
        distanceFromSite: validationResult.distanceFromSite,
        isWithinGeofence: validationResult.isWithinGeofence,
        verificationStatus,
        flagReason,
        metadata: metadata ? JSON.stringify(metadata) : null,
        createdAt: new Date(),
      })
      .returning({ id: locationVerifications.id })

    return verificationRecord[0].id
  } catch (error) {
    console.error('Error saving location verification:', error)
    throw new Error('Failed to save location verification')
  }
}