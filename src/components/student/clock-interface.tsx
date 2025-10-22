// TODO: Add cache invalidation hooks for mutations
"use client"

import { AlertCircle, CheckCircle, Clock, MapPin, Shield, Loader2 } from "lucide-react"
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
import { LocationDisplay, LocationSummary, LocationVerificationStatus } from "@/components/location/location-display"
import { useLocation, type LocationData } from "@/hooks/use-location"
import { unifiedLocationService, type LocationState as UnifiedLocationState } from "@/services/unified-location-service"

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
  verificationResult: any | null
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
    verificationResult: null
  })
  
  const [showLocationUI, setShowLocationUI] = useState(false)
  const [locationRequired, setLocationRequired] = useState(true) // Can be configured per site
  
  const {
    isSupported: locationSupported,
    hasPermission: locationPermission,
    getCurrentPosition,
    error: locationError
  } = useLocation({
    enableHighAccuracy: true,
    timeout: 15000,
    requiredAccuracy: 50
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
    setLocationState(prev => ({
      ...prev,
      hasPermission
    }))
  }

  // Handle location data updates
  const handleLocationData = (location: LocationData) => {
    setLocationState(prev => ({
      ...prev,
      currentLocation: location,
      error: null
    }))
  }

  // Capture location for clock in/out using unified service
  const captureLocation = async (): Promise<LocationData | null> => {
    if (!locationSupported || !locationPermission) {
      return null
    }

    setLocationState(prev => ({ ...prev, isCapturing: true, error: null }))

    try {
      const locationState = await unifiedLocationService.captureLocation({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
        requireFacilityLookup: true,
        cacheKey: 'clock-interface-location'
      })

      if (locationState.error) {
        throw new Error(locationState.error)
      }

      if (!locationState.coordinates) {
        throw new Error('No location coordinates received')
      }

      // Convert to legacy LocationData format for compatibility
      const location: LocationData = {
        latitude: locationState.coordinates.latitude,
        longitude: locationState.coordinates.longitude,
        accuracy: locationState.accuracy || 0,
        timestamp: locationState.lastUpdated?.getTime() || Date.now(),
        source: locationState.accuracyLevel === 'high' ? 'gps' : 'network'
      }

      setLocationState(prev => ({
        ...prev,
        currentLocation: location,
        isCapturing: false,
        error: null
      }))
      return location
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get location'
      setLocationState(prev => ({
        ...prev,
        error: errorMessage,
        isCapturing: false
      }))
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

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c
  }

  // Verify location against site requirements
  const verifyLocation = async (location: LocationData, timeRecordId: string): Promise<boolean> => {
    setLocationState(prev => ({ ...prev, isVerifying: true }))

    try {
      const response = await fetch('/api/location/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          timeRecordId,
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy
        })
      })

      const result = await response.json()
      
      setLocationState(prev => ({
        ...prev,
        verificationResult: result,
        isVerifying: false
      }))

      if (!result.isValid) {
        // Show warnings/errors to user
        result.errors?.forEach((error: string) => toast.error(error))
        result.warnings?.forEach((warning: string) => toast.warning(warning))
      }

      return result.isValid
    } catch (error) {
      setLocationState(prev => ({
        ...prev,
        error: 'Failed to verify location',
        isVerifying: false
      }))
      return false
    }
  }

  // Send location data to server using unified service
  const sendLocationData = async (location: LocationData, timeRecordId: string, captureType: 'clock_in' | 'clock_out') => {
    try {
      // Convert to unified service format
      const locationData = {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        timestamp: location.timestamp,
        source: location.source as 'gps' | 'network' | 'passive'
      }

      const success = await unifiedLocationService.sendLocationToAPI(locationData, timeRecordId, captureType)
      
      if (!success) {
        throw new Error('Failed to save location data')
      }

      return { success: true }
    } catch (error) {
      console.error('Location capture error:', error)
      toast.error('Failed to save location data')
      return { success: false }
    }
  }

  const fetchClockStatus = async () => {
    try {
      setError(null)
      const response = await fetch("/api/time-records/clock")
      
      if (!response.ok) {
        throw new Error(`Failed to fetch clock status: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.success === false) {
        throw new Error(data.error || "Failed to load clock status")
      }
      
      setClockStatus(data)
    } catch (error) {
      console.error("Clock status fetch error:", error)
      setError(error instanceof Error ? error.message : "Failed to load clock status")
      setClockStatus(null)
    } finally {
      setIsInitialLoading(false)
    }
  }

  const fetchAvailableSites = async () => {
    try {
      const response = await fetch("/api/sites/available")
      
      if (!response.ok) {
        console.warn("Failed to fetch available sites:", response.status)
        return
      }
      
      const data = await response.json()
      
      if (data.success !== false && data.sites) {
        setAvailableSites(data.sites)
        if (data.sites.length === 1) {
          setSelectedSite(data.sites[0].id)
        }
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
        setLocationState(prev => ({ ...prev, isCapturing: true, error: null }))
        
        try {
          const location = await getCurrentPosition()
          setLocationState(prev => ({
            ...prev,
            currentLocation: location,
            isCapturing: false,
            error: null
          }))
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to get location'
          setLocationState(prev => ({
            ...prev,
            error: errorMessage,
            isCapturing: false
          }))
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
          toast.error("Location services are not supported on this device. Please use a device with GPS capability or contact support.")
          setLoading(false)
          return
        }

        if (!locationPermission) {
          toast.error("Location permission is required for clock-in. Please enable location access in your browser settings and refresh the page.")
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
            const errorMessage = locationError instanceof Error ? locationError.message : 'Failed to capture location'
            toast.error(`Location capture failed: ${errorMessage}. Please ensure GPS is enabled and try again.`)
            setLoading(false)
            return
          }
          
          if (!location) {
            toast.error("Unable to capture location data. Please check your GPS settings, ensure you're in an area with good signal, and try again.")
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
      const response = await fetch("/api/time-records/clock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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

      const data = await response.json()

      if (response.ok) {
        // If we have location data, send it to the location capture API as backup
        if (location && data.recordId) {
          try {
            await sendLocationData(location, data.recordId, 'clock_in')
          } catch (locationSaveError) {
            console.warn('Failed to save location data to backup API:', locationSaveError)
            // Don't fail the entire clock-in process if backup location save fails
          }
        }

        toast.success("Successfully clocked in!" + (location ? ` Location captured with ${Math.round(location.accuracy || 0)}m accuracy.` : ""))
        setNotes("")
        await fetchClockStatus()
        onStatusChange?.()
      } else {
        toast.error(data.error || "Failed to clock in")
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Network error'
      toast.error(`Clock-in failed: ${errorMessage}. Please check your internet connection and try again.`)
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
          toast.error("Location services are not supported on this device. Please use a device with GPS capability or contact support.")
          setLoading(false)
          return
        }

        if (!locationPermission) {
          toast.error("Location permission is required for clock-out. Please enable location access in your browser settings and refresh the page.")
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
            const errorMessage = locationError instanceof Error ? locationError.message : 'Failed to capture location'
            
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
            console.warn('Location verification failed:', verificationError)
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

      const response = await fetch("/api/time-records/clock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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

      const data = await response.json()

      if (response.ok) {
        // If we have location data, send it to the location capture API as backup
        if (location && clockStatus?.recordId) {
          try {
            await sendLocationData(location, clockStatus.recordId, 'clock_out')
          } catch (locationSaveError) {
            console.warn('Failed to save location data to backup API:', locationSaveError)
            // Don't fail the entire clock-out process if backup location save fails
          }
        }

        const locationInfo = location ? ` Location captured with ${Math.round(location.accuracy || 0)}m accuracy.` : " Manual clock-out completed."
        toast.success(`Successfully clocked out! Total hours: ${data.totalHours}${locationInfo}`)
        setNotes("")
        setActivities([])
        await fetchClockStatus()
        onStatusChange?.()
      } else {
        toast.error(data.error || "Failed to clock out")
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Network error'
      toast.error(`Clock-out failed: ${errorMessage}. Please check your internet connection and try again.`)
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
            <div className="h-8 w-8 animate-spin rounded-full border-blue-600 border-b-2" />
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
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center text-red-600">
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
          <div className="text-center space-y-4">
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
    <div className="mx-auto w-full max-w-4xl space-y-6">
      {/* Current Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Time Clock
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <div className="font-bold font-mono text-3xl text-blue-600">
              {currentTime.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </div>
            <div className="mt-1 text-gray-600 text-sm">{formatDate(currentTime)}</div>
          </div>

          <div className="flex items-center justify-center gap-4">
            <Badge
              variant={clockStatus.clockedIn ? "default" : "secondary"}
              className={clockStatus.clockedIn ? "bg-green-500" : "bg-gray-500"}
            >
              {clockStatus.clockedIn ? (
                <>
                  <CheckCircle className="mr-1 h-3 w-3" /> Clocked In
                </>
              ) : (
                <>
                  <AlertCircle className="mr-1 h-3 w-3" /> Not Clocked In
                </>
              )}
            </Badge>
            {clockStatus.totalHours !== "0.00" && (
              <Badge variant="outline">Total Hours: {clockStatus.totalHours}</Badge>
            )}
          </div>

          {clockStatus.currentSite && (
            <div className="rounded-lg bg-blue-50 p-3">
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 text-blue-600" />
                <div>
                  <div className="font-medium text-blue-900">{clockStatus.currentSite.name}</div>
                  <div className="text-blue-700 text-sm">{clockStatus.currentSite.address}</div>
                </div>
              </div>
              {clockStatus.clockInTime && (
                <div className="mt-2 text-blue-700 text-sm">
                  Clocked in at: {formatTime(clockStatus.clockInTime)}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Location Permission Handler */}
      {locationRequired && (
        <LocationPermissionHandler
          onLocationGranted={handleLocationPermissionChange}
          onLocationData={handleLocationData}
          requiredAccuracy={50}
          showPermissionUI={!locationPermission}
        />
      )}

      {/* Location Status Display */}
      {locationRequired && locationSupported && (
        <LocationDisplay
          location={locationState.currentLocation}
          isLoading={locationState.isCapturing}
          showMap={true}
          showDetails={true}
          distance={locationState.verificationResult?.distance}
          siteName={selectedSite ? availableSites.find(s => s.id === selectedSite)?.name : undefined}
          className="mb-4"
        />
      )}

      {/* Location Verification Status */}
      {locationState.verificationResult && (
        <LocationVerificationStatus
          result={locationState.verificationResult}
          className="mb-4"
        />
      )}

      {/* Location Alerts */}
      {locationState.isCapturing && (
        <Alert className="mb-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertDescription>
            Capturing your location for time tracking...
          </AlertDescription>
        </Alert>
      )}

      {locationState.isVerifying && (
        <Alert className="mb-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertDescription>
            Verifying location against clinical site requirements...
          </AlertDescription>
        </Alert>
      )}

      {locationState.error && (
        <Alert className="border-red-200 bg-red-50 mb-4">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            {locationState.error}
          </AlertDescription>
        </Alert>
      )}

      {/* Clock In/Out Actions */}
      <Card>
        <CardHeader>
          <CardTitle>{clockStatus.clockedIn ? "Clock Out" : "Clock In"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!clockStatus.clockedIn && (
            <div>
              <label className="mb-2 block font-medium text-sm">Select Clinical Site</label>
              <Select value={selectedSite} onValueChange={setSelectedSite}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a clinical site" />
                </SelectTrigger>
                <SelectContent>
                  {availableSites.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
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
                Location access is required for time tracking. Please enable location permissions above.
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
            className={`w-full ${clockStatus.clockedIn ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}`}
          >
            {loading || locationState.isCapturing || locationState.isVerifying ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-white border-b-2" />
                {locationState.isCapturing ? "Getting Location..." : 
                 locationState.isVerifying ? "Verifying Location..." : "Processing..."}
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
      {availableSites.length > 0 && (
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
                      <p className="mt-1 text-blue-600 text-xs">Rotation: {site.rotation.name}</p>
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
      )}
    </div>
  )
}
