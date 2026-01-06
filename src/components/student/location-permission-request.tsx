import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MapPin, AlertCircle, RefreshCw, Settings } from "lucide-react"
import { cn } from "@/lib/utils"

interface LocationPermissionRequestProps {
  onPermissionGranted: () => void
  onPermissionDenied: () => void
  className?: string
}

export const LocationPermissionRequest: React.FC<LocationPermissionRequestProps> = ({
  onPermissionGranted,
  onPermissionDenied,
  className,
}) => {
  const [isRequesting, setIsRequesting] = useState(false)
  const [permissionStatus, setPermissionStatus] = useState<
    "unknown" | "granted" | "denied" | "prompt"
  >("unknown")

  useEffect(() => {
    // Check current permission status
    if (navigator.permissions) {
      navigator.permissions
        .query({ name: "geolocation" })
        .then((result) => {
          setPermissionStatus(result.state as PermissionState)
          if (result.state === "granted") {
            onPermissionGranted()
          } else if (result.state === "denied") {
            onPermissionDenied()
          }
        })
        .catch(() => {
          setPermissionStatus("unknown")
        })
    }
  }, [onPermissionGranted, onPermissionDenied])

  const requestPermission = async () => {
    setIsRequesting(true)
    try {
      // Try to get current position to trigger permission request
      await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setPermissionStatus("granted")
            onPermissionGranted()
            resolve(position)
          },
          (error) => {
            if (error.code === error.PERMISSION_DENIED) {
              setPermissionStatus("denied")
              onPermissionDenied()
            }
            reject(error)
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          }
        )
      })
    } catch (error) {
      console.error("Location permission request failed:", error)
    } finally {
      setIsRequesting(false)
    }
  }

  const openBrowserSettings = () => {
    // Provide instructions for enabling location permissions
    if (navigator.userAgent.includes("Chrome")) {
      window.open("chrome://settings/content/location", "_blank")
    } else if (navigator.userAgent.includes("Firefox")) {
      window.open("about:preferences#privacy", "_blank")
    } else if (navigator.userAgent.includes("Safari")) {
      window.open("preferences:Privacy", "_blank")
    } else {
      // Generic instructions
      alert("Please enable location permissions in your browser settings and refresh the page.")
    }
  }

  if (permissionStatus === "granted") {
    return null // Don't show if permission is already granted
  }

  return (
    <Card
      className={cn(
        "w-full backdrop-blur-md shadow-sm border-yellow-500/20 bg-yellow-500/5",
        className
      )}
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-yellow-500" />
          <span className="text-yellow-500">Location Access Required</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="gap-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
          <div className="gap-2">
            <p className="text-sm text-white">
              This application needs access to your location to verify you're at the correct site
              when clocking in/out.
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              Your location data is only used for verification purposes and is not shared with third
              parties.
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          {permissionStatus === "denied" ? (
            <>
              <Button
                onClick={openBrowserSettings}
                variant="outline"
                className="flex-1 border-white/10 text-white hover:bg-white/10"
              >
                <Settings className="h-4 w-4 mr-2" />
                Open Browser Settings
              </Button>
              <Button
                onClick={() => window.location.reload()}
                variant="default"
                className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-black"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Page
              </Button>
            </>
          ) : (
            <Button
              onClick={requestPermission}
              disabled={isRequesting}
              variant="default"
              className="flex-1 bg-theme-gradient text-white"
            >
              {isRequesting ? (
                <>
                  <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Requesting...
                </>
              ) : (
                <>
                  <MapPin className="h-4 w-4 mr-2" />
                  Enable Location Access
                </>
              )}
            </Button>
          )}
        </div>
        {permissionStatus === "denied" && (
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <p className="text-sm text-yellow-500 font-medium mb-1">Permission Denied</p>
            <p className="text-xs text-[var(--text-muted)]">
              Location access has been blocked. Please enable it in your browser settings and
              refresh the page.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default LocationPermissionRequest
