"use client"

import React, { useState, useEffect } from 'react'
import { Shield, Eye, EyeOff, Settings, Info, Clock, MapPin, Database, Trash2, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { locationStorageService } from '@/services/location-storage'

interface LocationPrivacySettings {
  allowLocationTracking: boolean
  allowAccuracyLogging: boolean
  dataRetentionDays: number
  shareWithInstitution: boolean
  showLocationInDashboard: boolean
  enableTimezoneDetection: boolean
}

interface LocationPrivacyManagerProps {
  userId: string
  onSettingsChange?: (settings: LocationPrivacySettings) => void
  className?: string
}

export function LocationPrivacyManager({
  userId,
  onSettingsChange,
  className = ""
}: LocationPrivacyManagerProps) {
  const [settings, setSettings] = useState<LocationPrivacySettings>({
    allowLocationTracking: true,
    allowAccuracyLogging: true,
    dataRetentionDays: 90,
    shareWithInstitution: true,
    showLocationInDashboard: true,
    enableTimezoneDetection: true
  })
  
  const [locationHistory, setLocationHistory] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showDataExport, setShowDataExport] = useState(false)

  useEffect(() => {
    loadLocationHistory()
  }, [userId])

  const loadLocationHistory = async () => {
    try {
      const history = await locationStorageService.getLocationHistory(userId, 10)
      setLocationHistory(history)
    } catch (error) {
      console.error('Failed to load location history:', error)
    }
  }

  const handleSettingChange = (key: keyof LocationPrivacySettings, value: boolean | number) => {
    const newSettings = { ...settings, [key]: value }
    setSettings(newSettings)
    onSettingsChange?.(newSettings)
  }

  const handleDataCleanup = async () => {
    setIsLoading(true)
    try {
      await locationStorageService.cleanupOldLocationData(settings.dataRetentionDays)
      await loadLocationHistory()
    } catch (error) {
      console.error('Failed to cleanup location data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDataExport = async () => {
    try {
      const fullHistory = await locationStorageService.getLocationHistory(userId, 1000)
      const exportData = {
        exportDate: new Date().toISOString(),
        userId,
        locationHistory: fullHistory,
        privacySettings: settings
      }
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `location-data-${userId}-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export location data:', error)
    }
  }

  const getRetentionOptions = () => [
    { value: 30, label: '30 days' },
    { value: 60, label: '60 days' },
    { value: 90, label: '90 days (recommended)' },
    { value: 180, label: '6 months' },
    { value: 365, label: '1 year' }
  ]

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Privacy Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Location Privacy & Security
          </CardTitle>
          <CardDescription>
            Manage how your location data is collected, stored, and used for time tracking
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4">
            <Info className="h-4 w-4" />
            <AlertDescription>
              Your location data is encrypted and used only for time tracking verification. 
              You have full control over your privacy settings and can export or delete your data at any time.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Location Tracking Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Location Tracking
          </CardTitle>
          <CardDescription>
            Control how location data is collected during clock-in and clock-out
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="location-tracking">Enable Location Tracking</Label>
              <p className="text-sm text-muted-foreground">
                Allow the app to access your location for time tracking verification
              </p>
            </div>
            <Switch
              id="location-tracking"
              checked={settings.allowLocationTracking}
              onCheckedChange={(checked) => handleSettingChange('allowLocationTracking', checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="accuracy-logging">Detailed Accuracy Logging</Label>
              <p className="text-sm text-muted-foreground">
                Store detailed location accuracy data for improved verification
              </p>
            </div>
            <Switch
              id="accuracy-logging"
              checked={settings.allowAccuracyLogging}
              onCheckedChange={(checked) => handleSettingChange('allowAccuracyLogging', checked)}
              disabled={!settings.allowLocationTracking}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="timezone-detection">Automatic Timezone Detection</Label>
              <p className="text-sm text-muted-foreground">
                Automatically detect timezone based on your location
              </p>
            </div>
            <Switch
              id="timezone-detection"
              checked={settings.enableTimezoneDetection}
              onCheckedChange={(checked) => handleSettingChange('enableTimezoneDetection', checked)}
              disabled={!settings.allowLocationTracking}
            />
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Data Management
          </CardTitle>
          <CardDescription>
            Control how long your location data is stored and who can access it
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="data-retention">Data Retention Period</Label>
              <p className="text-sm text-muted-foreground">
                How long to keep your location data before automatic deletion
              </p>
            </div>
            <Select
              value={settings.dataRetentionDays.toString()}
              onValueChange={(value) => handleSettingChange('dataRetentionDays', Number.parseInt(value))}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getRetentionOptions().map((option) => (
                  <SelectItem key={option.value} value={option.value.toString()}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="institution-sharing">Share with Institution</Label>
              <p className="text-sm text-muted-foreground">
                Allow your institution to access location data for verification purposes
              </p>
            </div>
            <Switch
              id="institution-sharing"
              checked={settings.shareWithInstitution}
              onCheckedChange={(checked) => handleSettingChange('shareWithInstitution', checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="dashboard-display">Show Location in Dashboard</Label>
              <p className="text-sm text-muted-foreground">
                Display location status and timezone in your dashboard
              </p>
            </div>
            <Switch
              id="dashboard-display"
              checked={settings.showLocationInDashboard}
              onCheckedChange={(checked) => handleSettingChange('showLocationInDashboard', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Location History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Location Activity
          </CardTitle>
          <CardDescription>
            Your recent location-based time tracking activities
          </CardDescription>
        </CardHeader>
        <CardContent>
          {locationHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No location activity recorded yet
            </p>
          ) : (
            <div className="space-y-2">
              {locationHistory.slice(0, 5).map((record) => (
                <div key={record.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Badge variant={record.action === 'clock_in' ? 'default' : 'secondary'}>
                      {record.action.replace('_', ' ')}
                    </Badge>
                    <span className="text-sm">
                      {new Date(record.timestamp).toLocaleDateString()} at{' '}
                      {new Date(record.timestamp).toLocaleTimeString()}
                    </span>
                    {record.timezone && (
                      <Badge variant="outline" className="text-xs">
                        {record.timezone}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {record.isWithinGeofence ? (
                      <Badge variant="default" className="bg-green-500">Verified</Badge>
                    ) : (
                      <Badge variant="secondary">Manual</Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      ±{record.accuracy}m
                    </span>
                  </div>
                </div>
              ))}
              {locationHistory.length > 5 && (
                <p className="text-xs text-muted-foreground text-center pt-2">
                  Showing 5 of {locationHistory.length} records
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Data Actions
          </CardTitle>
          <CardDescription>
            Export or delete your location data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDataExport}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export My Data
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleDataCleanup}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              {isLoading ? 'Cleaning...' : 'Clean Old Data'}
            </Button>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  View All Data
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Complete Location History</DialogTitle>
                  <DialogDescription>
                    All your location-based time tracking records
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  {locationHistory.map((record) => (
                    <div key={record.id} className="p-3 rounded-lg border">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant={record.action === 'clock_in' ? 'default' : 'secondary'}>
                          {record.action.replace('_', ' ')}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {new Date(record.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span>Accuracy: ±{record.accuracy}m</span>
                        {record.timezone && <span>• {record.timezone}</span>}
                        <span>• {record.isWithinGeofence ? 'Verified' : 'Manual'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}