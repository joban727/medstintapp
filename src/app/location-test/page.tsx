import React from 'react'
import SimpleClockWidget from '@/components/student/simple-clock-widget'
import EnhancedLocationDisplay from '@/components/location/enhanced-location-display'
import { ModeToggle } from '@/components/layout/mode-toggle'

export default function LocationTestPage() {
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center py-8">
          <div className="flex items-center justify-center gap-4 mb-4">
            <h1 className="text-3xl font-bold text-foreground">
              Location Tracking Test
            </h1>
            <ModeToggle />
          </div>
          <p className="text-muted-foreground">
            Test the enhanced location tracking functionality in both light and dark modes
          </p>
        </div>
        
        <SimpleClockWidget />
        
        {/* Test different variants of the enhanced location display */}
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-4">Enhanced Location Display - Default Variant</h2>
            <EnhancedLocationDisplay 
              variant="default"
              showMap={true}
              showDetails={true}
              autoRefresh={true}
              refreshInterval={30000}
            />
          </div>
          
          <div>
            <h2 className="text-lg font-semibold mb-4">Enhanced Location Display - Compact Variant</h2>
            <EnhancedLocationDisplay 
              variant="compact"
              showMap={false}
              showDetails={false}
              autoRefresh={false}
            />
          </div>
          
          <div>
            <h2 className="text-lg font-semibold mb-4">Enhanced Location Display - Detailed Variant</h2>
            <EnhancedLocationDisplay 
              variant="detailed"
              showMap={true}
              showDetails={true}
              autoRefresh={true}
              refreshInterval={60000}
            />
          </div>
        </div>
        
        <div className="bg-card rounded-lg p-6 border">
          <h2 className="text-lg font-semibold mb-4">Dark Mode Testing Features</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h3 className="font-medium">✅ Dark Mode Features:</h3>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Theme-aware color schemes with proper contrast</li>
                <li>• Smart caching with 5-minute timeout</li>
                <li>• Enhanced error handling with specific guidance</li>
                <li>• Live/cached status indicators</li>
                <li>• Permission-based error messages</li>
                <li>• Responsive design across all variants</li>
                <li>• Accessibility-compliant color contrast</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium">🧪 Dark Mode Test Instructions:</h3>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Toggle between light and dark modes using the button above</li>
                <li>• Verify all text remains readable in both modes</li>
                <li>• Check that status indicators are clearly visible</li>
                <li>• Test error states by denying location permission</li>
                <li>• Observe caching behavior and status changes</li>
                <li>• Verify map and accuracy indicators work in both themes</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}