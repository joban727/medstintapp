"use client"

import React, { useState, useEffect, useCallback, useMemo, memo } from 'react'
import { Clock, MapPin, Play, Square, AlertCircle, CheckCircle, Loader2, RefreshCw, Shield, Building2, Navigation } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useUser } from '@/hooks/use-clerk-safe'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { retryWithBackoff } from '@/lib/retry-utils'

import { openMapService, type LocationCoordinates, type FacilityInfo, type LocationLookupResult } from '@/lib/openmap-service'
import { unifiedLocationService } from '@/services/unified-location-service'

// Types
interface ClockStatus {
  clockedIn: boolean
  clockInTime?: string
  clockOutTime?: string
  currentSite?: {
    id: string
    name: string
    address?: string
  }
  totalHours?: string
  recordId?: string
  isClocked?: boolean
  currentDuration?: number
}

interface Site {
  id: string
  name: string
  address?: string
}

interface LocationState {
  coordinates: LocationCoordinates | null
  accuracy: number | null
  accuracyLevel: 'high' | 'medium' | 'low' | null
  facility: FacilityInfo | null
  isLoading: boolean
  error: string | null
  lastUpdated: Date | null
  hasPermission: boolean
}

interface ClockWidgetMobileState {
  // Time state
  currentTime: Date
  
  // Clock status
  clockStatus: ClockStatus | null
  isLoadingStatus: boolean
  statusError: string | null
  
  // Sites
  availableSites: Site[]
  selectedSiteId: string | null
  isLoadingSites: boolean
  
  // Operations
  isClockingIn: boolean
  isClockingOut: boolean
  
  // UI state
  notes: string
  
  // Enhanced location state
  location: LocationState
}

