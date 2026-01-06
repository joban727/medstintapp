"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { format } from "date-fns"
import {
  Clock,
  MapPin,
  Calendar,
  BookOpen,
  Play,
  Square,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Building2,
  Navigation,
  TrendingUp,
  FileText,
  ChevronRight,
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
import { cn } from "@/lib/utils"
import { useStudentDashboard } from "@/hooks/useStudentDashboard"
import type { StudentDashboardClientProps } from "@/types/dashboard"
import { unifiedLocationService } from "@/services/unified-location-service"
import { locationNameService } from "@/lib/location-name-service"
import { LocationPermissionHandler } from "@/components/location/location-permission-handler"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { safeFetchApi } from "@/lib/safe-fetch"
import { ClockServiceClient } from "@/lib/clock-service-client"
import { DashboardBackground } from "@/components/dashboard/dashboard-background"
import { SpotlightCard } from "@/components/ui/spotlight-card"

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
    hasPermission: null,
    isTracking: false,
  })
  const [showLocationPermissionUI, setShowLocationPermissionUI] = useState(false)
  const [locationPermissionStatus, setLocationPermissionStatus] = useState<
    "unknown" | "granted" | "denied" | "prompt"
  >("unknown")
  const [autoLocationEnabled, setAutoLocationEnabled] = useState(false) // Deferred until clock-in

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

  // Populate available sites from main dashboard API response (no redundant fetch)
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
    } else if (data && !data.assignedSites?.length) {
      setSitesLoadError("No active clinical site assignments found for your account.")
    }
  }, [data?.assignedSites, data])

  // Preselect first available site
  useEffect(() => {
    if (!data?.currentRotation?.clinicalSiteId && !selectedSite && availableSites.length > 0) {
      setSelectedSite(availableSites[0].id)
    }
  }, [availableSites, data?.currentRotation?.clinicalSiteId, selectedSite])

  // Check location permission on mount
  useEffect(() => {
    const checkLocationPermission = async () => {
      if (!navigator.geolocation) {
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
          setLocationPermissionStatus(permission.state as PermissionState)

          if (permission.state === "granted") {
            setLocation((prev) => ({ ...prev, hasPermission: true }))
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

          permission.addEventListener("change", () => {
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
                error: "Location access denied.",
              }))
              setShowLocationPermissionUI(false)
            }
          })
        } else {
          setShowLocationPermissionUI(true)
        }
      } catch (error) {
        console.error("[StudentDashboard] Permission check failed:", error)
      }
    }

    checkLocationPermission()
  }, [autoLocationEnabled])

  // Enhanced location capture
  const captureLocationWithPermission = useCallback(async () => {
    if (location.hasPermission === false) return

    setLocation((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      const locationState = await unifiedLocationService.captureLocation({
        enableHighAccuracy: true,
        timeout: 5000, // Reduced from 15s for faster perceived load
        maximumAge: 120000, // Increased cache age to reduce GPS calls
        requireFacilityLookup: true,
        cacheKey: "student-dashboard-location",
      })

      const normalizedCoords = locationState.coordinates
        ? { lat: locationState.coordinates.latitude, lng: locationState.coordinates.longitude }
        : null

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
          /* ignore */
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
      setLocation((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        lastUpdated: new Date(),
        hasPermission: !errorMessage.includes("denied"),
      }))
    }
  }, [location.hasPermission])

  const handleLocationPermissionGranted = useCallback(
    (granted?: boolean) => {
      const isGranted = granted === undefined ? true : Boolean(granted)
      setLocation((prev) => ({ ...prev, hasPermission: isGranted }))
      setLocationPermissionStatus(isGranted ? "granted" : "denied")
      setShowLocationPermissionUI(!isGranted)
      if (isGranted && autoLocationEnabled) {
        captureLocationWithPermission()
      }
      const notify = isGranted ? toast.success : toast.warning
      notify(
        isGranted
          ? "Location access granted!"
          : "Location access denied. You can still use manual clock-in/out."
      )
    },
    [autoLocationEnabled, captureLocationWithPermission]
  )

  const refreshLocation = useCallback(() => {
    if (location.hasPermission === true) {
      captureLocationWithPermission()
    } else if (location.hasPermission === null || locationPermissionStatus === "prompt") {
      setShowLocationPermissionUI(true)
    } else {
      toast.error("Location permission is required.")
    }
  }, [location.hasPermission, locationPermissionStatus, captureLocationWithPermission])

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 30000)
    return () => clearInterval(timer)
  }, [])

  const handleClockIn = async () => {
    if (!data?.currentRotation?.id && !selectedSite) {
      toast.error("Select a clinical site linked to your school")
      return
    }

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
      await refetch()

      if (result.recordId && result.recordId.startsWith("offline-")) {
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
      let friendly = errorMessage
      if (errorMessage.includes("already clocked in")) friendly = "You are already clocked in."
      else if (errorMessage.includes("Too far"))
        friendly = "You appear too far from the clinical site."
      toast.error(friendly)
    } finally {
      setIsClockingIn(false)
    }
  }

  const handleClockOut = async () => {
    if (!location.coordinates) {
      toast.warning("Location not available - using manual clock-out")
    }

    try {
      setIsClockingOut(true)

      const requestData: any = {
        studentId: userId,
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
      await refetch()

      if (result.recordId && result.recordId.startsWith("offline-")) {
        toast.success("Clock-out queued (Offline)", {
          description: "Your clock-out has been saved and will sync when you are back online.",
        })
      } else {
        toast.success("Clocked out successfully!", {
          description: `Total hours: ${result.totalHours || "0.00"} hours`,
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

  // Calculate progress
  const hoursProgress = data?.statistics.progressPercentage || 0
  const rotationProgress = data?.statistics.rotationProgress || 0

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass-card p-6 rounded-xl">
              <div className="h-4 bg-white/10 rounded w-1/2 mb-2" />
              <div className="h-8 bg-white/10 rounded w-3/4" />
            </div>
          ))}
        </div>
        <div className="glass-card p-8 rounded-xl">
          <div className="h-32 bg-white/10 rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-[calc(100vh-10rem)] overflow-hidden pb-8">
      {/* Animated Background */}
      <DashboardBackground theme={isClockedIn ? "green" : "blue"} />

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="mb-6 border-white/10 bg-white/5 backdrop-blur-xl">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      <div className="flex flex-col lg:flex-row gap-6 h-full">
        {/* Left: Clock Hero Panel */}
        <div className="flex-1 flex flex-col">
          {/* Clock Card - Spotlight Style */}
          <SpotlightCard
            className="flex-1 rounded-2xl border-white/10 bg-white/5"
            spotlightColor={isClockedIn ? "rgba(34, 197, 94, 0.1)" : "rgba(59, 130, 246, 0.1)"}
          >
            {/* Status Bar */}
            <div
              className={cn(
                "h-1 w-full",
                isClockedIn
                  ? "bg-gradient-to-r from-green-500/50 via-green-400 to-green-500/50"
                  : "bg-gradient-to-r from-white/5 via-white/10 to-white/5"
              )}
            />

            {/* Clock Content */}
            <div className="relative z-10 flex flex-col items-center justify-center p-8 lg:p-12 h-full">
              {/* Greeting */}
              <div className="text-white/50 text-sm font-light mb-2 tracking-wider">
                {getGreeting()}, ready to track your clinical hours
              </div>

              {/* Giant Clock */}
              <div className="relative mb-4">
                <div
                  className="text-7xl lg:text-8xl font-bold text-white font-mono tracking-tight"
                  style={{ textShadow: "0 0 60px rgba(255,255,255,0.1)" }}
                >
                  {format(currentTime, "HH")}
                  <span className="text-white/40 animate-pulse">:</span>
                  {format(currentTime, "mm")}
                </div>
                <div className="text-center text-xs text-white/30 font-mono mt-1">
                  {format(currentTime, "ss")}s
                </div>
              </div>

              {/* Date */}
              <div className="text-white/40 text-sm mb-8">
                {format(currentTime, "EEEE, MMMM d, yyyy")}
              </div>

              {/* Info Row - Simplified Text */}
              <div className="flex items-center justify-center gap-6 mb-8 text-sm">
                {(data?.currentRotation?.siteName || selectedSite) && (
                  <div className="flex items-center gap-2 text-white/60">
                    <Building2 className="h-4 w-4" />
                    <span>
                      {data?.currentRotation?.siteName ||
                        availableSites.find((s) => s.id === selectedSite)?.name ||
                        "Select Site"}
                    </span>
                  </div>
                )}
                {location.hasPermission && location.coordinates && (
                  <div className="flex items-center gap-2 text-green-400/70">
                    <MapPin className="h-4 w-4" />
                    <span>GPS Verified</span>
                  </div>
                )}
              </div>

              {/* Site Selector */}
              {!data?.currentRotation && availableSites.length > 0 && (
                <div className="w-full max-w-sm mb-6">
                  <Select value={selectedSite} onValueChange={setSelectedSite}>
                    <SelectTrigger className="h-12 rounded-full border-white/10 bg-white/5 backdrop-blur-xl text-white/80">
                      <SelectValue placeholder="Select your clinical site..." />
                    </SelectTrigger>
                    <SelectContent className="glass-dropdown">
                      {availableSites.map((site) => (
                        <SelectItem key={site.id} value={site.id}>
                          <span>{site.name}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Clock Button - Magnetic Style */}
              <button
                onClick={isClockedIn ? handleClockOut : handleClockIn}
                disabled={
                  (!data?.currentRotation?.id && !selectedSite) || isClockingIn || isClockingOut
                }
                className={cn(
                  "relative px-10 py-4 rounded-full text-lg font-medium",
                  "border backdrop-blur-xl transition-all duration-300 ease-out",
                  "transform hover:scale-[1.03] active:scale-[0.98]",
                  "disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none",
                  "group overflow-hidden",
                  isClockedIn
                    ? "border-white/10 bg-white/5 text-white hover:bg-white/10"
                    : "border-white/10 bg-white/5 text-white hover:bg-white/10"
                )}
              >
                {/* Hover glow */}
                <div
                  className={cn(
                    "absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300",
                    isClockedIn
                      ? "bg-gradient-to-r from-red-500/20 via-transparent to-red-500/20"
                      : "bg-gradient-to-r from-emerald-500/20 via-transparent to-emerald-500/20"
                  )}
                />

                <span className="relative flex items-center gap-3">
                  <span
                    className={cn(
                      "flex items-center justify-center w-10 h-10 rounded-full border",
                      isClockedIn
                        ? "bg-red-500/20 border-red-500/30 text-red-400"
                        : "bg-emerald-500/20 border-emerald-500/30 text-emerald-400"
                    )}
                  >
                    {isClockingIn || isClockingOut ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : isClockedIn ? (
                      <Square className="h-5 w-5" />
                    ) : (
                      <Play className="h-5 w-5" />
                    )}
                  </span>
                  <span>{isClockedIn ? "Clock Out" : "Clock In"}</span>
                </span>
              </button>

              {/* Session Info */}
              {isClockedIn && data?.clockStatus && (
                <p className="mt-4 text-xs text-green-300/60">
                  Session started at {format(new Date(data.clockStatus.clockIn), "h:mm a")}
                </p>
              )}
            </div>
          </SpotlightCard>
        </div>

        {/* Right: Stats Panel */}
        <div className="lg:w-80 flex flex-col gap-4">
          {/* Hours Card */}
          <SpotlightCard className="rounded-2xl border-white/10 bg-white/5 p-5 hover:-translate-y-1 hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5)]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <Clock className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <div className="text-xs text-white/40 font-mono">01</div>
                <div className="text-sm font-medium text-white">Clinical Hours</div>
              </div>
            </div>
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-3xl font-bold text-white">
                {data?.student.totalClinicalHours || 0}
              </span>
              <span className="text-white/40 text-sm">
                / {data?.statistics.totalRequiredHours || 0} hrs
              </span>
            </div>
            <Progress value={hoursProgress} className="h-1.5" />
            <div className="text-right text-xs text-white/40 mt-1">
              {Math.round(hoursProgress)}%
            </div>
          </SpotlightCard>

          {/* Rotations Card */}
          <SpotlightCard
            className="rounded-2xl border-white/10 bg-white/5 p-5 hover:-translate-y-1 hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5)]"
            spotlightColor="rgba(34, 197, 94, 0.1)"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <BookOpen className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <div className="text-xs text-white/40 font-mono">02</div>
                <div className="text-sm font-medium text-white">Rotations</div>
              </div>
            </div>
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-3xl font-bold text-white">
                {data?.student.completedRotations || 0}
              </span>
              <span className="text-white/40 text-sm">
                / {data?.statistics.totalRotations || 0}
              </span>
            </div>
            <Progress value={rotationProgress} className="h-1.5" />
            <div className="text-right text-xs text-white/40 mt-1">
              {Math.round(rotationProgress)}%
            </div>
          </SpotlightCard>

          {/* Quick Links Card */}
          <SpotlightCard
            className="rounded-2xl border-white/10 bg-white/5 p-5 hover:-translate-y-1 hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5)]"
            spotlightColor="rgba(168, 85, 247, 0.1)"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <FileText className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <div className="text-xs text-white/40 font-mono">03</div>
                <div className="text-sm font-medium text-white">Quick Links</div>
              </div>
            </div>
            <div className="space-y-2">
              <Link
                href="/dashboard/student/time-records"
                className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10 transition-all text-sm text-white/70 hover:text-white group/link"
              >
                <span>View Time Records</span>
                <ChevronRight className="h-4 w-4 group-hover/link:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/dashboard/student/rotations"
                className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10 transition-all text-sm text-white/70 hover:text-white group/link"
              >
                <span>All Rotations</span>
                <ChevronRight className="h-4 w-4 group-hover/link:translate-x-1 transition-transform" />
              </Link>
            </div>
          </SpotlightCard>
        </div>
      </div>

      {/* Recent Activity - Polished List */}
      {data?.recentTimeRecords && data.recentTimeRecords.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2 pl-1">
            <TrendingUp className="h-5 w-5 text-blue-400" />
            Recent Activity
          </h3>

          <div className="grid gap-3">
            {data.recentTimeRecords.slice(0, 5).map((record, index) => (
              <div
                key={index}
                className="group relative overflow-hidden rounded-xl border border-white/5 bg-white/5 p-4 transition-all hover:bg-white/10 hover:border-white/10"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Icon Box */}
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full border",
                        record.clockOut
                          ? "border-green-500/20 bg-green-500/10 text-green-400"
                          : "border-blue-500/20 bg-blue-500/10 text-blue-400"
                      )}
                    >
                      {record.clockOut ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <Play className="h-5 w-5 ml-0.5" />
                      )}
                    </div>

                    {/* Details */}
                    <div>
                      <div className="font-medium text-white">
                        {record.clockOut ? "Completed Shift" : "Clocked In"}
                      </div>
                      <div className="text-sm text-white/40 flex items-center gap-2">
                        <span>
                          {format(new Date(record.clockIn || record.date), "MMMM d, yyyy")}
                        </span>
                        {record.siteName && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-white/20" />
                            <span>{record.siteName}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Side Stats */}
                  <div className="text-right">
                    {record.totalHours ? (
                      <>
                        <div className="text-lg font-bold text-white">
                          {record.totalHours}{" "}
                          <span className="text-sm font-normal text-white/40">hrs</span>
                        </div>
                        <div className="text-xs text-white/40">
                          {format(new Date(record.clockIn), "h:mm a")} -{" "}
                          {record.clockOut ? format(new Date(record.clockOut), "h:mm a") : "N/A"}
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-1.5 text-sm font-medium text-blue-300 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                        </span>
                        In Progress
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
