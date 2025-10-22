'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { 
  ThemeAwareCard, 
  ThemeAwareCardContent, 
  ThemeAwareCardHeader, 
  ThemeAwareCardTitle 
} from '@/components/ui/theme-aware-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { 
  MapPin, 
  Navigation, 
  Clock, 
  RefreshCw, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Maximize2,
  Minimize2,
  Satellite,
  Wifi,
  WifiOff,
  Shield,
  Settings
} from 'lucide-react'
import { unifiedLocationService, type LocationState, type LocationData } from '@/services/unified-location-service'
import { formatDistance, getAccuracyDescription } from '@/utils/location-validation'
import { cn } from '@/lib/utils'
import { useEnhancedTheme } from '@/contexts/theme-context'

interface EnhancedLocationDisplayProps {
  className?: string
  autoRefresh?: boolean
  refreshInterval?: number
  showMap?: boolean
  showDetails?: boolean
  variant?: 'default' | 'compact' | 'detailed'
  onLocationUpdate?: (location: LocationState) => void
  cacheTimeout?: number // Cache duration in milliseconds (default: 5 minutes)
}

interface LocationMapProps {
  latitude: number
  longitude: number
  accuracy: number
  className?: string
  isFullscreen?: boolean
  onToggleFullscreen?: () => void
}

