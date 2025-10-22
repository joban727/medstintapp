"use client"

import { useState, useEffect, useCallback } from "react"
import { 
  ThemeAwareCard as Card, 
  ThemeAwareCardContent as CardContent, 
  ThemeAwareCardDescription as CardDescription,
  ThemeAwareCardHeader as CardHeader, 
  ThemeAwareCardTitle as CardTitle 
} from "@/components/ui/theme-aware-card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { ThemeAwareButton as Button } from "@/components/ui/theme-aware-button"
import { WelcomeBanner } from "@/components/dashboard/welcome-banner"
import { toast } from "sonner"
import { format } from "date-fns"
import { 
  Clock, 
  MapPin, 
  Calendar, 
  TrendingUp, 
  Award, 
  BookOpen, 
  Play, 
  Square, 
  Target, 
  Users, 
  FileText, 
  CheckCircle, 
  Navigation, 
  Shield, 
  Wifi, 
  WifiOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Building2,
  MessageSquare
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Label } from "@/components/ui/label"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { useStudentDashboard } from "@/hooks/useStudentDashboard"
import type { StudentDashboardClientProps } from "@/types/dashboard"
import { openMapService, LocationCoordinates, FacilityInfo, LocationLookupResult } from '@/lib/openmap-service'
import { debouncedLocationCapture } from '@/lib/location-debouncer'
import { unifiedLocationService } from '@/services/unified-location-service'
import { FloatingActionButton } from "@/components/ui/floating-action-button"
import { SwipeableRotationRow } from "@/components/dashboard/swipeable-rotation-card"
import { EnhancedLocationDisplay } from "@/components/location/enhanced-location-display"
import { LocationPermissionHandler } from "@/components/location/location-permission-handler"
import { useRouter } from "next/navigation"

// Props interface is imported from types file

interface Site {
  id: string
  name: string
  address: string
  type: "hospital" | "clinic" | "research" | "other"
  coordinates?: {
    lat: number
    lng: number
  }
}

interface TimeRecord {
  id: string
  date: string
  clockIn: string
  clockOut: string
  site: string
  totalHours: number
  location?: {
    lat: number
    lng: number
    accuracy?: number
  }
}

interface StudentData {
  id: string
  name: string
  email: string
  totalHours: number
  requiredHours: number
  currentRotation: string
  completedRotations: number
  totalRotations: number
  gpa: number
  schoolName: string
  upcomingRotations: string[]
}

interface LocationState {
  coordinates: { lat: number; lng: number } | null
  accuracy: number | null
  accuracyLevel: 'high' | 'medium' | 'low'
  facility: string | null
  address: string | null
  isLoading: boolean
  error: string | null
  lastUpdated: Date | null
  hasPermission: boolean
  isTracking: boolean
}

interface LocationCacheEntry {
  location: LocationState
  timestamp: number
}

// Location cache with 2-minute duration and accuracy validation
const locationCache = {
  data: null as LocationCacheEntry | null,
  
  get(): LocationState | null {
    if (!this.data) return null
    
    const now = Date.now()
    const isExpired = now - this.data.timestamp > 120000 // 2 minutes
    const isAccurate = this.data.location.accuracy !== null && this.data.location.accuracy <= 100
    
    if (isExpired || !isAccurate) {
      this.data = null
      return null
    }
    
    return this.data.location
  },
  
  set(location: LocationState) {
    this.data = {
      location,
      timestamp: Date.now()
    }
  },
  
  clear() {
    this.data = null
  }
}

