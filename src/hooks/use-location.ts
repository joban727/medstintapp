"use client"

import { useState, useEffect, useCallback, useRef } from "react"

export interface LocationData {
  latitude: number
  longitude: number
  accuracy: number
  timestamp: number
  source: "gps" | "network" | "passive"
}

export interface LocationError {
  code: number
  message: string
  type: "permission_denied" | "position_unavailable" | "timeout" | "not_supported"
}

export interface LocationState {
  isSupported: boolean
  isLoading: boolean
  hasPermission: boolean | null
  currentLocation: LocationData | null
  error: LocationError | null
  accuracy: "high" | "medium" | "low" | null
}

export interface LocationOptions {
  enableHighAccuracy?: boolean
  timeout?: number
  maximumAge?: number
  watchPosition?: boolean
  requiredAccuracy?: number // meters
}

const DEFAULT_OPTIONS: Required<LocationOptions> = {
  enableHighAccuracy: true,
  timeout: 15000, // 15 seconds
  maximumAge: 60000, // 1 minute
  watchPosition: false,
  requiredAccuracy: 50, // 50 meters
}

export function useLocation(options: LocationOptions = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  const [state, setState] = useState<LocationState>({
    isSupported: false,
    isLoading: false,
    hasPermission: null,
    currentLocation: null,
    error: null,
    accuracy: null,
  })

  const watchIdRef = useRef<number | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const stateRef = useRef(state)

  // Update state ref whenever state changes
  useEffect(() => {
    stateRef.current = state
  }, [state])

  // Check if geolocation is supported
  useEffect(() => {
    const isSupported = "geolocation" in navigator && "permissions" in navigator
    setState((prev) => ({ ...prev, isSupported }))
  }, [])

  // Check permission status
  const checkPermission = useCallback(async () => {
    if (!stateRef.current.isSupported) return false

    try {
      const permission = await navigator.permissions.query({ name: "geolocation" })
      const hasPermission = permission.state === "granted"
      setState((prev) => ({ ...prev, hasPermission }))
      return hasPermission
    } catch (error) {
      console.warn("Permission API not available, will request on location access")
      return null
    }
  }, [])

  // Get accuracy classification
  const getAccuracyLevel = useCallback((accuracy: number): "high" | "medium" | "low" => {
    if (accuracy <= 10) return "high"
    if (accuracy <= 50) return "medium"
    return "low"
  }, [])

  // Convert GeolocationPosition to LocationData
  const convertPosition = useCallback((position: GeolocationPosition): LocationData => {
    const { latitude, longitude, accuracy } = position.coords

    // Determine source based on accuracy and other factors
    let source: LocationData["source"] = "network"
    if (accuracy <= 20) source = "gps"
    else if (accuracy > 100) source = "passive"

    return {
      latitude,
      longitude,
      accuracy,
      timestamp: position.timestamp,
      source,
    }
  }, [])

  // Handle geolocation errors
  const handleError = useCallback((error: GeolocationPositionError): LocationError => {
    let type: LocationError["type"]
    let message: string

    switch (error.code) {
      case error.PERMISSION_DENIED:
        type = "permission_denied"
        message = "Location access denied by user"
        break
      case error.POSITION_UNAVAILABLE:
        type = "position_unavailable"
        message = "Location information unavailable"
        break
      case error.TIMEOUT:
        type = "timeout"
        message = "Location request timed out"
        break
      default:
        type = "not_supported"
        message = "Geolocation not supported"
    }

    return {
      code: error.code,
      message,
      type,
    }
  }, [])

  // Get current position
  const getCurrentPosition = useCallback(async (): Promise<LocationData> => {
    if (!stateRef.current.isSupported) {
      throw new Error("Geolocation not supported")
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    // Create abort controller for timeout handling
    abortControllerRef.current = new AbortController()

    return new Promise((resolve, reject) => {
      const successCallback = (position: GeolocationPosition) => {
        const locationData = convertPosition(position)
        const accuracy = getAccuracyLevel(locationData.accuracy)

        setState((prev) => ({
          ...prev,
          isLoading: false,
          currentLocation: locationData,
          accuracy,
          hasPermission: true,
          error: null,
        }))

        // Check if accuracy meets requirements
        if (locationData.accuracy > opts.requiredAccuracy) {
          const warning: LocationError = {
            code: 0,
            message: `Location accuracy (${Math.round(locationData.accuracy)}m) exceeds required accuracy (${opts.requiredAccuracy}m)`,
            type: "position_unavailable",
          }
          setState((prev) => ({ ...prev, error: warning }))
        }

        resolve(locationData)
      }

      const errorCallback = (error: GeolocationPositionError) => {
        const locationError = handleError(error)
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: locationError,
          hasPermission: error.code === error.PERMISSION_DENIED ? false : prev.hasPermission,
        }))
        reject(locationError)
      }

      const positionOptions: PositionOptions = {
        enableHighAccuracy: opts.enableHighAccuracy,
        timeout: opts.timeout,
        maximumAge: opts.maximumAge,
      }

      navigator.geolocation.getCurrentPosition(successCallback, errorCallback, positionOptions)
    })
  }, [opts, convertPosition, getAccuracyLevel, handleError])

  // Start watching position
  const startWatching = useCallback(() => {
    if (!stateRef.current.isSupported || watchIdRef.current !== null) return

    const successCallback = (position: GeolocationPosition) => {
      const locationData = convertPosition(position)
      const accuracy = getAccuracyLevel(locationData.accuracy)

      setState((prev) => ({
        ...prev,
        currentLocation: locationData,
        accuracy,
        hasPermission: true,
        error: null,
      }))
    }

    const errorCallback = (error: GeolocationPositionError) => {
      const locationError = handleError(error)
      setState((prev) => ({
        ...prev,
        error: locationError,
        hasPermission: error.code === error.PERMISSION_DENIED ? false : prev.hasPermission,
      }))
    }

    const positionOptions: PositionOptions = {
      enableHighAccuracy: opts.enableHighAccuracy,
      timeout: opts.timeout,
      maximumAge: opts.maximumAge,
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      successCallback,
      errorCallback,
      positionOptions
    )
  }, [opts, convertPosition, getAccuracyLevel, handleError])

  // Stop watching position
  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }, [])

  // Request permission explicitly
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!stateRef.current.isSupported) return false

    try {
      // Try to get position to trigger permission request
      await getCurrentPosition()
      return true
    } catch (error) {
      return false
    }
  }, [getCurrentPosition])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopWatching()
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [stopWatching])

  // Auto-start watching if enabled - prevent infinite loops by removing function dependencies
  useEffect(() => {
    if (opts.watchPosition && state.isSupported && state.hasPermission) {
      startWatching()
    }
    return () => {
      if (opts.watchPosition) {
        stopWatching()
      }
    }
  }, [opts.watchPosition, state.isSupported, state.hasPermission]) // Removed function dependencies

  // Check permission on mount - only run once, prevent infinite loops
  useEffect(() => {
    if (state.isSupported && state.hasPermission === null) {
      checkPermission()
    }
  }, [state.isSupported, state.hasPermission]) // Removed checkPermission dependency

  return {
    ...state,
    getCurrentPosition,
    requestPermission,
    startWatching,
    stopWatching,
    checkPermission,
  }
}

// Re-export geographic utilities from shared module
export {
  calculateDistance,
  formatCoordinates,
  getAccuracyDescription,
} from "@/lib/geo-utils"
