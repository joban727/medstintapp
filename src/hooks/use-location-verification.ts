"use client"

import { useState, useCallback, useEffect } from "react"
import { useLocation, type LocationData, type LocationError } from "./use-location"

// Clinical site location interface
export interface ClinicalSiteLocation {
  id: string
  clinicalSiteId: string
  name: string
  latitude: number
  longitude: number
  radius: number // meters
  isActive: boolean
  isPrimary: boolean
  description?: string
  floor?: string
  department?: string
}

// Location verification result
export interface LocationVerificationResult {
  isWithinGeofence: boolean
  nearestLocation: ClinicalSiteLocation | null
  distanceFromSite: number // meters
  verificationStatus: "approved" | "flagged" | "rejected"
  flagReason?: string
  userLocation: LocationData
  timestamp: number
}

// Verification options
export interface VerificationOptions {
  clinicalSiteId?: string
  strictMode?: boolean // Require high accuracy GPS
  allowNetworkLocation?: boolean
  maxDistance?: number // Override site radius
  requirePrimaryLocation?: boolean
}

// Verification state
export interface VerificationState {
  isVerifying: boolean
  lastVerification: LocationVerificationResult | null
  availableLocations: ClinicalSiteLocation[]
  isLoadingLocations: boolean
  error: LocationError | null
}

const DEFAULT_VERIFICATION_OPTIONS: Required<VerificationOptions> = {
  clinicalSiteId: "",
  strictMode: false,
  allowNetworkLocation: true,
  maxDistance: 0, // Use site radius
  requirePrimaryLocation: false,
}

