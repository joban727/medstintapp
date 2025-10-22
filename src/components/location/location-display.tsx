"use client"

import { MapPin, Navigation, Shield, Clock, AlertTriangle, CheckCircle, Wifi, WifiOff } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import type { LocationData } from "@/hooks/use-location"
import { 
  formatDistance, 
  formatCoordinates, 
  getAccuracyDescription,
  getLocationSourceReliability 
} from "@/utils/location-validation"
import { StatusIndicator } from "@/components/ui/status-indicator"
import { locationNameService, type LocationDisplayInfo } from "@/lib/location-name-service"
import { useState, useEffect } from "react"

interface LocationDisplayProps {
  location: LocationData | null
  isLoading?: boolean
  error?: string | null
  hasPermission?: boolean
  showMap?: boolean
  showDetails?: boolean
  distance?: number
  siteName?: string
  className?: string
  variant?: 'default' | 'compact'
}

interface LocationMapPreviewProps {
  latitude: number
  longitude: number
  accuracy: number
  siteName?: string
  className?: string
}

/**
 * Simple map preview component using static map service
 */
export function LocationMapPreview({ 
  latitude, 
  longitude, 
  accuracy, 
  siteName,
  className = "" 
}: LocationMapPreviewProps) {
  const [locationDisplayInfo, setLocationDisplayInfo] = useState<LocationDisplayInfo | null>(null)
  const [isLoadingLocationName, setIsLoadingLocationName] = useState(false)

  // Get user-friendly location name
  useEffect(() => {
    setIsLoadingLocationName(true)
    locationNameService.getLocationDisplayName({
      latitude,
      longitude
    }).then(info => {
      setLocationDisplayInfo(info)
      setIsLoadingLocationName(false)
    }).catch(error => {
      console.error('Failed to get location display name:', error)
      setIsLoadingLocationName(false)
    })
  }, [latitude, longitude])

  // Using a static map service for preview (can be replaced with interactive map)
  const mapUrl = `https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/pin-s-l+000(${longitude},${latitude})/${longitude},${latitude},15,0/300x200@2x?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw`
  
  return (
    <div className={`relative overflow-hidden rounded-lg border ${className}`}>
      <div className="aspect-[3/2] bg-gray-100 flex items-center justify-center">
        <div className="text-center text-gray-500">
          <MapPin className="h-8 w-8 mx-auto mb-2" />
          <div className="text-sm font-medium">Location Preview</div>
          {isLoadingLocationName ? (
            <div className="flex items-center justify-center gap-2 text-xs">
              <div className="h-3 w-3 animate-spin rounded-full border-gray-300 border-b-2" />
              Loading location...
            </div>
          ) : (
            <div className="text-xs">
              {locationDisplayInfo?.displayName || 'Current Location'}
            </div>
          )}
          {siteName && (
            <div className="text-xs mt-1 font-medium text-blue-600">
              {siteName}
            </div>
          )}
        </div>
      </div>
      
      {/* Accuracy indicator overlay */}
      <div className="absolute top-2 right-2">
        <Badge variant="secondary" className="text-xs">
          ±{Math.round(accuracy)}m
        </Badge>
      </div>
    </div>
  )
}

/**
 * Location accuracy indicator component
 */
export function LocationAccuracyIndicator({ 
  accuracy, 
  className = "" 
}: { 
  accuracy: number
  className?: string 
}) {
  const { level, description, color } = getAccuracyDescription(accuracy)
  
  const getIcon = () => {
    switch (level) {
      case 'excellent':
      case 'good':
        return <CheckCircle className="h-4 w-4" />
      case 'fair':
        return <Navigation className="h-4 w-4" />
      case 'poor':
        return <AlertTriangle className="h-4 w-4" />
    }
  }

  const getBgColor = () => {
    switch (level) {
      case 'excellent':
        return 'bg-green-50 border-green-200'
      case 'good':
        return 'bg-green-50 border-green-200'
      case 'fair':
        return 'bg-yellow-50 border-yellow-200'
      case 'poor':
        return 'bg-red-50 border-red-200'
    }
  }

  return (
    <div className={`flex items-center gap-2 p-2 rounded-lg border ${getBgColor()} ${className}`}>
      <div className={color}>
        {getIcon()}
      </div>
      <div className="flex-1">
        <div className={`text-sm font-medium ${color}`}>
          {description}
        </div>
        <div className="text-xs text-gray-600">
          Accuracy: ±{Math.round(accuracy)} meters
        </div>
      </div>
    </div>
  )
}

