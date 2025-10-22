/**
 * Unified Location Service
 * Consolidates all location capture functionality into a single, reliable service
 * Addresses multiple conflicting implementations and provides consistent error handling
 */

import { toast } from 'sonner'

export interface LocationCoordinates {
  latitude: number
  longitude: number
}

export interface LocationData extends LocationCoordinates {
  accuracy: number
  timestamp: number
  source: 'gps' | 'network' | 'passive'
  altitude?: number
  altitudeAccuracy?: number
  heading?: number
  speed?: number
}

export interface LocationState {
  coordinates: LocationCoordinates | null
  accuracy: number | null
  accuracyLevel: 'high' | 'medium' | 'low' | null
  facility: FacilityInfo | null
  isLoading: boolean
  error: string | null
  lastUpdated: Date | null
  hasPermission: boolean | null
}

export interface FacilityInfo {
  id?: string
  name: string
  address: string
  type?: string
  distance?: number
}

export interface LocationCaptureOptions {
  enableHighAccuracy?: boolean
  timeout?: number
  maximumAge?: number
  requireFacilityLookup?: boolean
  cacheKey?: string
}

export interface LocationPermissionStatus {
  state: 'granted' | 'denied' | 'prompt'
  canRequest: boolean
  isSupported: boolean
}

class UnifiedLocationService {
  private static instance: UnifiedLocationService
  private cache = new Map<string, { data: LocationState; timestamp: number }>()
  private readonly CACHE_DURATION = 5 * 60 * 1000 // 5 minutes
  private readonly DEFAULT_OPTIONS: Required<LocationCaptureOptions> = {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 60000,
    requireFacilityLookup: true,
    cacheKey: 'default'
  }

  private constructor() {}

  static getInstance(): UnifiedLocationService {
    if (!UnifiedLocationService.instance) {
      UnifiedLocationService.instance = new UnifiedLocationService()
    }
    return UnifiedLocationService.instance
  }

