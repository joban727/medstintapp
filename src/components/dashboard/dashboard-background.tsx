"use client"

import React from "react"
import { cn } from "@/lib/utils"

interface DashboardBackgroundProps {
  theme?: "default" | "green" | "red" | "blue"
  className?: string
}

export function DashboardBackground({ theme = "default", className }: DashboardBackgroundProps) {
  const getGradient = () => {
    switch (theme) {
      case "green":
        return "radial-gradient(circle, rgba(34, 197, 94, 0.15) 0%, transparent 70%)"
      case "red":
        return "radial-gradient(circle, rgba(239, 68, 68, 0.15) 0%, transparent 70%)"
      case "blue":
        return "radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%)"
      default:
        return "radial-gradient(circle, rgba(59, 130, 246, 0.12) 0%, transparent 70%)"
    }
  }

  return (
    <div className={cn("absolute inset-0 -z-10 overflow-hidden pointer-events-none", className)}>
      {/* Main Gradient Orb */}
      <div
        className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[100px] animate-pulse"
        style={{
          background: getGradient(),
          transition: "background 1s ease-in-out",
        }}
      />
      {/* Secondary Orb */}
      <div
        className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full blur-[80px]"
        style={{
          background: "radial-gradient(circle, rgba(139, 92, 246, 0.1) 0%, transparent 70%)",
        }}
      />
      {/* Tertiary Orb (Bottom Left) */}
      <div
        className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full blur-[100px]"
        style={{
          background: "radial-gradient(circle, rgba(14, 165, 233, 0.1) 0%, transparent 70%)",
        }}
      />
    </div>
  )
}
