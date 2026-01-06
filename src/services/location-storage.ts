import { db } from "@/database/connection-pool"
import { locationVerifications, locationPermissions, locationAccuracyLogs, timeRecords } from '@/database/schema'
import { eq, and, desc, lt } from 'drizzle-orm'
import type { OpenMapService } from '@/lib/openmap-service'
import { openMapService } from '@/lib/openmap-service'
import {
  encryptLocationForStorage,
  decryptLocationFromStorage,
  isEncrypted,
  isEncryptionConfigured
} from '@/lib/encryption'
import { logger } from '@/lib/logger'

interface LocationVerificationMetadata {
  timezone?: string
  timezoneOffset?: number
  deviceInfo?: any
  encrypted?: boolean
  encryptionVersion?: number
}

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
  private readonly DEFAULT_RETENTION_DAYS = 90

  constructor() {
    // Use singleton to avoid multiple interval owners and memory leaks
    this.openMapService = openMapService

    // Log encryption status on initialization (only in development)
    if (process.env.NODE_ENV === 'development' && !isEncryptionConfigured()) {
      logger.warn('Using development encryption key. Set LOCATION_ENCRYPTION_KEY in production.')
    }
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

      // Encrypt sensitive location data using AES-256-GCM
      const encryptedLocationString = encryptLocationForStorage(
        locationData.latitude,
        locationData.longitude
      )

      // Store location verification with encrypted coordinates
      // The encrypted string contains both lat/long encrypted together
      // We store the encrypted string in userLatitude and a marker in userLongitude
      const [verification] = await db.insert(locationVerifications).values({
        timeRecordId: options.timeRecordId,
        verificationType: options.action,
        userLatitude: encryptedLocationString,
        userLongitude: 'ENCRYPTED_V1', // Marker indicating encrypted data
        userAccuracy: locationData.accuracy.toString(),
        clinicalSiteLocationId: options.clinicalSiteId,
        isWithinGeofence: false, // Will be calculated by geofence service
        locationSource: options.isManual ? 'manual' : 'gps',
        verificationTime: locationData.timestamp,
        metadata: {
          timezone: validation.timezone,
          timezoneOffset: validation.timezoneOffset,
          deviceInfo: options.deviceInfo,
          encrypted: true,
          encryptionVersion: 1
        }
      }).returning({ id: locationVerifications.id })

      // Store detailed accuracy logs if enabled
      await this.storeAccuracyLog(locationData, options.userId, options.isManual ? 'manual' : 'gps')

      return {
        success: true,
        verificationId: verification.id
      }
    } catch (error) {
      logger.error({ error }, 'Error storing location data')
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
        locationSource: "gps", // Default to gps
        respondedAt: new Date(),
        lastUsedAt: new Date()
      })

      return { success: true }
    } catch (error) {
      logger.error({ error }, 'Error storing location permission')
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
        timezone: (record.metadata as unknown as LocationVerificationMetadata)?.timezone
      }))
    } catch (error) {
      logger.error({ error }, 'Error fetching location history')
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
      logger.error({ error }, 'Error fetching location permission')
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
        .where(lt(locationAccuracyLogs.createdAt, cutoffDate))



      logger.info({ retentionDays }, 'Cleaned up old location data')
    } catch (error) {
      logger.error({ error }, 'Error cleaning up location data')
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
      // Encrypt location coordinates
      const encryptedLocation = encryptLocationForStorage(
        locationData.latitude,
        locationData.longitude
      )

      await db.insert(locationAccuracyLogs).values({
        userId,
        latitude: encryptedLocation,
        longitude: 'ENCRYPTED_V1', // Marker indicating encrypted data
        accuracy: locationData.accuracy.toString(),
        locationSource: source,
      })
    } catch (error) {
      logger.error({ error }, 'Error storing accuracy log')
    }
  }

  /**
   * Decrypt location data from storage
   * Handles both encrypted (v1+) and legacy unencrypted data
   */
  async decryptStoredLocation(
    storedLatitude: string,
    storedLongitude: string
  ): Promise<{ latitude: number; longitude: number }> {
    // Check if data is encrypted (v1 marker)
    if (storedLongitude === 'ENCRYPTED_V1') {
      // Data is encrypted, decrypt using the encryption module
      return decryptLocationFromStorage(storedLatitude)
    }

    // Legacy unencrypted data - parse as raw coordinates
    return {
      latitude: parseFloat(storedLatitude),
      longitude: parseFloat(storedLongitude)
    }
  }

  /**
   * Check if stored location data is encrypted
   */
  isLocationEncrypted(storedLongitude: string): boolean {
    return storedLongitude === 'ENCRYPTED_V1' || storedLongitude.startsWith('ENCRYPTED_V')
  }
}

// Export singleton instance
export const locationStorageService = new LocationStorageService()