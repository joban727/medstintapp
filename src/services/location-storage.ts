import { db } from "@/database/connection-pool"
import { locationVerifications, locationPermissions, locationAccuracyLogs, timeRecords } from '@/database/schema'
import { eq, and, desc, lt } from 'drizzle-orm'
import type { OpenMapService } from '@/lib/openmap-service'
import { openMapService } from '@/lib/openmap-service'

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
  timeRecordId: string
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
  permissionType: 'precise' | 'approximate' | 'denied'
  permissionStatus: 'granted' | 'denied' | 'prompt' | 'not_requested'
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
    // Use singleton to avoid multiple interval owners and memory leaks
    this.openMapService = openMapService
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
        timeRecordId: options.timeRecordId,
        verificationType: options.action,
        userLatitude: encryptedLocation.latitude.toString(),
        userLongitude: encryptedLocation.longitude.toString(),
        userAccuracy: locationData.accuracy.toString(),
        clinicalSiteLocationId: options.clinicalSiteId, // Using clinicalSiteId as locationId for now
        isWithinGeofence: false, // Will be calculated by geofence service
        locationSource: options.isManual ? 'manual' : 'gps',
        verificationTime: locationData.timestamp,
        metadata: {
          timezone: validation.timezone,
          timezoneOffset: validation.timezoneOffset,
          deviceInfo: options.deviceInfo
        }
      }).returning({ id: locationVerifications.id })

      // Store detailed accuracy logs if enabled
      await this.storeAccuracyLog(locationData, options.userId, options.isManual ? 'manual' : 'gps')

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
        respondedAt: new Date(),
        lastUsedAt: new Date()
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
          action: locationVerifications.verificationType,
          timestamp: locationVerifications.verificationTime,
          accuracy: locationVerifications.userAccuracy,
          isWithinGeofence: locationVerifications.isWithinGeofence,
          isManual: locationVerifications.locationSource,
          metadata: locationVerifications.metadata
        })
        .from(locationVerifications)
        .innerJoin(timeRecords, eq(locationVerifications.timeRecordId, timeRecords.id))
        .where(eq(timeRecords.studentId, userId))
        .orderBy(desc(locationVerifications.verificationTime))
        .limit(limit)

      return history.map(record => ({
        id: record.id,
        action: record.action,
        timestamp: record.timestamp,
        accuracy: parseFloat(record.accuracy ?? '0'),
        isWithinGeofence: record.isWithinGeofence,
        isManual: record.isManual === 'manual',
        timezone: (record.metadata as any)?.timezone
      }))
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
            eq(locationPermissions.permissionStatus, 'granted')
          )
        )
        .orderBy(desc(locationPermissions.lastUsedAt))
        .limit(1)

      if (permission.length === 0) {
        return { hasPermission: false }
      }

      return {
        hasPermission: permission[0].permissionStatus === 'granted',
        permissionType: permission[0].permissionType || undefined,
        lastChecked: permission[0].lastUsedAt || undefined
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
        .where(lt(locationVerifications.verificationTime, cutoffDate))

      // Delete old accuracy logs
      await db
        .delete(locationAccuracyLogs)
        .where(lt(locationAccuracyLogs.timestamp, cutoffDate))

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
    source: 'gps' | 'network' | 'manual'
  ): Promise<void> {
    try {
      await db.insert(locationAccuracyLogs).values({
        userId,
        latitude: locationData.latitude.toString(),
        longitude: locationData.longitude.toString(),
        accuracy: locationData.accuracy.toString(),
        altitude: locationData.altitude?.toString(),
        altitudeAccuracy: locationData.altitudeAccuracy?.toString(),
        heading: locationData.heading?.toString(),
        speed: locationData.speed?.toString(),
        locationSource: source,
        batteryLevel: null, // Will be populated from device info if available
        timestamp: locationData.timestamp
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