/**
 * Location source indicator
 */
export function LocationSourceIndicator({ 
  source, 
  className = "" 
}: { 
  source: string
  className?: string 
}) {
  const { reliability, description } = getLocationSourceReliability(source)
  
  const getColor = () => {
    switch (reliability) {
      case 'high':
        return 'text-green-600 bg-green-50 border-green-200'
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'low':
        return 'text-red-600 bg-red-50 border-red-200'
    }
  }

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs ${getColor()} ${className}`}>
      <Shield className="h-3 w-3" />
      <span className="font-medium">{source.toUpperCase()}</span>
      <span className="text-gray-500">• {description}</span>
    </div>
  )
}

/**
 * Main location display component
 */
export function LocationDisplay({
  location,
  isLoading = false,
  error = null,
  hasPermission = true,
  showMap = true,
  showDetails = true,
  distance,
  siteName,
  className = "",
  variant = 'default'
}: LocationDisplayProps) {
  const [locationDisplayInfo, setLocationDisplayInfo] = useState<LocationDisplayInfo | null>(null)
  const [isLoadingLocationName, setIsLoadingLocationName] = useState(false)

  // Get user-friendly location name
  useEffect(() => {
    if (location && 
        typeof location.latitude === 'number' && 
        typeof location.longitude === 'number' &&
        !isNaN(location.latitude) && 
        !isNaN(location.longitude)) {
      setIsLoadingLocationName(true)
      locationNameService.getLocationDisplayName({
        latitude: location.latitude,
        longitude: location.longitude
      }).then(info => {
        setLocationDisplayInfo(info)
        setIsLoadingLocationName(false)
      }).catch(error => {
        console.error('Failed to get location display name:', error)
        setIsLoadingLocationName(false)
      })
    }
  }, [location])

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-gray-500">
            <div className="h-4 w-4 animate-spin rounded-full border-gray-300 border-b-2" />
            <span className="text-sm">Getting your location...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">Location Error</span>
          </div>
          <div className="mt-2 text-sm text-gray-600">
            {error}
          </div>
          <div className="mt-3 text-xs text-gray-500">
            You can still clock in/out manually without location verification.
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!hasPermission) {
    if (variant === 'compact') {
      return (
        <div className={`flex items-center gap-2 text-sm text-yellow-600 ${className}`}>
          <AlertTriangle className="h-4 w-4" />
          <span>Location permission denied</span>
        </div>
      )
    }
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-yellow-600">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">Location Permission Denied</span>
          </div>
          <div className="mt-2 text-sm text-gray-600">
            Please enable location permissions in your browser settings to use location-based features.
          </div>
          <div className="mt-3 text-xs text-gray-500">
            You can still clock in/out manually without location verification.
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!location) {
    if (variant === 'compact') {
      return (
        <div className={`flex items-center gap-2 text-sm text-gray-500 ${className}`}>
          <MapPin className="h-4 w-4" />
          <span>Location not available</span>
          {process.env.NODE_ENV === 'development' && (
            <Badge variant="outline" className="text-xs ml-2">
              DEV MODE
            </Badge>
          )}
        </div>
      )
    }
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-gray-500">
            <MapPin className="h-4 w-4" />
            <span className="text-sm">Location not available</span>
            {process.env.NODE_ENV === 'development' && (
              <Badge variant="outline" className="text-xs ml-2">
                DEV MODE
              </Badge>
            )}
          </div>
          <div className="mt-2 text-sm text-gray-600">
            Location services are not available or permission was denied.
          </div>
        </CardContent>
      </Card>
    )
  }

  if (variant === 'compact') {
    const { level, color } = getAccuracyDescription(location.accuracy)
    return (
      <div className={`flex items-center gap-2 text-sm ${className}`}>
        <MapPin className={`h-4 w-4 ${color}`} />
        {isLoadingLocationName ? (
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 animate-spin rounded-full border-gray-300 border-b-2" />
            <span className="font-medium">Getting location...</span>
          </div>
        ) : (
          <span className="font-medium">
            {locationDisplayInfo?.displayName || 'Current Location'}
          </span>
        )}
        <Badge variant="outline" className="text-xs">
          ±{Math.round(location.accuracy)}m
        </Badge>
        {distance !== undefined && (
          <Badge variant="secondary" className="text-xs">
            {formatDistance(distance)}
          </Badge>
        )}
      </div>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="h-4 w-4" />
          {isLoadingLocationName ? (
            <span className="flex items-center gap-2">
              <div className="h-3 w-3 animate-spin rounded-full border-gray-300 border-b-2" />
              Current Location
            </span>
          ) : (
            locationDisplayInfo?.displayName || 'Current Location'
          )}
          {distance !== undefined && (
            <Badge variant="outline" className="ml-auto">
              {formatDistance(distance)} away
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Map Preview */}
        {showMap && (
          <LocationMapPreview
            latitude={location.latitude}
            longitude={location.longitude}
            accuracy={location.accuracy}
            siteName={siteName}
          />
        )}

        {/* Location Details */}
        {showDetails && (
          <div className="space-y-3">
            {/* Accuracy Indicator */}
            <LocationAccuracyIndicator accuracy={location.accuracy} />

            {/* Location Name with Type */}
            {locationDisplayInfo && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Location:</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{locationDisplayInfo.displayName}</span>
                  {locationDisplayInfo.type === 'facility' && (
                    <Badge variant="secondary" className="text-xs">
                      {locationDisplayInfo.details?.facilityType || 'Facility'}
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Timestamp */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Captured:</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(location.timestamp).toLocaleTimeString()}
              </span>
            </div>

            {/* Location Source */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Source:</span>
              <LocationSourceIndicator source={location.source} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Compact location summary for inline display
 */
export function LocationSummary({
  location,
  distance,
  className = ""
}: {
  location: LocationData
  distance?: number
  className?: string
}) {
  const [locationDisplayInfo, setLocationDisplayInfo] = useState<LocationDisplayInfo | null>(null)
  const [isLoadingLocationName, setIsLoadingLocationName] = useState(false)
  const { level, color } = getAccuracyDescription(location.accuracy)

  // Get user-friendly location name
  useEffect(() => {
    if (location && 
        typeof location.latitude === 'number' && 
        typeof location.longitude === 'number' &&
        !isNaN(location.latitude) && 
        !isNaN(location.longitude)) {
      setIsLoadingLocationName(true)
      locationNameService.getLocationDisplayName({
        latitude: location.latitude,
        longitude: location.longitude
      }).then(info => {
        setLocationDisplayInfo(info)
        setIsLoadingLocationName(false)
      }).catch(error => {
        console.error('Failed to get location display name:', error)
        setIsLoadingLocationName(false)
      })
    }
  }, [location])

  return (
    <div className={`flex items-center gap-2 text-sm ${className}`}>
      <MapPin className={`h-4 w-4 ${color}`} />
      {isLoadingLocationName ? (
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 animate-spin rounded-full border-gray-300 border-b-2" />
          <span className="font-medium">Loading location...</span>
        </div>
      ) : (
        <span className="font-medium">
          {locationDisplayInfo?.displayName || 'Current Location'}
        </span>
      )}
      <Badge variant="outline" className="text-xs">
        ±{Math.round(location.accuracy)}m
      </Badge>
      {distance !== undefined && (
        <Badge variant="secondary" className="text-xs">
          {formatDistance(distance)}
        </Badge>
      )}
    </div>
  )
}

/**
 * Location verification status display
 */
export function LocationVerificationStatus({
  isVerified,
  errors = [],
  warnings = [],
  distance,
  className = ""
}: {
  isVerified: boolean
  errors?: string[]
  warnings?: string[]
  distance?: number
  className?: string
}) {
  if (isVerified) {
    return (
      <Alert className={`border-green-200 bg-green-50 ${className}`}>
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">
          <div className="font-medium">Location verified successfully</div>
          {distance !== undefined && (
            <div className="text-sm mt-1">
              You are {formatDistance(distance)} from the clinical site
            </div>
          )}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {errors.length > 0 && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <div className="font-medium">Location verification failed</div>
            <ul className="text-sm mt-1 space-y-1">
              {errors.map((error, index) => (
                <li key={index}>• {error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {warnings.length > 0 && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            <div className="font-medium">Location verification warnings</div>
            <ul className="text-sm mt-1 space-y-1">
              {warnings.map((warning, index) => (
                <li key={index}>• {warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}