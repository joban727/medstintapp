'use client'

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { 
  MapPin, 
  Navigation, 
  Activity, 
  Shield,
  Zap,
  BarChart3
} from 'lucide-react'
import LocationDashboard from '@/components/location/location-dashboard'

export default function LocationDemoPage() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <MapPin className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">OpenMap API Integration</h1>
            <p className="text-lg text-muted-foreground">
              Comprehensive location services with authentication, error handling, and visualization
            </p>
          </div>
        </div>

        {/* Feature Overview */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Authentication</CardTitle>
              <Shield className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">Secure</div>
              <p className="text-xs text-muted-foreground">
                API key validation & rate limiting
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Error Handling</CardTitle>
              <Activity className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">Robust</div>
              <p className="text-xs text-muted-foreground">
                Retry logic & fallback mechanisms
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Performance</CardTitle>
              <Zap className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">Fast</div>
              <p className="text-xs text-muted-foreground">
                Intelligent caching & optimization
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Analytics</CardTitle>
              <BarChart3 className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">Detailed</div>
              <p className="text-xs text-muted-foreground">
                Real-time metrics & visualization
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Separator />

      {/* Implementation Features */}
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight mb-4">Implementation Features</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4 text-green-500" />
                  Security & Authentication
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">API Key Validation</span>
                  <Badge variant="default">✓</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Rate Limiting</span>
                  <Badge variant="default">✓</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Request Signing</span>
                  <Badge variant="default">✓</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">HTTPS Enforcement</span>
                  <Badge variant="default">✓</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4 text-blue-500" />
                  Error Handling
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Retry Mechanisms</span>
                  <Badge variant="default">✓</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Exponential Backoff</span>
                  <Badge variant="default">✓</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Fallback Strategies</span>
                  <Badge variant="default">✓</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Error Classification</span>
                  <Badge variant="default">✓</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Intelligent Caching</span>
                  <Badge variant="default">✓</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Request Deduplication</span>
                  <Badge variant="default">✓</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Response Compression</span>
                  <Badge variant="default">✓</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Connection Pooling</span>
                  <Badge variant="default">✓</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-purple-500" />
                  Analytics & Monitoring
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Real-time Metrics</span>
                  <Badge variant="default">✓</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Performance Tracking</span>
                  <Badge variant="default">✓</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Error Monitoring</span>
                  <Badge variant="default">✓</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Usage Analytics</span>
                  <Badge variant="default">✓</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-red-500" />
                  Location Services
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">GPS Integration</span>
                  <Badge variant="default">✓</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Geocoding</span>
                  <Badge variant="default">✓</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Reverse Geocoding</span>
                  <Badge variant="default">✓</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Facility Lookup</span>
                  <Badge variant="default">✓</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Navigation className="h-4 w-4 text-indigo-500" />
                  User Experience
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Interactive Maps</span>
                  <Badge variant="default">✓</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Real-time Updates</span>
                  <Badge variant="default">✓</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Status Indicators</span>
                  <Badge variant="default">✓</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Responsive Design</span>
                  <Badge variant="default">✓</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Separator />

      {/* Main Dashboard */}
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Location Dashboard</h2>
          <p className="text-muted-foreground">
            Interactive dashboard showcasing all OpenMap API integration features
          </p>
        </div>
        
        <LocationDashboard />
      </div>

      {/* Footer */}
      <Separator />
      <div className="text-center space-y-2">
        <p className="text-sm text-muted-foreground">
          OpenMap API Integration Demo - Built with Next.js, TypeScript, and Tailwind CSS
        </p>
        <div className="flex justify-center space-x-4">
          <Badge variant="outline">Secure</Badge>
          <Badge variant="outline">Efficient</Badge>
          <Badge variant="outline">Accurate</Badge>
          <Badge variant="outline">Real-time</Badge>
        </div>
      </div>
    </div>
  )
}