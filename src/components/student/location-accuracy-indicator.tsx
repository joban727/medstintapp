import type React from 'react'
import { cn } from '@/lib/utils'

interface LocationAccuracyIndicatorProps {
  accuracy: number
  className?: string
  showLabel?: boolean
}

export const LocationAccuracyIndicator: React.FC<LocationAccuracyIndicatorProps> = ({ 
  accuracy, 
  className,
  showLabel = true 
}) => {
  const getAccuracyLevel = (accuracy: number) => {
    if (accuracy < 50) return 'high'
    if (accuracy < 200) return 'medium'
    return 'low'
  }

  const getAccuracyColor = (level: string) => {
    switch (level) {
      case 'high': return 'bg-success'
      case 'medium': return 'bg-warning'
      case 'low': return 'bg-error'
      default: return 'bg-muted'
    }
  }

  const getAccuracyText = (level: string) => {
    switch (level) {
      case 'high': return 'High accuracy'
      case 'medium': return 'Medium accuracy'
      case 'low': return 'Low accuracy'
      default: return 'Unknown accuracy'
    }
  }

  const level = getAccuracyLevel(accuracy)
  const color = getAccuracyColor(level)
  const text = getAccuracyText(level)

  // Calculate ring sizes based on accuracy
  const ring1Size = Math.min(accuracy / 10, 20)
  const ring2Size = Math.min(accuracy / 5, 40)
  const ring3Size = Math.min(accuracy / 2, 60)

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="relative">
        {/* Outer ring (lowest accuracy) */}
        <div 
          className={cn(
            "absolute rounded-full border-2 opacity-20",
            level === 'low' ? 'border-error' : level === 'medium' ? 'border-warning' : 'border-success'
          )}
          style={{
            width: `${ring3Size}px`,
            height: `${ring3Size}px`,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)'
          }}
        />
        
        {/* Middle ring */}
        <div 
          className={cn(
            "absolute rounded-full border-2 opacity-30",
            level === 'low' ? 'border-error' : level === 'medium' ? 'border-warning' : 'border-success'
          )}
          style={{
            width: `${ring2Size}px`,
            height: `${ring2Size}px`,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)'
          }}
        />
        
        {/* Inner ring */}
        <div 
          className={cn(
            "absolute rounded-full border-2 opacity-50",
            level === 'low' ? 'border-error' : level === 'medium' ? 'border-warning' : 'border-success'
          )}
          style={{
            width: `${ring1Size}px`,
            height: `${ring1Size}px`,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)'
          }}
        />
        
        {/* Center dot */}
        <div className={cn("w-3 h-3 rounded-full", color)} />
      </div>
      
      {showLabel && (
        <div className="flex flex-col">
          <span className="text-sm font-medium text-foreground">{text}</span>
          <span className="text-xs text-muted-foreground">±{Math.round(accuracy)}m radius</span>
        </div>
      )}
    </div>
  )
}

export default LocationAccuracyIndicator