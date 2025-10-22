/**
 * Location validation and proximity verification utilities
 * Handles business logic for location-based time tracking
 */

export interface LocationValidationConfig {
  maxAllowedDistance: number // meters
  minRequiredAccuracy: number // meters
  enableStrictMode: boolean
  allowManualOverride: boolean
}

export interface ValidationResult {
  isValid: boolean
  distance?: number
  accuracy: number
  errors: string[]
  warnings: string[]
  requiresManualApproval?: boolean
}

export interface ClinicalSiteLocation {
  id: string
  name: string
  latitude: number
  longitude: number
  allowedRadius: number // meters
  address: string
  strictLocationRequired: boolean
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
 * Validate location accuracy
 */
export function validateLocationAccuracy(
  accuracy: number,
  config: LocationValidationConfig
): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []

  if (accuracy > config.minRequiredAccuracy) {
    if (config.enableStrictMode) {
      errors.push(
        `Location accuracy (±${Math.round(accuracy)}m) exceeds maximum allowed (±${config.minRequiredAccuracy}m)`
      )
    } else {
      warnings.push(
        `Location accuracy (±${Math.round(accuracy)}m) is lower than recommended (±${config.minRequiredAccuracy}m)`
      )
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Validate proximity to clinical site
 */
export function validateProximity(
  userLat: number,
  userLon: number,
  site: ClinicalSiteLocation,
  config: LocationValidationConfig
): { isValid: boolean; distance: number; errors: string[]; warnings: string[] } {
  const distance = calculateDistance(userLat, userLon, site.latitude, site.longitude)
  const allowedDistance = Math.max(site.allowedRadius, config.maxAllowedDistance)
  
  const errors: string[] = []
  const warnings: string[] = []

  if (distance > allowedDistance) {
    const errorMessage = `You are ${Math.round(distance)}m away from ${site.name}. Maximum allowed distance is ${allowedDistance}m.`
    
    if (site.strictLocationRequired && config.enableStrictMode) {
      errors.push(errorMessage)
    } else {
      warnings.push(errorMessage)
    }
  }

  // Additional proximity checks
  if (distance > allowedDistance * 2) {
    errors.push(`Location is significantly far from the clinical site (${Math.round(distance)}m away)`)
  }

  return {
    isValid: errors.length === 0,
    distance,
    errors,
    warnings
  }
}

/**
 * Comprehensive location validation
 */
export function validateLocation(
  userLat: number,
  userLon: number,
  accuracy: number,
  site: ClinicalSiteLocation,
  config: LocationValidationConfig
): ValidationResult {
  const accuracyValidation = validateLocationAccuracy(accuracy, config)
  const proximityValidation = validateProximity(userLat, userLon, site, config)

  const allErrors = [...accuracyValidation.errors, ...proximityValidation.errors]
  const allWarnings = [...accuracyValidation.warnings, ...proximityValidation.warnings]

  const isValid = allErrors.length === 0
  const requiresManualApproval = !isValid && config.allowManualOverride && allWarnings.length > 0

  return {
    isValid,
    distance: proximityValidation.distance,
    accuracy,
    errors: allErrors,
    warnings: allWarnings,
    requiresManualApproval
  }
}

/**
 * Get default validation configuration
 */
export function getDefaultValidationConfig(): LocationValidationConfig {
  return {
    maxAllowedDistance: 100, // 100 meters
    minRequiredAccuracy: 50, // 50 meters
    enableStrictMode: false,
    allowManualOverride: true
  }
}

/**
 * Format location coordinates for display
 */
export function formatCoordinates(lat: number, lon: number, precision = 6): string {
  return `${lat.toFixed(precision)}, ${lon.toFixed(precision)}`
}

/**
 * Format distance for display
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`
  }
    return `${(meters / 1000).toFixed(1)}km`
}

/**
 * Get accuracy description based on GPS accuracy value
 */
export function getAccuracyDescription(accuracy: number): {
  level: 'excellent' | 'good' | 'fair' | 'poor'
  description: string
  color: string
} {
  if (accuracy <= 5) {
    return {
      level: 'excellent',
      description: 'Excellent GPS accuracy',
      color: 'text-green-600'
    }
  }if (accuracy <= 15) {
    return {
      level: 'good',
      description: 'Good GPS accuracy',
      color: 'text-green-500'
    }
  }if (accuracy <= 50) {
    return {
      level: 'fair',
      description: 'Fair GPS accuracy',
      color: 'text-yellow-600'
    }
  }
    return {
      level: 'poor',
      description: 'Poor GPS accuracy',
      color: 'text-red-600'
    }
}

/**
 * Check if location is within reasonable bounds (basic sanity check)
 */
export function isValidCoordinate(lat: number, lon: number): boolean {
  return (
    lat >= -90 && lat <= 90 &&
    lon >= -180 && lon <= 180 &&
    !isNaN(lat) && !isNaN(lon) &&
    isFinite(lat) && isFinite(lon)
  )
}

/**
 * Estimate location source reliability
 */
export function getLocationSourceReliability(source: string): {
  reliability: 'high' | 'medium' | 'low'
  description: string
} {
  switch (source.toLowerCase()) {
    case 'gps':
      return {
        reliability: 'high',
        description: 'GPS satellite positioning'
      }
    case 'network':
      return {
        reliability: 'medium',
        description: 'Network-based positioning'
      }
    case 'passive':
      return {
        reliability: 'low',
        description: 'Passive location services'
      }
    default:
      return {
        reliability: 'medium',
        description: 'Unknown positioning method'
      }
  }
}

/**
 * Generate location verification report
 */
export function generateLocationReport(
  validation: ValidationResult,
  site: ClinicalSiteLocation,
  timestamp: Date
): {
  summary: string
  details: string[]
  recommendations: string[]
} {
  const summary = validation.isValid 
    ? `Location verified successfully at ${site.name}`
    : `Location verification failed for ${site.name}`

  const details: string[] = [
    `Distance from site: ${formatDistance(validation.distance || 0)}`,
    `GPS accuracy: ±${Math.round(validation.accuracy)}m`,
    `Verification time: ${timestamp.toLocaleString()}`
  ]

  const recommendations: string[] = []

  if (validation.accuracy > 50) {
    recommendations.push('Try moving to an area with better GPS signal for improved accuracy')
  }

  if (validation.distance && validation.distance > 50) {
    recommendations.push('Move closer to the clinical site entrance for better location verification')
  }

  if (validation.errors.length > 0) {
    recommendations.push('Contact your supervisor if you believe this location verification is incorrect')
  }

  return {
    summary,
    details,
    recommendations
  }
}