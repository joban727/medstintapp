'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { 
  MapPin, 
  Wifi, 
  Shield, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  RefreshCw,
  Satellite,
  Navigation,
  Signal
} from 'lucide-react'
import { OpenMapService } from '@/lib/openmap-service'

interface LocationStatus {
  permission: 'granted' | 'denied' | 'prompt' | 'unknown'
  accuracy: number | null
  timestamp: Date | null
  coordinates: {
    latitude: number
    longitude: number
  } | null
  isLoading: boolean
  error: string | null
  provider: string | null
}

interface LocationStatusIndicatorProps {
  openMapService?: OpenMapService
  className?: string
  autoRefresh?: boolean
  refreshInterval?: number
  onLocationUpdate?: (location: GeolocationPosition) => void
  onError?: (error: GeolocationPositionError) => void
}

export default function LocationStatusIndicator({
  openMapService,
  className = '',
  autoRefresh = true,
  refreshInterval = 30000,
  onLocationUpdate,
  onError
}: LocationStatusIndicatorProps) {
  const [service] = useState(() => openMapService || new OpenMapService())
  const [status, setStatus] = useState<LocationStatus>({
    permission: 'unknown',
    accuracy: null,
    timestamp: null,
    coordinates: null,
    isLoading: false,
    error: null,
    provider: null
  })
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Check geolocation permission
  const checkPermission = async () => {
    if (!navigator.geolocation) {
      setStatus(prev => ({
        ...prev,
        permission: 'denied',
        error: 'Geolocation is not supported by this browser'
      }))
      return
    }

    try {
      if ('permissions' in navigator) {
        const permission = await navigator.permissions.query({ name: 'geolocation' })
        setStatus(prev => ({
          ...prev,
          permission: permission.state as 'granted' | 'denied' | 'prompt'
        }))
      }
    } catch (error) {
      console.warn('Could not check geolocation permission:', error)
    }
  }

  // Get current location
  const getCurrentLocation = async () => {
    if (!navigator.geolocation) {
      setStatus(prev => ({
        ...prev,
        error: 'Geolocation is not supported'
      }))
      return
    }

    setStatus(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const location = await service.getCurrentLocation()
      
      setStatus(prev => ({
        ...prev,
        coordinates: {
          latitude: location.latitude,
          longitude: location.longitude
        },
        accuracy: location.accuracy,
        timestamp: new Date(),
        isLoading: false,
        error: null,
        provider: 'GPS'
      }))

      // Call the callback if provided
      if (onLocationUpdate) {
        // Create a mock GeolocationPosition object
        const position: GeolocationPosition = {
          coords: {
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null
          },
          timestamp: Date.now()
        }
        onLocationUpdate(position)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get location'
      
      setStatus(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }))

      // Call the error callback if provided
      if (onError) {
        // Create a mock GeolocationPositionError
        const positionError: GeolocationPositionError = {
          code: 1, // PERMISSION_DENIED
          message: errorMessage,
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3
        }
        onError(positionError)
      }
    }
  }

  // Refresh location and permission status
  const refresh = async () => {
    setIsRefreshing(true)
    await checkPermission()
    await getCurrentLocation()
    setIsRefreshing(false)
  }

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(refresh, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [autoRefresh, refreshInterval])

  // Initial load
  useEffect(() => {
    checkPermission()
  }, [])

  // Get status color and icon
  const getStatusInfo = () => {
    if (status.isLoading) {
      return {
        color: 'bg-blue-500',
        icon: RefreshCw,
        text: 'Loading...',
        variant: 'secondary' as const
      }
    }

    if (status.error) {
      return {
        color: 'bg-red-500',
        icon: XCircle,
        text: 'Error',
        variant: 'destructive' as const
      }
    }

    if (status.permission === 'denied') {
      return {
        color: 'bg-red-500',
        icon: XCircle,
        text: 'Denied',
        variant: 'destructive' as const
      }
    }

    if (status.coordinates) {
      return {
        color: 'bg-green-500',
        icon: CheckCircle,
        text: 'Active',
        variant: 'default' as const
      }
    }

    return {
      color: 'bg-yellow-500',
      icon: AlertTriangle,
      text: 'Inactive',
      variant: 'secondary' as const
    }
  }

  // Get accuracy level
  const getAccuracyLevel = (accuracy: number | null) => {
    if (!accuracy) return { level: 'Unknown', color: 'text-gray-500', percentage: 0 }
    
    if (accuracy <= 5) return { level: 'Excellent', color: 'text-green-600', percentage: 100 }
    if (accuracy <= 10) return { level: 'Good', color: 'text-green-500', percentage: 80 }
    if (accuracy <= 20) return { level: 'Fair', color: 'text-yellow-500', percentage: 60 }
    if (accuracy <= 50) return { level: 'Poor', color: 'text-orange-500', percentage: 40 }
    return { level: 'Very Poor', color: 'text-red-500', percentage: 20 }
  }

  const statusInfo = getStatusInfo()
  const accuracyInfo = getAccuracyLevel(status.accuracy)

  return (
    <div className={`space-y-4 ${className}`}>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${statusInfo.color} ${status.isLoading ? 'animate-pulse' : ''}`} />
              <CardTitle className="text-lg">Location Services</CardTitle>
            </div>
            <Button
              onClick={refresh}
              disabled={isRefreshing}
              size="sm"
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          <CardDescription>
            Real-time location status and accuracy information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status Overview */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <statusInfo.icon className={`h-5 w-5 ${status.isLoading ? 'animate-spin' : ''}`} />
              </div>
              <div>
                <p className="text-sm font-medium">Status</p>
                <Badge variant={statusInfo.variant}>{statusInfo.text}</Badge>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium">Permission</p>
                <Badge variant={status.permission === 'granted' ? 'default' : 'secondary'}>
                  {status.permission.charAt(0).toUpperCase() + status.permission.slice(1)}
                </Badge>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <Satellite className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium">Provider</p>
                <Badge variant="outline">
                  {status.provider || 'Unknown'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Location Details */}
          {status.coordinates && (
            <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <MapPin className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">Current Location</span>
              </div>
              
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Latitude:</span>
                  <span className="font-mono">{status.coordinates.latitude.toFixed(6)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Longitude:</span>
                  <span className="font-mono">{status.coordinates.longitude.toFixed(6)}</span>
                </div>
                {status.accuracy && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Accuracy:</span>
                    <span className={`font-medium ${accuracyInfo.color}`}>
                      ±{status.accuracy.toFixed(0)}m ({accuracyInfo.level})
                    </span>
                  </div>
                )}
                {status.timestamp && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Updated:</span>
                    <span className="text-gray-800">
                      {status.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Accuracy Indicator */}
          {status.accuracy && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Signal className="h-4 w-4" />
                  <span className="text-sm font-medium">Location Accuracy</span>
                </div>
                <span className={`text-sm font-medium ${accuracyInfo.color}`}>
                  {accuracyInfo.level}
                </span>
              </div>
              <Progress value={accuracyInfo.percentage} className="h-2" />
              <p className="text-xs text-gray-500">
                Accuracy within {status.accuracy.toFixed(0)} meters
              </p>
            </div>
          )}

          {/* Error Display */}
          {status.error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {status.error}
              </AlertDescription>
            </Alert>
          )}

          {/* Permission Request */}
          {status.permission === 'prompt' && (
            <Alert>
              <Navigation className="h-4 w-4" />
              <AlertDescription>
                Location permission is required. Click refresh to request access.
              </AlertDescription>
            </Alert>
          )}

          {/* Connection Status */}
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center space-x-2">
              <Wifi className="h-4 w-4" />
              <span>Network Status</span>
            </div>
            <Badge variant={navigator.onLine ? 'default' : 'destructive'}>
              {navigator.onLine ? 'Online' : 'Offline'}
            </Badge>
          </div>

          {/* Last Update */}
          {status.timestamp && (
            <div className="flex items-center justify-between text-sm text-gray-600">
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4" />
                <span>Last Updated</span>
              </div>
              <span>{status.timestamp.toLocaleString()}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}