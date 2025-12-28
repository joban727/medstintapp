// TODO: Add cache invalidation hooks for mutations
"use client"

import { AlertCircle, CheckCircle, Clock, MapPin, Shield, Loader2, Fingerprint, Navigation } from "lucide-react"
import { GlassCard } from "@/components/ui/glass-card"
import { motion, AnimatePresence } from "@/components/ui/motion"
import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { LocationPermissionHandler } from "@/components/location/location-permission-handler"
import {
  LocationDisplay,
  LocationSummary,
  LocationVerificationStatus,
} from "@/components/location/location-display"
import { useLocation, type LocationData } from "@/hooks/use-location"
import {
  unifiedLocationService,
  type LocationState as UnifiedLocationState,
} from "@/services/unified-location-service"
import { safeFetchApi } from "@/lib/safe-fetch"

const validateEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

interface Site {
  id: string
  name: string
  address: string
  phone?: string
  email?: string
  type: string
  latitude?: number
  longitude?: number
  assignment: {
    id: string
    status: string
    startDate: string
    endDate?: string
  }
  rotation?: {
    id: string
    name: string
  }
}

interface ClockStatus {
  status: "clocked_in" | "clocked_out" | "not_clocked_in"
  clockedIn: boolean
  currentSite?: {
    name: string
    address: string
  }
  clockInTime?: string
  clockOutTime?: string
  totalHours: string
  recordId?: string
}

interface ClockInterfaceProps {
  className?: string
  onStatusChange?: () => void
}

interface LocationState {
  isCapturing: boolean
  hasPermission: boolean | null
  currentLocation: LocationData | null
  error: string | null
  isVerifying: boolean
  verificationResult: { success: boolean; message?: string; data?: unknown; distance?: number; isValid?: boolean; errors?: string[]; warnings?: string[] } | null
}

