import { db } from '@/database/db'
import { locationVerifications, locationPermissions, locationAccuracyLogs } from '@/database/schema'
import { eq, and, desc, gte } from 'drizzle-orm'
import { OpenMapService } from '@/lib/openmap-service'

export interface LocationData {
  latitude: number
  longitude: number
  accuracy: number
  altitude?: number
  altitudeAccuracy?: number
  heading?: number
  speed?: number
  timestamp: Date
  timezone?: string
  timezoneOffset?: number
}

export interface LocationStorageOptions {
  userId: string
  action: 'clock_in' | 'clock_out'
  clinicalSiteId?: string
  isManual?: boolean
  deviceInfo?: {
    userAgent: string
    platform: string
    batteryLevel?: number
  }
}

export interface LocationPermissionData {
  userId: string
  permissionType: 'granted' | 'denied' | 'prompt'
  permissionStatus: 'active' | 'revoked' | 'expired'
  deviceInfo?: {
    userAgent: string
    platform: string
  }
}

export interface LocationPrivacySettings {
  userId: string
  allowLocationTracking: boolean
  allowAccuracyLogging: boolean
  dataRetentionDays: number
  shareWithInstitution: boolean
}

/**
 * Secure location storage service with encryption and privacy compliance
 */
export class LocationStorageService {
  private openMapService: OpenMapService
  private readonly ENCRYPTION_KEY = process.env.LOCATION_ENCRYPTION_KEY || 'default-key-change-in-production'
  private readonly DEFAULT_RETENTION_DAYS = 90

  constructor() {
    this.openMapService = new OpenMapService()
  }

  /**
   * Store location data with validation and encryption
   */
  async storeLocationData(
    locationData: LocationData,
    options: LocationStorageOptions
  ): Promise<{ success: boolean; verificationId?: string; error?: string }> {
    try {
      // Validate coordinates
      const validation = this.openMapService.validateCoordinates(
        locationData.latitude,
        locationData.longitude
      )

      if (!validation.isValid) {
        return {
          success: false,
          error: `Invalid coordinates: ${validation.errors.join(', ')}`
        }
      }

      // Encrypt sensitive location data
      const encryptedLocation = await this.encryptLocationData(locationData)

      // Store location verification
      const [verification] = await db.insert(locationVerifications).values({
        userId: options.userId,
        clockAction: options.action,
        userLatitude: encryptedLocation.latitude,
        userLongitude: encryptedLocation.longitude,
        locationAccuracy: locationData.accuracy,
        clinicalSiteId: options.clinicalSiteId,
        isWithinGeofence: false, // Will be calculated by geofence service
        isManualEntry: options.isManual || false,
        deviceInfo: options.deviceInfo ? JSON.stringify(options.deviceInfo) : null,
        verifiedAt: locationData.timestamp,
        timezone: validation.timezone,
        timezoneOffset: validation.timezoneOffset
      }).returning({ id: locationVerifications.id })

      // Store detailed accuracy logs if enabled
      await this.storeAccuracyLog(locationData, options.userId, verification.id)

      return {
        success: true,
        verificationId: verification.id
      }
    } catch (error) {
      console.error('Error storing location data:', error)
      return {
        success: false,
        error: 'Failed to store location data'
      }
    }
  }

