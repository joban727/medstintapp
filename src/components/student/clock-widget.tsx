"use client"

import React, { useState, useEffect, useCallback, useMemo, memo } from 'react'
import { 
  Clock, 
  MapPin, 
  Play, 
  Square, 
  AlertCircle, 
  CheckCircle, 
  Loader2, 
  RefreshCw, 
  Shield, 
  Building2, 
  Navigation, 
  Plus, 
  Minus,
  Info,
  MessageSquare,
  LogIn,
  LogOut,
  Globe
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeAwareCard } from '@/components/ui/theme-aware-card'
import { ThemeAwareButton } from '@/components/ui/theme-aware-button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useEnhancedTheme } from '@/contexts/theme-context'
import { toast } from 'sonner'
import { useTimeSync } from '../../hooks/useTimeSync'
import { LocationAccuracyIndicator } from '@/components/student/location-accuracy-indicator'
import { LocationStatusIndicator } from '@/components/student/location-status-indicator'
import { LocationPermissionRequest } from '@/components/student/location-permission-request'

import { openMapService, type LocationCoordinates, type FacilityInfo, type LocationLookupResult } from '@/lib/openmap-service'
import { debouncedLocationCapture } from '@/lib/location-debouncer'
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

interface ClockWidgetState {
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
  isExpanded: boolean
  
  // Enhanced location state
  location: LocationState
  locationLoading: boolean
  locationError: string | null
  currentLocation: any
  
  // Computed state
  canClockIn: boolean
  canClockOut: boolean
  isLoading: boolean
}


