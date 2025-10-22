import type React from 'react'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MapPin, AlertCircle, RefreshCw, Settings } from 'lucide-react'
import { useEnhancedTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'
import { ThemeAwareCard } from '@/components/ui/theme-aware-card'
import { ThemeAwareButton } from '@/components/ui/theme-aware-button'

interface LocationPermissionRequestProps {
  onPermissionGranted: () => void
  onPermissionDenied: () => void
  className?: string
}

export const LocationPermissionRequest: React.FC<LocationPermissionRequestProps> = ({
  onPermissionGranted,
  onPermissionDenied,
  className
}) => {
  const { theme } = useEnhancedTheme()
  const [isRequesting, setIsRequesting] = useState(false)
  const [permissionStatus, setPermissionStatus] = useState<'unknown' | 'granted' | 'denied' | 'prompt'>('unknown')

  useEffect(() => {
    // Check current permission status
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' })
        .then(result => {
          setPermissionStatus(result.state as any)
          if (result.state === 'granted') {
            onPermissionGranted()
          } else if (result.state === 'denied') {
            onPermissionDenied()
          }
        })
        .catch(() => {
          setPermissionStatus('unknown')
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
            setPermissionStatus('granted')
            onPermissionGranted()
            resolve(position)
          },
          (error) => {
            if (error.code === error.PERMISSION_DENIED) {
              setPermissionStatus('denied')
              onPermissionDenied()
            }
            reject(error)
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          }
        )
      })
    } catch (error) {
      console.error('Location permission request failed:', error)
    } finally {
      setIsRequesting(false)
    }
  }

  const openBrowserSettings = () => {
    // Provide instructions for enabling location permissions
    if (navigator.userAgent.includes('Chrome')) {
      window.open('chrome://settings/content/location', '_blank')
    } else if (navigator.userAgent.includes('Firefox')) {
      window.open('about:preferences#privacy', '_blank')
    } else if (navigator.userAgent.includes('Safari')) {
      window.open('preferences:Privacy', '_blank')
    } else {
      // Generic instructions
      alert('Please enable location permissions in your browser settings and refresh the page.')
    }
  }

  if (permissionStatus === 'granted') {
    return null // Don't show if permission is already granted
  }

  return (
    <ThemeAwareCard style="warning" className={cn("w-full", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-warning" />
          <span className="text-warning">Location Access Required</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-warning mt-0.5 flex-shrink-0" />
          <div className="space-y-2">
            <p className="text-sm text-foreground">
              This application needs access to your location to verify you're at the correct site when clocking in/out.
            </p>
            <p className="text-xs text-muted-foreground">
              Your location data is only used for verification purposes and is not shared with third parties.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {permissionStatus === 'denied' ? (
            <>
              <ThemeAwareButton
                onClick={openBrowserSettings}
                variant="outline"
                className="flex-1"
              >
                <Settings className="h-4 w-4 mr-2" />
                Open Browser Settings
              </ThemeAwareButton>
              <ThemeAwareButton
                onClick={() => window.location.reload()}
                variant="primary"
                className="flex-1"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Page
              </ThemeAwareButton>
            </>
          ) : (
            <ThemeAwareButton
              onClick={requestPermission}
              disabled={isRequesting}
              variant="primary"
              className="flex-1"
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
            </ThemeAwareButton>
          )}
        </div>

        {permissionStatus === 'denied' && (
          <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg">
            <p className="text-sm text-warning font-medium mb-1">Permission Denied</p>
            <p className="text-xs text-muted-foreground">
              Location access has been blocked. Please enable it in your browser settings and refresh the page.
            </p>
          </div>
        )}
      </CardContent>
    </ThemeAwareCard>
  )
}

export default LocationPermissionRequest