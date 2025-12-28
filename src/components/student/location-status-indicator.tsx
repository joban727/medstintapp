"use client"

import type React from "react"
import { cn } from "@/lib/utils"
import { MapPin, Navigation, Wifi, WifiOff, AlertCircle } from "lucide-react"

interface LocationStatusIndicatorProps {
    isTracking: boolean
    hasPermission: boolean
    isConnected: boolean
    accuracy: number
    lastUpdated?: Date
    className?: string
    showDetails?: boolean
}

export const LocationStatusIndicator: React.FC<LocationStatusIndicatorProps> = ({
    isTracking,
    hasPermission,
    isConnected,
    accuracy,
    lastUpdated,
    className,
    showDetails = true,
}) => {
    const getAccuracyLevel = (accuracy: number) => {
        if (accuracy < 50) return "high"
        if (accuracy < 200) return "medium"
        return "low"
    }

    const accuracyLevel = getAccuracyLevel(accuracy)

    const getStatusConfig = () => {
        if (!hasPermission) {
            return {
                icon: AlertCircle,
                color: "text-error",
                bgColor: "bg-error/10",
                label: "Permission Required",
                description: "Location access denied",
            }
        }
        if (!isConnected) {
            return {
                icon: WifiOff,
                color: "text-warning",
                bgColor: "bg-warning/10",
                label: "Offline",
                description: "Location tracking unavailable",
            }
        }
        if (isTracking) {
            return {
                icon: Navigation,
                color:
                    accuracyLevel === "high"
                        ? "text-success"
                        : accuracyLevel === "medium"
                            ? "text-warning"
                            : "text-error",
                bgColor:
                    accuracyLevel === "high"
                        ? "bg-success/10"
                        : accuracyLevel === "medium"
                            ? "bg-warning/10"
                            : "bg-error/10",
                label: "Live Tracking",
                description:
                    accuracyLevel === "high"
                        ? "High accuracy"
                        : accuracyLevel === "medium"
                            ? "Medium accuracy"
                            : "Low accuracy",
            }
        }
        return {
            icon: MapPin,
            color: "text-muted-foreground",
            bgColor: "bg-muted",
            label: "Location Ready",
            description: "Ready to track",
        }
    }

    const status = getStatusConfig()
    const Icon = status.icon

    return (
        <div className={cn("flex items-center gap-2", className)}>
            <div className={cn("relative p-2 rounded-full", status.bgColor)}>
                <Icon className={cn("h-4 w-4", status.color)} />
                {isTracking && (
                    <div
                        className={cn(
                            "absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full animate-pulse",
                            accuracyLevel === "high"
                                ? "bg-success"
                                : accuracyLevel === "medium"
                                    ? "bg-warning"
                                    : "bg-error"
                        )}
                    />
                )}
            </div>
            {showDetails && (
                <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium text-foreground truncate">{status.label}</span>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{status.description}</span>
                        {lastUpdated && (
                            <span className="text-xs text-muted-foreground/70">
                                {" "}
                                • {lastUpdated.toLocaleTimeString()}{" "}
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export default LocationStatusIndicator