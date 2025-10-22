/**
 * Enhanced OpenMap Location Service
 * Provides facility lookup and location resolution using OpenStreetMap APIs
 * with comprehensive authentication, error handling, and security measures
 */

import { RetryManager } from './enhanced-error-handling'
import { DataValidator } from './data-validation'

export interface LocationCoordinates {
  latitude: number
  longitude: number
  timezone?: string
  timezoneOffset?: number
}

export interface FacilityInfo {
  name: string
  type: string
  department?: string
  address: string
  distance?: number
  osmId?: string
  confidence?: number
  lastUpdated?: Date
  timezone?: string
  timezoneOffset?: number
}

export interface LocationLookupResult {
  success: boolean
  facility?: FacilityInfo
  confidence: 'high' | 'medium' | 'low'
  fallback?: {
    address: string
    coordinates: LocationCoordinates
  }
  cached: boolean
  responseTime?: number
  apiCallsUsed?: number
  timezone?: string
  timezoneOffset?: number
}

export interface LocationCacheEntry {
  id: string
  latitude: number
  longitude: number
  facilityName: string
  facilityType: string
  department?: string
  fullAddress: string
  osmId?: string
  confidenceScore: number
  cachedAt: Date
  expiresAt: Date
  isVerified: boolean
  hitCount: number
  lastAccessed: Date
}

export interface OpenMapConfig {
  apiKey?: string
  userAgent: string
  timeout: number
  maxRetries: number
  rateLimitPerMinute: number
  cacheEnabled: boolean
  cacheDuration: number
  enableMetrics: boolean
}

export interface ApiMetrics {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  cacheHits: number
  cacheMisses: number
  averageResponseTime: number
  rateLimitHits: number
  lastResetTime: Date
}

export interface RateLimitEntry {
  count: number
  resetTime: number
  windowStart: number
}

class OpenMapService {
  private readonly NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org'
  private readonly OVERPASS_BASE_URL = 'https://overpass-api.de/api/interpreter'
  private readonly DEFAULT_RADIUS = 500 // meters
  private readonly DEFAULT_CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours
  
  // Configuration
  private config: OpenMapConfig
  
  // Medical facility types prioritized in search
  private readonly MEDICAL_FACILITY_TYPES = [
    'hospital',
    'clinic',
    'doctors',
    'medical_center',
    'health_centre',
    'pharmacy',
    'dentist',
    'veterinary'
  ]

  // Enhanced caching system
  private cache = new Map<string, LocationCacheEntry>()
  
  // Rate limiting
  private rateLimitStore = new Map<string, RateLimitEntry>()
  
