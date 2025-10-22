'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  MapPin, 
  Navigation, 
  Zap, 
  Clock,
  AlertTriangle,
  RefreshCw,
  Maximize2,
  Minimize2
} from 'lucide-react'
import { OpenMapService, type LocationCoordinates, type FacilityInfo } from '@/lib/openmap-service'

interface LocationMapVisualizationProps {
  coordinates?: LocationCoordinates
  facilities?: FacilityInfo[]
  className?: string
  height?: string
  showControls?: boolean
  autoCenter?: boolean
}

interface MapMarker {
  id: string
  lat: number
  lng: number
  type: 'user' | 'facility'
  title: string
  description?: string
  facility?: FacilityInfo
}

export default function LocationMapVisualization({
  coordinates,
  facilities = [],
  className = '',
  height = '400px',
  showControls = true,
  autoCenter = true
}: LocationMapVisualizationProps) {
  const [openMapService] = useState(() => new OpenMapService())
  const [currentLocation, setCurrentLocation] = useState<LocationCoordinates | null>(coordinates || null)
  const [nearbyFacilities, setNearbyFacilities] = useState<FacilityInfo[]>(facilities)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const [mapCenter, setMapCenter] = useState<LocationCoordinates | null>(null)
  const [zoom, setZoom] = useState(15)

  // Initialize map center
  useEffect(() => {
    if (currentLocation && autoCenter) {
      setMapCenter(currentLocation)
    }
  }, [currentLocation, autoCenter])

  // Fetch location data if not provided
  const fetchLocationData = async () => {
    if (coordinates && facilities.length > 0) return

    setIsLoading(true)
    setError(null)

    try {
      const location = await openMapService.getCurrentLocation()
      setCurrentLocation(location)

      const result = await openMapService.lookupFacility(location)
      setNearbyFacilities(result.facilities)

      if (autoCenter) {
        setMapCenter(location)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch location data')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchLocationData()
  }, [])

  // Create markers for visualization
  const createMarkers = (): MapMarker[] => {
    const markers: MapMarker[] = []

    // Add user location marker
    if (currentLocation) {
      markers.push({
        id: 'user-location',
        lat: currentLocation.latitude,
        lng: currentLocation.longitude,
        type: 'user',
        title: 'Your Location',
        description: `Accuracy: ±${currentLocation.accuracy || 'Unknown'}m`
      })
    }

    // Add facility markers
    nearbyFacilities.forEach((facility, index) => {
      markers.push({
        id: `facility-${facility.osmId || index}`,
        lat: facility.latitude,
        lng: facility.longitude,
        type: 'facility',
        title: facility.name,
        description: `${facility.type} • ${facility.distance.toFixed(0)}m away`,
        facility
      })
    })

    return markers
  }

  const markers = createMarkers()

  // Calculate map bounds to fit all markers
  const calculateBounds = () => {
    if (markers.length === 0) return null

    const lats = markers.map(m => m.lat)
    const lngs = markers.map(m => m.lng)

    return {
      north: Math.max(...lats),
      south: Math.min(...lats),
      east: Math.max(...lngs),
      west: Math.min(...lngs)
    }
  }

  const bounds = calculateBounds()

  // Simple SVG-based map visualization (since we can't use external map libraries)
  const renderSVGMap = () => {
    if (!mapCenter || markers.length === 0) {
      return (
        <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg">
          <div className="text-center">
            <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500">No location data available</p>
          </div>
        </div>
      )
    }

    // Calculate SVG dimensions and scaling
    const svgWidth = 800
    const svgHeight = 600
    const padding = 50

    // Calculate scale based on bounds or default area
    let scale = 100000 // Default scale for single point
    if (bounds && markers.length > 1) {
      const latRange = bounds.north - bounds.south
      const lngRange = bounds.east - bounds.west
      const maxRange = Math.max(latRange, lngRange)
      scale = Math.min((svgWidth - 2 * padding) / lngRange, (svgHeight - 2 * padding) / latRange) * 0.8
    }

    // Convert lat/lng to SVG coordinates
    const toSVGCoords = (lat: number, lng: number) => {
      const centerLat = mapCenter.latitude
      const centerLng = mapCenter.longitude
      
      const x = svgWidth / 2 + (lng - centerLng) * scale
      const y = svgHeight / 2 - (lat - centerLat) * scale
      
      return { x, y }
    }

    return (
      <div className="relative w-full h-full bg-blue-50 rounded-lg overflow-hidden">
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="absolute inset-0"
        >
          {/* Grid lines for reference */}
          <defs>
            <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#e5e7eb" strokeWidth="1" opacity="0.3"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Render markers */}
          {markers.map((marker) => {
            const coords = toSVGCoords(marker.lat, marker.lng)
            const isSelected = selectedMarker?.id === marker.id
            
            return (
              <g key={marker.id}>
                {/* Marker circle */}
                <circle
                  cx={coords.x}
                  cy={coords.y}
                  r={marker.type === 'user' ? 12 : 8}
                  fill={marker.type === 'user' ? '#3b82f6' : '#ef4444'}
                  stroke="white"
                  strokeWidth="2"
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => setSelectedMarker(isSelected ? null : marker)}
                />
                
                {/* Marker icon */}
                <text
                  x={coords.x}
                  y={coords.y + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="white"
                  fontSize="10"
                  fontWeight="bold"
                  className="pointer-events-none"
                >
                  {marker.type === 'user' ? '●' : '+'}
                </text>

                {/* Accuracy circle for user location */}
                {marker.type === 'user' && currentLocation?.accuracy && (
                  <circle
                    cx={coords.x}
                    cy={coords.y}
                    r={Math.max(5, (currentLocation.accuracy / 10) * scale)}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="1"
                    strokeDasharray="5,5"
                    opacity="0.5"
                  />
                )}
              </g>
            )
          })}

          {/* Distance lines from user to facilities */}
          {currentLocation && markers.filter(m => m.type === 'facility').map((facilityMarker) => {
            const userCoords = toSVGCoords(currentLocation.latitude, currentLocation.longitude)
            const facilityCoords = toSVGCoords(facilityMarker.lat, facilityMarker.lng)
            
            return (
              <line
                key={`line-${facilityMarker.id}`}
                x1={userCoords.x}
                y1={userCoords.y}
                x2={facilityCoords.x}
                y2={facilityCoords.y}
                stroke="#94a3b8"
                strokeWidth="1"
                strokeDasharray="3,3"
                opacity="0.4"
              />
            )
          })}
        </svg>

        {/* Marker info popup */}
        {selectedMarker && (
          <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-3 max-w-xs z-10">
            <div className="flex items-start justify-between mb-2">
              <h4 className="font-semibold text-sm">{selectedMarker.title}</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedMarker(null)}
                className="h-6 w-6 p-0"
              >
                ×
              </Button>
            </div>
            {selectedMarker.description && (
              <p className="text-xs text-gray-600 mb-2">{selectedMarker.description}</p>
            )}
            {selectedMarker.facility && (
              <div className="space-y-1">
                <Badge variant="secondary" className="text-xs">
                  {selectedMarker.facility.type}
                </Badge>
                {selectedMarker.facility.department && (
                  <p className="text-xs text-gray-600">
                    Department: {selectedMarker.facility.department}
                  </p>
                )}
                {selectedMarker.facility.confidence && (
                  <p className="text-xs text-gray-600">
                    Confidence: {selectedMarker.facility.confidence}%
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Map controls */}
        {showControls && (
          <div className="absolute bottom-4 right-4 flex flex-col gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setZoom(Math.min(20, zoom + 1))}
              className="h-8 w-8 p-0"
            >
              +
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setZoom(Math.max(1, zoom - 1))}
              className="h-8 w-8 p-0"
            >
              −
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="h-8 w-8 p-0"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        )}

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading location data...</span>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <Card className={`${className} ${isFullscreen ? 'fixed inset-4 z-50' : ''}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Navigation className="h-5 w-5" />
              Location Map
            </CardTitle>
            <CardDescription>
              Interactive visualization of your location and nearby medical facilities
            </CardDescription>
          </div>
          {showControls && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchLocationData}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div 
          ref={mapContainerRef}
          className="w-full rounded-lg border"
          style={{ height: isFullscreen ? 'calc(100vh - 200px)' : height }}
        >
          {renderSVGMap()}
        </div>

        {/* Map legend */}
        <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full" />
              <span>Your Location</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full" />
              <span>Medical Facilities</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {currentLocation && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {currentLocation.latitude.toFixed(4)}, {currentLocation.longitude.toFixed(4)}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              {nearbyFacilities.length} facilities
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}