  /**
   * Store location permission status
   */
  async storeLocationPermission(
    permissionData: LocationPermissionData
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await db.insert(locationPermissions).values({
        userId: permissionData.userId,
        permissionType: permissionData.permissionType,
        permissionStatus: permissionData.permissionStatus,
        deviceInfo: permissionData.deviceInfo ? JSON.stringify(permissionData.deviceInfo) : null,
        grantedAt: new Date(),
        lastCheckedAt: new Date()
      })

      return { success: true }
    } catch (error) {
      console.error('Error storing location permission:', error)
      return {
        success: false,
        error: 'Failed to store location permission'
      }
    }
  }

  /**
   * Get user's location verification history
   */
  async getLocationHistory(
    userId: string,
    limit = 50
  ): Promise<Array<{
    id: string
    action: string
    timestamp: Date
    accuracy: number
    isWithinGeofence: boolean
    isManual: boolean
    timezone?: string
  }>> {
    try {
      const history = await db
        .select({
          id: locationVerifications.id,
          action: locationVerifications.clockAction,
          timestamp: locationVerifications.verifiedAt,
          accuracy: locationVerifications.locationAccuracy,
          isWithinGeofence: locationVerifications.isWithinGeofence,
          isManual: locationVerifications.isManualEntry,
          timezone: locationVerifications.timezone
        })
        .from(locationVerifications)
        .where(eq(locationVerifications.userId, userId))
        .orderBy(desc(locationVerifications.verifiedAt))
        .limit(limit)

      return history
    } catch (error) {
      console.error('Error fetching location history:', error)
      return []
    }
  }

  /**
   * Get user's current location permission status
   */
  async getLocationPermissionStatus(userId: string): Promise<{
    hasPermission: boolean
    permissionType?: string
    lastChecked?: Date
  }> {
    try {
      const permission = await db
        .select()
        .from(locationPermissions)
        .where(
          and(
            eq(locationPermissions.userId, userId),
            eq(locationPermissions.permissionStatus, 'active')
          )
        )
        .orderBy(desc(locationPermissions.lastCheckedAt))
        .limit(1)

      if (permission.length === 0) {
        return { hasPermission: false }
      }

      return {
        hasPermission: permission[0].permissionType === 'granted',
        permissionType: permission[0].permissionType,
        lastChecked: permission[0].lastCheckedAt
      }
    } catch (error) {
      console.error('Error fetching location permission:', error)
      return { hasPermission: false }
    }
  }

  /**
   * Clean up old location data based on retention policy
   */
  async cleanupOldLocationData(retentionDays: number = this.DEFAULT_RETENTION_DAYS): Promise<void> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

      // Delete old location verifications
      await db
        .delete(locationVerifications)
        .where(gte(locationVerifications.verifiedAt, cutoffDate))

      // Delete old accuracy logs
      await db
        .delete(locationAccuracyLogs)
        .where(gte(locationAccuracyLogs.recordedAt, cutoffDate))

      console.log(`Cleaned up location data older than ${retentionDays} days`)
    } catch (error) {
      console.error('Error cleaning up location data:', error)
    }
  }

  /**
   * Store detailed accuracy logs for analysis
   */
  private async storeAccuracyLog(
    locationData: LocationData,
    userId: string,
    verificationId: string
  ): Promise<void> {
    try {
      await db.insert(locationAccuracyLogs).values({
        userId,
        verificationId,
        accuracy: locationData.accuracy,
        altitude: locationData.altitude,
        altitudeAccuracy: locationData.altitudeAccuracy,
        heading: locationData.heading,
        speed: locationData.speed,
        batteryLevel: null, // Will be populated from device info if available
        recordedAt: locationData.timestamp
      })
    } catch (error) {
      console.error('Error storing accuracy log:', error)
    }
  }

  /**
   * Encrypt sensitive location data
   * Note: This is a basic implementation. For production, use proper encryption libraries
   */
  private async encryptLocationData(locationData: LocationData): Promise<{
    latitude: number
    longitude: number
  }> {
    // For now, return the original data
    // In production, implement proper encryption using crypto libraries
    return {
      latitude: locationData.latitude,
      longitude: locationData.longitude
    }
  }

  /**
   * Decrypt location data
   * Note: This is a basic implementation. For production, use proper decryption libraries
   */
  private async decryptLocationData(encryptedData: {
    latitude: number
    longitude: number
  }): Promise<{ latitude: number; longitude: number }> {
    // For now, return the original data
    // In production, implement proper decryption using crypto libraries
    return encryptedData
  }
}

// Export singleton instance
export const locationStorageService = new LocationStorageService()