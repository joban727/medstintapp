"use client"

import type { ReactNode } from "react"

import UnifiedErrorBoundary, { ErrorBoundaryConfigs } from "./unified-error-boundary"

interface StudentDashboardErrorWrapperProps {
  children: ReactNode
}

/**
 * @deprecated Use UnifiedErrorBoundary with ErrorBoundaryConfigs.student instead
 * This wrapper is maintained for backward compatibility
 */
export function StudentDashboardErrorWrapper({ children }: StudentDashboardErrorWrapperProps) {
  return (
    <UnifiedErrorBoundary config={ErrorBoundaryConfigs.student}>{children}</UnifiedErrorBoundary>
  )
}
