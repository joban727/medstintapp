"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { WelcomeBanner } from "@/components/dashboard/welcome-banner"
import { PageContainer } from "@/components/ui/page-container"
import { DashboardCard } from "@/components/dashboard/shared/dashboard-card"
import { DashboardBackground } from "@/components/dashboard/dashboard-background"
import { StatCard, StatGrid } from "@/components/ui/stat-card"
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
  MessageSquare,
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Label } from "@/components/ui/label"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { useStudentDashboard } from "@/hooks/useStudentDashboard"
import type { StudentDashboardClientProps } from "@/types/dashboard"
import {
  openMapService,
  LocationCoordinates,
  FacilityInfo,
  LocationLookupResult,
} from "@/lib/openmap-service"
import { locationNameService } from "@/lib/location-name-service"
import { debouncedLocationCapture } from "@/lib/location-debouncer"
import { unifiedLocationService } from "@/services/unified-location-service"
import { FloatingActionButton } from "@/components/ui/floating-action-button"
import { SwipeableRotationRow } from "@/components/dashboard/swipeable-rotation-card"
import { EnhancedLocationDisplay } from "@/components/location/enhanced-location-display"
import { LocationPermissionHandler } from "@/components/location/location-permission-handler"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { safeFetchApi } from "@/lib/safe-fetch"
import { ClockServiceClient } from "@/lib/clock-service-client"

// Props interface is imported from types file
const validateEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

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
  accuracyLevel: "high" | "medium" | "low"
  facility: string | null
  address: string | null
  isLoading: boolean
  error: string | null
  lastUpdated: Date | null
  hasPermission: boolean | null
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
    this.data = { location, timestamp: Date.now() }
  },
  clear() {
    this.data = null
  },
}