// Enhanced Clock Display with time synchronization integration
const ClockDisplay = memo(function ClockDisplay({ 
  time, 
  timezoneInfo 
}: { 
  time: Date
  timezoneInfo?: {
    timezone: string | null
    offset: number | null
    isLocationBased: boolean
  }
}) {
  const { theme } = useEnhancedTheme()
  const { 
    currentTime: syncedTime, 
    isConnected, 
    accuracy, 
    drift, 
    protocol, 
    connectionHealth,
    getFormattedTime 
  } = useTimeSync({ 
    autoStart: true, 
    updateInterval: 100,
    enableLogging: false 
  })
  
  // Add a local time state for fallback when sync service fails
  const [localTime, setLocalTime] = useState<Date>(new Date())
  
  // Update local time every second as fallback
  useEffect(() => {
    const interval = setInterval(() => {
      setLocalTime(new Date())
    }, 1000)
    
    return () => clearInterval(interval)
  }, [])
  
  // Use the most appropriate time source
  const finalDisplayTime = isConnected ? syncedTime : (time.getTime() > localTime.getTime() - 5000 ? time : localTime)
  
  // Get timezone information from browser
  const browserTimezone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone
    } catch {
      return 'UTC'
    }
  }, [])

  // Format timezone display
  const formatTimezone = useMemo(() => {
    const timezone = timezoneInfo?.timezone || browserTimezone
    
    // Get timezone abbreviation
    try {
      const date = new Date()
      const timezoneName = date.toLocaleString('en-US', {
        timeZoneName: 'short',
        timeZone: timezone
      }).split(' ').pop() || timezone
      
      return {
        full: timezone,
        short: timezoneName,
        offset: timezoneInfo?.offset !== null && timezoneInfo?.offset !== undefined ? 
          `UTC${timezoneInfo.offset >= 0 ? '+' : ''}${timezoneInfo.offset}` : 
          `UTC${-date.getTimezoneOffset() / 60 >= 0 ? '+' : ''}${-date.getTimezoneOffset() / 60}`
      }
    } catch {
      return {
        full: timezone,
        short: timezone.split('/').pop() || timezone,
        offset: 'UTC+0'
      }
    }
  }, [timezoneInfo, browserTimezone])

  const formatTime = useMemo(() => {
    // Use the time sync service's formatter when connected, otherwise format manually
    if (isConnected && getFormattedTime) {
      // Get the full time string and remove seconds (last 3 characters ":SS")
      const fullTime = getFormattedTime('time')
      return fullTime.length > 5 ? fullTime.substring(0, 5) : fullTime
    }
    
    // Fallback formatting - show only hours and minutes
    return finalDisplayTime.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    })
  }, [isConnected, getFormattedTime, finalDisplayTime])

  const formatDate = useMemo(() => {
    return finalDisplayTime.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }, [finalDisplayTime])

  const formatDay = useMemo(() => {
    return finalDisplayTime.toLocaleDateString('en-US', {
      weekday: 'short'
    })
  }, [finalDisplayTime])

  // Determine sync indicator color and icon
  const getSyncIndicator = () => {
    if (!isConnected) {
      return { color: 'text-destructive', icon: '🔴', label: 'OFFLINE', bgColor: 'bg-destructive' }
    }
    
    switch (accuracy) {
      case 'high':
        return { color: 'text-success', icon: '🟢', label: 'SYNCED', bgColor: 'bg-success' }
      case 'medium':
        return { color: 'text-warning', icon: '🟡', label: 'SYNC OK', bgColor: 'bg-warning' }
      case 'low':
        return { color: 'text-orange-500', icon: '🟠', label: 'SYNC LOW', bgColor: 'bg-orange-500' }
      default:
        return { color: 'text-muted-foreground', icon: '⚪', label: 'UNKNOWN', bgColor: 'bg-muted' }
    }
  }

  const syncIndicator = getSyncIndicator()

  return (
    <ThemeAwareCard style="elevated" className="text-center p-6 relative">
      {/* Sync Status Indicator */}
      <div className="absolute top-3 right-3 flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${syncIndicator.bgColor} ${isConnected ? 'animate-pulse' : ''}`} />
        <span className={`text-xs font-medium ${syncIndicator.color}`}>
          {syncIndicator.label}
        </span>
      </div>

      {/* Protocol and Health Indicator (only show if connected) */}
      {isConnected && (
        <div className="absolute top-3 left-3 flex items-center gap-1">
          <span className="text-xs text-muted-foreground uppercase tracking-wide">
            {protocol}
          </span>
          {connectionHealth > 80 && <span className="text-xs">⚡</span>}
        </div>
      )}

      {/* Day indicator */}
      <div className="text-xs font-semibold text-primary mb-2 uppercase tracking-wide">
        {formatDay}
      </div>
      
      {/* Main clock display with drift indicator */}
      <div className="relative">
        <div className={`text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-mono font-bold text-foreground
                     drop-shadow-sm transition-all duration-300 ${
                       theme.animations ? 'animate-in fade-in duration-500' : ''
                     } ${!isConnected ? 'opacity-75' : ''}`}>
          {formatTime}
        </div>
        
        {/* Drift warning for high drift */}
        {isConnected && drift > 100 && (
          <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
            <span className="text-xs text-orange-500 bg-orange-50 px-2 py-1 rounded-full">
              ±{Math.round(drift)}ms
            </span>
          </div>
        )}
      </div>
      
      {/* Enhanced date display */}
      <div className="text-base md:text-lg text-muted-foreground font-medium mt-3">
        {formatDate}
      </div>

      {/* Enhanced Timezone Display */}
      <div className="flex items-center justify-center gap-2 mt-2">
        <Globe className="h-4 w-4 text-muted-foreground" />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium">{formatTimezone.short}</span>
          <span className="text-xs opacity-75">({formatTimezone.offset})</span>
          {timezoneInfo?.isLocationBased && (
            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              Location-based
            </span>
          )}
        </div>
      </div>
      
      {/* Enhanced live indicator with sync status */}
      <div className="flex items-center justify-center gap-2 mt-4">
        <div className={`w-2 h-2 rounded-full ${syncIndicator.bgColor} ${isConnected ? 'animate-pulse' : ''}`} />
        <span className={`text-xs font-medium ${syncIndicator.color}`}>
          {isConnected ? `LIVE • ${syncIndicator.label}` : 'LOCAL TIME'}
        </span>
        {isConnected && accuracy === 'high' && (
          <span className="text-xs text-success">• HIGH PRECISION</span>
        )}
      </div>

      {/* Detailed sync info (only show for medium/low accuracy or high drift) */}
      {isConnected && (accuracy !== 'high' || drift > 50) && (
        <div className="mt-2 text-xs text-muted-foreground">
          <div className="flex items-center justify-center gap-4">
            <span>Accuracy: {accuracy.toUpperCase()}</span>
            <span>Drift: ±{Math.round(drift)}ms</span>
            <span>Health: {Math.round(connectionHealth)}%</span>
          </div>
        </div>
      )}
    </ThemeAwareCard>
  )
})

