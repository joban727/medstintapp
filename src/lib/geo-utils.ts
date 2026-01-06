/**
 * Geographic Utilities
 * Shared functions for geographic calculations and location-related utilities.
 * Consolidates duplicate implementations from multiple files.
 */

/**
 * Calculate distance between two GPS coordinates using the Haversine formula.
 * @param lat1 - Latitude of first point in degrees
 * @param lon1 - Longitude of first point in degrees
 * @param lat2 - Latitude of second point in degrees
 * @param lon2 - Longitude of second point in degrees
 * @returns Distance in meters
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

/**
 * Format GPS coordinates for display.
 * @param lat - Latitude in degrees
 * @param lon - Longitude in degrees
 * @param precision - Decimal places (default: 6)
 * @returns Formatted string like "40.712776°N, 74.005974°W"
 */
export function formatCoordinates(lat: number, lon: number, precision = 6): string {
  const latDir = lat >= 0 ? "N" : "S"
  const lonDir = lon >= 0 ? "E" : "W"
  return `${Math.abs(lat).toFixed(precision)}°${latDir}, ${Math.abs(lon).toFixed(precision)}°${lonDir}`
}

/**
 * Get a human-readable description of location accuracy.
 * @param accuracy - Accuracy in meters
 * @returns Description string
 */
export function getAccuracyDescription(accuracy: number): string {
  if (accuracy <= 10) return "Excellent accuracy"
  if (accuracy <= 25) return "Good accuracy"
  if (accuracy <= 50) return "Moderate accuracy"
  if (accuracy <= 100) return "Fair accuracy"
  return "Poor accuracy"
}

/**
 * Categorize location accuracy level.
 * @param accuracy - Accuracy in meters
 * @returns Accuracy level category
 */
export function getAccuracyLevel(accuracy: number): "high" | "medium" | "low" {
  if (accuracy <= 20) return "high"
  if (accuracy <= 100) return "medium"
  return "low"
}

/**
 * Check if a point is within a circular geofence.
 * @param userLat - User's latitude
 * @param userLon - User's longitude
 * @param centerLat - Center latitude of geofence
 * @param centerLon - Center longitude of geofence
 * @param radiusMeters - Radius of geofence in meters
 * @returns True if user is within the geofence
 */
export function isWithinGeofence(
  userLat: number,
  userLon: number,
  centerLat: number,
  centerLon: number,
  radiusMeters: number
): boolean {
  const distance = calculateDistance(userLat, userLon, centerLat, centerLon)
  return distance <= radiusMeters
}

/**
 * Convert degrees to radians.
 * @param degrees - Angle in degrees
 * @returns Angle in radians
 */
export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/**
 * Convert radians to degrees.
 * @param radians - Angle in radians
 * @returns Angle in degrees
 */
export function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI
}