export default function StudentDashboardClient({ userId }: StudentDashboardClientProps) {
  const { data, isLoading, error, refetch } = useStudentDashboard()
  const router = useRouter()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isClockedIn, setIsClockedIn] = useState(false)
  const [isClockingIn, setIsClockingIn] = useState(false)
  const [isClockingOut, setIsClockingOut] = useState(false)
  const [selectedSite, setSelectedSite] = useState("")
  const [availableSites, setAvailableSites] = useState<
    Array<{ id: string; name: string; type: string; address: string }>
  >([])
  const [sitesLoadError, setSitesLoadError] = useState<string | null>(null)
  const [location, setLocation] = useState<LocationState>({
    coordinates: null,
    accuracy: null,
    accuracyLevel: "low",
    facility: null,
    address: null,
    isLoading: false,
    error: null,
    lastUpdated: null,
    hasPermission: null, // Changed from true to null to properly check permission
    isTracking: false,
  })
  const [showLocationDetails, setShowLocationDetails] = useState(false)
  const [autoLocationEnabled, setAutoLocationEnabled] = useState(true)
  const [locationPermissionStatus, setLocationPermissionStatus] = useState<
    "unknown" | "granted" | "denied" | "prompt"
  >("unknown")
  const [showLocationPermissionUI, setShowLocationPermissionUI] = useState(false)
  const prefersReducedMotion = typeof window !== "undefined" ? useReducedMotion() : false

  const sitesForLabel = availableSites.length > 0 ? availableSites : (data?.assignedSites ?? [])
  const selectedSiteName =
    sitesForLabel.find((s) => s.id === selectedSite)?.name ?? data?.currentRotation?.siteName ?? ""

  // Check if we're in development environment
  const isDevelopment = process.env.NODE_ENV === "development"

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
      setSelectedSite(String(data.currentRotation.clinicalSiteId))
    }
  }, [data?.currentRotation])

  // Populate available sites from dashboard or fallback to API filtered by student
  useEffect(() => {
    if (data?.assignedSites && data.assignedSites.length > 0) {
      setAvailableSites(
        data.assignedSites.map((s: any) => ({
          id: String(s.id),
          name: s.name,
          type: s.type,
          address: s.address,
        }))
      )
      setSitesLoadError(null)
      console.info("[StudentDashboard] assignedSites loaded:", data.assignedSites.length)
      return
    }

    // Fallback: fetch available sites linked to the student's school assignments
    const controller = new AbortController()
    const fetchAvailableSites = async () => {
      try {
        const response = await safeFetchApi("/api/sites/available", {
          signal: controller.signal,
        })

        if (!response.success) {
          setSitesLoadError(
            response.error === "Unauthorized"
              ? "You are signed out or lack access. Please sign in."
              : `Failed to load available sites: ${response.error || "Unknown error"}`
          )
          return
        }

        const sitesPayload = (response.data?.sites || []) as Array<any>
        const sites = sitesPayload.map((s) => ({
          id: String(s.id ?? s.siteId),
          name: s.name ?? s.siteName,
          type: s.type ?? s.siteType,
          address: s.address ?? s.siteAddress,
        }))

        if (!controller.signal.aborted) {
          setAvailableSites(sites)
        }

        if (sites.length === 0) {
          setSitesLoadError("No active clinical site assignments found for your account.")
          console.info("[StudentDashboard] fallback availableSites returned empty for user")
        } else {
          setSitesLoadError(null)
        }
        console.info("[StudentDashboard] fallback availableSites loaded:", sites.length)
      } catch (_err: any) {
        if (controller.signal.aborted) return
        if (_err?.name === "AbortError") return
        setSitesLoadError("Unexpected error while loading available sites.")
      }
    }

    fetchAvailableSites()
    return () => {
      controller.abort()
    }
  }, [data?.assignedSites])

  // If no current rotation, preselect first available site
  useEffect(() => {
    if (!data?.currentRotation?.clinicalSiteId && !selectedSite && availableSites.length > 0) {
      setSelectedSite(availableSites[0].id)
    }
  }, [availableSites, data?.currentRotation?.clinicalSiteId, selectedSite])

  // Log permission UI state changes for verification
  useEffect(() => {
    console.info("[StudentDashboard] location permission state:", {
      hasPermission: location.hasPermission,
      permissionStatus: locationPermissionStatus,
      showPermissionUI: showLocationPermissionUI,
    })
  }, [location.hasPermission, locationPermissionStatus, showLocationPermissionUI])

  // Check location permission on component mount
  useEffect(() => {
    const checkLocationPermission = async () => {
      console.log("🔐 [StudentDashboard] Checking location permission status...")
      if (!navigator.geolocation) {
        console.log("❌ [StudentDashboard] Geolocation not supported")
        setLocation((prev) => ({
          ...prev,
          hasPermission: false,
          error: "Geolocation not supported by this browser",
        }))
        setLocationPermissionStatus("denied")
        return
      }

      try {
        if ("permissions" in navigator) {
          const permission = await navigator.permissions.query({ name: "geolocation" })
          console.log("🔐 [StudentDashboard] Permission status:", permission.state)
          setLocationPermissionStatus(permission.state as PermissionState)

          if (permission.state === "granted") {
            setLocation((prev) => ({ ...prev, hasPermission: true }))
            // Auto-capture location if permission is already granted
            if (autoLocationEnabled) {
              captureLocationWithPermission()
            }
          } else if (permission.state === "denied") {
            setLocation((prev) => ({
              ...prev,
              hasPermission: false,
              error:
                "Location access denied. Please enable location permissions in your browser settings.",
            }))
          } else if (permission.state === "prompt") {
            setLocation((prev) => ({ ...prev, hasPermission: null }))
            setShowLocationPermissionUI(true)
          }

          // Listen for permission changes
          permission.addEventListener("change", () => {
            console.log("🔐 [StudentDashboard] Permission changed to:", permission.state)
            setLocationPermissionStatus(permission.state as PermissionState)
            if (permission.state === "granted") {
              setLocation((prev) => ({ ...prev, hasPermission: true }))
              setShowLocationPermissionUI(false)
              if (autoLocationEnabled) {
                captureLocationWithPermission()
              }
            } else if (permission.state === "denied") {
              setLocation((prev) => ({
                ...prev,
                hasPermission: false,
                error:
                  "Location access denied. Please enable location permissions in your browser settings.",
              }))
              setShowLocationPermissionUI(false)
            }
          })
        } else {
          // Fallback for browsers without permissions API
          console.log(
            "⚠️ [StudentDashboard] Permissions API not available, showing permission request UI"
          )
          setShowLocationPermissionUI(true)
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred"
        console.error("[StudentDashboardClient] Operation failed:", error)
        toast.error(errorMessage)
      }
    }

    checkLocationPermission()
  }, [autoLocationEnabled])

  // Enhanced location capture with permission handling
  const captureLocationWithPermission = useCallback(async () => {
    if (location.hasPermission === false) {
      console.log("❌ [StudentDashboard] Location permission denied, cannot capture location")
      return
    }

    console.log("🌍 [StudentDashboard] Starting location capture using unified service")
    setLocation((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      const locationState = await unifiedLocationService.captureLocation({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
        requireFacilityLookup: true,
        cacheKey: "student-dashboard-location",
      })

      console.log("✅ [StudentDashboard] Location capture completed:", locationState)
      // Normalize coordinates to local shape { lat, lng }
      const normalizedCoords = locationState.coordinates
        ? { lat: locationState.coordinates.latitude, lng: locationState.coordinates.longitude }
        : null

      // Resolve display-friendly facility name/address
      let facilityName: string | null = null
      let facilityAddress: string | null = null

      if (locationState.facility) {
        facilityName = locationState.facility.name || null
        facilityAddress = locationState.facility.address || null
      } else if (normalizedCoords) {
        try {
          const displayInfo = await locationNameService.getLocationDisplayName({
            latitude: normalizedCoords.lat,
            longitude: normalizedCoords.lng,
          })
          facilityName = displayInfo.displayName
          facilityAddress = displayInfo.details?.fullAddress || null
        } catch (_err) {
          // Non-blocking: ignore name service errors
        }
      }

      setLocation((prev) => ({
        ...prev,
        coordinates: normalizedCoords,
        accuracy: locationState.accuracy,
        accuracyLevel: locationState.accuracyLevel || "low",
        facility: facilityName,
        address: facilityAddress,
        isLoading: false,
        error: null,
        lastUpdated: new Date(),
        hasPermission: true,
      }))
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to capture location"
      console.error("❌ [StudentDashboard] Location capture failed:", errorMessage)
      setLocation((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        lastUpdated: new Date(),
        hasPermission: !errorMessage.includes("denied"),
      }))

      // Show user-friendly error messages
      if (errorMessage.includes("denied")) {
        toast.error(
          "Location access denied. Please enable location permissions to use location features."
        )
      } else if (errorMessage.includes("timeout")) {
        toast.warning("Location request timed out. You can still use manual clock-in/out.")
      }
    }
  }, [location.hasPermission])

  // Original captureLocation function for backward compatibility
  const captureLocation = useCallback(async () => {
    return captureLocationWithPermission()
  }, [captureLocationWithPermission])

  // Handle location permission granted
  const handleLocationPermissionGranted = useCallback(
    (granted?: boolean) => {
      const isGranted = granted === undefined ? true : Boolean(granted)
      console.log(`✅ [StudentDashboard] Location permission ${isGranted ? "granted" : "denied"}`)
      setLocation((prev) => ({ ...prev, hasPermission: isGranted }))
      setLocationPermissionStatus(isGranted ? "granted" : "denied")
      setShowLocationPermissionUI(!isGranted)
      if (isGranted && autoLocationEnabled) {
        captureLocationWithPermission()
      }
      const notify = isGranted ? toast.success : toast.warning
      notify(
        isGranted
          ? "Location access granted! Location features are now available."
          : "Location access denied. You can still use manual clock-in/out."
      )
    },
    [autoLocationEnabled, captureLocationWithPermission]
  )

  // Handle location permission denied
  const handleLocationPermissionDenied = useCallback(() => {
    console.log("❌ [StudentDashboard] Location permission denied")
    setLocation((prev) => ({
      ...prev,
      hasPermission: false,
      error: "Location access denied. You can still use manual clock-in/out.",
    }))
    setLocationPermissionStatus("denied")
    setShowLocationPermissionUI(false)
    toast.warning("Location access denied. You can still use manual clock-in/out features.")
  }, [])

  // Manual location refresh
  const refreshLocation = useCallback(() => {
    if (location.hasPermission === true) {
      captureLocationWithPermission()
    } else if (location.hasPermission === null || locationPermissionStatus === "prompt") {
      setShowLocationPermissionUI(true)
    } else {
      toast.error(
        "Location permission is required. Please enable location access in your browser settings."
      )
    }
  }, [location.hasPermission, locationPermissionStatus, captureLocationWithPermission])

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 30000) // Update every 30 seconds instead of every second to reduce performance impact

    return () => clearInterval(timer)
  }, [])

  const handleClockIn = async () => {
    if (!data?.currentRotation?.id && !selectedSite) {
      toast.error("Select a clinical site linked to your school")
      return
    }

    // Location is optional - allow manual clock-in if location is not available
    if (!location.coordinates) {
      toast.warning("Location not available - using manual clock-in")
    }

    try {
      setIsClockingIn(true)

      const requestData: any = {
        timestamp: new Date().toISOString(),
        clientTimestamp: new Date().toISOString(),
        notes: "",
        locationSource: location.coordinates ? "gps" : "manual",
      }

      if (location.coordinates) {
        requestData.location = {
          latitude: location.coordinates.lat,
          longitude: location.coordinates.lng,
          accuracy: location.accuracy as number,
          timestamp: new Date().toISOString(),
        }
      }

      if (data?.currentRotation?.id) {
        requestData.rotationId = data.currentRotation.id
      } else if (selectedSite) {
        requestData.siteId = selectedSite
      }

      const result = await ClockServiceClient.clockIn(requestData)

      setIsClockedIn(true)
      // Refresh dashboard data
      await refetch()

      // Check if it was an offline operation (optimistic)
      if (result.recordId && result.recordId.startsWith('offline-')) {
        toast.success("Clock-in queued (Offline)", {
          description: "Your clock-in has been saved and will sync when you are back online.",
        })
      } else {
        toast.success("Clocked in successfully!", {
          description: location.coordinates
            ? `Location: ${location.facility || "Unknown Facility"}`
            : "Manual clock-in (location not available)",
        })
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to clock in"

      // Handle specific error messages if needed, similar to before
      let friendly = errorMessage
      if (errorMessage.includes("already clocked in")) friendly = "You are already clocked in."
      else if (errorMessage.includes("Too far")) friendly = "You appear too far from the clinical site."

      toast.error(friendly)
    } finally {
      setIsClockingIn(false)
    }
  }

  const handleClockOut = async () => {
    // Location is optional - allow manual clock-out if location is not available
    if (!location.coordinates) {
      toast.warning("Location not available - using manual clock-out")
    }

    try {
      setIsClockingOut(true)

      const requestData: any = {
        studentId: userId, // ClockServiceClient might need this or infer it, but passing it is safe if we have it
        timestamp: new Date().toISOString(),
        clientTimestamp: new Date().toISOString(),
        locationSource: location.coordinates ? "gps" : "manual",
      }

      if (location.coordinates) {
        requestData.location = {
          latitude: location.coordinates.lat,
          longitude: location.coordinates.lng,
          accuracy: location.accuracy,
          timestamp: new Date().toISOString(),
        }
      }

      const result = await ClockServiceClient.clockOut(requestData)

      setIsClockedIn(false)
      // Refresh dashboard data
      await refetch()

      if (result.recordId && result.recordId.startsWith('offline-')) {
        toast.success("Clock-out queued (Offline)", {
          description: "Your clock-out has been saved and will sync when you are back online.",
        })
      } else {
        toast.success("Clocked out successfully!", {
          description: `Total hours: ${result.totalHours || '0.00'} hours`,
        })
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to clock out"
      toast.error(errorMessage)
    } finally {
      setIsClockingOut(false)
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
      <div className="gap-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded-md w-1/4 mb-4" />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card rounded-lg border p-6">
                <div className="h-4 bg-muted rounded-md w-3/4 mb-2" />
                <div className="h-8 bg-muted rounded-md w-1/2 mb-2" />
                <div className="h-2 bg-muted rounded-md w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Error state
  // Render through error with non-blocking alert to allow fallbacks
  const renderErrorAlert = error ? (
    <div className="gap-6 mb-4">
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error Loading Dashboard</AlertTitle>
        <AlertDescription>
          {error}. Some features may be limited; fallback data will be used where possible.
        </AlertDescription>
      </Alert>
    </div>
  ) : null

  return (
    <PageContainer className="gap-6" maxWidth="2xl">
      <h1 id="student-dashboard-title" className="sr-only">
        Student Dashboard
      </h1>
      <a
        href="#clock-controls"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-background focus:border focus:rounded-md focus:px-3 focus:py-1"
      >
        Skip to clock controls
      </a>

      <div className="relative min-h-screen w-full">
        <DashboardBackground />

        <div className="relative z-10 space-y-6">
          {/* Welcome Banner */}
          <WelcomeBanner userRole="STUDENT" userName={data?.student.name || "Student"} />

          {/* Swipeable Rotations (Courses) */}
          <div className="md:hidden gap-3">
            <h3 className="text-lg font-semibold text-foreground">Your Rotations</h3>
            <SwipeableRotationRow
              sites={(data?.assignedSites || []).map((s) => ({
                id: s.id,
                name: s.name,
                facilityName: s.name,
              }))}
            />
          </div>

          {/* Location Permission Handler */}
          {(!location.hasPermission || showLocationPermissionUI) && (
            <LocationPermissionHandler
              onLocationGranted={handleLocationPermissionGranted}
              onLocationData={(locationData) => {
                if (locationData) {
                  setLocation((prev) => ({
                    ...prev,
                    coordinates: { lat: locationData.latitude, lng: locationData.longitude },
                    accuracy: locationData.accuracy,
                    lastUpdated: new Date(locationData.timestamp),
                    isLoading: false,
                    error: null,
                  }))
                }
              }}
              showPermissionUI={showLocationPermissionUI || !location.hasPermission}
              className="mb-6"
            />
          )}

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 stagger-children">
            {/* Enhanced Primary Clock Card - Takes prominence */}
            <DashboardCard
              variant="premium"
              className="md:col-span-2 lg:col-span-2 shadow-lg rounded-xl w-full relative overflow-hidden gradient-overlay-blue"
              role="region"
              aria-labelledby="clock-title"
            >
              <CardHeader className="pb-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="icon-container icon-container-blue">
                      <Clock className="h-7 w-7" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-foreground">
                        {isClockedIn ? "Clocked In" : "Clocked Out"}
                      </h3>
                      <p className="text-muted-foreground text-base">
                        {isClockedIn
                          ? "Currently tracking clinical hours"
                          : "Ready to start your session"}
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
              <CardContent className="gap-8">
                {/* Enhanced Time Display */}
                <motion.div
                  initial={prefersReducedMotion ? false : { scale: 0.95, opacity: 0 }}
                  animate={prefersReducedMotion ? {} : { scale: 1, opacity: 1 }}
                  className="clock-hero text-center py-12 bg-gradient-to-br from-card/60 to-card/30 rounded-xl border border-border/60 backdrop-blur-sm"
                >
                  <motion.div
                    key={currentTime.getSeconds()}
                    initial={prefersReducedMotion ? false : { opacity: 0, y: -10 }}
                    animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
                    className="text-6xl sm:text-7xl md:text-8xl font-bold text-foreground mb-6 font-mono tracking-tight"
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
                    <div className="flex items-center gap-3 text-lg text-muted-foreground">
                      <span>
                        {getGreeting()}, {data?.student.name || "Student"}
                      </span>
                    </div>
                  </div>
                </motion.div>

                {/* Clock Controls */}
                <div id="clock-controls" className="gap-6">
                  {/* Site Selection */}
                  {availableSites.length > 0 && (
                    <div className="gap-3">
                      <Label htmlFor="site-select" className="text-base font-semibold text-foreground">
                        Select Clinical Site
                      </Label>
                      <Select value={selectedSite} onValueChange={setSelectedSite}>
                        <SelectTrigger
                          id="site-select"
                          className="w-full text-base"
                          aria-describedby="site-select-description"
                        >
                          <SelectValue placeholder="Choose your clinical site" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableSites.map((site) => (
                            <SelectItem key={site.id} value={site.id} className="text-base">
                              <div className="flex flex-col">
                                <span className="font-medium">{site.name}</span>
                                <span className="text-sm text-muted-foreground">{site.type}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p id="site-select-description" className="text-sm text-muted-foreground">
                        Select the clinical site where you'll be working today
                      </p>
                    </div>
                  )}

                  {availableSites.length === 0 && !isLoading && (
                    <Alert className="mt-2">
                      <AlertTitle>No Clinical Sites Available</AlertTitle>
                      <AlertDescription>
                        {sitesLoadError ||
                          (error
                            ? `Failed to load dashboard data: ${error}`
                            : data?.student?.school?.id
                              ? "We couldn’t find any active site assignments. Check assignment status and start/end dates in the School Admin system."
                              : "Your account has no school assigned. Please contact your School Admin to link your school.")}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Current Rotation Display */}
                  {data?.currentRotation && (
                    <div className="gap-3 p-4 bg-muted/50 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <Building2 className="h-5 w-5 text-medical-primary" />
                        <div>
                          <h4 className="font-semibold text-foreground">Current Rotation</h4>
                          <p className="text-muted-foreground">{data.currentRotation.siteName}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Clock Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Button
                      onClick={isClockedIn ? handleClockOut : handleClockIn}
                      size="lg"
                      variant={isClockedIn ? "destructive" : "default"}
                      className="flex-1 text-lg py-6 font-semibold"
                      disabled={
                        (!data?.currentRotation?.id && !selectedSite) || isClockingIn || isClockingOut
                      }
                    >
                      {isClockedIn ? (
                        <>
                          <Square className="mr-3 h-6 w-6" />
                          Clock Out
                        </>
                      ) : (
                        <>
                          <Play className="mr-3 h-6 w-6" />
                          Clock In
                        </>
                      )}
                    </Button>

                    {location.hasPermission && (
                      <Button
                        onClick={refreshLocation}
                        variant="outline"
                        size="lg"
                        className="text-lg py-6"
                        disabled={location.isLoading}
                      >
                        {location.isLoading ? (
                          <Loader2 className="mr-3 h-6 w-6 animate-spin" />
                        ) : (
                          <Navigation className="mr-3 h-6 w-6" />
                        )}
                        Refresh Location
                      </Button>
                    )}
                  </div>

                  {/* Location Status */}
                  {location.hasPermission && (
                    <div className="gap-3 p-4 bg-muted/30 rounded-lg border">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <MapPin className="h-5 w-5 text-medical-primary" />
                          <div>
                            <h4 className="font-semibold text-foreground">Location Status</h4>
                            <p className="text-sm text-muted-foreground">
                              {location.coordinates
                                ? `${location.facility || "Unknown Facility"} • ${location.accuracyLevel} accuracy`
                                : location.error || "Location not available"}
                            </p>
                          </div>
                        </div>
                        <Badge variant={location.coordinates ? "default" : "secondary"}>
                          {location.coordinates ? "Located" : "Unavailable"}
                        </Badge>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </DashboardCard>

            {/* Progress Cards */}
            <div className="gap-6">
              {/* Hours Progress */}
              <DashboardCard variant="glass" className="card-hover-lift rounded-xl relative overflow-hidden gradient-overlay-blue">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="icon-container icon-container-blue">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Clinical Hours</CardTitle>
                      <CardDescription>Progress toward requirement</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="gap-4">
                    <div className="flex justify-between items-center">
                      <span className="text-3xl font-bold text-foreground animate-stat-value">
                        {data?.student.totalClinicalHours || 0}
                      </span>
                      <span className="text-muted-foreground">
                        / {data?.statistics.totalRequiredHours || 0} hours
                      </span>
                    </div>
                    <Progress value={hoursProgress} className="h-3" />
                    <p className="text-sm text-muted-foreground">
                      {Math.round(hoursProgress)}% complete
                    </p>
                  </div>
                </CardContent>
              </DashboardCard>

              {/* Rotation Progress */}
              <DashboardCard variant="glass" className="card-hover-lift rounded-xl relative overflow-hidden gradient-overlay-green">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="icon-container icon-container-green">
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Rotations</CardTitle>
                      <CardDescription>Completed rotations</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="gap-4">
                    <div className="flex justify-between items-center">
                      <span className="text-3xl font-bold text-foreground animate-stat-value">
                        {data?.student.completedRotations || 0}
                      </span>
                      <span className="text-muted-foreground">
                        / {data?.statistics.totalRotations || 0} rotations
                      </span>
                    </div>
                    <Progress value={rotationProgress} className="h-3" />
                    <p className="text-sm text-muted-foreground">
                      {Math.round(rotationProgress)}% complete
                    </p>
                  </div>
                </CardContent>
              </DashboardCard>

              {/* Time Records Link */}
              <div className="flex justify-end">
                <Link href="/dashboard/student/time-records" className="underline text-sm">
                  View all time records
                </Link>
                <Button
                  variant="link"
                  aria-label="Open time records"
                  className="ml-2 text-sm"
                  onClick={() => router.push("/dashboard/student/time-records")}
                >
                  Open
                </Button>
              </div>
            </div>
          </div>

          {/* Recent Time Records */}
          {data?.recentTimeRecords && data.recentTimeRecords.length > 0 && (
            <DashboardCard variant="glass" className="rounded-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <FileText className="h-5 w-5" />
                  Recent Time Records
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="gap-4">
                  {data.recentTimeRecords.slice(0, 5).map((record, index) => (
                    <div
                      key={index}
                      className="list-item-interactive flex items-center gap-4 p-3 rounded-lg border"
                    >
                      <div className="p-2 bg-muted rounded-full">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-foreground">
                          {record.clockOut
                            ? `Clocked out${record.siteName ? ` from ${record.siteName}` : ""}`
                            : `Clocked in${record.siteName ? ` at ${record.siteName}` : ""}`}
                          {typeof record.totalHours === "number" ? ` • ${record.totalHours}h` : ""}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {format(
                            new Date(record.clockOut || record.clockIn || record.date),
                            "MMM d, yyyy 'at' h:mm a"
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </DashboardCard>
          )}

          {/* Floating Action Button for Quick Actions */}
          <FloatingActionButton
            actions={[
              {
                icon: isClockedIn ? Square : Play,
                label: isClockedIn ? "Clock Out" : "Clock In",
                onClick: isClockedIn ? handleClockOut : handleClockIn,
                variant: isClockedIn ? "destructive" : "default",
              },
              {
                icon: Navigation,
                label: "Refresh Location",
                onClick: refreshLocation,
                disabled: location.isLoading || !location.hasPermission,
              },
              {
                icon: MessageSquare,
                label: "Support",
                onClick: () => router.push("/support"),
              },
            ]}
          />
        </div>
      </div>
    </PageContainer>
  )
}