// Enhanced Status Display with theme-aware styling
const StatusDisplay = memo(({ clockStatus, location, isLoadingStatus }: { 
  clockStatus: any; 
  location: any; 
  isLoadingStatus: boolean;
}) => {
  const { theme } = useEnhancedTheme()
  
  if (isLoadingStatus) {
    return (
      <ThemeAwareCard style="default" className="text-center p-6">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-sm font-medium text-muted-foreground">
            Loading clock status...
          </span>
        </div>
      </ThemeAwareCard>
    );
  }

  if (!clockStatus) {
    return (
      <ThemeAwareCard style="error" className="text-center p-6">
        <div className="flex flex-col items-center gap-3">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <div>
            <p className="font-semibold text-destructive">
              Unable to load clock status
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Please refresh the page or contact support
            </p>
          </div>
        </div>
      </ThemeAwareCard>
    );
  }

  const statusStyle = clockStatus.clockedIn ? 'success' : 'warning'

  return (
    <ThemeAwareCard style={statusStyle} className="p-6">
      {/* Status indicator */}
      <div className="flex items-center justify-center gap-3 mb-4">
        <div className={`w-4 h-4 rounded-full ${
          clockStatus.clockedIn 
            ? 'bg-success shadow-lg shadow-success/30' 
            : 'bg-warning shadow-lg shadow-warning/30'
        } animate-pulse`} />
        <span className={`text-lg font-bold ${
          clockStatus.clockedIn ? 'text-success' : 'text-warning'
        }`}>
          {clockStatus.clockedIn ? '🟢 CLOCKED IN' : '🔴 CLOCKED OUT'}
        </span>
      </div>
      
      {/* Enhanced status details */}
      <div className="space-y-3">
        {clockStatus.clockedIn && clockStatus.lastClockIn && (
          <div className="text-center">
            <p className="text-xs font-medium text-muted-foreground mb-1">
              LAST CLOCK-IN
            </p>
            <p className="text-sm font-semibold text-foreground">
              {new Date(clockStatus.lastClockIn).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>
        )}
        
        {clockStatus.totalHours && (
          <div className="text-center">
            <p className="text-xs font-medium text-muted-foreground mb-1">
              TOTAL HOURS TODAY
            </p>
            <p className="text-lg font-bold text-primary">
              {clockStatus.totalHours}
            </p>
          </div>
        )}
        
        {clockStatus.currentSite && (
          <div className="text-center">
            <p className="text-xs font-medium text-muted-foreground mb-1">
              CURRENT SITE
            </p>
            <p className="text-sm font-semibold text-foreground">
              {clockStatus.currentSite.name}
            </p>
          </div>
        )}
      </div>
      
      {/* Quick action hint */}
      <div className="mt-4 pt-4 border-t border-border/50">
        <p className="text-xs text-muted-foreground text-center">
          {clockStatus.clockedIn 
            ? 'Ready to clock out when your shift ends' 
            : 'Select a site and get location to clock in'}
        </p>
      </div>
    </ThemeAwareCard>
  );
})

const ClockWidget = memo(function ClockWidget() {
  const { theme } = useEnhancedTheme()
  
  // Temporarily disable Clerk user hook to test React 19 compatibility
  const [user, setUser] = useState<any>(null)

  // Mock user data for testing
  useEffect(() => {
    setUser({ id: 'test-user', email: 'test@example.com' })
  }, [])

  // Main state
  const [state, setState] = useState<ClockWidgetState>({
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
    isExpanded: false,
    location: {
      coordinates: null,
      accuracy: null,
      accuracyLevel: null,
      facility: null,
      isLoading: false,
      error: null,
      lastUpdated: null,
      hasPermission: false
    },
    locationLoading: false,
    locationError: null,
    currentLocation: null,
    canClockIn: false,
    canClockOut: false,
    isLoading: false
  })

  // Add timezone state
  const [timezoneInfo, setTimezoneInfo] = useState<{
    timezone: string | null
    offset: number | null
    isLocationBased: boolean
  }>({
    timezone: null,
    offset: null,
    isLocationBased: false
  })

  // Update current time every second
  useEffect(() => {
    const updateTime = () => {
      setState(prev => ({ ...prev, currentTime: new Date() }))
    }
    
    // Update immediately
    updateTime()
    
    // Set up interval to update every second
    const intervalId = setInterval(updateTime, 1000)
    
    return () => clearInterval(intervalId)
  }, [])

  // Enhanced location caching with accuracy validation
  const locationCache = useMemo(() => {
    const CACHE_DURATION = 2 * 60 * 1000 // 2 minutes for better accuracy
    let cachedLocation: LocationState | null = null
    let cacheTimestamp = 0

    return {
      get: () => {
        if (cachedLocation && Date.now() - cacheTimestamp < CACHE_DURATION) {
          // Validate cached location accuracy
          if (cachedLocation.accuracy && cachedLocation.accuracy > 100) {
            // Discard low-accuracy cached locations
            cachedLocation = null
            cacheTimestamp = 0
            return null
          }
          return cachedLocation
        }
        return null
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

  // Enhanced location capture using OpenMapService with debouncing and caching
  const captureLocation = useCallback(async (): Promise<LocationState> => {
    console.log('🌍 [ClockWidget] Starting location capture using unified service')
    
    try {
      const locationState = await unifiedLocationService.captureLocation({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
        requireFacilityLookup: true,
        cacheKey: 'clock-widget-location'
      })

      // Update local state
      setState(prev => ({
        ...prev,
        location: locationState,
        currentLocation: locationState.coordinates ? {
          coordinates: {
            lat: locationState.coordinates.latitude,
            lng: locationState.coordinates.longitude
          },
          accuracy: locationState.accuracy || null,
          facility: locationState.facility?.name || null,
          city: locationState.facility?.address || null
        } : null
      }))

      console.log('✅ [ClockWidget] Location capture completed:', locationState)
      return locationState

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to capture location'
      console.error('❌ [ClockWidget] Location capture failed:', errorMessage)
      
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
        location: errorState,
        currentLocation: null
      }))

      return errorState
    }
  }, [])

  return (
    <div className="space-y-4">
      <ClockDisplay time={state.currentTime} timezoneInfo={timezoneInfo} />
      <StatusDisplay 
        clockStatus={state.clockStatus} 
        location={state.location} 
        isLoadingStatus={state.isLoadingStatus} 
      />
    </div>
  )
}
