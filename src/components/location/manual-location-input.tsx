'use client'

import { useState, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  MapPin, 
  Search, 
  Globe, 
  AlertCircle, 
  CheckCircle, 
  Loader2,
  Navigation,
  Clock,
  Info
} from 'lucide-react'
import { toast } from 'sonner'
import { openMapService } from '@/lib/openmap-service'
import type { LocationCoordinates, LocationLookupResult } from '@/lib/openmap-service'

interface ManualLocationInputProps {
  onLocationSelected: (location: LocationCoordinates & { 
    timezone?: string
    timezoneOffset?: number
    facility?: any
  }) => void
  onCancel?: () => void
  initialCoordinates?: LocationCoordinates
  className?: string
}

interface LocationSearchResult {
  coordinates: LocationCoordinates
  address?: string
  facility?: any
  timezone?: string
  timezoneOffset?: number
  accuracy: 'manual' | 'geocoded'
}

export default function ManualLocationInput({
  onLocationSelected,
  onCancel,
  initialCoordinates,
  className = ''
}: ManualLocationInputProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [coordinates, setCoordinates] = useState({
    latitude: initialCoordinates?.latitude?.toString() || '',
    longitude: initialCoordinates?.longitude?.toString() || ''
  })
  const [isSearching, setIsSearching] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [searchResults, setSearchResults] = useState<LocationSearchResult[]>([])
  const [validationResult, setValidationResult] = useState<LocationLookupResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Validate coordinates format
  const coordinatesValidation = useMemo(() => {
    const lat = Number.parseFloat(coordinates.latitude)
    const lng = Number.parseFloat(coordinates.longitude)
    
    const isLatValid = !isNaN(lat) && lat >= -90 && lat <= 90
    const isLngValid = !isNaN(lng) && lng >= -180 && lng <= 180
    
    return {
      isValid: isLatValid && isLngValid,
      latitude: isLatValid ? lat : null,
      longitude: isLngValid ? lng : null,
      errors: {
        latitude: !isLatValid && coordinates.latitude ? 'Invalid latitude (-90 to 90)' : null,
        longitude: !isLngValid && coordinates.longitude ? 'Invalid longitude (-180 to 180)' : null
      }
    }
  }, [coordinates])

  // Search for locations by address/name
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      toast.error('Please enter a search query')
      return
    }

    setIsSearching(true)
    setError(null)
    setSearchResults([])

    try {
      // This would typically use a geocoding service
      // For now, we'll simulate with a basic implementation
      toast.info('Address search is not yet implemented. Please use coordinates directly.')
      
      // TODO: Implement actual geocoding service integration
      // const results = await geocodingService.search(searchQuery)
      // setSearchResults(results)
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Search failed'
      setError(errorMessage)
      toast.error(`Search Error: ${errorMessage}`)
    } finally {
      setIsSearching(false)
    }
  }, [searchQuery])

  // Validate manually entered coordinates
  const handleValidateCoordinates = useCallback(async () => {
    if (!coordinatesValidation.isValid || !coordinatesValidation.latitude || !coordinatesValidation.longitude) {
      toast.error('Please enter valid coordinates')
      return
    }

    setIsValidating(true)
    setError(null)
    setValidationResult(null)

    try {
      const result = await openMapService.validateCoordinates(
        coordinatesValidation.latitude,
        coordinatesValidation.longitude
      )

      setValidationResult(result)

      if (result.isValid) {
        toast.success('Coordinates validated successfully')
      } else {
        toast.warning('Coordinates are outside valid range')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Validation failed'
      setError(errorMessage)
      toast.error(`Validation Error: ${errorMessage}`)
    } finally {
      setIsValidating(false)
    }
  }, [coordinatesValidation])

  // Confirm location selection
  const handleConfirmLocation = useCallback(() => {
    if (!validationResult || !coordinatesValidation.isValid) {
      toast.error('Please validate coordinates first')
      return
    }

    const locationData = {
      latitude: coordinatesValidation.latitude!,
      longitude: coordinatesValidation.longitude!,
      accuracy: 0, // Manual input has no accuracy measurement
      timestamp: Date.now(),
      timezone: validationResult.timezone,
      timezoneOffset: validationResult.timezoneOffset,
      facility: validationResult.facility
    }

    onLocationSelected(locationData)
    toast.success('Manual location set successfully')
  }, [validationResult, coordinatesValidation, onLocationSelected])

  return (
    <Card className={`w-full max-w-2xl mx-auto ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Manual Location Input
        </CardTitle>
        <CardDescription>
          Enter location coordinates manually when automatic detection fails
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Address Search Section */}
        <div className="space-y-3">
          <Label htmlFor="search" className="text-sm font-medium">
            Search by Address (Coming Soon)
          </Label>
          <div className="flex gap-2">
            <Input
              id="search"
              placeholder="Enter address, landmark, or facility name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              disabled={true} // Disabled until geocoding is implemented
            />
            <Button 
              onClick={handleSearch} 
              disabled={isSearching || !searchQuery.trim() || true}
              size="sm"
            >
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Address search will be available in a future update. Please use coordinates for now.
            </AlertDescription>
          </Alert>
        </div>

        <Separator />

        {/* Manual Coordinates Section */}
        <div className="space-y-4">
          <Label className="text-sm font-medium">Enter Coordinates Manually</Label>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="latitude" className="text-xs text-muted-foreground">
                Latitude (-90 to 90)
              </Label>
              <Input
                id="latitude"
                placeholder="e.g., 40.7128"
                value={coordinates.latitude}
                onChange={(e) => setCoordinates(prev => ({ ...prev, latitude: e.target.value }))}
                className={coordinatesValidation.errors.latitude ? 'border-destructive' : ''}
              />
              {coordinatesValidation.errors.latitude && (
                <p className="text-xs text-destructive">{coordinatesValidation.errors.latitude}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="longitude" className="text-xs text-muted-foreground">
                Longitude (-180 to 180)
              </Label>
              <Input
                id="longitude"
                placeholder="e.g., -74.0060"
                value={coordinates.longitude}
                onChange={(e) => setCoordinates(prev => ({ ...prev, longitude: e.target.value }))}
                className={coordinatesValidation.errors.longitude ? 'border-destructive' : ''}
              />
              {coordinatesValidation.errors.longitude && (
                <p className="text-xs text-destructive">{coordinatesValidation.errors.longitude}</p>
              )}
            </div>
          </div>

          <Button
            onClick={handleValidateCoordinates}
            disabled={!coordinatesValidation.isValid || isValidating}
            className="w-full"
            variant="outline"
          >
            {isValidating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Validating...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Validate Coordinates
              </>
            )}
          </Button>
        </div>

        {/* Validation Results */}
        {validationResult && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {validationResult.isValid ? (
                <CheckCircle className="h-4 w-4 text-success" />
              ) : (
                <AlertCircle className="h-4 w-4 text-destructive" />
              )}
              <span className="text-sm font-medium">
                {validationResult.isValid ? 'Valid Location' : 'Invalid Location'}
              </span>
            </div>

            {validationResult.isValid && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Coordinates:</span>
                    <p className="font-mono">
                      {coordinatesValidation.latitude?.toFixed(6)}, {coordinatesValidation.longitude?.toFixed(6)}
                    </p>
                  </div>
                  
                  {validationResult.timezone && (
                    <div>
                      <span className="text-muted-foreground">Timezone:</span>
                      <div className="flex items-center gap-2">
                        <Globe className="h-3 w-3" />
                        <span>{validationResult.timezone}</span>
                        {validationResult.timezoneOffset !== undefined && (
                          <Badge variant="secondary" className="text-xs">
                            UTC{validationResult.timezoneOffset >= 0 ? '+' : ''}{validationResult.timezoneOffset}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {validationResult.facility && (
                  <div>
                    <span className="text-muted-foreground text-sm">Facility:</span>
                    <p className="text-sm">{validationResult.facility.name || 'Unknown Facility'}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button
            onClick={handleConfirmLocation}
            disabled={!validationResult?.isValid}
            className="flex-1"
          >
            <Navigation className="h-4 w-4 mr-2" />
            Use This Location
          </Button>
          
          {onCancel && (
            <Button onClick={onCancel} variant="outline">
              Cancel
            </Button>
          )}
        </div>

        {/* Help Text */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">
            <strong>Tip:</strong> You can find coordinates by right-clicking on Google Maps and selecting the coordinates that appear.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}