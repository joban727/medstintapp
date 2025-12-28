"use client"

import React, { useState, useEffect } from "react"
import { AlertTriangle, MapPin, Shield, Settings, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { useLocation, type LocationError } from "@/hooks/use-location"

interface LocationPermissionHandlerProps {
  onLocationGranted?: (hasPermission: boolean) => void
  onLocationData?: (location: any) => void
  requiredAccuracy?: number
  showPermissionUI?: boolean
  className?: string
}

export function LocationPermissionHandler({
  onLocationGranted,
  onLocationData,
  requiredAccuracy = 50,
  showPermissionUI = true,
  className = "",
}: LocationPermissionHandlerProps) {
  const [isRequestingPermission, setIsRequestingPermission] = useState(false)
  const [showManualInstructions, setShowManualInstructions] = useState(false)

  const {
    isSupported,
    isLoading,
    hasPermission,
    currentLocation,
    error,
    accuracy,
    getCurrentPosition,
    requestPermission,
    checkPermission,
  } = useLocation({
    enableHighAccuracy: true,
    timeout: 15000,
    requiredAccuracy,
  })

  // Notify parent component of permission status changes
  useEffect(() => {
    if (onLocationGranted && hasPermission !== null) {
      onLocationGranted(hasPermission)
    }
  }, [hasPermission, onLocationGranted])

  // Notify parent component of location data
  useEffect(() => {
    if (onLocationData && currentLocation) {
      onLocationData(currentLocation)
    }
  }, [currentLocation, onLocationData])

  const handleRequestPermission = async () => {
    setIsRequestingPermission(true)
    setShowManualInstructions(false)

    try {
      const granted = await requestPermission()
      if (!granted) {
        setShowManualInstructions(true)
      }
    } catch (error) {
      console.error("Permission request failed:", error)
      setShowManualInstructions(true)
    } finally {
      setIsRequestingPermission(false)
    }
  }

  const handleRetryLocation = async () => {
    try {
      await getCurrentPosition()
    } catch (error) {
      console.error("Location retry failed:", error)
    }
  }

  const handleRefreshPermission = async () => {
    await checkPermission()
  }

  const getPermissionStatusBadge = () => {
    if (hasPermission === null) {
      return <Badge variant="secondary">Checking...</Badge>
    }
    if (hasPermission) {
      return (
        <Badge variant="default" className="bg-green-500">
          Granted
        </Badge>
      )
    }
    return <Badge variant="destructive">Denied</Badge>
  }

  const getAccuracyBadge = () => {
    if (!accuracy) return null

    const variants = {
      high: "default",
      medium: "secondary",
      low: "destructive",
    } as const

    const colors = {
      high: "bg-green-500",
      medium: "bg-warning",
      low: "bg-red-500",
    }

    return (
      <Badge variant={variants[accuracy]} className={accuracy === "high" ? colors[accuracy] : ""}>
        {accuracy.charAt(0).toUpperCase() + accuracy.slice(1)} Accuracy
      </Badge>
    )
  }

  const renderLocationError = (error: LocationError) => {
    const errorMessages = {
      permission_denied: {
        title: "Location Access Denied",
        description:
          "Location permission is required for accurate time tracking. Please enable location access in your browser settings.",
        action: "Enable Location",
      },
      position_unavailable: {
        title: "Location Unavailable",
        description:
          "Unable to determine your current location. Please check your device's location settings and try again.",
        action: "Retry Location",
      },
      timeout: {
        title: "Location Timeout",
        description:
          "Location request timed out. This may be due to poor GPS signal or network connectivity.",
        action: "Try Again",
      },
      not_supported: {
        title: "Location Not Supported",
        description:
          "Your browser or device doesn't support location services. Please use a modern browser with location capabilities.",
        action: null,
      },
    }

    const errorInfo = errorMessages[error.type] || {
      title: "Location Error",
      description: error.message,
      action: "Retry",
    }

    return (
      <Alert className="border-red-200 bg-red-50">
        <AlertTriangle className="h-4 w-4 text-error" />
        <AlertDescription className="text-red-800">
          <div className="font-medium mb-1">{errorInfo.title}</div>
          <div className="text-sm">{errorInfo.description}</div>
          {errorInfo.action && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2 border-red-300 text-red-700 hover:bg-red-100 transition-colors duration-200"
              onClick={
                error.type === "permission_denied" ? handleRequestPermission : handleRetryLocation
              }
              disabled={isRequestingPermission || isLoading}
            >
              {isRequestingPermission || isLoading ? (
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <MapPin className="h-3 w-3 mr-1" />
              )}
              {errorInfo.action}
            </Button>
          )}
        </AlertDescription>
      </Alert>
    )
  }

  const renderManualInstructions = () => (
    <Card className="border-amber-200 bg-amber-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-amber-800 flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Enable Location Manually
        </CardTitle>
        <CardDescription className="text-amber-700">
          Follow these steps to enable location access:
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-amber-800">
        <ol className="list-decimal list-inside space-y-2">
          <li>Click the location icon in your browser's address bar</li>
          <li>Select "Allow" or "Always allow" for location access</li>
          <li>If no icon appears, check your browser settings under Privacy &amp; Security</li>
          <li>Refresh the page after enabling location access</li>
        </ol>
        <div className="flex gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshPermission}
            className="border-amber-300 text-amber-700 hover:bg-amber-100 transition-colors duration-200"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Check Again
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowManualInstructions(false)}
            className="border-amber-300 text-amber-700 hover:bg-amber-100 transition-colors duration-200"
          >
            Dismiss
          </Button>
        </div>
      </CardContent>
    </Card>
  )

  if (!showPermissionUI) {
    return null
  }

  if (!isSupported) {
    return (
      <Alert className="border-red-200 bg-red-50">
        <AlertTriangle className="h-4 w-4 text-error" />
        <AlertDescription className="text-red-800">
          <div className="font-medium mb-1">Location Not Supported</div>
          <div className="text-sm">
            Your browser doesn't support location services. Please use a modern browser like Chrome,
            Firefox, Safari, or Edge for location-based features.
          </div>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Permission Status Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Location Permission
            </div>
            {getPermissionStatusBadge()}
          </CardTitle>
          <CardDescription>
            Location access is required for accurate time tracking and verification
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {hasPermission === null && "Checking permission status..."}
                {hasPermission === true && "Location access granted"}
                {hasPermission === false && "Location access denied"}
              </span>
              {getAccuracyBadge()}
            </div>
            {hasPermission === false && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRequestPermission}
                disabled={isRequestingPermission}
              >
                {isRequestingPermission ? (
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <MapPin className="h-3 w-3 mr-1" />
                )}
                Request Access
              </Button>
            )}
            {hasPermission === true && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetryLocation}
                disabled={isLoading}
              >
                {isLoading ? (
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3 mr-1" />
                )}
                Refresh Location
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && renderLocationError(error)}

      {/* Manual Instructions */}
      {showManualInstructions && renderManualInstructions()}

      {/* Current Location Info */}
      {currentLocation && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-green-800">
              <MapPin className="h-4 w-4" />
              <span className="text-sm font-medium">Location Acquired</span>
              <Badge variant="outline" className="border-green-300 text-green-700">
                ±{Math.round(currentLocation.accuracy)}m
              </Badge>
            </div>
            <div className="text-xs text-green-600 mt-1">
              {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
