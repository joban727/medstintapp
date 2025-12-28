/**
 * Location Name Service
 * Converts coordinates to user-friendly location names using OpenMap
 */

import { openMapService, type LocationCoordinates, type FacilityInfo } from "./openmap-service"

export interface LocationDisplayInfo {
  displayName: string
  type: "facility" | "address" | "coordinates"
  confidence: "high" | "medium" | "low"
  details?: {
    facilityType?: string
    department?: string
    fullAddress?: string
  }
}

class LocationNameService {
  private cache = new Map<string, { data: LocationDisplayInfo; timestamp: number }>()
  private readonly CACHE_DURATION = 10 * 60 * 1000 // 10 minutes

  /**
   * Get user-friendly location name from coordinates
   */
  async getLocationDisplayName(coordinates: LocationCoordinates): Promise<LocationDisplayInfo> {
    // Validate coordinates before processing
    if (
      !coordinates ||
      typeof coordinates.latitude !== "number" ||
      typeof coordinates.longitude !== "number" ||
      isNaN(coordinates.latitude) ||
      isNaN(coordinates.longitude)
    ) {
      return {
        displayName: "Invalid Location",
        type: "coordinates",
        confidence: "low",
        details: {
          fullAddress: "Location coordinates are invalid or unavailable",
        },
      }
    }

    const cacheKey = `${coordinates.latitude.toFixed(4)},${coordinates.longitude.toFixed(4)}`

    // Check cache first
    const cached = this.cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data
    }

    try {
      // Use OpenMap service to lookup facility
      const result = await openMapService.lookupFacility(coordinates, 200) // 200m radius

      if (result.success && result.facility) {
        const displayInfo: LocationDisplayInfo = {
          displayName: this.formatFacilityName(result.facility),
          type: "facility",
          confidence: result.confidence,
          details: {
            facilityType: result.facility.type,
            department: result.facility.department,
            fullAddress: result.facility.address,
          },
        }

        // Cache the result
        this.cache.set(cacheKey, { data: displayInfo, timestamp: Date.now() })
        return displayInfo
      }

      // Fallback to address lookup
      if (result.fallback) {
        const displayInfo: LocationDisplayInfo = {
          displayName: this.formatAddress(result.fallback.address),
          type: "address",
          confidence: "medium",
          details: {
            fullAddress: result.fallback.address,
          },
        }

        this.cache.set(cacheKey, { data: displayInfo, timestamp: Date.now() })
        return displayInfo
      }

      // Final fallback to coordinates
      return this.getCoordinatesFallback(coordinates)
    } catch (error) {
      console.error("Location name lookup failed:", error)
      return this.getCoordinatesFallback(coordinates)
    }
  }

  /**
   * Format facility name for display
   */
  private formatFacilityName(facility: FacilityInfo): string {
    const typeMap: Record<string, string> = {
      hospital: "Hospital",
      clinic: "Clinic",
      doctors: "Medical Office",
      medical_center: "Medical Center",
      health_centre: "Health Center",
      pharmacy: "Pharmacy",
      dentist: "Dental Office",
      veterinary: "Veterinary Clinic",
    }

    const facilityType = typeMap[facility.type] || "Medical Facility"

    if (facility.name && facility.name.toLowerCase() !== "unnamed") {
      return facility.name
    }

    if (facility.department) {
      return `${facilityType} - ${facility.department}`
    }

    return facilityType
  }

  /**
   * Format address for display (extract meaningful parts)
   */
  private formatAddress(fullAddress: string): string {
    // Try to extract building/location name from address
    const parts = fullAddress.split(",").map((part) => part.trim())

    // Look for building names, street names, or area names
    for (const part of parts) {
      // Skip house numbers (digits only) and postal codes (5 digits, optional dash and 4 digits)
      const isDigits = /^\d+$/.test(part)
      const isZip = /^\d{5}(?:-\d{4})?$/.test(part)
      if (isDigits || isZip) {
        continue
      }

      // Skip state abbreviations
      if (/^[A-Z]{2}$/.test(part)) {
        continue
      }

      // Return first meaningful part
      if (part.length > 2) {
        return part
      }
    }

    // Fallback to first two parts
    return parts.slice(0, 2).join(", ")
  }

  /**
   * Get coordinates fallback display
   */
  private getCoordinatesFallback(coordinates: LocationCoordinates): LocationDisplayInfo {
    return {
      displayName: "Current Location",
      type: "coordinates",
      confidence: "low",
      details: {
        fullAddress: `${coordinates.latitude.toFixed(4)}, ${coordinates.longitude.toFixed(4)}`,
      },
    }
  }

  /**
   * Clear cache (for testing or manual refresh)
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
    }
  }
}

// Export singleton instance
export const locationNameService = new LocationNameService()