export function useLocationVerification(options: VerificationOptions = {}) {
  const opts = { ...DEFAULT_VERIFICATION_OPTIONS, ...options }

  // Use the base location hook
  const location = useLocation({
    enableHighAccuracy: opts.strictMode,
    timeout: opts.strictMode ? 20000 : 15000,
    requiredAccuracy: opts.strictMode ? 20 : 50,
  })

  const [state, setState] = useState<VerificationState>({
    isVerifying: false,
    lastVerification: null,
    availableLocations: [],
    isLoadingLocations: false,
    error: null,
  })

  // Calculate distance between two coordinates using Haversine formula
  const calculateDistance = useCallback(
    (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const R = 6371e3 // Earth's radius in meters
      const φ1 = (lat1 * Math.PI) / 180
      const φ2 = (lat2 * Math.PI) / 180
      const Δφ = ((lat2 - lat1) * Math.PI) / 180
      const Δλ = ((lon2 - lon1) * Math.PI) / 180

      const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

      return R * c
    },
    []
  )

  // Find nearest clinical site location
  const findNearestLocation = useCallback(
    (
      userLat: number,
      userLon: number,
      locations: ClinicalSiteLocation[]
    ): { location: ClinicalSiteLocation | null; distance: number } => {
      if (locations.length === 0) {
        return { location: null, distance: Number.POSITIVE_INFINITY }
      }

      let nearestLocation: ClinicalSiteLocation | null = null
      let minDistance = Number.POSITIVE_INFINITY

      for (const loc of locations) {
        if (!loc.isActive) continue

        const distance = calculateDistance(userLat, userLon, loc.latitude, loc.longitude)

        if (distance < minDistance) {
          minDistance = distance
          nearestLocation = loc
        }
      }

      return { location: nearestLocation, distance: minDistance }
    },
    [calculateDistance]
  )

  // Load clinical site locations from API
  const loadClinicalSiteLocations = useCallback(async (clinicalSiteId?: string) => {
    setState((prev) => ({ ...prev, isLoadingLocations: true, error: null }))

    try {
      const url = clinicalSiteId
        ? `/api/clinical-sites/${clinicalSiteId}/locations`
        : "/api/clinical-sites/locations"

      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`Failed to load locations: ${response.statusText}`)
      }

      const locations: ClinicalSiteLocation[] = await response.json()

      setState((prev) => ({
        ...prev,
        availableLocations: locations,
        isLoadingLocations: false,
      }))

      return locations
    } catch (error) {
      const locationError: LocationError = {
        code: -1,
        message: error instanceof Error ? error.message : "Failed to load locations",
        type: "position_unavailable",
      }

      setState((prev) => ({
        ...prev,
        isLoadingLocations: false,
        error: locationError,
      }))

      return []
    }
  }, [])

  // Verify user location against clinical site locations
  const verifyLocation = useCallback(
    async (
      verificationType: "clock_in" | "clock_out" = "clock_in"
    ): Promise<LocationVerificationResult | null> => {
      setState((prev) => ({ ...prev, isVerifying: true, error: null }))

      try {
        // Get current location
        const userLocation = await location.getCurrentPosition()

        // Validate location source if in strict mode
        if (opts.strictMode && !opts.allowNetworkLocation && userLocation.source !== "gps") {
          const result: LocationVerificationResult = {
            isWithinGeofence: false,
            nearestLocation: null,
            distanceFromSite: Number.POSITIVE_INFINITY,
            verificationStatus: "rejected",
            flagReason: "GPS location required in strict mode",
            userLocation,
            timestamp: Date.now(),
          }

          setState((prev) => ({ ...prev, isVerifying: false, lastVerification: result }))
          return result
        }

        // Load locations if not already loaded
        let locations = state.availableLocations
        if (locations.length === 0) {
          locations = await loadClinicalSiteLocations(opts.clinicalSiteId)
        }

        // Filter locations if primary required
        if (opts.requirePrimaryLocation) {
          locations = locations.filter((loc) => loc.isPrimary)
        }

        // Find nearest location
        const { location: nearestLocation, distance } = findNearestLocation(
          userLocation.latitude,
          userLocation.longitude,
          locations
        )

        if (!nearestLocation) {
          const result: LocationVerificationResult = {
            isWithinGeofence: false,
            nearestLocation: null,
            distanceFromSite: Number.POSITIVE_INFINITY,
            verificationStatus: "rejected",
            flagReason: "No clinical site locations available",
            userLocation,
            timestamp: Date.now(),
          }

          setState((prev) => ({ ...prev, isVerifying: false, lastVerification: result }))
          return result
        }

        // Check geofence
        const effectiveRadius = opts.maxDistance > 0 ? opts.maxDistance : nearestLocation.radius
        const isWithinGeofence = distance <= effectiveRadius

        // Determine verification status
        let verificationStatus: LocationVerificationResult["verificationStatus"] = "approved"
        let flagReason: string | undefined

        if (!isWithinGeofence) {
          verificationStatus = "flagged"
          flagReason = `Outside geofence by ${Math.round(distance - effectiveRadius)}m`
        } else if (userLocation.accuracy > 100) {
          verificationStatus = "flagged"
          flagReason = `Low location accuracy (±${Math.round(userLocation.accuracy)}m)`
        } else if (opts.strictMode && userLocation.source !== "gps") {
          verificationStatus = "flagged"
          flagReason = "Non-GPS location source in strict mode"
        }

        const result: LocationVerificationResult = {
          isWithinGeofence,
          nearestLocation,
          distanceFromSite: distance,
          verificationStatus,
          flagReason,
          userLocation,
          timestamp: Date.now(),
        }

        // Save verification to database
        await saveVerificationResult(result, verificationType)

        setState((prev) => ({ ...prev, isVerifying: false, lastVerification: result }))
        return result
      } catch (error) {
        const locationError: LocationError = {
          code: -1,
          message: error instanceof Error ? error.message : "Location verification failed",
          type: "position_unavailable",
        }

        setState((prev) => ({ ...prev, isVerifying: false, error: locationError }))
        return null
      }
    },
    [location, opts, state.availableLocations, loadClinicalSiteLocations, findNearestLocation]
  )

  // Save verification result to database
  const saveVerificationResult = useCallback(
    async (result: LocationVerificationResult, verificationType: "clock_in" | "clock_out") => {
      try {
        const response = await fetch("/api/location/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            verificationType,
            userLatitude: result.userLocation.latitude,
            userLongitude: result.userLocation.longitude,
            userAccuracy: result.userLocation.accuracy,
            locationSource: result.userLocation.source,
            clinicalSiteLocationId: result.nearestLocation?.id,
            distanceFromSite: result.distanceFromSite,
            isWithinGeofence: result.isWithinGeofence,
            verificationStatus: result.verificationStatus,
            flagReason: result.flagReason,
            metadata: {
              timestamp: result.timestamp,
              accuracy: location.accuracy,
              strictMode: opts.strictMode,
            },
          }),
        })

        if (!response.ok) {
          console.warn("Failed to save location verification:", response.statusText)
        }
      } catch (error) {
        console.warn("Error saving location verification:", error)
      }
    },
    [location.accuracy, opts.strictMode]
  )

  // Get location permission status
  const getPermissionStatus = useCallback(() => {
    return {
      hasPermission: location.hasPermission,
      isSupported: location.isSupported,
      canRequest: location.hasPermission !== false,
    }
  }, [location.hasPermission, location.isSupported])

  // Request location permission
  const requestPermission = useCallback(async () => {
    return await location.requestPermission()
  }, [location])

  // Load locations on mount or when clinical site ID changes
  useEffect(() => {
    if (opts.clinicalSiteId) {
      loadClinicalSiteLocations(opts.clinicalSiteId)
    }
  }, [opts.clinicalSiteId, loadClinicalSiteLocations])

  return {
    // State
    ...state,
    locationState: location,

    // Actions
    verifyLocation,
    loadClinicalSiteLocations,
    requestPermission,
    getPermissionStatus,

    // Utilities
    calculateDistance,
    findNearestLocation,

    // Computed properties
    isReady: location.isSupported && location.hasPermission !== false && !state.isLoadingLocations,
    canVerify:
      location.isSupported &&
      location.hasPermission === true &&
      state.availableLocations.length > 0,
  }
}