// Simple map component with location pin and accuracy circle
function LocationMap({ 
  latitude, 
  longitude, 
  accuracy, 
  className = "",
  isFullscreen = false,
  onToggleFullscreen 
}: LocationMapProps) {
  const { config } = useEnhancedTheme()
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${longitude-0.01},${latitude-0.01},${longitude+0.01},${latitude+0.01}&layer=mapnik&marker=${latitude},${longitude}`
  
  return (
    <div className={cn(
      "relative rounded-lg overflow-hidden transition-colors duration-200",
      "bg-muted/50 dark:bg-muted/20",
      className
    )}>
      {/* Map iframe */}
      <iframe
        src={mapUrl}
        className="w-full h-full border-0"
        title="Location Map"
        loading="lazy"
      />
      
      {/* Accuracy overlay */}
      <div className="absolute top-2 left-2">
        <Badge 
          variant="secondary" 
          className="text-xs bg-background/90 backdrop-blur-sm border border-border/50"
        >
          ±{Math.round(accuracy)}m accuracy
        </Badge>
      </div>
      
      {/* Fullscreen toggle */}
      {onToggleFullscreen && (
        <Button
          variant="secondary"
          size="sm"
          className="absolute top-2 right-2 bg-background/90 backdrop-blur-sm border border-border/50"
          onClick={onToggleFullscreen}
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
      )}
      
      {/* Center pin indicator */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
        <div className="relative">
          <MapPin className="h-6 w-6 text-destructive drop-shadow-lg" />
          {/* Accuracy circle visualization */}
          <div 
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 border-2 border-primary/40 rounded-full opacity-60"
            style={{
              width: `${Math.min(accuracy / 10, 50)}px`,
              height: `${Math.min(accuracy / 10, 50)}px`
            }}
          />
        </div>
      </div>
    </div>
  )
}

// Coordinates display with high precision
function CoordinatesDisplay({ latitude, longitude }: { latitude: number; longitude: number }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground font-medium">Latitude:</span>
        <span className="font-mono text-sm bg-muted/50 text-foreground px-2 py-1 rounded border border-border/50">
          {latitude.toFixed(6)}°
        </span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground font-medium">Longitude:</span>
        <span className="font-mono text-sm bg-muted/50 text-foreground px-2 py-1 rounded border border-border/50">
          {longitude.toFixed(6)}°
        </span>
      </div>
    </div>
  )
}

// Accuracy indicator with visual representation
function AccuracyIndicator({ accuracy }: { accuracy: number }) {
  const { level, color, description } = getAccuracyDescription(accuracy)
  
  const getAccuracyPercentage = (acc: number) => {
    // Convert accuracy to percentage (lower is better)
    // Excellent: 0-10m = 90-100%, Good: 10-50m = 70-90%, Fair: 50-100m = 50-70%, Poor: >100m = 0-50%
    if (acc <= 10) return 90 + (10 - acc)
    if (acc <= 50) return 70 + (50 - acc) / 2
    if (acc <= 100) return 50 + (100 - acc) / 2.5
    return Math.max(0, 50 - (acc - 100) / 10)
  }
  
  const percentage = getAccuracyPercentage(accuracy)
  
  // Get theme-aware color classes for accuracy levels
  const getAccuracyColorClass = (level: string) => {
    switch (level) {
      case 'excellent':
        return 'text-green-600 dark:text-green-400 border-green-200 dark:border-green-800'
      case 'good':
        return 'text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800'
      case 'fair':
        return 'text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800'
      case 'poor':
        return 'text-red-600 dark:text-red-400 border-red-200 dark:border-red-800'
      default:
        return 'text-muted-foreground border-border'
    }
  }
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground font-medium">Position Accuracy:</span>
        <Badge variant="outline" className={cn("text-xs", getAccuracyColorClass(level))}>
          {description}
        </Badge>
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>±{Math.round(accuracy)} meters</span>
          <span>{Math.round(percentage)}%</span>
        </div>
        <Progress value={percentage} className="h-2" />
      </div>
    </div>
  )
}

// Source indicator showing GPS/Network/etc
function SourceIndicator({ source }: { source: LocationData['source'] }) {
  const getSourceInfo = (src: LocationData['source']) => {
    switch (src) {
      case 'gps':
        return { 
          icon: Satellite, 
          label: 'GPS', 
          color: 'text-green-600 dark:text-green-400', 
          bg: 'bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800' 
        }
      case 'network':
        return { 
          icon: Wifi, 
          label: 'Network', 
          color: 'text-blue-600 dark:text-blue-400', 
          bg: 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800' 
        }
      case 'passive':
        return { 
          icon: WifiOff, 
          label: 'Passive', 
          color: 'text-muted-foreground', 
          bg: 'bg-muted/50 border-border' 
        }
      default:
        return { 
          icon: Navigation, 
          label: 'Unknown', 
          color: 'text-muted-foreground', 
          bg: 'bg-muted/50 border-border' 
        }
    }
  }
  
  const { icon: Icon, label, color, bg } = getSourceInfo(source)
  
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground font-medium">Location Source:</span>
      <div className={cn("flex items-center gap-1 px-2 py-1 rounded-full text-xs border", bg, color)}>
        <Icon className="h-3 w-3" />
        <span className="font-medium">{label}</span>
      </div>
    </div>
  )
}

// Location cache interface
interface LocationCache {
  data: LocationState
  timestamp: number
  expiresAt: number
}

// Main enhanced location display component
export function EnhancedLocationDisplay({
  className = "",
  autoRefresh = true,
  refreshInterval = 30000, // 30 seconds
  showMap = true,
  showDetails = true,
  variant = 'default',
  onLocationUpdate,
  cacheTimeout = 300000 // 5 minutes default cache
}: EnhancedLocationDisplayProps) {
  const { config } = useEnhancedTheme()
  const [locationState, setLocationState] = useState<LocationState | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [isMapFullscreen, setIsMapFullscreen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [permissionStatus, setPermissionStatus] = useState<'unknown' | 'granted' | 'denied' | 'prompt'>('unknown')
  const cacheRef = useRef<LocationCache | null>(null)
  const hasInitializedRef = useRef(false)

  // Check if cached location is still valid
  const isCacheValid = useCallback(() => {
    if (!cacheRef.current) return false
    return Date.now() < cacheRef.current.expiresAt
  }, [])

  // Get cached location if valid
  const getCachedLocation = useCallback(() => {
    if (isCacheValid() && cacheRef.current) {
      return cacheRef.current.data
    }
    return null
  }, [isCacheValid])

  // Cache location data
  const cacheLocation = useCallback((data: LocationState) => {
    const now = Date.now()
    cacheRef.current = {
      data,
      timestamp: now,
      expiresAt: now + cacheTimeout
    }
  }, [cacheTimeout])

  // Enhanced error handling with specific error types
  const handleLocationError = useCallback((err: any) => {
    let errorMessage = 'Failed to capture location'
    let status: typeof permissionStatus = 'unknown'

    if (err instanceof GeolocationPositionError) {
      switch (err.code) {
        case GeolocationPositionError.PERMISSION_DENIED:
          errorMessage = 'Location access denied. Please enable location permissions in your browser settings.'
          status = 'denied'
          break
        case GeolocationPositionError.POSITION_UNAVAILABLE:
          errorMessage = 'Location information unavailable. Please check your GPS signal or internet connection.'
          break
        case GeolocationPositionError.TIMEOUT:
          errorMessage = 'Location request timed out. Please try again.'
          break
        default:
          errorMessage = 'An unknown location error occurred.'
      }
    } else if (err instanceof Error) {
      if (err.message.includes('permission')) {
        errorMessage = 'Location permission required. Please allow location access and try again.'
        status = 'denied'
      } else if (err.message.includes('unavailable')) {
        errorMessage = 'Location services are currently unavailable. Please try again later.'
      } else {
        errorMessage = err.message
      }
    }

    setError(errorMessage)
    setPermissionStatus(status)
    console.error('Location capture failed:', err)
  }, [])

  // Capture location function with caching and enhanced error handling
  const captureLocation = useCallback(async (forceRefresh = false) => {
    try {
      // Check cache first unless force refresh is requested
      if (!forceRefresh) {
        const cached = getCachedLocation()
        if (cached) {
          setLocationState(cached)
          setLastRefresh(new Date(cacheRef.current!.timestamp))
          if (onLocationUpdate) {
            onLocationUpdate(cached)
          }
          return
        }
      }

      setIsRefreshing(true)
      setError(null)
      setPermissionStatus('unknown')
      
      const result = await unifiedLocationService.captureLocation({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: forceRefresh ? 0 : 5000,
        requireFacilityLookup: false
      })
      
      // Cache the result
      cacheLocation(result)
      
      setLocationState(result)
      setLastRefresh(new Date())
      setPermissionStatus('granted')
      
      if (onLocationUpdate) {
        onLocationUpdate(result)
      }
    } catch (err) {
      handleLocationError(err)
    } finally {
      setIsRefreshing(false)
    }
  }, [onLocationUpdate, getCachedLocation, cacheLocation, handleLocationError])

  // Initial location capture (only once)
  useEffect(() => {
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true
      captureLocation(false) // Use cache if available
    }
  }, [captureLocation])

  // Auto-refresh setup
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      captureLocation(true) // Force refresh for auto-refresh
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, captureLocation])

  // Manual refresh handler
  const handleRefresh = useCallback(() => {
    if (!isRefreshing) {
      captureLocation(true) // Force refresh for manual refresh
    }
  }, [isRefreshing, captureLocation])

  // Enhanced loading state with better UX
  if (!locationState && isRefreshing) {
    return (
      <ThemeAwareCard className={className} variant="default">
        <ThemeAwareCardContent className="p-6">
          <div className="flex items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm font-medium">Capturing your location...</span>
          </div>
          <div className="mt-2 text-xs text-center text-muted-foreground">
            This may take a few seconds. Please ensure location services are enabled.
          </div>
          <div className="mt-3 flex justify-center">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-2 w-2 bg-primary rounded-full animate-pulse" />
              <span>Requesting permission...</span>
            </div>
          </div>
        </ThemeAwareCardContent>
      </ThemeAwareCard>
    )
  }

  // Enhanced error state with specific error handling
  if (error && !locationState) {
    const getErrorIcon = () => {
      if (permissionStatus === 'denied') return Shield
      if (error.includes('unavailable')) return WifiOff
      if (error.includes('timeout')) return Clock
      return AlertTriangle
    }

    const getErrorVariant = () => {
      if (permissionStatus === 'denied') return 'warning'
      return 'error'
    }

    const ErrorIcon = getErrorIcon()

    return (
      <ThemeAwareCard className={className} variant={getErrorVariant()}>
        <ThemeAwareCardContent className="p-6">
          <Alert className="border-0 bg-transparent p-0">
            <ErrorIcon className="h-4 w-4" />
            <AlertDescription>
              <div className="font-medium">Location Error</div>
              <div className="text-sm mt-1">{error}</div>
              
              {/* Specific help text based on error type */}
              {permissionStatus === 'denied' && (
                <div className="mt-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1 mb-1">
                    <Settings className="h-3 w-3" />
                    <span>To enable location access:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Click the location icon in your browser's address bar</li>
                    <li>Select "Allow" for location permissions</li>
                    <li>Refresh the page and try again</li>
                  </ul>
                </div>
              )}
              
              <div className="flex gap-2 mt-3">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                >
                  <RefreshCw className={cn("h-3 w-3 mr-1", isRefreshing && "animate-spin")} />
                  Try Again
                </Button>
                
                {permissionStatus === 'denied' && (
                  <Button 
                    variant="secondary" 
                    size="sm"
                    onClick={() => window.location.reload()}
                  >
                    <Settings className="h-3 w-3 mr-1" />
                    Refresh Page
                  </Button>
                )}
              </div>
            </AlertDescription>
          </Alert>
        </ThemeAwareCardContent>
      </ThemeAwareCard>
    )
  }

  // No location available state
  if (!locationState || !locationState.coordinates) {
    return (
      <ThemeAwareCard className={className} variant="default">
        <ThemeAwareCardContent className="p-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <XCircle className="h-4 w-4" />
            <span className="text-sm">Location not available</span>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Location services may be disabled or permission denied
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-3"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn("h-3 w-3 mr-1", isRefreshing && "animate-spin")} />
            Request Location
          </Button>
        </ThemeAwareCardContent>
      </ThemeAwareCard>
    )
  }

  const { coordinates, accuracy, lastUpdated } = locationState

  // Compact variant
  if (variant === 'compact') {
    return (
      <div className={cn("flex items-center gap-3 p-3 bg-white rounded-lg border", className)}>
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <span className="text-sm font-medium">Current Location</span>
        </div>
        <div className="text-xs font-mono bg-gray-50 px-2 py-1 rounded">
          {coordinates.latitude.toFixed(6)}, {coordinates.longitude.toFixed(6)}
        </div>
        <Badge variant="outline" className="text-xs">
          ±{Math.round(accuracy || 0)}m
        </Badge>
        {lastUpdated && (
          <span className="text-xs text-gray-500">
            {lastUpdated.toLocaleTimeString()}
          </span>
        )}
      </div>
    )
  }

  // Full display with enhanced status indicators
  const isLocationFresh = cacheRef.current && (Date.now() - cacheRef.current.timestamp) < 60000 // Fresh if less than 1 minute old
  
  return (
    <ThemeAwareCard className={cn(className, isMapFullscreen && "fixed inset-4 z-50")} variant="default">
      <ThemeAwareCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <ThemeAwareCardTitle className="flex items-center gap-2 text-lg">
            <MapPin className="h-5 w-5 text-primary" />
            Current Location
            {/* Status indicator */}
            <div className="flex items-center gap-1">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <Badge variant="secondary" className="text-xs bg-green-50 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-400 dark:border-green-800">
                {isLocationFresh ? 'Live' : 'Cached'}
              </Badge>
            </div>
          </ThemeAwareCardTitle>
          <div className="flex items-center gap-2">
            {lastRefresh && (
              <span className="text-xs text-muted-foreground">
                Updated {lastRefresh.toLocaleTimeString()}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            </Button>
          </div>
        </div>
      </ThemeAwareCardHeader>
      
      <ThemeAwareCardContent className="space-y-4">
        {/* Map Display */}
        {showMap && (
          <LocationMap
            latitude={coordinates.latitude}
            longitude={coordinates.longitude}
            accuracy={accuracy || 0}
            className={isMapFullscreen ? "h-96" : "h-48"}
            isFullscreen={isMapFullscreen}
            onToggleFullscreen={() => setIsMapFullscreen(!isMapFullscreen)}
          />
        )}

        {/* Location Details */}
        {showDetails && (
          <div className="space-y-4">
            {/* Coordinates */}
            <CoordinatesDisplay 
              latitude={coordinates.latitude} 
              longitude={coordinates.longitude} 
            />
            
            {/* Accuracy */}
            {accuracy && (
              <AccuracyIndicator accuracy={accuracy} />
            )}
            
            {/* Timestamp */}
            {lastUpdated && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground font-medium">Captured:</span>
                <div className="flex items-center gap-1 text-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{lastUpdated.toLocaleString()}</span>
                  {isLocationFresh && (
                    <Badge variant="secondary" className="text-xs ml-2 bg-green-50 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-400 dark:border-green-800">
                      Fresh
                    </Badge>
                  )}
                </div>
              </div>
            )}
            
            {/* Source Information */}
            {locationState.coordinates && (
              <SourceIndicator source="gps" />
            )}
          </div>
        )}

        {/* Auto-refresh indicator */}
        {autoRefresh && (
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
            <span>Auto-refresh every {Math.round(refreshInterval / 1000)}s</span>
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse" />
              <span>Live</span>
            </div>
          </div>
        )}
      </ThemeAwareCardContent>
    </ThemeAwareCard>
  )
}

export default EnhancedLocationDisplay