  /**
   * Check if geolocation is supported and get permission status
   */
  async getPermissionStatus(): Promise<LocationPermissionStatus> {
    const isSupported = 'geolocation' in navigator && 'permissions' in navigator

    if (!isSupported) {
      return {
        state: 'denied',
        canRequest: false,
        isSupported: false
      }
    }

    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' })
      return {
        state: permission.state as 'granted' | 'denied' | 'prompt',
        canRequest: permission.state !== 'denied',
        isSupported: true
      }
    } catch (error) {
      console.warn('Permission API not available:', error)
      return {
        state: 'prompt',
        canRequest: true,
        isSupported: true
      }
    }
  }

  /**
   * Request location permission explicitly
   */
  async requestPermission(): Promise<boolean> {
    try {
      const position = await this.getCurrentPosition({ timeout: 5000 })
      return !!position
    } catch (error) {
      console.error('Permission request failed:', error)
      return false
    }
  }

  /**
   * Get current position using browser geolocation API
   */
  private getCurrentPosition(options: Partial<LocationCaptureOptions> = {}): Promise<LocationData> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options }

    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'))
        return
      }

      const positionOptions: PositionOptions = {
        enableHighAccuracy: opts.enableHighAccuracy,
        timeout: opts.timeout,
        maximumAge: opts.maximumAge
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy, altitude, altitudeAccuracy, heading, speed } = position.coords
          
          // Validate coordinates
          if (typeof latitude !== 'number' || typeof longitude !== 'number' || 
              latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            reject(new Error('Invalid coordinates received from geolocation'))
            return
          }

          // Determine source based on accuracy
          let source: LocationData['source'] = 'network'
          if (accuracy <= 20) source = 'gps'
          else if (accuracy > 100) source = 'passive'

          const locationData: LocationData = {
            latitude,
            longitude,
            accuracy,
            timestamp: position.timestamp,
            source,
            altitude: altitude || undefined,
            altitudeAccuracy: altitudeAccuracy || undefined,
            heading: heading || undefined,
            speed: speed || undefined
          }

          resolve(locationData)
        },
        (error) => {
          let errorMessage = 'Geolocation error'
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location access denied by user'
              break
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information unavailable'
              break
            case error.TIMEOUT:
              errorMessage = 'Location request timed out'
              break
            default:
              errorMessage = 'Unknown geolocation error'
          }
          reject(new Error(errorMessage))
        },
        positionOptions
      )
    })
  }

  /**
   * Lookup facility information for given coordinates
   */
  private async lookupFacility(coordinates: LocationCoordinates): Promise<FacilityInfo | null> {
    try {
      // Import OpenMapService dynamically to avoid circular dependencies
      const { OpenMapService } = await import('@/lib/openmap-service')
      const openMapService = OpenMapService.getInstance()
      
      const result = await openMapService.lookupFacility(coordinates, 500)
      
      if (result.success && result.facility) {
        return {
          id: result.facility.id,
          name: result.facility.name,
          address: result.facility.address,
          type: result.facility.type,
          distance: result.distance
        }
      }
      
      return null
    } catch (error) {
      console.warn('Facility lookup failed:', error)
      return null
    }
  }

  /**
   * Determine accuracy level based on accuracy value
   */
  private getAccuracyLevel(accuracy: number): 'high' | 'medium' | 'low' {
    if (accuracy <= 10) return 'high'
    if (accuracy <= 50) return 'medium'
    return 'low'
  }

  /**
   * Get cached location data if available and not expired
   */
  private getCachedLocation(cacheKey: string): LocationState | null {
    const cached = this.cache.get(cacheKey)
    if (!cached) return null

    const isExpired = Date.now() - cached.timestamp > this.CACHE_DURATION
    if (isExpired) {
      this.cache.delete(cacheKey)
      return null
    }

    return cached.data
  }

  /**
   * Cache location data
   */
  private setCachedLocation(cacheKey: string, data: LocationState): void {
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    })
  }

  /**
   * Main location capture method - consolidates all location capture logic
   */
  async captureLocation(options: LocationCaptureOptions = {}): Promise<LocationState> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options }
    const cacheKey = opts.cacheKey || 'default'
    
    console.log('🌍 [UnifiedLocationService] Starting location capture with options:', opts)
    
    // Check cache first
    if (opts.maximumAge && opts.maximumAge > 0) {
      const cached = this.getCachedLocation(cacheKey)
      if (cached && cached.lastUpdated) {
        const age = Date.now() - cached.lastUpdated.getTime()
        if (age < opts.maximumAge) {
          console.log('✅ [UnifiedLocationService] Using cached location:', cached)
          return cached
        }
      }
    }

    // Set loading state
    const loadingState: LocationState = {
      coordinates: null,
      accuracy: null,
      accuracyLevel: null,
      facility: null,
      isLoading: true,
      error: null,
      lastUpdated: new Date(),
      hasPermission: false
    }

    this.setCachedLocation(cacheKey, loadingState)

    try {
      // Check permission status
      const permissionStatus = await this.getPermissionStatus()
      console.log('🔐 [UnifiedLocationService] Permission status:', permissionStatus)
      
      if (!permissionStatus.isSupported) {
        throw new Error('Geolocation is not supported by this browser')
      }

      if (permissionStatus.state === 'denied') {
        throw new Error('Location access denied. Please enable location permissions in your browser.')
      }

      // Request permission if needed
      if (permissionStatus.state === 'prompt') {
        console.log('🔐 [UnifiedLocationService] Requesting permission...')
        const granted = await this.requestPermission()
        if (!granted) {
          throw new Error('Location permission was denied')
        }
      }

      // Get current position
      console.log('📍 [UnifiedLocationService] Getting current position...')
      const locationData = await this.getCurrentPosition(opts)
      console.log('✅ [UnifiedLocationService] Position received:', locationData)

      // Determine accuracy level
      const accuracyLevel = this.getAccuracyLevel(locationData.accuracy)

      console.log('📏 [UnifiedLocationService] Accuracy analysis:', { 
        accuracy: locationData.accuracy, 
        level: accuracyLevel 
      })

      // Perform facility lookup if required
      let facility: FacilityInfo | null = null
      if (opts.requireFacilityLookup) {
        try {
          console.log('🏥 [UnifiedLocationService] Looking up nearby facilities...')
          facility = await this.lookupFacility(locationData)
          if (facility) {
            console.log('✅ [UnifiedLocationService] Facility found:', facility.name)
          } else {
            console.log('ℹ️ [UnifiedLocationService] No nearby facilities found')
          }
        } catch (facilityError) {
          console.warn('⚠️ [UnifiedLocationService] Facility lookup failed:', facilityError)
          // Don't fail the entire location capture if facility lookup fails
        }
      }

      const locationState: LocationState = {
        coordinates: {
          latitude: locationData.latitude,
          longitude: locationData.longitude
        },
        accuracy: locationData.accuracy,
        accuracyLevel,
        facility,
        isLoading: false,
        error: null,
        lastUpdated: new Date(),
        hasPermission: true
      }

      // Cache the successful result
      this.setCachedLocation(cacheKey, locationState)
      console.log('💾 [UnifiedLocationService] Location cached successfully')

      // Show success toast
      if (accuracyLevel === 'high') {
        toast.success('Location captured with high accuracy', {
          description: `Accuracy: ${Math.round(locationData.accuracy)}m`
        })
      } else if (accuracyLevel === 'medium') {
        toast.success('Location captured successfully', {
          description: `Accuracy: ${Math.round(locationData.accuracy)}m`
        })
      } else {
        toast.success('Location captured', {
          description: 'Lower accuracy - consider moving to a better location'
        })
      }

      console.log('🎉 [UnifiedLocationService] Location capture completed successfully')
      return locationState

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to capture location'
      console.error('❌ [UnifiedLocationService] Location capture failed:', errorMessage)

      const errorState: LocationState = {
        coordinates: null,
        accuracy: null,
        accuracyLevel: null,
        facility: null,
        isLoading: false,
        error: errorMessage,
        lastUpdated: new Date(),
        hasPermission: false
      }

      // Cache the error state temporarily (shorter cache time)
      this.setCachedLocation(cacheKey, errorState)

      // Show user-friendly error messages
      if (error instanceof Error) {
        if (error.message.includes('denied') || error.message.includes('permission')) {
          toast.error('Location access denied', {
            description: 'Please enable location permissions in your browser settings'
          })
        } else if (error.message.includes('unavailable')) {
          toast.error('Location unavailable', {
            description: 'Please check your GPS/location services'
          })
        } else if (error.message.includes('timeout')) {
          toast.error('Location request timed out', {
            description: 'Please try again or check your connection'
          })
        } else {
          toast.error('Failed to capture location', {
            description: 'Please try again or check your location settings'
          })
        }
      }

      return errorState
    }
  }

  /**
   * Send location data to API endpoint
   */
  async sendLocationToAPI(
    locationData: LocationData,
    timeRecordId: string,
    captureType: 'clock_in' | 'clock_out'
  ): Promise<boolean> {
    try {
      console.log('📡 [UnifiedLocationService] Sending location to API:', {
        timeRecordId,
        captureType,
        coordinates: { latitude: locationData.latitude, longitude: locationData.longitude },
        accuracy: locationData.accuracy
      })

      const response = await fetch('/api/location/capture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          timeRecordId,
          captureType,
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          accuracy: locationData.accuracy,
          source: locationData.source,
          timestamp: new Date(locationData.timestamp).toISOString(),
          metadata: {
            altitude: locationData.altitude,
            altitudeAccuracy: locationData.altitudeAccuracy,
            heading: locationData.heading,
            speed: locationData.speed
          }
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const result = await response.json()
      console.log('✅ [UnifiedLocationService] Location sent successfully:', result)
      
      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send location'
      console.error('❌ [UnifiedLocationService] Failed to send location:', errorMessage)
      
      toast.error('Failed to save location', {
        description: errorMessage
      })
      
      return false
    }
  }

  /**
   * Clear all cached location data
   */
  clearCache(): void {
    this.cache.clear()
    console.log('🗑️ [UnifiedLocationService] Cache cleared')
  }

  /**
   * Clear specific cached location
   */
  clearCachedLocation(cacheKey: string): void {
    this.cache.delete(cacheKey)
    console.log('🗑️ [UnifiedLocationService] Cleared cache for key:', cacheKey)
  }
}

// Export singleton instance
export const unifiedLocationService = UnifiedLocationService.getInstance()
export default unifiedLocationService