export const ClockWidgetMobile = memo(function ClockWidgetMobile() {
  const { user } = useUser()

  // Main state
  const [state, setState] = useState<ClockWidgetMobileState>({
    currentTime: new Date(),
    clockStatus: null,
    isLoadingStatus: true,
    statusError: null,
    availableSites: [],
    selectedSiteId: null,
    isLoadingSites: false,
    isClockingIn: false,
    isClockingOut: false,
    notes: '',
    
    location: {
      coordinates: null,
      accuracy: null,
      accuracyLevel: null,
      facility: null,
      isLoading: false,
      error: null,
      lastUpdated: null,
      hasPermission: false
    }
  })

  // Enhanced performance monitoring for mobile
  const [performanceMetrics, setPerformanceMetrics] = useState({
    initStartTime: Date.now(),
    locationLoadTime: null as number | null,
    clockStatusLoadTime: null as number | null,
    totalInitTime: null as number | null,
    timeUpdateAccuracy: null as number | null,
    timeUpdateCount: 0,
    lastTimeUpdate: Date.now(),
    cacheHitRate: 0,
    cacheHits: 0,
    cacheRequests: 0,
    memoryUsage: null as number | null
  })

  // Memoized performance metrics calculation
  const computedMetrics = useMemo(() => {
    const now = Date.now();
    const metrics = {
      totalInitTime: performanceMetrics.totalInitTime ? now - performanceMetrics.initStartTime : null,
      locationLoadTime: performanceMetrics.locationLoadTime,
      clockStatusLoadTime: performanceMetrics.clockStatusLoadTime,
      timeUpdateAccuracy: performanceMetrics.timeUpdateCount > 0 ? Math.round((now - performanceMetrics.lastTimeUpdate) / performanceMetrics.timeUpdateCount) : null,
      cacheHitRate: Math.round((performanceMetrics.cacheHits / Math.max(performanceMetrics.cacheRequests, 1)) * 100),
      memoryUsage: typeof window !== 'undefined' && (window as any).performance?.memory ? 
        Math.round((window as any).performance.memory.usedJSHeapSize / 1024 / 1024) : null
    };
    
    // Log performance metrics for monitoring (only in development)
    if (process.env.NODE_ENV === 'development' && metrics.totalInitTime && metrics.totalInitTime > 1000) {
      console.log('📱 Mobile Clock Widget Performance:', metrics);
    }
    
    return metrics;
  }, [performanceMetrics])

  // Update current time with high precision for mobile (every 100ms for smooth animations)
  useEffect(() => {
    let animationFrameId: number
    let lastUpdate = 0
    
    const updateTime = (timestamp: number) => {
      // Update every 100ms for smooth second transitions on mobile
      if (timestamp - lastUpdate >= 100) {
        setState(prev => ({ ...prev, currentTime: new Date() }))
        
        // Update performance metrics
        setPerformanceMetrics(prev => ({
          ...prev,
          timeUpdateCount: prev.timeUpdateCount + 1,
          lastTimeUpdate: timestamp
        }))
        
        lastUpdate = timestamp
      }
      animationFrameId = requestAnimationFrame(updateTime)
    }
    
    animationFrameId = requestAnimationFrame(updateTime)
    return () => cancelAnimationFrame(animationFrameId)
  }, [])

  // Enhanced location caching with accuracy validation for mobile
  const locationCache = useMemo(() => {
    const CACHE_DURATION = 2 * 60 * 1000 // 2 minutes for better mobile accuracy
    let cachedLocation: LocationState | null = null
    let cacheTimestamp = 0

    return {
      get: () => {
        if (!cachedLocation) return null
        const now = Date.now()
        if (now - cacheTimestamp > CACHE_DURATION) {
          cachedLocation = null
          cacheTimestamp = 0
          return null
        }
        
        // Validate cached location accuracy for mobile
        if (cachedLocation.accuracy && cachedLocation.accuracy > 100) {
          // Discard low-accuracy cached locations on mobile
          cachedLocation = null
          cacheTimestamp = 0
          return null
        }
        
        return cachedLocation
      },
      set: (location: LocationState) => {
        cachedLocation = location
        cacheTimestamp = Date.now()
      },
      clear: () => {
        cachedLocation = null
        cacheTimestamp = 0
      }
    }
  }, [])

  // Fetch clock status
  const fetchClockStatus = useCallback(async () => {
    const clockStartTime = Date.now()
    setState(prev => ({ ...prev, isLoadingStatus: true, statusError: null }))
    
    try {
      const result = await retryWithBackoff(async () => {
        const response = await fetch('/api/student/clock-status', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        })
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        return await response.json()
      })
      
      if (result.success) {
        setState(prev => ({
          ...prev,
          clockStatus: result.data,
          isLoadingStatus: false,
          statusError: null
        }))
        
        // Update performance metrics for successful clock status load
        setPerformanceMetrics(prev => ({
          ...prev,
          clockStatusLoadTime: Date.now() - clockStartTime,
          totalInitTime: prev.locationLoadTime ? Date.now() - prev.initStartTime : null
        }))
        
        return result.data
      }
        throw new Error(result.error || 'Failed to fetch clock status')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch clock status'
      console.error('Error fetching clock status:', errorMessage)
      
      setState(prev => ({
        ...prev,
        isLoadingStatus: false,
        statusError: 'Unable to load clock data. Please check your connection.'
      }))
      
      return null
    }
  }, [])

  // Handle clock in
  const handleClockIn = useCallback(async () => {
    if (!state.selectedSiteId) {
      toast.error('Please select a site first')
      return
    }

    if (!state.location.coordinates) {
      toast.error('Please wait for location to be captured')
      return
    }

    setState(prev => ({ ...prev, isClockingIn: true }))

    try {
      const result = await retryWithBackoff(async () => {
        const response = await fetch('/api/student/clock-in', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            siteId: state.selectedSiteId,
            notes: state.notes,
            location: state.location.coordinates,
            facility: state.location.facility,
            accuracy: state.location.accuracy,
            accuracyLevel: state.location.accuracyLevel
          })
        })
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        return await response.json()
      })

      if (result.success) {
        toast.success('Clocked in successfully!')
        setState(prev => ({
          ...prev,
          isClockingIn: false,
          notes: ''
        }))
        
        // Refresh status after successful clock in
        await fetchClockStatus()
        
        // Use haptic feedback on mobile if available
        if ('vibrate' in navigator) {
          navigator.vibrate([100, 50, 100])
        }
      } else {
        throw new Error(result.error || 'Failed to clock in')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to clock in'
      console.error('Error clocking in:', errorMessage)
      
      toast.error(errorMessage.includes('network') || errorMessage.includes('timeout') 
        ? 'Network error. Please check your connection and try again.' 
        : 'Failed to clock in. Please try again.')
      
      setState(prev => ({ ...prev, isClockingIn: false }))
    }
  }, [state.selectedSiteId, state.location, state.notes, fetchClockStatus])

  // Handle clock out
  const handleClockOut = useCallback(async () => {
    if (!state.clockStatus?.recordId) {
      toast.error('No active clock-in record found')
      return
    }

    if (!state.location.coordinates) {
      toast.error('Please wait for location to be captured')
      return
    }

    setState(prev => ({ ...prev, isClockingOut: true }))

    try {
      const result = await retryWithBackoff(async () => {
        const response = await fetch('/api/student/clock-out', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recordId: state.clockStatus?.recordId,
            notes: state.notes,
            location: state.location.coordinates,
            facility: state.location.facility,
            accuracy: state.location.accuracy,
            accuracyLevel: state.location.accuracyLevel
          })
        })
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        return await response.json()
      })

      if (result.success) {
        toast.success('Clocked out successfully!')
        setState(prev => ({
          ...prev,
          isClockingOut: false,
          notes: ''
        }))
        
        // Refresh status after successful clock out
        await fetchClockStatus()
        
        // Use haptic feedback on mobile if available
        if ('vibrate' in navigator) {
          navigator.vibrate([100, 50, 100])
        }
      } else {
        throw new Error(result.error || 'Failed to clock out')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to clock out'
      console.error('Error clocking out:', errorMessage)
      
      toast.error(errorMessage.includes('network') || errorMessage.includes('timeout')
        ? 'Network error. Please check your connection and try again.'
        : 'Failed to clock out. Please try again.')
      
      setState(prev => ({ ...prev, isClockingOut: false }))
    }
  }, [state.clockStatus?.recordId, state.location, state.notes, fetchClockStatus])

  // Enhanced location capture using unified service with caching
  const captureLocation = useCallback(async (forceRefresh = false) => {
    const locationStartTime = Date.now()
    
    console.log('🌍 [ClockWidgetMobile] Starting location capture using unified service')
    
    try {
      const locationState = await unifiedLocationService.captureLocation({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: forceRefresh ? 0 : 60000,
        requireFacilityLookup: true,
        cacheKey: 'clock-widget-mobile-location'
      })

      setState(prev => ({
        ...prev,
        location: locationState
      }))

      // Update performance metrics for location capture
      setPerformanceMetrics(prev => ({
        ...prev,
        locationLoadTime: Date.now() - locationStartTime
      }))

      // Use haptic feedback on mobile if available
      if ('vibrate' in navigator) {
        navigator.vibrate(50)
      }

      console.log('✅ [ClockWidgetMobile] Location capture completed:', locationState)
      return locationState

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get location'
      console.error('❌ [ClockWidgetMobile] Location capture failed:', errorMessage)
      
      const errorState: LocationState = {
        coordinates: null,
        accuracy: null,
        accuracyLevel: null,
        facility: null,
        isLoading: false,
        error: errorMessage,
        lastUpdated: new Date(),
        hasPermission: false
      }

      setState(prev => ({
        ...prev,
        location: errorState
      }))

      return errorState
      
      // Only show user-friendly messages for certain error types
      let userMessage = 'Location unavailable'
      if (errorMessage.includes('denied')) {
        userMessage = 'Location access denied. Please enable location permissions.'
      } else if (errorMessage.includes('unavailable')) {
        userMessage = 'Location service unavailable. You can still clock in/out manually.'
      } else if (errorMessage.includes('timeout')) {
        userMessage = 'Location request timed out. You can still clock in/out manually.'
      }

      const errorLocationData: LocationState = {
        coordinates: null,
        accuracy: null,
        accuracyLevel: 'low',
        facility: null,
        isLoading: false,
        error: userMessage,
        lastUpdated: new Date(),
        hasPermission: !errorMessage.includes('denied')
      }

      setState(prev => ({
        ...prev,
        location: errorLocationData
      }))

      // Only show toast for permission errors
      if (errorMessage.includes('denied')) {
        toast.error(userMessage)
      }
      
      return errorLocationData
    }
  }, [locationCache])

  // Initialize component
  useEffect(() => {
    const initialize = async () => {
      // Capture location first (with caching)
      await captureLocation()
      
      // Then fetch clock status
      await fetchClockStatus()
    }

    initialize()

    // Set up periodic location refresh every 5 minutes
    const locationInterval = setInterval(() => {
      captureLocation()
    }, 5 * 60 * 1000)

    return () => {
      clearInterval(locationInterval)
    }
  }, [captureLocation, fetchClockStatus])



  // Quick action handlers for mobile
  const handleQuickClockIn = useCallback(async () => {
    if (!state.selectedSiteId) {
      toast.error('Please select a site first')
      return
    }
    await handleClockIn()
  }, [state.selectedSiteId, handleClockIn])

  const handleQuickClockOut = useCallback(async () => {
    await handleClockOut()
  }, [handleClockOut])

  // Enhanced mobile time display with better visibility
  const timeDisplay = useMemo(() => {
    const hours = state.currentTime.getHours()
    const minutes = state.currentTime.getMinutes()
    const seconds = state.currentTime.getSeconds()
    const isPM = hours >= 12
    const displayHours = hours % 12 || 12
    
    return (
      <div 
        className="text-center p-5 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-xl border border-blue-100 shadow-sm touch-manipulation"
      >
        {/* Digital Clock */}
        <div className="flex items-center justify-center gap-1 mb-2">
          <div className="text-4xl font-mono font-bold text-gray-800 tabular-nums">
            {String(displayHours).padStart(2, '0')}
          </div>
          <div className="text-4xl font-mono font-bold text-blue-600 animate-pulse">:</div>
          <div className="text-4xl font-mono font-bold text-gray-800 tabular-nums">
            {String(minutes).padStart(2, '0')}
          </div>
          <div className="text-2xl font-mono font-bold text-gray-600 ml-1">
            {isPM ? 'PM' : 'AM'}
          </div>
        </div>
        
        {/* Date Display */}
        <div className="text-sm text-gray-600 font-medium">
          {state.currentTime.toLocaleDateString(undefined, { 
            weekday: 'long', 
            month: 'short', 
            day: 'numeric' 
          })}
        </div>
        
        {/* Time Zone */}
        <div className="text-xs text-gray-500 mt-1">
          {Intl.DateTimeFormat().resolvedOptions().timeZone}
        </div>
      

      
      {/* Location Display */}
      <div className="mt-3 pt-3 border-t border-blue-200">
        {state.location.isLoading ? (
          <div className="flex items-center justify-center gap-2 text-blue-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Getting location...</span>
          </div>
        ) : state.location.coordinates ? (
          <div className="flex items-center justify-center gap-2 text-green-600">
            <MapPin className="h-4 w-4" />
            <span className="text-sm">
              Location ready
              {state.location.accuracy && (
                <span className="text-xs text-gray-500 ml-1">
                  (±{Math.round(state.location.accuracy)}m)
                </span>
              )}
            </span>
          </div>
        ) : state.location.error ? (
          <div className="flex items-center justify-center gap-2 text-red-600">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{state.location.error}</span>
          </div>
        ) : !state.location.hasPermission ? (
          <div className="flex items-center justify-center gap-2 text-red-600">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Location denied</span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 text-gray-500">
            <MapPin className="h-4 w-4" />
            <span className="text-sm">No location</span>
          </div>
        )}
      </div>
    </div>
  )
}, [state.currentTime, state.location])

  // Mobile-optimized status display
  const statusDisplay = useMemo(() => {
    if (!state.clockStatus) return null

    return (
      <div className={`rounded-lg border p-4 ${
        state.clockStatus.clockedIn 
          ? 'border-green-200 bg-green-50' 
          : 'border-gray-200 bg-gray-50'
      }`}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {state.clockStatus.clockedIn ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-800">Clocked In</span>
                </>
              ) : (
                <>
                  <Clock className="h-5 w-5 text-gray-600" />
                  <span className="font-medium text-gray-800">Not Clocked In</span>
                </>
              )}
            </div>
            
            {/* Quick action button */}
            <Button
              onClick={state.clockStatus.clockedIn ? handleQuickClockOut : handleQuickClockIn}
              disabled={state.clockStatus.clockedIn ? !state.location.coordinates || state.isClockingOut : !state.selectedSiteId || !state.location.coordinates || state.isClockingIn}
              className={cn(
                "h-8 px-3 text-sm",
                state.clockStatus.clockedIn 
                  ? "bg-red-600 hover:bg-red-700" 
                  : "bg-green-600 hover:bg-green-700"
              )}
            >
              {state.clockStatus.clockedIn ? (
                state.isClockingOut ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Square className="h-3 w-3" />
                )
              ) : (
                state.isClockingIn ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Play className="h-3 w-3" />
                )
              )}
            </Button>
          </div>
          
          {state.clockStatus.clockedIn && (
            <>
              {state.clockStatus.clockInTime && (
                <div className="text-sm text-green-700">
                  Started: {new Date(state.clockStatus.clockInTime).toLocaleTimeString()}
                </div>
              )}
              {state.clockStatus.currentSite && (
                <div className="text-sm text-green-700">
                  Site: {state.clockStatus.currentSite.name}
                </div>
              )}
            </>
          )}
          
          {state.clockStatus.totalHours && (
            <div className="text-sm text-gray-700">
              Total: {state.clockStatus.totalHours} hours
            </div>
          )}
        </div>
      </div>
    )
  }, [state.clockStatus, handleQuickClockIn, handleQuickClockOut, state.selectedSiteId, state.location.coordinates, state.isClockingIn, state.isClockingOut])

  // Mobile-optimized site selector
  const siteSelector = useMemo(() => (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">Site</label>
      <Select 
        value={state.selectedSiteId || ''} 
        onValueChange={(value) => setState(prev => ({ ...prev, selectedSiteId: value }))}
      >
        <SelectTrigger className="h-12">
          <SelectValue placeholder="Choose site..." />
        </SelectTrigger>
        <SelectContent>
          {state.availableSites.map((site) => (
            <SelectItem key={site.id} value={site.id}>
              <div className="flex flex-col">
                <span className="font-medium">{site.name}</span>
                {site.address && <span className="text-xs text-gray-500">{site.address}</span>}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  ), [state.availableSites, state.selectedSiteId])

  // Mobile-optimized notes input
  const notesInput = useMemo(() => (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">Notes</label>
      <Textarea
        value={state.notes}
        onChange={(e) => setState(prev => ({ ...prev, notes: e.target.value }))}
        placeholder="Add shift notes..."
        rows={2}
        className="text-sm"
      />
    </div>
  ), [state.notes])



  // Location status display
  const locationDisplay = useMemo(() => {
    if (state.location.isLoading) {
      return (
        <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 text-blue-700">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Getting location...</span>
          </div>
        </div>
      )
    }

    if (state.location.error) {
      return (
        <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{state.location.error}</span>
          </div>
          <Button onClick={captureLocation} variant="outline" size="sm" className="text-red-700 border-red-300 hover:bg-red-50">
            <Navigation className="h-4 w-4 mr-1" />
            Retry
          </Button>
        </div>
      )
    }

    if (state.location.coordinates) {
      const accuracyColor = 
        state.location.accuracyLevel === 'high' ? 'text-green-600' :
        state.location.accuracyLevel === 'medium' ? 'text-yellow-600' : 'text-red-600'
      
      const accuracyBg = 
        state.location.accuracyLevel === 'high' ? 'bg-green-50 border-green-200' :
        state.location.accuracyLevel === 'medium' ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'

      return (
        <div className={`p-3 border rounded-lg ${accuracyBg}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <MapPin className={`h-4 w-4 ${accuracyColor}`} />
              <span className={`text-sm font-medium ${accuracyColor}`}>
                {state.location.accuracyLevel?.toUpperCase()} accuracy
              </span>
            </div>
            <Button onClick={captureLocation} variant="ghost" size="sm" className="h-6 w-6 p-0">
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
          
          {state.location.facility && (
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
              <Building2 className="h-3 w-3" />
              <span>{state.location.facility.name}</span>
            </div>
          )}
          
          <div className="text-xs text-gray-500">
            {state.location.accuracy && `±${state.location.accuracy}m`}
            {state.location.lastUpdated && ` • ${state.location.lastUpdated.toLocaleTimeString()}`}
          </div>
        </div>
      )
    }

    return (
      <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex items-center gap-2 text-gray-600">
          <MapPin className="h-4 w-4" />
          <span className="text-sm">Location not available</span>
        </div>
        <Button onClick={captureLocation} variant="outline" size="sm">
          <Navigation className="h-4 w-4 mr-1" />
          Get Location
        </Button>
      </div>
    )
  }, [state.location, captureLocation])

  // Mobile-optimized loading state
  const isInitializing = state.isLoadingStatus && !state.clockStatus
  
  if (isInitializing) {
    return (
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            Time Clock
            <Badge variant="outline" className="ml-auto text-xs">
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
              Loading...
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {timeDisplay}
          
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded animate-pulse" />
            <div className="h-10 bg-gray-200 rounded animate-pulse" />
            <div className="h-10 bg-gray-200 rounded animate-pulse" />
          </div>
          
          {locationDisplay}
        </CardContent>
      </Card>
    )
  }

  // Mobile-optimized error state
  if (state.statusError) {
    return (
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            Time Clock
            <Badge variant="destructive" className="ml-auto text-xs">
              <AlertCircle className="h-3 w-3 mr-1" />
              Error
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {timeDisplay}
          
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-700 mb-2">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium text-sm">Clock data unavailable</span>
            </div>
            <p className="text-sm text-red-600 mb-3">{state.statusError}</p>
            <Button onClick={fetchClockStatus} variant="outline" size="sm" className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
          
          {locationDisplay}
        </CardContent>
      </Card>
    )
  }

  const canClockIn = !state.clockStatus?.clockedIn && state.selectedSiteId && state.location.coordinates && !state.isClockingIn
  const canClockOut = state.clockStatus?.clockedIn && state.location.coordinates && !state.isClockingOut

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Enhanced Mobile Container */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 md:p-6">
        {/* Mobile-First Layout */}
        <div className="space-y-6">
          {/* Time Display - Prominent on Mobile */}
          <div className="text-center">
            {timeDisplay}
          </div>
          
          {/* Status Display */}
          {statusDisplay}
          
          {/* Location Display */}
          {locationDisplay}
          
          {/* Site Selector */}
          {siteSelector}
          
          {/* Notes Input */}
          {notesInput}
          
          {/* Enhanced Clock In/Out Buttons - Mobile Optimized */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Button
              onClick={handleQuickClockIn}
              disabled={!state.selectedSiteId || !state.location.coordinates || state.isClockingIn}
              className="bg-green-600 hover:bg-green-700 h-14 text-base font-medium transition-all duration-200 hover:scale-105 active:scale-95"
              size="lg"
            >
              {state.isClockingIn ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : (
                <Play className="h-5 w-5 mr-2" />
              )}
              Clock In
            </Button>
            
            <Button
              onClick={handleQuickClockOut}
              disabled={!state.clockStatus?.clockedIn || !state.location.coordinates || state.isClockingOut}
              className="bg-red-600 hover:bg-red-700 h-14 text-base font-medium transition-all duration-200 hover:scale-105 active:scale-95"
              size="lg"
            >
              {state.isClockingOut ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : (
                <Square className="h-5 w-5 mr-2" />
              )}
              Clock Out
            </Button>
          </div>
          
          {/* Location Requirements Notice */}
          {!state.location.coordinates && (
            <div className="text-center p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center justify-center gap-2 text-yellow-700 mb-2">
                <MapPin className="h-5 w-5" />
                <span className="font-medium">Location Required</span>
              </div>
              <p className="text-sm text-yellow-600">
                Please enable location services to clock in/out
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

export default ClockWidgetMobile