  // API metrics
  private metrics: ApiMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageResponseTime: 0,
    rateLimitHits: 0,
    lastResetTime: new Date()
  }

  constructor(config?: Partial<OpenMapConfig>) {
    this.config = {
      userAgent: 'MedStintClerk/1.0 (Location Service)',
      timeout: 10000,
      maxRetries: 3,
      rateLimitPerMinute: 60,
      cacheEnabled: true,
      cacheDuration: this.DEFAULT_CACHE_DURATION,
      enableMetrics: true,
      ...config
    }

    // Validate configuration
    this.validateConfig()
    
    // Setup cleanup intervals
    this.setupCleanupIntervals()
  }

  /**
   * Detect timezone from coordinates using a simple timezone mapping
   * This is a basic implementation - for production, consider using a proper timezone API
   */
  private detectTimezoneFromCoordinates(latitude: number, longitude: number): {
    timezone: string
    offset: number
  } {
    // Simple timezone detection based on longitude
    // This is a basic approximation - for accurate results, use a proper timezone service
    const timezoneOffset = Math.round(longitude / 15)
    
    // Common timezone mappings for major regions
    const timezoneMap: { [key: string]: string } = {
      '-12': 'Pacific/Kwajalein',
      '-11': 'Pacific/Midway',
      '-10': 'Pacific/Honolulu',
      '-9': 'America/Anchorage',
      '-8': 'America/Los_Angeles',
      '-7': 'America/Denver',
      '-6': 'America/Chicago',
      '-5': 'America/New_York',
      '-4': 'America/Halifax',
      '-3': 'America/Sao_Paulo',
      '-2': 'Atlantic/South_Georgia',
      '-1': 'Atlantic/Azores',
      '0': 'Europe/London',
      '1': 'Europe/Berlin',
      '2': 'Europe/Helsinki',
      '3': 'Europe/Moscow',
      '4': 'Asia/Dubai',
      '5': 'Asia/Karachi',
      '6': 'Asia/Dhaka',
      '7': 'Asia/Bangkok',
      '8': 'Asia/Shanghai',
      '9': 'Asia/Tokyo',
      '10': 'Australia/Sydney',
      '11': 'Pacific/Norfolk',
      '12': 'Pacific/Auckland'
    }

    const offsetKey = timezoneOffset.toString()
    const timezone = timezoneMap[offsetKey] || 'UTC'

    return {
      timezone,
      offset: timezoneOffset
    }
  }

  /**
   * Enhanced coordinate validation with timezone detection
   */
  public validateCoordinates(latitude: number, longitude: number): {
    isValid: boolean
    errors: string[]
    timezone?: string
    timezoneOffset?: number
  } {
    const errors: string[] = []

    // Validate latitude
    if (typeof latitude !== 'number' || isNaN(latitude)) {
      errors.push('Latitude must be a valid number')
    } else if (latitude < -90 || latitude > 90) {
      errors.push('Latitude must be between -90 and 90 degrees')
    }

    // Validate longitude
    if (typeof longitude !== 'number' || isNaN(longitude)) {
      errors.push('Longitude must be a valid number')
    } else if (longitude < -180 || longitude > 180) {
      errors.push('Longitude must be between -180 and 180 degrees')
    }

    const isValid = errors.length === 0

    if (isValid) {
      const timezoneInfo = this.detectTimezoneFromCoordinates(latitude, longitude)
      return {
        isValid,
        errors,
        timezone: timezoneInfo.timezone,
        timezoneOffset: timezoneInfo.offset
      }
    }

    return { isValid, errors }
  }

  /**
   * Validate service configuration
   */
  private validateConfig(): void {
    if (this.config.timeout < 1000 || this.config.timeout > 30000) {
      throw new Error('Timeout must be between 1000ms and 30000ms')
    }
    
    if (this.config.maxRetries < 0 || this.config.maxRetries > 5) {
      throw new Error('Max retries must be between 0 and 5')
    }
    
    if (this.config.rateLimitPerMinute < 1 || this.config.rateLimitPerMinute > 300) {
      throw new Error('Rate limit must be between 1 and 300 requests per minute')
    }
  }

  /**
   * Setup cleanup intervals for cache and rate limiting
   */
  private setupCleanupIntervals(): void {
    // Clean up expired cache entries every 5 minutes
    setInterval(() => {
      this.cleanupExpiredCache()
    }, 5 * 60 * 1000)

    // Clean up expired rate limit entries every minute
    setInterval(() => {
      this.cleanupExpiredRateLimit()
    }, 60 * 1000)
  }

  /**
   * Check rate limiting before making API calls
   */
  private checkRateLimit(identifier = 'default'): boolean {
    const now = Date.now()
    const windowMs = 60 * 1000 // 1 minute
    const entry = this.rateLimitStore.get(identifier)

    if (!entry || now > entry.resetTime) {
      this.rateLimitStore.set(identifier, {
        count: 1,
        resetTime: now + windowMs,
        windowStart: now
      })
      return true
    }

    if (entry.count >= this.config.rateLimitPerMinute) {
      this.metrics.rateLimitHits++
      return false
    }

    entry.count++
    return true
  }

  /**
   * Enhanced API request with authentication, retry logic, and error handling
   */
  private async makeApiRequest(
    url: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<Response> {
    const startTime = Date.now()
    
    // Check rate limiting
    if (!this.checkRateLimit()) {
      throw new Error('Rate limit exceeded. Please try again later.')
    }

    // Prepare headers with authentication and user agent
    const headers: HeadersInit = {
      'User-Agent': this.config.userAgent,
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      ...options.headers
    }

    // Add API key if configured
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`
    }

    const requestOptions: RequestInit = {
      ...options,
      headers,
      signal: AbortSignal.timeout(this.config.timeout)
    }

    try {
      this.metrics.totalRequests++
      
      const response = await fetch(url, requestOptions)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      // Update metrics
      const responseTime = Date.now() - startTime
      this.updateResponseTimeMetrics(responseTime)
      this.metrics.successfulRequests++

      return response
    } catch (error) {
      this.metrics.failedRequests++
      
      // Retry logic with exponential backoff
      if (retryCount < this.config.maxRetries && this.shouldRetry(error)) {
        const delay = Math.min(1000 * 2 ** retryCount, 10000)
        await new Promise(resolve => setTimeout(resolve, delay))
        return this.makeApiRequest(url, options, retryCount + 1)
      }

      throw error
    }
  }

  /**
   * Determine if an error should trigger a retry
   */
  private shouldRetry(error: any): boolean {
    if (error.name === 'AbortError') return false
    if (error.message.includes('Rate limit')) return false
    if (error.message.includes('HTTP 4')) return false // Client errors
    return true
  }

  /**
   * Update response time metrics
   */
  private updateResponseTimeMetrics(responseTime: number): void {
    if (!this.config.enableMetrics) return
    
    const totalRequests = this.metrics.successfulRequests
    const currentAverage = this.metrics.averageResponseTime
    
    this.metrics.averageResponseTime = 
      (currentAverage * (totalRequests - 1) + responseTime) / totalRequests
  }

  /**
   * Get current location using browser geolocation API with enhanced error handling
   */
  async getCurrentLocation(): Promise<LocationCoordinates> {
    return RetryManager.executeWithRetry(
      () => new Promise<LocationCoordinates>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocation is not supported by this browser'))
          return
        }

        navigator.geolocation.getCurrentPosition(
          (position) => {
            const coords = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            }
            
            // Validate coordinates
            if (!DataValidator.validateCoordinates(coords.latitude, coords.longitude)) {
              reject(new Error('Invalid coordinates received from geolocation'))
              return
            }
            
            resolve(coords)
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
                errorMessage = `Geolocation error: ${error.message}`
            }
            reject(new Error(errorMessage))
          },
          {
            enableHighAccuracy: true,
            timeout: this.config.timeout,
            maximumAge: 60000 // 1 minute
          }
        )
      }),
      this.config.maxRetries,
      1000,
      (error) => !error.message.includes('denied') // Don't retry permission errors
    )
  }

  /**
   * Enhanced facility lookup with comprehensive error handling and caching
   */
  async lookupFacility(
    coordinates: LocationCoordinates,
    radius: number = this.DEFAULT_RADIUS
  ): Promise<LocationLookupResult> {
    const startTime = Date.now()
    
    try {
      // Validate input coordinates
      if (!DataValidator.validateCoordinates(coordinates.latitude, coordinates.longitude)) {
        throw new Error('Invalid coordinates provided')
      }

      // Validate radius
      if (radius < 50 || radius > 5000) {
        throw new Error('Radius must be between 50 and 5000 meters')
      }

      // Check cache first
      const cacheKey = this.getCacheKey(coordinates, radius)
      const cached = this.getFromCache(cacheKey)
      
      if (cached) {
        this.metrics.cacheHits++
        return {
          success: true,
          facility: {
            name: cached.facilityName,
            type: cached.facilityType,
            department: cached.department,
            address: cached.fullAddress,
            osmId: cached.osmId,
            confidence: cached.confidenceScore,
            lastUpdated: cached.cachedAt
          },
          confidence: this.getConfidenceLevel(cached.confidenceScore),
          cached: true,
          responseTime: Date.now() - startTime,
          apiCallsUsed: 0
        }
      }

      this.metrics.cacheMisses++
      let apiCallsUsed = 0

      // Query OpenStreetMap for nearby medical facilities
      const facilities = await this.queryNearbyFacilities(coordinates, radius)
      apiCallsUsed++
      
      if (facilities.length > 0) {
        const bestFacility = this.selectBestFacility(facilities, coordinates)
        
        // Cache the result
        this.cacheResult(cacheKey, bestFacility, coordinates)
        
        return {
          success: true,
          facility: {
            ...bestFacility,
            confidence: 85,
            lastUpdated: new Date()
          },
          confidence: 'high',
          cached: false,
          responseTime: Date.now() - startTime,
          apiCallsUsed
        }
      }

      // Fallback to reverse geocoding for address
      const fallbackAddress = await this.reverseGeocode(coordinates)
      apiCallsUsed++
      
      return {
        success: true,
        confidence: 'low',
        fallback: {
          address: fallbackAddress,
          coordinates
        },
        cached: false,
        responseTime: Date.now() - startTime,
        apiCallsUsed
      }

    } catch (error) {
      console.error('Facility lookup error:', error)
      return {
        success: false,
        confidence: 'low',
        cached: false,
        responseTime: Date.now() - startTime,
        apiCallsUsed: 0
      }
    }
  }

  /**
   * Query OpenStreetMap Overpass API for nearby medical facilities with enhanced error handling
   */
  private async queryNearbyFacilities(
    coordinates: LocationCoordinates,
    radius: number
  ): Promise<FacilityInfo[]> {
    const { latitude, longitude } = coordinates
    
    // Overpass query for medical facilities
    const query = `
      [out:json][timeout:25];
      (
        node["amenity"~"^(hospital|clinic|doctors|pharmacy|dentist)$"](around:${radius},${latitude},${longitude});
        way["amenity"~"^(hospital|clinic|doctors|pharmacy|dentist)$"](around:${radius},${latitude},${longitude});
        relation["amenity"~"^(hospital|clinic|doctors|pharmacy|dentist)$"](around:${radius},${latitude},${longitude});
      );
      out center meta;
    `

    try {
      const response = await this.makeApiRequest(this.OVERPASS_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `data=${encodeURIComponent(query)}`
      })

      const data = await response.json()
      
      // Validate response structure
      if (!data || !Array.isArray(data.elements)) {
        throw new Error('Invalid response structure from Overpass API')
      }

      return this.parseOverpassResults(data.elements, coordinates)
    } catch (error) {
      console.error('Overpass API query failed:', error)
      
      // Return empty array instead of throwing to allow fallback
      return []
    }
  }

  /**
   * Enhanced reverse geocoding with error handling and validation
   */
  private async reverseGeocode(coordinates: LocationCoordinates): Promise<string> {
    const { latitude, longitude } = coordinates
    
    try {
      const url = `${this.NOMINATIM_BASE_URL}/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
      const response = await this.makeApiRequest(url)

      const data = await response.json()
      
      // Validate response
      if (!data || typeof data.display_name !== 'string') {
        throw new Error('Invalid response from Nominatim API')
      }

      return data.display_name || `${latitude}, ${longitude}`
    } catch (error) {
      console.error('Reverse geocoding failed:', error)
      return `${latitude}, ${longitude}`
    }
  }

  /**
   * Enhanced cache management with hit tracking and validation
   */
  private getFromCache(key: string): LocationCacheEntry | null {
    if (!this.config.cacheEnabled) return null
    
    const entry = this.cache.get(key)
    if (entry && entry.expiresAt > new Date()) {
      // Update access tracking
      entry.hitCount++
      entry.lastAccessed = new Date()
      return entry
    }
    
    if (entry) {
      this.cache.delete(key)
    }
    return null
  }

  private cacheResult(
    key: string,
    facility: FacilityInfo,
    coordinates: LocationCoordinates
  ): void {
    if (!this.config.cacheEnabled) return
    
    const entry: LocationCacheEntry = {
      id: crypto.randomUUID(),
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      facilityName: facility.name,
      facilityType: facility.type,
      department: facility.department,
      fullAddress: facility.address,
      osmId: facility.osmId,
      confidenceScore: facility.confidence || 85,
      cachedAt: new Date(),
      expiresAt: new Date(Date.now() + this.config.cacheDuration),
      isVerified: false,
      hitCount: 0,
      lastAccessed: new Date()
    }
    
    this.cache.set(key, entry)
  }

  /**
   * Cleanup expired cache entries
   */
  private cleanupExpiredCache(): void {
    const now = new Date()
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Cleanup expired rate limit entries
   */
  private cleanupExpiredRateLimit(): void {
    const now = Date.now()
    for (const [key, entry] of this.rateLimitStore.entries()) {
      if (entry.resetTime < now) {
        this.rateLimitStore.delete(key)
      }
    }
  }

  /**
   * Get API metrics and statistics
   */
  getMetrics(): ApiMetrics {
    return { ...this.metrics }
  }

  /**
   * Reset API metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageResponseTime: 0,
      rateLimitHits: 0,
      lastResetTime: new Date()
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number
    hitRate: number
    totalHits: number
    oldestEntry?: Date
    newestEntry?: Date
  } {
    const entries = Array.from(this.cache.values())
    const totalHits = entries.reduce((sum, entry) => sum + entry.hitCount, 0)
    const totalRequests = this.metrics.cacheHits + this.metrics.cacheMisses
    
    return {
      size: this.cache.size,
      hitRate: totalRequests > 0 ? this.metrics.cacheHits / totalRequests : 0,
      totalHits,
      oldestEntry: entries.length > 0 ? 
        new Date(Math.min(...entries.map(e => e.cachedAt.getTime()))) : undefined,
      newestEntry: entries.length > 0 ? 
        new Date(Math.max(...entries.map(e => e.cachedAt.getTime()))) : undefined
    }
  }

  /**
   * Clear cache manually
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Update service configuration
   */
  updateConfig(newConfig: Partial<OpenMapConfig>): void {
    this.config = { ...this.config, ...newConfig }
    this.validateConfig()
  }

  /**
   * Parse Overpass API results into FacilityInfo objects
   */
  private parseOverpassResults(
    elements: any[],
    userLocation: LocationCoordinates
  ): FacilityInfo[] {
    return elements
      .map(element => {
        const tags = element.tags || {}
        const lat = element.lat || element.center?.lat
        const lon = element.lon || element.center?.lon
        
        if (!lat || !lon || !tags.name) return null

        const distance = this.calculateDistance(
          userLocation,
          { latitude: lat, longitude: lon }
        )

        return {
          name: tags.name,
          type: tags.amenity || 'medical_facility',
          department: tags.healthcare || tags.medical_specialty,
          address: this.formatAddress(tags),
          distance,
          osmId: `${element.type}/${element.id}`
        }
      })
      .filter(Boolean)
      .sort((a, b) => (a!.distance || 0) - (b!.distance || 0))
  }

  /**
   * Reverse geocode coordinates to get address
   */
  private async reverseGeocode(coordinates: LocationCoordinates): Promise<string> {
    const { latitude, longitude } = coordinates
    
    try {
      const response = await fetch(
        `${this.NOMINATIM_BASE_URL}/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
      )

      if (!response.ok) {
        throw new Error(`Nominatim API error: ${response.status}`)
      }

      const data = await response.json()
      return data.display_name || `${latitude}, ${longitude}`
    } catch (error) {
      console.error('Reverse geocoding failed:', error)
      return `${latitude}, ${longitude}`
    }
  }

  /**
   * Select the best facility from results
   */
  private selectBestFacility(
    facilities: FacilityInfo[],
    userLocation: LocationCoordinates
  ): FacilityInfo {
    // Prioritize by type and distance
    const prioritized = facilities.sort((a, b) => {
      const aTypeScore = this.getFacilityTypeScore(a.type)
      const bTypeScore = this.getFacilityTypeScore(b.type)
      
      if (aTypeScore !== bTypeScore) {
        return bTypeScore - aTypeScore // Higher score first
      }
      
      return (a.distance || 0) - (b.distance || 0) // Closer first
    })

    return prioritized[0]
  }

  /**
   * Get facility type priority score
   */
  private getFacilityTypeScore(type: string): number {
    const scores: Record<string, number> = {
      hospital: 10,
      clinic: 8,
      doctors: 7,
      medical_center: 6,
      health_centre: 5,
      pharmacy: 3,
      dentist: 2,
      veterinary: 1
    }
    return scores[type] || 0
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  private calculateDistance(
    coord1: LocationCoordinates,
    coord2: LocationCoordinates
  ): number {
    const R = 6371e3 // Earth's radius in meters
    const φ1 = coord1.latitude * Math.PI / 180
    const φ2 = coord2.latitude * Math.PI / 180
    const Δφ = (coord2.latitude - coord1.latitude) * Math.PI / 180
    const Δλ = (coord2.longitude - coord1.longitude) * Math.PI / 180

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))

    return R * c
  }

  /**
   * Format address from OSM tags
   */
  private formatAddress(tags: any): string {
    const parts = []
    
    if (tags['addr:housenumber']) parts.push(tags['addr:housenumber'])
    if (tags['addr:street']) parts.push(tags['addr:street'])
    if (tags['addr:city']) parts.push(tags['addr:city'])
    if (tags['addr:state']) parts.push(tags['addr:state'])
    if (tags['addr:postcode']) parts.push(tags['addr:postcode'])
    
    return parts.length > 0 ? parts.join(', ') : 'Address not available'
  }

  /**
   * Cache management methods
   */
  private getCacheKey(coordinates: LocationCoordinates, radius: number): string {
    const lat = Math.round(coordinates.latitude * 10000) / 10000
    const lon = Math.round(coordinates.longitude * 10000) / 10000
    return `${lat},${lon},${radius}`
  }

  private getFromCache(key: string): LocationCacheEntry | null {
    const entry = this.cache.get(key)
    if (entry && entry.expiresAt > new Date()) {
      return entry
    }
    if (entry) {
      this.cache.delete(key)
    }
    return null
  }

  private cacheResult(
     key: string,
     facility: FacilityInfo,
     coordinates: LocationCoordinates
   ): void {
     if (!this.config.cacheEnabled) return
     
     const entry: LocationCacheEntry = {
       id: crypto.randomUUID(),
       latitude: coordinates.latitude,
       longitude: coordinates.longitude,
       facilityName: facility.name,
       facilityType: facility.type,
       department: facility.department,
       fullAddress: facility.address,
       osmId: facility.osmId,
       confidenceScore: facility.confidence || 85,
       cachedAt: new Date(),
       expiresAt: new Date(Date.now() + this.config.cacheDuration),
       isVerified: false,
       hitCount: 0,
       lastAccessed: new Date()
     }
     
     this.cache.set(key, entry)
   }

  private getConfidenceLevel(score: number): 'high' | 'medium' | 'low' {
    if (score >= 80) return 'high'
    if (score >= 60) return 'medium'
    return 'low'
  }

  /**
   * Clear cache (for testing or manual refresh)
   */
  clearCache(): void {
    this.cache.clear()
  }
}

// Export both the class and singleton instance
export { OpenMapService }
export const openMapService = new OpenMapService()