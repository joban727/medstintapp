"use client"

import React, { useState, useEffect } from "react"
import { Shield, AlertTriangle, CheckCircle, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { circuitBreakerRegistry, CircuitState } from "@/lib/api-circuit-breaker"
import { toast } from "sonner"

interface CircuitBreakerStatusProps {
  className?: string
}

export function CircuitBreakerStatus({ className }: CircuitBreakerStatusProps) {
  const [stats, setStats] = useState<Record<string, any>>({})
  const [isRefreshing, setIsRefreshing] = useState(false)

  const refreshStats = () => {
    setStats(circuitBreakerRegistry.getAllStats())
  }

  useEffect(() => {
    refreshStats()
    const interval = setInterval(refreshStats, 5000) // Refresh every 5 seconds
    return () => clearInterval(interval)
  }, [])

  const resetBreaker = (name: string) => {
    try {
      const breaker = circuitBreakerRegistry.getBreaker(name)
      breaker.reset()
      toast.success(`Circuit breaker "${name}" reset successfully`)
      refreshStats()
    } catch (error) {
      toast.error(`Failed to reset circuit breaker "${name}"`)
    }
  }

  const resetAllBreakers = () => {
    setIsRefreshing(true)
    try {
      circuitBreakerRegistry.resetAll()
      toast.success("All circuit breakers reset successfully")
      refreshStats()
    } catch (error) {
      toast.error("Failed to reset circuit breakers")
    } finally {
      setIsRefreshing(false)
    }
  }

  const getStateIcon = (state: CircuitState) => {
    switch (state) {
      case CircuitState.CLOSED:
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case CircuitState.OPEN:
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      case CircuitState.HALF_OPEN:
        return <Shield className="h-4 w-4 text-warning" />
      default:
        return <Shield className="h-4 w-4 text-gray-500" />
    }
  }

  const getStateBadgeVariant = (state: CircuitState) => {
    switch (state) {
      case CircuitState.CLOSED:
        return "default"
      case CircuitState.OPEN:
        return "destructive"
      case CircuitState.HALF_OPEN:
        return "secondary"
      default:
        return "outline"
    }
  }

  const breakerEntries = Object.entries(stats)

  if (breakerEntries.length === 0) {
    return null
  }

  return (
    <Card className={className}>
      <CardHeader className="flex items-center justify-between gap-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Circuit Breaker Status
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={resetAllBreakers}
          disabled={isRefreshing}
          className="h-8"
        >
          <RotateCcw className={`h-3 w-3 mr-1 ${isRefreshing ? "animate-spin" : ""}`} />
          Reset All
        </Button>
      </CardHeader>
      <CardContent className="gap-3">
        {breakerEntries.map(([name, stat]) => (
          <div key={name} className="flex items-center justify-between p-2 border rounded-lg">
            <div className="flex items-center gap-2 flex-1">
              {getStateIcon(stat.state)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant={getStateBadgeVariant(stat.state)} className="text-xs">
                    {stat.state}
                  </Badge>
                  <span>
                    Failures: {stat.failureCount}/{stat.totalFailures}
                  </span>
                  {stat.nextAttemptTime && stat.state === CircuitState.OPEN && (
                    <span>Next: {new Date(stat.nextAttemptTime).toLocaleTimeString()}</span>
                  )}
                </div>
              </div>
            </div>
            {stat.state !== CircuitState.CLOSED && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => resetBreaker(name)}
                className="h-7 px-2 text-xs"
              >
                Reset
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export default CircuitBreakerStatus
