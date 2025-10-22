import { cn } from "@/lib/utils"
import { Clock, MapPin, Wifi, WifiOff, CheckCircle, AlertCircle, XCircle } from "lucide-react"

interface StatusIndicatorProps {
  type: "clock" | "location" | "connection" | "success" | "warning" | "error"
  status: "active" | "inactive" | "loading" | "error"
  text?: string
  className?: string
  size?: "sm" | "md" | "lg"
}

export function StatusIndicator({ 
  type, 
  status, 
  text, 
  className, 
  size = "md" 
}: StatusIndicatorProps) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6"
  }

  const getIcon = () => {
    switch (type) {
      case "clock":
        return <Clock className={sizeClasses[size]} />
      case "location":
        return <MapPin className={sizeClasses[size]} />
      case "connection":
        return status === "active" ? 
          <Wifi className={sizeClasses[size]} /> : 
          <WifiOff className={sizeClasses[size]} />
      case "success":
        return <CheckCircle className={sizeClasses[size]} />
      case "warning":
        return <AlertCircle className={sizeClasses[size]} />
      case "error":
        return <XCircle className={sizeClasses[size]} />
      default:
        return <Clock className={sizeClasses[size]} />
    }
  }

  const getStatusColor = () => {
    if (status === "loading") return "text-blue-500 animate-pulse"
    
    switch (type) {
      case "success":
        return "text-green-500"
      case "warning":
        return "text-yellow-500"
      case "error":
        return "text-red-500"
      case "connection":
        return status === "active" ? "text-green-500" : "text-red-500"
      default:
        switch (status) {
          case "active":
            return "text-green-500"
          case "inactive":
            return "text-gray-400"
          case "error":
            return "text-red-500"
          default:
            return "text-gray-400"
        }
    }
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn("flex-shrink-0", getStatusColor())}>
        {getIcon()}
      </div>
      {text && (
        <span className={cn(
          "text-sm font-medium",
          status === "loading" ? "animate-pulse" : "",
          getStatusColor()
        )}>
          {text}
        </span>
      )}
    </div>
  )
}