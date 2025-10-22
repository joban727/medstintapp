'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  MapPin, 
  Activity, 
  Clock, 
  TrendingUp, 
  RefreshCw, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  BarChart3,
  Globe,
  Zap,
  Settings
} from 'lucide-react'
import { OpenMapService, type LocationCoordinates, type FacilityInfo } from '@/lib/openmap-service'
import LocationAnalyticsChart from './location-analytics-chart'
import LocationStatusIndicator from './location-status-indicator'
import LocationMapVisualization from './location-map-visualization'

interface LocationMetrics {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  cacheHits: number
  cacheMisses: number
  averageResponseTime: number
  rateLimitHits: number
  lastResetTime: Date
}

interface CacheStats {
  size: number
  hitRate: number
  totalHits: number
  oldestEntry?: Date
  newestEntry?: Date
}

interface LocationData {
  coordinates: LocationCoordinates
  facilities?: FacilityInfo[]
  address: string
  timestamp: Date
  accuracy?: number
}

export default function LocationDashboard() {
  const [openMapService] = useState(() => new OpenMapService())
  const [locationData, setLocationData] = useState<LocationData | null>(null)
  const [currentLocation, setCurrentLocation] = useState<LocationCoordinates | null>(null)
  const [metrics, setMetrics] = useState<LocationMetrics | null>(null)
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null)

  // Fetch current location and nearby facilities
  const fetchLocationData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Get current location
      const coordinates = await openMapService.getCurrentLocation()
      
      // Lookup nearby facilities
      const result = await openMapService.lookupFacility(coordinates)
      
      setLocationData({
        coordinates,
        facilities: result.facilities,
        address: result.address,
        timestamp: new Date(),
        accuracy: coordinates.accuracy
      })

      // Update metrics and cache stats
      setMetrics(openMapService.getMetrics())
      setCacheStats(openMapService.getCacheStats())

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch location data')
    } finally {
      setIsLoading(false)
    }
  }, [openMapService])

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchLocationData, 30000) // Refresh every 30 seconds
      setRefreshInterval(interval)
      return () => clearInterval(interval)
    }if (refreshInterval) {
      clearInterval(refreshInterval)
      setRefreshInterval(null)
    }
  }, [autoRefresh, fetchLocationData])

  // Initial load
  useEffect(() => {
    fetchLocationData()
  }, [fetchLocationData])

  const formatTimestamp = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).format(date)
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  const getAccuracyColor = (accuracy?: number) => {
    if (!accuracy) return 'bg-gray-500'
    if (accuracy <= 10) return 'bg-green-500'
    if (accuracy <= 50) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const getAccuracyText = (accuracy?: number) => {
    if (!accuracy) return 'Unknown'
    if (accuracy <= 10) return 'High'
    if (accuracy <= 50) return 'Medium'
    return 'Low'
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Location Dashboard</h1>
          <p className="text-muted-foreground">
            Real-time location data and OpenMap API analytics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? 'bg-green-50 border-green-200' : ''}
          >
            <Activity className="h-4 w-4 mr-2" />
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </Button>
          <Button
            onClick={fetchLocationData}
            disabled={isLoading}
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="status">Status</TabsTrigger>
          <TabsTrigger value="map">Map</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Current Location Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Current Location</CardTitle>
                <MapPin className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {locationData ? (
                  <div className="space-y-2">
                    <div className="text-2xl font-bold">
                      {locationData.coordinates.latitude.toFixed(4)}, {locationData.coordinates.longitude.toFixed(4)}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${getAccuracyColor(locationData.accuracy)}`} />
                      <span className="text-xs text-muted-foreground">
                        {getAccuracyText(locationData.accuracy)} accuracy
                        {locationData.accuracy && ` (±${locationData.accuracy}m)`}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Updated: {formatTimestamp(locationData.timestamp)}
                    </p>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Loading...</div>
                )}
              </CardContent>
            </Card>

            {/* Facilities Found Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Nearby Facilities</CardTitle>
                <Globe className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {locationData?.facilities?.length || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Medical facilities within 1km
                </p>
              </CardContent>
            </Card>

            {/* API Performance Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Response Time</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics?.averageResponseTime.toFixed(0) || 0}ms
                </div>
                <p className="text-xs text-muted-foreground">
                  Average API response time
                </p>
              </CardContent>
            </Card>

            {/* Cache Hit Rate Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {cacheStats ? (cacheStats.hitRate * 100).toFixed(1) : 0}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Cache efficiency
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Address Card */}
          {locationData && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Current Address</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{locationData.address}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Facilities Tab */}
        <TabsContent value="facilities" className="space-y-4">
          {locationData?.facilities?.length ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {locationData.facilities.map((facility, index) => (
                <Card key={facility.osmId || index}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{facility.name}</CardTitle>
                        <CardDescription>{facility.type}</CardDescription>
                      </div>
                      <Badge variant="secondary">
                        {facility.distance.toFixed(0)}m
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {facility.department && (
                        <div className="text-sm">
                          <span className="font-medium">Department:</span> {facility.department}
                        </div>
                      )}
                      <div className="text-sm text-muted-foreground">
                        {facility.address}
                      </div>
                      {facility.confidence && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs">Confidence:</span>
                          <Progress value={facility.confidence} className="flex-1 h-2" />
                          <span className="text-xs">{facility.confidence}%</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <div className="text-center">
                  <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No facilities found nearby</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Status Tab */}
        <TabsContent value="status" className="space-y-4">
          <LocationStatusIndicator
            openMapService={openMapService}
            onLocationUpdate={(position) => {
              setCurrentLocation({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
              })
            }}
            onError={(error) => {
              console.error('Location error:', error)
            }}
          />
        </TabsContent>

        {/* Map Tab */}
        <TabsContent value="map" className="space-y-4">
          <LocationMapVisualization
            openMapService={openMapService}
            initialLocation={currentLocation}
            onLocationSelect={(location) => {
              setCurrentLocation(location)
            }}
          />
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <LocationAnalyticsChart
            openMapService={openMapService}
          />
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                   <Settings className="h-4 w-4" />
                   Service Configuration
                 </CardTitle>
                <CardDescription>
                  Configure OpenMap service settings and preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Cache Duration</label>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">5 minutes</span>
                    <Progress value={50} className="flex-1" />
                    <span className="text-sm text-gray-600">1 hour</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Request Timeout</label>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">5s</span>
                    <Progress value={75} className="flex-1" />
                    <span className="text-sm text-gray-600">30s</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Rate Limit</label>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">10/min</span>
                    <Progress value={60} className="flex-1" />
                    <span className="text-sm text-gray-600">100/min</span>
                  </div>
                </div>

                <div className="flex space-x-2">
                  <Button size="sm" variant="outline">
                    Reset to Defaults
                  </Button>
                  <Button size="sm">
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cache Management</CardTitle>
                <CardDescription>
                  Manage cached location data and performance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Cache Size</span>
                    <Badge variant="secondary">{cacheStats?.size || 0} entries</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Hit Rate</span>
                    <Badge variant="default">{cacheStats ? (cacheStats.hitRate * 100).toFixed(1) : 0}%</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Memory Usage</span>
                    <Badge variant="outline">~{cacheStats ? (cacheStats.size * 0.5).toFixed(1) : 0}KB</Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="w-full"
                    onClick={() => {
                       openMapService.clearCache()
            setCacheStats(openMapService.getCacheStats())
                     }}
                  >
                    Clear Cache
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="w-full"
                    onClick={() => {
                       openMapService.resetMetrics()
            setMetrics(openMapService.getMetrics())
                     }}
                  >
                    Reset Metrics
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Cache Tab */}
        <TabsContent value="cache" className="space-y-4">
          {cacheStats && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Cache Overview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-sm">Cache Size:</span>
                    <span className="font-medium">{cacheStats.size} entries</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Hit Rate:</span>
                    <span className="font-medium">{(cacheStats.hitRate * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Total Hits:</span>
                    <span className="font-medium">{cacheStats.totalHits}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Cache Performance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Hit Rate</span>
                      <span>{(cacheStats.hitRate * 100).toFixed(1)}%</span>
                    </div>
                    <Progress value={cacheStats.hitRate * 100} className="h-2" />
                  </div>
                  {metrics && (
                    <div className="space-y-2 mt-4">
                      <div className="flex justify-between">
                        <span className="text-sm">Cache Hits:</span>
                        <span className="font-medium">{metrics.cacheHits}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Cache Misses:</span>
                        <span className="font-medium">{metrics.cacheMisses}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Cache Timeline</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {cacheStats.oldestEntry && (
                    <div className="flex justify-between">
                      <span className="text-sm">Oldest Entry:</span>
                      <span className="font-medium text-xs">
                        {formatDate(cacheStats.oldestEntry)}
                      </span>
                    </div>
                  )}
                  {cacheStats.newestEntry && (
                    <div className="flex justify-between">
                      <span className="text-sm">Newest Entry:</span>
                      <span className="font-medium text-xs">
                        {formatDate(cacheStats.newestEntry)}
                      </span>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      openMapService.clearCache()
                      setCacheStats(openMapService.getCacheStats())
                    }}
                    className="w-full"
                  >
                    Clear Cache
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}