export default function StudentDashboardClient({ userId }: StudentDashboardClientProps) {
  const { data, isLoading, error, refetch } = useStudentDashboard()
  const router = useRouter()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isClockedIn, setIsClockedIn] = useState(false)
  const [selectedSite, setSelectedSite] = useState("")
  const [location, setLocation] = useState<LocationState>({
    coordinates: null,
    accuracy: null,
    accuracyLevel: 'low',
    facility: null,
    address: null,
    isLoading: false,
    error: null,
    lastUpdated: null,
    hasPermission: null, // Changed from true to null to properly check permission
    isTracking: false
  })
  const [showLocationDetails, setShowLocationDetails] = useState(false)
  const [autoLocationEnabled, setAutoLocationEnabled] = useState(true)
  const [locationPermissionStatus, setLocationPermissionStatus] = useState<'unknown' | 'granted' | 'denied' | 'prompt'>('unknown')
  const [showLocationPermissionUI, setShowLocationPermissionUI] = useState(false)
  const prefersReducedMotion = typeof window !== 'undefined' ? useReducedMotion() : false
  const selectedSiteName = data?.assignedSites?.find((s) => s.id === selectedSite)?.name ?? ""

  // Check if we're in development environment
  const isDevelopment = process.env.NODE_ENV === 'development'

  // Update clock status from real data
  useEffect(() => {
    if (data?.clockStatus) {
      setIsClockedIn(true)
    } else {
      setIsClockedIn(false)
    }
  }, [data?.clockStatus])

  // Update selected site from current rotation
  useEffect(() => {
    if (data?.currentRotation) {
      setSelectedSite(data.currentRotation.clinicalSiteId)
    }
  }, [data?.currentRotation])

  // Check location permission on component mount
  useEffect(() => {
    const checkLocationPermission = async () => {
      console.log('🔐 [StudentDashboard] Checking location permission status...')
      
      if (!navigator.geolocation) {
        console.log('❌ [StudentDashboard] Geolocation not supported')
        setLocation(prev => ({
          ...prev,
          hasPermission: false,
          error: 'Geolocation not supported by this browser'
        }))
        setLocationPermissionStatus('denied')
        return
      }

      try {
        if ('permissions' in navigator) {
          const permission = await navigator.permissions.query({ name: 'geolocation' })
          console.log('🔐 [StudentDashboard] Permission status:', permission.state)
          
          setLocationPermissionStatus(permission.state as any)
          
          if (permission.state === 'granted') {
            setLocation(prev => ({ ...prev, hasPermission: true }))
            // Auto-capture location if permission is already granted
            if (autoLocationEnabled) {
              captureLocationWithPermission()
            }
          } else if (permission.state === 'denied') {
            setLocation(prev => ({ 
              ...prev, 
              hasPermission: false,
              error: 'Location access denied. Please enable location permissions in your browser settings.'
            }))
          } else if (permission.state === 'prompt') {
            setLocation(prev => ({ ...prev, hasPermission: null }))
            setShowLocationPermissionUI(true)
          }

          // Listen for permission changes
          permission.addEventListener('change', () => {
            console.log('🔐 [StudentDashboard] Permission changed to:', permission.state)
            setLocationPermissionStatus(permission.state as any)
            
            if (permission.state === 'granted') {
              setLocation(prev => ({ ...prev, hasPermission: true }))
              setShowLocationPermissionUI(false)
              if (autoLocationEnabled) {
                captureLocationWithPermission()
              }
            } else if (permission.state === 'denied') {
              setLocation(prev => ({ 
                ...prev, 
                hasPermission: false,
                error: 'Location access denied. Please enable location permissions in your browser settings.'
              }))
              setShowLocationPermissionUI(false)
            }
          })
        } else {
          // Fallback for browsers without permissions API
          console.log('⚠️ [StudentDashboard] Permissions API not available, showing permission request UI')
          setShowLocationPermissionUI(true)
        }
      } catch (error) {
        console.error('❌ [StudentDashboard] Error checking permission:', error)
        setLocationPermissionStatus('unknown')
        setShowLocationPermissionUI(true)
      }
    }

    checkLocationPermission()
  }, [autoLocationEnabled])

  // Enhanced location capture with permission handling
  const captureLocationWithPermission = useCallback(async () => {
    if (location.hasPermission === false) {
      console.log('❌ [StudentDashboard] Location permission denied, cannot capture location')
      return
    }

    console.log('🌍 [StudentDashboard] Starting location capture using unified service')
    
    setLocation(prev => ({ ...prev, isLoading: true, error: null }))
    
    try {
      const locationState = await unifiedLocationService.captureLocation({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
        requireFacilityLookup: true,
        cacheKey: 'student-dashboard-location'
      })

      console.log('✅ [StudentDashboard] Location capture completed:', locationState)
      
      setLocation(prev => ({
        ...prev,
        coordinates: locationState.coordinates,
        accuracy: locationState.accuracy,
        accuracyLevel: locationState.accuracyLevel || 'low',
        facility: locationState.facility,
        address: locationState.address,
        isLoading: false,
        error: null,
        lastUpdated: new Date(),
        hasPermission: true
      }))

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to capture location'
      console.error('❌ [StudentDashboard] Location capture failed:', errorMessage)
      
      setLocation(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        lastUpdated: new Date(),
        hasPermission: !errorMessage.includes('denied')
      }))

      // Show user-friendly error messages
      if (errorMessage.includes('denied')) {
        toast.error('Location access denied. Please enable location permissions to use location features.')
      } else if (errorMessage.includes('timeout')) {
        toast.warning('Location request timed out. You can still use manual clock-in/out.')
      }
    }
  }, [location.hasPermission])

  // Original captureLocation function for backward compatibility
  const captureLocation = useCallback(async () => {
    return captureLocationWithPermission()
  }, [captureLocationWithPermission])

  // Handle location permission granted
  const handleLocationPermissionGranted = useCallback(() => {
    console.log('✅ [StudentDashboard] Location permission granted')
    setLocation(prev => ({ ...prev, hasPermission: true }))
    setLocationPermissionStatus('granted')
    setShowLocationPermissionUI(false)
    
    if (autoLocationEnabled) {
      captureLocationWithPermission()
    }
    
    toast.success('Location access granted! Location features are now available.')
  }, [autoLocationEnabled, captureLocationWithPermission])

  // Handle location permission denied
  const handleLocationPermissionDenied = useCallback(() => {
    console.log('❌ [StudentDashboard] Location permission denied')
    setLocation(prev => ({ 
      ...prev, 
      hasPermission: false,
      error: 'Location access denied. You can still use manual clock-in/out.'
    }))
    setLocationPermissionStatus('denied')
    setShowLocationPermissionUI(false)
    
    toast.warning('Location access denied. You can still use manual clock-in/out features.')
  }, [])

  // Manual location refresh
  const refreshLocation = useCallback(() => {
    if (location.hasPermission === true) {
      captureLocationWithPermission()
    } else if (location.hasPermission === null || locationPermissionStatus === 'prompt') {
      setShowLocationPermissionUI(true)
    } else {
      toast.error('Location permission is required. Please enable location access in your browser settings.')
    }
  }, [location.hasPermission, locationPermissionStatus, captureLocationWithPermission])

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 30000) // Update every 30 seconds instead of every second to reduce performance impact

    return () => clearInterval(timer)
  }, [])

  const handleClockIn = async () => {
    if (!selectedSite) {
      toast.error("Please select a clinical site")
      return
    }

    // Location is optional - allow manual clock-in if location is not available
    if (!location.coordinates) {
      toast.warning("Location not available - using manual clock-in")
    }

    try {
      const response = await fetch('/api/student/clock-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clinicalSiteId: selectedSite,
          location: location.coordinates ? {
            latitude: location.coordinates.lat,
            longitude: location.coordinates.lng,
            accuracy: location.accuracy,
          } : null, // Allow null location for manual clock-in
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to clock in')
      }

      const result = await response.json()
      
      if (result.success) {
        setIsClockedIn(true)
        // Refresh dashboard data
        await refetch()
        
        toast.success("Clocked in successfully!", {
          description: location.coordinates 
            ? `Location: ${location.facility || "Unknown Facility"}`
            : "Manual clock-in (location not available)",
        })
      } else {
        throw new Error(result.error || 'Failed to clock in')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to clock in'
      toast.error(errorMessage)
    }
  }

  const handleClockOut = async () => {
    // Location is optional - allow manual clock-out if location is not available
    if (!location.coordinates) {
      toast.warning("Location not available - using manual clock-out")
    }

    try {
      const response = await fetch('/api/student/clock-out', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          location: location.coordinates ? {
            latitude: location.coordinates.lat,
            longitude: location.coordinates.lng,
            accuracy: location.accuracy,
          } : null, // Allow null location for manual clock-out
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to clock out')
      }

      const result = await response.json()
      
      if (result.success) {
        setIsClockedIn(false)
        // Refresh dashboard data
        await refetch()
        
        toast.success("Clocked out successfully!", {
          description: location.coordinates 
            ? `Total hours: ${result.totalHours} hours`
            : `Manual clock-out completed - Total hours: ${result.totalHours} hours`,
        })
      } else {
        throw new Error(result.error || 'Failed to clock out')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to clock out'
      toast.error(errorMessage)
    }
  }

  const getGreeting = () => {
    const hour = currentTime.getHours()
    if (hour < 12) return "Good morning"
    if (hour < 18) return "Good afternoon"
    return "Good evening"
  }

  // Location Display Component removed to resolve continuous loading issues
  // The component was causing performance problems and stuck loading states

  // Calculate progress percentages from real data
  const hoursProgress = data?.statistics.progressPercentage || 0
  const rotationProgress = data?.statistics.rotationProgress || 0

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4" />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-lg border p-6">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-8 bg-gray-200 rounded w-1/2 mb-2" />
                <div className="h-2 bg-gray-200 rounded w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Dashboard</AlertTitle>
          <AlertDescription>
            {error}. Please refresh the page or contact support if the problem persists.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <section className="container mx-auto space-y-6 px-4 sm:px-6 lg:px-8" role="main" aria-labelledby="student-dashboard-title">
      <h1 id="student-dashboard-title" className="sr-only">Student Dashboard</h1>
      <a href="#clock-controls" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-background focus:border focus:rounded-md focus:px-3 focus:py-1">Skip to clock controls</a>
      {/* Welcome Banner */}
      <WelcomeBanner userRole="STUDENT" userName={data?.student.name || "Student"} />

      {/* Swipeable Rotations (Courses) */}
      <div className="md:hidden space-y-3">
        <h3 className="text-lg font-semibold text-foreground">Your Rotations</h3>
        <SwipeableRotationRow sites={(data?.assignedSites || []).map((s) => ({ id: s.id, name: s.name, facilityName: s.name }))} />
      </div>

      {/* Location Permission Handler */}
      {!location.hasPermission && (
        <LocationPermissionHandler
          onLocationGranted={handleLocationPermissionGranted}
          onLocationData={(locationData) => {
            if (locationData) {
              setLocation(prev => ({
                ...prev,
                coordinates: { lat: locationData.latitude, lng: locationData.longitude },
                accuracy: locationData.accuracy,
                lastUpdated: new Date(locationData.timestamp),
                isLoading: false,
                error: null
              }))
            }
          }}
          showPermissionUI={true}
          className="mb-6"
        />
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Enhanced Primary Clock Card - Takes prominence */}
        <Card variant="medical" className="md:col-span-2 lg:col-span-2 shadow-lg hover:shadow-xl transition-all duration-300 w-full" role="region" aria-labelledby="clock-title">
          <CardHeader className="pb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-medical-primary/10 rounded-full">
                  <Clock className="h-8 w-8 text-medical-primary" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-foreground">
                    {isClockedIn ? "Clocked In" : "Clocked Out"}
                  </h3>
                  <p className="text-muted-foreground text-base">
                    {isClockedIn ? "Currently tracking clinical hours" : "Ready to start your session"}
                  </p>
                </div>
              </div>
              <span role="status" aria-live="polite" className="inline-flex">
                <Badge 
                  variant={isClockedIn ? "default" : "secondary"} 
                  className="px-4 py-2 text-base font-semibold"
                >
                  {isClockedIn ? "Active" : "Inactive"}
                </Badge>
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Enhanced Time Display */}
            <motion.div 
              initial={prefersReducedMotion ? false : { scale: 0.95, opacity: 0 }}
              animate={prefersReducedMotion ? {} : { scale: 1, opacity: 1 }}
              className="text-center py-12 bg-gradient-to-br from-card/60 to-card/30 rounded-3xl border border-border/60 backdrop-blur-sm"
            >
              <motion.div 
                key={currentTime.getSeconds()}
                initial={prefersReducedMotion ? false : { opacity: 0, y: -10 }}
                animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
                className="text-8xl font-bold text-foreground mb-6 font-mono tracking-tight"
              >
                {format(currentTime, "HH:mm")}
              </motion.div>
              <motion.div 
                className="text-xl text-muted-foreground font-medium mb-6"
                initial={prefersReducedMotion ? false : { opacity: 0 }}
                animate={prefersReducedMotion ? {} : { opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                {format(currentTime, "EEEE, MMMM d, yyyy")}
              </motion.div>
              <div className="flex justify-center" aria-live="polite" aria-atomic="true">
                  <div className="flex items-center space-x-3 text-sm text-muted-foreground bg-background/50 px-6 py-3 rounded-full border border-border/40">
                    {location.coordinates ? (
                      <>
                        <CheckCircle2 className="h-5 w-5 text-green-600" aria-hidden="true" />
                        <span className="font-medium">Location verified</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-5 w-5 text-yellow-600" aria-hidden="true" />
                        <span className="font-medium">Manual clock-in available</span>
                      </>
                    )}
                  </div>
                </div>
            </motion.div>

            {/* Enhanced Site Selection & Clock Buttons */}
            <div className="space-y-8">
              <motion.div 
                initial={prefersReducedMotion ? false : { opacity: 0, x: -20 }}
                animate={prefersReducedMotion ? {} : { opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Label htmlFor="site-select" className="block text-lg font-semibold mb-4 text-foreground">
                  Clinical Site
                </Label>
                <Select value={selectedSite} onValueChange={setSelectedSite} disabled={isClockedIn}>
                  <SelectTrigger id="site-select" className="w-full text-lg h-14 border-2 border-border/60 focus:border-blue-500 focus:ring-blue-500/20 transition-colors">
                    <MapPin className="h-5 w-5 mr-3 text-muted-foreground" aria-hidden="true" />
                    <SelectValue placeholder="Select a clinical site..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    {data?.assignedSites?.map((site) => (
                      <SelectItem key={site.id} value={site.id} className="text-lg py-4">
                        <div className="flex items-center gap-4">
                          <span className={`w-4 h-4 rounded-full ${
                            site.type === 'hospital' ? 'bg-red-500' :
                            site.type === 'clinic' ? 'bg-blue-500' :
                            site.type === 'research' ? 'bg-purple-500' :
                            'bg-gray-500'
                          }`} aria-hidden="true" />
                          <span className="font-semibold text-lg">{site.name}</span>
                          <span className="text-muted-foreground text-base">({site.type})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </motion.div>
              
              <motion.div 
                className="flex items-end"
                initial={prefersReducedMotion ? false : { opacity: 0, x: 20 }}
                animate={prefersReducedMotion ? {} : { opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                {isClockedIn ? (
                  <Button
                    variant="error"
                    onClick={handleClockOut}
                    disabled={isLoading}
                    aria-label="Clock out and end current session"
                    className="w-full shadow-lg transition-all duration-200 hover:shadow-xl h-16 text-xl font-semibold"
                    size="lg"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-4 h-6 w-6 animate-spin" aria-hidden="true" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Square className="mr-4 h-6 w-6" aria-hidden="true" />
                        Clock Out
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    variant="success"
                    onClick={handleClockIn}
                    disabled={isLoading || !selectedSite}
                    aria-label={selectedSiteName ? `Clock in at ${selectedSiteName}` : "Clock in"}
                    className="w-full shadow-lg transition-all duration-200 hover:shadow-xl h-16 text-xl font-semibold"
                    size="lg"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-4 h-6 w-6 animate-spin" aria-hidden="true" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Play className="mr-4 h-6 w-6" aria-hidden="true" />
                        Clock In
                      </>
                    )}
                  </Button>
                )}
              </motion.div>
            </div>

            {/* Location Status */}
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
              animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="p-3 bg-card rounded-lg border border-border"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              <EnhancedLocationDisplay 
                variant="compact"
                showMap={false}
                showDetails={true}
                autoRefresh={true}
                refreshInterval={30000}
                onLocationUpdate={(locationState) => {
                  if (locationState.coordinates) {
                    setLocation(prev => ({
                      ...prev,
                      coordinates: { lat: locationState.coordinates!.latitude, lng: locationState.coordinates!.longitude },
                      accuracy: locationState.accuracy,
                      lastUpdated: locationState.lastUpdated,
                      isLoading: locationState.isLoading,
                      error: locationState.error,
                      hasPermission: locationState.hasPermission
                    }))
                  }
                }}
              />
            </motion.div>
          </CardContent>
        </Card>

        {/* Key Metrics - Positioned below clock system */}
        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-3 md:col-span-2 lg:col-span-2">
          {/* Grades */}
          <Card variant="warning" className="shadow-sm hover:shadow-md transition-all duration-200" role="region" aria-labelledby="metric-grades-title">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle id="metric-grades-title" className="text-base font-semibold text-foreground">Grades</CardTitle>
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/50 rounded-lg">
                <Award className="h-5 w-5 text-yellow-600 dark:text-yellow-400" aria-hidden="true" />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold text-foreground">{data?.student.gpa ?? "N/A"}</div>
              <p className="text-sm text-muted-foreground">Current GPA</p>
            </CardContent>
          </Card>

          {/* Attendance */}
          <Card variant="success" className="shadow-sm hover:shadow-md transition-all duration-200" role="region" aria-labelledby="metric-attendance-title">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle id="metric-attendance-title" className="text-base font-semibold text-foreground">Attendance</CardTitle>
              <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
                <Clock className="h-5 w-5 text-green-600 dark:text-green-400" aria-hidden="true" />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold text-foreground">{data?.statistics.weeklyCount || 0} days</div>
              <p className="text-sm text-muted-foreground">This week</p>
              <div className="mt-2">
                <Progress value={Math.min(100, Math.round(((data?.statistics.weeklyCount || 0) / 5) * 100))} className="h-2" aria-label="Attendance progress" />
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Deadlines */}
          <Card variant="default" className="shadow-sm hover:shadow-md transition-all duration-200" role="region" aria-labelledby="metric-deadlines-title">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle id="metric-deadlines-title" className="text-base font-semibold text-foreground">Upcoming Deadlines</CardTitle>
              <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-base font-semibold text-foreground">
                {data?.student.expectedGraduation ? (
                  <>Expected Graduation: {format(new Date(data.student.expectedGraduation), "MMM d, yyyy")} </>
                ) : (
                  <>No upcoming deadlines</>
                )}
              </div>
              <p className="text-sm text-muted-foreground">Check your schedule for more</p>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Quick Stats */}
      <motion.div 
        className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
        animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card variant="medical" className="shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 min-h-[180px] max-h-[200px] flex flex-col" role="region" aria-labelledby="stat-hours-title">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 px-4 pt-4 flex-shrink-0">
            <CardTitle id="stat-hours-title" className="text-sm sm:text-base font-semibold text-foreground truncate pr-2 leading-tight">
              Total Hours This Week
            </CardTitle>
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex-shrink-0">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            </div>
          </CardHeader>
          <CardContent className="flex flex-col justify-between flex-1 px-4 pb-4 pt-0 min-h-0">
            <div className="flex-1 flex flex-col justify-center">
              <div className="text-2xl sm:text-3xl font-bold text-foreground mb-1 sm:mb-2 leading-none">{data?.statistics.weeklyHours || 0}</div>
              <p className="text-xs sm:text-sm text-blue-600 dark:text-blue-400 font-medium leading-tight truncate">
                {Math.max(0, (data?.student.requiredHours || 0) - (data?.statistics.weeklyHours || 0))} hours remaining
              </p>
            </div>
            <div className="mt-2 sm:mt-3 flex-shrink-0">
              <Progress value={hoursProgress} className="h-2 w-full" />
            </div>
          </CardContent>
        </Card>
        
        <Card variant="success" className="shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 min-h-[180px] max-h-[200px] flex flex-col" role="region" aria-labelledby="stat-required-title">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 px-4 pt-4 flex-shrink-0">
            <CardTitle id="stat-required-title" className="text-sm sm:text-base font-semibold text-foreground truncate pr-2 leading-tight">
              Required Hours Progress
            </CardTitle>
            <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg flex-shrink-0">
              <Target className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" aria-hidden="true" />
            </div>
          </CardHeader>
          <CardContent className="flex flex-col justify-between flex-1 px-4 pb-4 pt-0 min-h-0">
            <div className="flex-1 flex flex-col justify-center">
              <div className="text-2xl sm:text-3xl font-bold text-foreground mb-1 sm:mb-2 leading-none">
                {Math.round(hoursProgress)}%
              </div>
              <p className="text-xs sm:text-sm text-green-600 dark:text-green-400 font-medium leading-tight truncate">
                {data?.student.requiredHours || 0} total hours required
              </p>
            </div>
            <div className="mt-2 sm:mt-3 flex-shrink-0">
              <Progress value={hoursProgress} className="h-2 w-full" />
            </div>
          </CardContent>
        </Card>
        
        <Card variant="default" className="shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 min-h-[180px] max-h-[200px] flex flex-col sm:col-span-2 lg:col-span-1" role="region" aria-labelledby="stat-rotation-title">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 px-4 pt-4 flex-shrink-0">
            <CardTitle id="stat-rotation-title" className="text-sm sm:text-base font-semibold text-foreground truncate pr-2 leading-tight">
              Current Rotation Progress
            </CardTitle>
            <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg flex-shrink-0">
              <Award className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 dark:text-purple-400" aria-hidden="true" />
            </div>
          </CardHeader>
          <CardContent className="flex flex-col justify-between flex-1 px-4 pb-4 pt-0 min-h-0">
            <div className="flex-1 flex flex-col justify-center">
              <div className="text-2xl sm:text-3xl font-bold text-foreground mb-1 sm:mb-2 leading-none">
                {Math.round(rotationProgress)}%
              </div>
              <p className="text-xs sm:text-sm text-purple-600 dark:text-purple-400 font-medium leading-tight truncate" title={data?.currentRotation?.name || "No active rotation"}>
                {data?.currentRotation?.name || "No active rotation"}
              </p>
            </div>
            <div className="mt-2 sm:mt-3 flex-shrink-0">
              <Progress value={rotationProgress} className="h-2 w-full" />
            </div>
          </CardContent>
        </Card>
      </motion.div>
      </div>

      {/* Enhanced Secondary Information Grid */}
      <motion.div 
        className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
        animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        {/* Enhanced Current Rotation */}
        <Card variant="medical" className="shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 h-full" role="region" aria-labelledby="current-rotation-title">
          <CardHeader>
            <CardTitle id="current-rotation-title" className="flex items-center gap-3 text-foreground text-xl font-bold">
              <Calendar className="h-6 w-6 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              Current Rotation
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col justify-between h-[calc(100%-80px)]">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="font-bold text-xl text-foreground truncate">{data?.currentRotation?.name || "No active rotation"}</div>
                <Badge className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800 text-base flex-shrink-0">
                  Active
                </Badge>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-base text-muted-foreground">
                  <MapPin className="h-5 w-5 text-blue-500 dark:text-blue-400 flex-shrink-0" aria-hidden="true" />
                  <span className="font-medium truncate">{data?.currentRotation?.clinicalSite?.name || "No site assigned"}</span>
                </div>
                <div className="flex items-center gap-3 text-base text-muted-foreground">
                  <Building2 className="h-5 w-5 text-blue-500 dark:text-blue-400 flex-shrink-0" aria-hidden="true" />
                  <span className="font-medium">{data?.currentRotation?.specialty || "General"}</span>
                </div>
              </div>
            </div>
            <div className="pt-3">
              <Progress value={rotationProgress} className="h-3" />
              <p className="text-sm text-blue-600 dark:text-blue-400 mt-2 font-semibold">
                {Math.round(rotationProgress)}% complete
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Enhanced Recent Activity */}
        <Card variant="success" className="shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 h-full" role="region" aria-labelledby="recent-activity-title">
          <CardHeader>
            <CardTitle id="recent-activity-title" className="flex items-center gap-3 text-foreground text-xl font-bold">
              <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" aria-hidden="true" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col justify-between h-[calc(100%-80px)]">
            <div className="space-y-4">
              {data?.recentTimeRecords?.slice(0, 3).map((record, index) => (
                <motion.div 
                  key={record.id} 
                  className="flex items-center justify-between p-4 bg-card rounded-lg border border-border hover:border-green-200 dark:hover:border-green-800 transition-all duration-200"
                  initial={prefersReducedMotion ? false : { opacity: 0, x: -20 }}
                  animate={prefersReducedMotion ? {} : { opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={"w-4 h-4 rounded-full bg-blue-500 shadow-sm flex-shrink-0"} aria-hidden="true" />
                    <div className="min-w-0">
                      <div className="text-base font-bold text-foreground truncate">{record.clinicalSite?.name || "Unknown Site"}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <Clock className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                        {format(new Date(record.clockIn), "MMM d")} • {format(new Date(record.clockIn), "HH:mm")}-{record.clockOut ? format(new Date(record.clockOut), "HH:mm") : "--:--"}
                      </div>
                    </div>
                  </div>
                  <Badge className="bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800 text-base flex-shrink-0">
                    {record.totalHours?.toFixed(1) || "0.0"}h
                  </Badge>
                </motion.div>
              ))}
              {data?.recentTimeRecords?.length === 0 && (
                <div className="text-center py-6 text-muted-foreground">
                  <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-50" aria-hidden="true" />
                  <p className="text-base">No recent activity</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Enhanced Academic Overview */}
        <Card variant="warning" className="shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 h-full" role="region" aria-labelledby="academic-overview-title">
          <CardHeader>
            <CardTitle id="academic-overview-title" className="flex items-center gap-3 text-foreground text-xl font-bold">
              <Award className="h-6 w-6 text-yellow-600 dark:text-yellow-400" aria-hidden="true" />
              Academic Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col justify-between h-[calc(100%-80px)]">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-card rounded-lg border border-border">
                  <div className="text-3xl font-bold text-foreground">{data?.student.gpa || "N/A"}</div>
                  <div className="text-sm text-yellow-600 dark:text-yellow-400 font-semibold">GPA</div>
                </div>
                <div className="text-center p-4 bg-card rounded-lg border border-border">
                  <div className="text-3xl font-bold text-green-700 dark:text-green-400">{data?.statistics.completedRotations || 0}</div>
                  <div className="text-sm text-green-600 dark:text-green-400 font-semibold">Completed</div>
                </div>
              </div>
              <div className="p-4 bg-card rounded-lg border border-border">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-base font-semibold text-foreground">Overall Progress</span>
                  <span className="text-base font-bold text-foreground">
                    {data?.statistics.completedRotations || 0}/{data?.student.totalRotations || 0}
                  </span>
                </div>
                <Progress value={rotationProgress} className="h-3" />
                <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-2 font-semibold">
                  {Math.round(rotationProgress)}% complete
                </p>
              </div>
            </div>
            <div className="flex items-center justify-center p-4 bg-green-50 dark:bg-green-950/50 rounded-lg border border-green-200 dark:border-green-800">
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400 mr-3" aria-hidden="true" />
              <span className="text-base font-bold text-green-800 dark:text-green-200">On Track</span>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Mobile Quick Actions */}
      <FloatingActionButton
        actions={[
          {
            label: isClockedIn ? "Clock Out" : "Clock In",
            icon: Clock,
            onClick: () => (isClockedIn ? handleClockOut() : handleClockIn()),
          },
          {
            label: "Add Record",
            icon: FileText,
            onClick: () => router.push("/dashboard/time-tracker"),
          },
          {
            label: "Message Supervisor",
            icon: MessageSquare,
            onClick: () => router.push("/dashboard/messages"),
          },
        ]}
        position={{ bottom: 24, right: 24 }}
      />
    </section>
  )
}