export default function ClockInterface({ className, onStatusChange }: ClockInterfaceProps) {
  const [clockStatus, setClockStatus] = useState<ClockStatus | null>(null)
  const [availableSites, setAvailableSites] = useState<Site[]>([])
  const [selectedSite, setSelectedSite] = useState<string>("")
  const [notes, setNotes] = useState("")
  const [activities, setActivities] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())

  // Location tracking state
  const [locationState, setLocationState] = useState<LocationState>({
    isCapturing: false,
    hasPermission: null,
    currentLocation: null,
    error: null,
    isVerifying: false,
    verificationResult: null,
  })
  const [showLocationUI, setShowLocationUI] = useState(false)
  const [locationRequired, setLocationRequired] = useState(true) // Can be configured per site

  const {
    isSupported: locationSupported,
    hasPermission: locationPermission,
    getCurrentPosition,
    error: locationError,
  } = useLocation({
    enableHighAccuracy: true,
    timeout: 15000,
    requiredAccuracy: 50,
  })

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Handle location permission changes
  const handleLocationPermissionChange = (hasPermission: boolean) => {
    setLocationState((prev) => ({ ...prev, hasPermission }))
  }

  // Handle location data updates
  const handleLocationData = (location: LocationData) => {
    setLocationState((prev) => ({ ...prev, currentLocation: location, error: null }))
  }

  // Capture location for clock in/out using unified service
  const captureLocation = async (): Promise<LocationData | null> => {
    if (!locationSupported || !locationPermission) {
      return null
    }

    setLocationState((prev) => ({ ...prev, isCapturing: true, error: null }))

    try {
      const locationState = await unifiedLocationService.captureLocation({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
        requireFacilityLookup: true,
        cacheKey: "clock-interface-location",
      })

      if (locationState.error) {
        throw new Error(locationState.error)
      }

      if (!locationState.coordinates) {
        throw new Error("No location coordinates received")
      }

      // Convert to legacy LocationData format for compatibility
      const location: LocationData = {
        latitude: locationState.coordinates.latitude,
        longitude: locationState.coordinates.longitude,
        accuracy: locationState.accuracy || 0,
        timestamp: locationState.lastUpdated?.getTime() || Date.now(),
        source: locationState.accuracyLevel === "high" ? "gps" : "network",
      }

      setLocationState((prev) => ({
        ...prev,
        currentLocation: location,
        isCapturing: false,
        error: null,
      }))

      return location
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to get location"
      setLocationState((prev) => ({ ...prev, error: errorMessage, isCapturing: false }))
      return null
    }
  }

  // Calculate distance to a specific site
  const calculateDistanceToSite = (site: Site): number | undefined => {
    if (!locationState.currentLocation || !site.latitude || !site.longitude) {
      return undefined
    }

    const R = 6371e3 // Earth's radius in meters
    const φ1 = (locationState.currentLocation.latitude * Math.PI) / 180
    const φ2 = (site.latitude * Math.PI) / 180
    const Δφ = ((site.latitude - locationState.currentLocation.latitude) * Math.PI) / 180
    const Δλ = ((site.longitude - locationState.currentLocation.longitude) * Math.PI) / 180

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c
  }

  // Verify location against site requirements
  const verifyLocation = async (location: LocationData, timeRecordId: string): Promise<boolean> => {
    setLocationState((prev) => ({ ...prev, isVerifying: true }))

    try {
      const response = await fetch("/api/location/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timeRecordId,
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
        }),
      })

      const result = await response.json().catch((err) => {
        console.error("Failed to parse JSON response:", err)
        throw new Error("Invalid response format")
      })

      setLocationState((prev) => ({ ...prev, verificationResult: result, isVerifying: false }))

      if (!result.isValid) {
        // Show warnings/errors to user
        result.errors?.forEach((error: string) => toast.error(error))
        result.warnings?.forEach((warning: string) => toast.warning(warning))
      }

      return result.isValid
    } catch (error) {
      setLocationState((prev) => ({
        ...prev,
        error: "Failed to verify location",
        isVerifying: false,
      }))
      return false
    }
  }

  // Send location data to server using unified service
  const sendLocationData = async (
    location: LocationData,
    timeRecordId: string,
    captureType: "clock_in" | "clock_out"
  ) => {
    try {
      // Convert to unified service format
      const locationData = {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        timestamp: location.timestamp,
        source: location.source as "gps" | "network" | "passive",
      }

      const success = await unifiedLocationService.sendLocationToAPI(
        locationData,
        timeRecordId,
        captureType
      )

      if (!success) {
        throw new Error("Failed to save location data")
      }

      return { success: true }
    } catch (error) {
      console.error("Location capture error:", error)
      toast.error("Failed to save location data")
      return { success: false }
    }
  }

  const fetchClockStatus = async () => {
    try {
      setError(null)
      const result = await safeFetchApi<any>("/api/time-records/clock")

      if (!result.success) {
        throw new Error(result.error || "Failed to load clock status")
      }

      // Map API response to component state
      const apiData = result.data || {}

      // Format duration from seconds to HH:MM:SS
      let formattedDuration = "00:00:00"
      if (apiData.currentDuration) {
        const hours = Math.floor(apiData.currentDuration / 3600)
        const minutes = Math.floor((apiData.currentDuration % 3600) / 60)
        const seconds = apiData.currentDuration % 60
        formattedDuration = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
      }

      setClockStatus({
        status: apiData.isClocked ? "clocked_in" : "not_clocked_in",
        clockedIn: apiData.isClocked,
        recordId: apiData.timeRecordId,
        totalHours: formattedDuration,
        clockInTime: apiData.clockedInAt,
        currentSite: undefined, // Will be populated by fetchAvailableSites if possible
      })

      // If we have a rotationId, try to set the selected site
      if (apiData.rotationId) {
        setSelectedSite(apiData.rotationId)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred"
      console.error("[ClockInterface] Operation failed:", error)
      toast.error(errorMessage)
    } finally {
      setIsInitialLoading(false)
    }
  }

  const fetchAvailableSites = async () => {
    try {
      const result = await safeFetchApi<{ sites: Site[] }>("/api/sites/available")

      if (!result.success) {
        console.warn("Failed to fetch available sites:", result.error)
        return
      }

      if (result.data?.sites) {
        const sites = result.data.sites
        // Only include sites that have an associated rotation since clock-in requires rotationId
        const sitesWithRotation = (sites as Site[]).filter((s) => s.rotation && s.rotation.id)
        setAvailableSites(sitesWithRotation)

        // If only one site, select it by default (unless already selected by clock status)
        if (sitesWithRotation.length === 1 && !selectedSite) {
          setSelectedSite(sitesWithRotation[0].rotation!.id)
        }

        // If we have clock status with rotationId, try to find the site name
        setClockStatus((prev) => {
          if (!prev || !prev.recordId || !selectedSite) return prev
          const site = sitesWithRotation.find((s) => s.rotation?.id === selectedSite)
          if (site) {
            return {
              ...prev,
              currentSite: {
                name: site.name,
                address: site.address,
              },
            }
          }
          return prev
        })
      }
    } catch (error) {
      console.warn("Available sites fetch error:", error)
      // Don't show error for sites as it's not critical
    }
  }

  // Fetch initial data
  useEffect(() => {
    fetchClockStatus()
    fetchAvailableSites()
  }, [])

  // Capture location on component mount if required
  useEffect(() => {
    const captureInitialLocation = async () => {
      if (locationRequired && locationSupported && locationPermission) {
        setLocationState((prev) => ({ ...prev, isCapturing: true, error: null }))
        try {
          const location = await getCurrentPosition()
          setLocationState((prev) => ({
            ...prev,
            currentLocation: location,
            isCapturing: false,
            error: null,
          }))
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Failed to get location"
          setLocationState((prev) => ({ ...prev, error: errorMessage, isCapturing: false }))
        }
      }
    }

    // Only capture location if we have permission and it's required
    if (locationPermission === true && locationRequired) {
      captureInitialLocation()
    }
  }, [locationPermission, locationRequired, locationSupported, getCurrentPosition])

  const handleClockIn = async () => {
    if (!selectedSite) {
      toast.error("Please select a clinical site")
      return
    }

    setLoading(true)
    let location: LocationData | null = null

    try {
      // Handle location capture with comprehensive error handling
      if (locationRequired) {
        if (!locationSupported) {
          toast.error(
            "Location services are not supported on this device. Please use a device with GPS capability or contact support."
          )
          setLoading(false)
          return
        }

        if (!locationPermission) {
          toast.error(
            "Location permission is required for clock-in. Please enable location access in your browser settings and refresh the page."
          )
          setLoading(false)
          return
        }

        location = locationState.currentLocation

        if (!location) {
          // Attempt to capture location one more time
          toast.info("Attempting to capture location...")
          try {
            location = await captureLocation()
          } catch (locationError) {
            const errorMessage =
              locationError instanceof Error ? locationError.message : "Failed to capture location"
            toast.error(
              `Location capture failed: ${errorMessage}. Please ensure GPS is enabled and try again.`
            )
            setLoading(false)
            return
          }

          if (!location) {
            toast.error(
              "Unable to capture location data. Please check your GPS settings, ensure you're in an area with good signal, and try again."
            )
            setLoading(false)
            return
          }
        }

        // Validate location accuracy
        if (location.accuracy && location.accuracy > 500) {
          const proceed = confirm(
            `Location accuracy is low (${Math.round(location.accuracy)}m). This may affect attendance verification. Do you want to proceed anyway?`
          )
          if (!proceed) {
            setLoading(false)
            return
          }
        }
      }

      // Proceed with clock-in
      const result = await safeFetchApi<any>("/api/time-records/clock", {
        method: "POST",
        body: JSON.stringify({
          action: "clock-in",
          rotationId: selectedSite,
          notes: notes.trim() || undefined,
          latitude: location?.latitude,
          longitude: location?.longitude,
          accuracy: location?.accuracy,
          locationSource: location?.source,
        }),
      })

      if (result.success) {
        const recordId = result.data?.id

        // If we have location data, send it to the location capture API as backup
        if (location && recordId) {
          try {
            await sendLocationData(location, recordId, "clock_in")
          } catch (locationSaveError) {
            console.warn("Failed to save location data to backup API:", locationSaveError)
            // Don't fail the entire clock-in process if backup location save fails
          }
        }

        toast.success(
          "Successfully clocked in!" +
          (location
            ? ` Location captured with ${Math.round(location.accuracy || 0)}m accuracy.`
            : "")
        )
        setNotes("")
        await fetchClockStatus()
        onStatusChange?.()
      } else {
        toast.error(result.error || "Failed to clock in")
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Network error"
      toast.error(
        `Clock-in failed: ${errorMessage}. Please check your internet connection and try again.`
      )
    } finally {
      setLoading(false)
    }
  }

  const handleClockOut = async () => {
    setLoading(true)
    let location: LocationData | null = null

    try {
      // Handle location capture with comprehensive error handling
      if (locationRequired && clockStatus?.recordId) {
        if (!locationSupported) {
          toast.error(
            "Location services are not supported on this device. Please use a device with GPS capability or contact support."
          )
          setLoading(false)
          return
        }

        if (!locationPermission) {
          toast.error(
            "Location permission is required for clock-out. Please enable location access in your browser settings and refresh the page."
          )
          setLoading(false)
          return
        }

        location = locationState.currentLocation

        if (!location) {
          // Attempt to capture location one more time
          toast.info("Attempting to capture location...")
          try {
            location = await captureLocation()
          } catch (locationError) {
            const errorMessage =
              locationError instanceof Error ? locationError.message : "Failed to capture location"
            // For clock-out, allow manual override with confirmation
            const proceed = confirm(
              `Location capture failed: ${errorMessage}. Do you want to proceed with manual clock-out? This will be flagged for review.`
            )
            if (!proceed) {
              setLoading(false)
              return
            }
            // Continue with null location for manual clock-out
          }
        }

        if (location) {
          // Validate location accuracy
          if (location.accuracy && location.accuracy > 500) {
            const proceed = confirm(
              `Location accuracy is low (${Math.round(location.accuracy)}m). This may affect attendance verification. Do you want to proceed anyway?`
            )
            if (!proceed) {
              setLoading(false)
              return
            }
          }

          // Verify location before allowing clock-out
          try {
            const isValidLocation = await verifyLocation(location, clockStatus.recordId)
            if (!isValidLocation) {
              // Allow user to proceed with warning, or block based on policy
              const proceed = confirm(
                "Location verification failed. You may be outside the approved area. Do you want to proceed with clock-out anyway? This will be flagged for review."
              )
              if (!proceed) {
                setLoading(false)
                return
              }
            }
          } catch (verificationError) {
            console.warn("Location verification failed:", verificationError)
            const proceed = confirm(
              "Unable to verify location due to a technical issue. Do you want to proceed with clock-out anyway? This will be flagged for review."
            )
            if (!proceed) {
              setLoading(false)
              return
            }
          }
        } else if (locationRequired) {
          // If location is required but not available, show warning but allow proceeding
          const proceed = confirm(
            "Location data is not available. Do you want to proceed with manual clock-out? This will be flagged for review by your supervisor."
          )
          if (!proceed) {
            setLoading(false)
            return
          }
        }
      }

      const result = await safeFetchApi<any>("/api/time-records/clock", {
        method: "POST",
        body: JSON.stringify({
          action: "clock-out",
          timeRecordId: clockStatus?.recordId,
          notes: notes.trim() || undefined,
          latitude: location?.latitude,
          longitude: location?.longitude,
          accuracy: location?.accuracy,
          locationSource: location?.source,
        }),
      })

      if (result.success) {
        // If we have location data, send it to the location capture API as backup
        if (location && clockStatus?.recordId) {
          try {
            await sendLocationData(location, clockStatus.recordId, "clock_out")
          } catch (locationSaveError) {
            console.warn("Failed to save location data to backup API:", locationSaveError)
            // Don't fail the entire clock-out process if backup location save fails
          }
        }

        const locationInfo = location
          ? ` Location captured with ${Math.round(location.accuracy || 0)}m accuracy.`
          : " Manual clock-out completed."
        toast.success(
          `Successfully clocked out! Total hours: ${result.data?.totalHours || "0.00"}${locationInfo}`
        )
        setNotes("")
        setActivities([])
        await fetchClockStatus()
        onStatusChange?.()
      } else {
        toast.error(result.error || "Failed to clock out")
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Network error"
      toast.error(
        `Clock-out failed: ${errorMessage}. Please check your internet connection and try again.`
      )
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  if (isInitialLoading) {
    return (
      <Card className="mx-auto w-full max-w-2xl">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-medical-primary border-b-2" />
            <span className="ml-2">Loading clock status...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="mx-auto w-full max-w-2xl">
        <CardContent className="p-6">
          <div className="text-center gap-4">
            <div className="flex items-center justify-center text-error">
              <AlertCircle className="h-8 w-8 mr-2" />
              <span className="text-lg font-medium">Failed to load clock status</span>
            </div>
            <p className="text-gray-600 text-sm">{error}</p>
            <Button
              onClick={() => {
                setIsInitialLoading(true)
                fetchClockStatus()
              }}
              variant="outline"
            >
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!clockStatus) {
    return (
      <Card className="mx-auto w-full max-w-2xl">
        <CardContent className="p-6">
          <div className="text-center gap-4">
            <div className="flex items-center justify-center text-yellow-600">
              <AlertCircle className="h-8 w-8 mr-2" />
              <span className="text-lg font-medium">No clock status available</span>
            </div>
            <p className="text-gray-600 text-sm">Unable to retrieve your current clock status.</p>
            <Button
              onClick={() => {
                setIsInitialLoading(true)
                fetchClockStatus()
              }}
              variant="outline"
            >
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <LocationPermissionHandler
        onLocationGranted={handleLocationPermissionChange}
        className="mb-4"
      />

      {locationState.currentLocation && (
        <LocationSummary
          location={locationState.currentLocation}
          distance={locationState.verificationResult?.distance}
          className="mb-4"
        />
      )}

      {/* Location Verification Status */}
      {
        locationState.verificationResult && (
          <LocationVerificationStatus
            isVerified={locationState.verificationResult.isValid || locationState.verificationResult.success}
            errors={locationState.verificationResult.errors}
            warnings={locationState.verificationResult.warnings}
            distance={locationState.verificationResult.distance}
            className="mb-4"
          />
        )
      }

      {/* Location Alerts */}
      {
        locationState.isCapturing && (
          <Alert className="mb-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>Capturing your location for time tracking...</AlertDescription>
          </Alert>
        )
      }

      {
        locationState.isVerifying && (
          <Alert className="mb-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>
              Verifying location against clinical site requirements...
            </AlertDescription>
          </Alert>
        )
      }

      {
        locationState.error && (
          <Alert className="border-red-200 bg-red-50 mb-4">
            <AlertCircle className="h-4 w-4 text-error" />
            <AlertDescription className="text-red-800">{locationState.error}</AlertDescription>
          </Alert>
        )
      }

      {/* Clock In/Out Actions */}
      <Card>
        <CardHeader>
          <CardTitle>{clockStatus.clockedIn ? "Clock Out" : "Clock In"}</CardTitle>
        </CardHeader>
        <CardContent className="gap-4">
          {!clockStatus.clockedIn && (
            <div>
              <label className="mb-2 block font-medium text-sm">Select Clinical Site</label>
              <Select
                aria-label="Choose a clinical site"
                value={selectedSite}
                onValueChange={setSelectedSite}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a clinical site" />
                </SelectTrigger>
                <SelectContent>
                  {availableSites.map((site) => (
                    <SelectItem key={site.id} value={site.rotation!.id}>
                      <div>
                        <div className="font-medium">{site.name}</div>
                        <div className="text-gray-500 text-xs">{site.address}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <label className="mb-2 block font-medium text-sm">
              {clockStatus.clockedIn ? "Activities Completed" : "Notes (Optional)"}
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                clockStatus.clockedIn
                  ? "Describe the activities you completed during this shift..."
                  : "Add any notes about your shift..."
              }
              rows={3}
            />
          </div>

          {/* Location requirement notice */}
          {locationRequired && !locationPermission && (
            <Alert className="border-amber-200 bg-amber-50">
              <Shield className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                Location access is required for time tracking. Please enable location permissions
                above.
              </AlertDescription>
            </Alert>
          )}

          <Button
            onClick={clockStatus.clockedIn ? handleClockOut : handleClockIn}
            disabled={
              loading ||
              (!clockStatus.clockedIn && !selectedSite) ||
              (locationRequired && !locationPermission) ||
              locationState.isCapturing ||
              locationState.isVerifying
            }
            className={`w-full ${clockStatus.clockedIn
              ? "bg-error hover:bg-red transition-color duration-200s duration-200-700"
              : "bg-healthcare-green hover:bg-green transition-color duration-200s duration-200-700"
              }`}
          >
            {loading || locationState.isCapturing || locationState.isVerifying ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-white border-b-2" />
                {locationState.isCapturing
                  ? "Getting Location..."
                  : locationState.isVerifying
                    ? "Verifying Location..."
                    : "Processing..."}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {clockStatus.clockedIn ? "Clock Out" : "Clock In"}
              </div>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Available Sites Info */}
      {
        availableSites.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Your Assigned Clinical Sites
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {availableSites.map((site) => (
                  <div key={site.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">{site.name}</h4>
                          <Badge variant="outline" className="text-xs">
                            {site.type}
                          </Badge>
                        </div>
                        <p className="text-gray-600 text-sm">{site.address}</p>
                        {site.rotation && (
                          <p className="mt-1 text-medical-primary text-xs">
                            Rotation: {site.rotation.name}
                          </p>
                        )}
                        {/* Show location summary if current location is available */}
                        {locationState.currentLocation && (
                          <div className="mt-2">
                            <LocationSummary
                              location={locationState.currentLocation}
                              distance={calculateDistanceToSite(site)}
                              className="text-xs"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )
      }
    </div >
  )
}
