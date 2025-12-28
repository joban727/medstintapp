"use client"

import { AlertTriangle, Home, RefreshCw } from "lucide-react"
import React, { Component, type ErrorInfo, type ReactNode } from "react"
import { Alert, AlertDescription } from "../ui/alert"
import { Button } from "../ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"

// Error boundary configuration types
export interface ErrorBoundaryConfig {
  maxRetries?: number
  showDetails?: boolean
  enableChunkErrorHandling?: boolean
  fallbackType?: "minimal" | "dashboard" | "fullscreen"
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

export interface ErrorFallbackProps {
  error: Error
  retry: () => void
  canRetry: boolean
  retryCount: number
  maxRetries: number
}

interface Props {
  children: ReactNode
  config?: ErrorBoundaryConfig
  fallback?: React.ComponentType<ErrorFallbackProps>
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  retryCount: number
}

/**
 * Unified Error Boundary Component
 *
 * Consolidates all error boundary functionality into a single, configurable component
 * that can handle different error scenarios and UI requirements.
 */
class UnifiedErrorBoundary extends Component<Props, State> {
  private config: Required<ErrorBoundaryConfig>

  constructor(props: Props) {
    super(props)

    // Default configuration
    this.config = {
      maxRetries: 3,
      showDetails: process.env.NODE_ENV === "development",
      enableChunkErrorHandling: true,
      fallbackType: "dashboard",
      onError: () => { },
      ...props.config,
    }

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> | null {
    // Ignore NEXT_REDIRECT errors to allow Next.js to handle redirects
    if (error.message === "NEXT_REDIRECT" || error.message.includes("NEXT_REDIRECT")) {
      return null
    }

    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    })

    // Log error appropriately based on environment
    if (process.env.NODE_ENV === "development") {
      console.error("Unified Error Boundary caught an error:", error, errorInfo)
    }

    // Handle chunk loading errors specifically
    if (this.config.enableChunkErrorHandling && this.isChunkError(error)) {
      console.error("Chunk loading error detected:", {
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      })
    }

    // Call custom error handler if provided
    this.config.onError?.(error, errorInfo)

    // In production, you might want to send this to an error reporting service
    // Example: Sentry.captureException(error, { contexts: { react: errorInfo } })
  }

  private isChunkError = (error: Error): boolean => {
    return error.name === "ChunkLoadError" || error.message.includes("Loading chunk")
  }

  handleRetry = () => {
    const { error } = this.state

    // For chunk loading errors, reload the page
    if (this.config.enableChunkErrorHandling && error && this.isChunkError(error)) {
      window.location.reload()
      return
    }

    // Regular retry logic
    if (this.state.retryCount < this.config.maxRetries) {
      this.setState((prevState) => ({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: prevState.retryCount + 1,
      }))
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    })
  }

  handleGoHome = () => {
    window.location.href = "/"
  }

  private renderMinimalFallback = () => {
    const { error } = this.state
    const isChunkError = error && this.isChunkError(error)
    const canRetry = this.state.retryCount < this.config.maxRetries

    return (
      <div className="flex min-h-[200px] items-center justify-center p-4">
        <div className="text-center gap-4">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto" />
          <div>
            <h3 className="font-medium text-gray-900">
              {isChunkError ? "Loading Error" : "Something went wrong"}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {isChunkError
                ? "Please reload the page to continue."
                : "An error occurred. Please try again."}
            </p>
          </div>
          <div className="flex gap-2 justify-center">
            {canRetry && (
              <Button size="sm" onClick={this.handleRetry}>
                <RefreshCw className="mr-2 h-3 w-3" />
                {isChunkError ? "Reload" : "Retry"}
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  private renderDashboardFallback = () => {
    const { error } = this.state
    const isChunkError = error && this.isChunkError(error)
    const canRetry = this.state.retryCount < this.config.maxRetries
    const errorMessage = error?.message || "An unexpected error occurred"

    return (
      <div className="flex min-h-[400px] items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle className="h-8 w-8 text-error" />
            </div>
            <CardTitle className="text-2xl">
              {isChunkError ? "Loading Error" : "Something went wrong"}
            </CardTitle>
            <CardDescription>
              {isChunkError
                ? "There was an issue loading part of the application. This usually happens after an update."
                : "We encountered an error while loading this section."}
            </CardDescription>
          </CardHeader>
          <CardContent className="gap-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">{errorMessage}</AlertDescription>
            </Alert>

            {this.config.showDetails && this.state.errorInfo && (
              <details className="text-sm">
                <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground transition-color duration-200s duration-200">
                  Technical Details
                </summary>
                <pre className="mt-2 overflow-auto rounded-md bg-muted p-2 text-xs">
                  {error?.stack}
                </pre>
              </details>
            )}

            <div className="flex flex-col gap-2 sm:flex-row">
              {canRetry && (
                <Button onClick={this.handleRetry} variant="default" className="flex-1">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {isChunkError
                    ? "Reload Page"
                    : `Try Again (${this.config.maxRetries - this.state.retryCount} left)`}
                </Button>
              )}
              <Button onClick={this.handleReset} variant="outline" className="flex-1">
                <Home className="mr-2 h-4 w-4" />
                Reset
              </Button>
            </div>

            {!canRetry && !isChunkError && (
              <Alert variant="destructive">
                <AlertDescription className="text-sm">
                  Maximum retry attempts reached. Please refresh the page or contact support if the
                  problem persists.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  private renderFullscreenFallback = () => {
    const { error } = this.state
    const isChunkError = error && this.isChunkError(error)
    const canRetry = this.state.retryCount < this.config.maxRetries

    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-6 w-6 text-error" />
            </div>
            <CardTitle className="font-semibold text-xl">
              {isChunkError ? "Loading Error" : "Something went wrong"}
            </CardTitle>
            <CardDescription>
              {isChunkError
                ? "There was an issue loading part of the application. This usually happens after an update."
                : "An unexpected error occurred. Please try refreshing the page."}
            </CardDescription>
          </CardHeader>
          <CardContent className="gap-4">
            {this.config.showDetails && error && (
              <div className="rounded-md bg-gray-50 p-3">
                <p className="font-medium text-gray-900 text-sm">Error Details:</p>
                <p className="mt-1 font-mono text-gray-600 text-xs">{error.message}</p>
              </div>
            )}
            <div className="flex gap-2">
              {canRetry && (
                <Button onClick={this.handleRetry} className="flex-1" variant="default">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {isChunkError ? "Reload Page" : "Try Again"}
                </Button>
              )}
              <Button onClick={this.handleGoHome} variant="outline" className="flex-1">
                Go Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  render() {
    if (this.state.hasError) {
      const { error } = this.state
      const canRetry = this.state.retryCount < this.config.maxRetries

      // Use custom fallback if provided
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback
        return (
          <FallbackComponent
            error={error || new Error("Unknown error")}
            retry={this.handleRetry}
            canRetry={canRetry}
            retryCount={this.state.retryCount}
            maxRetries={this.config.maxRetries}
          />
        )
      }

      // Use built-in fallback based on configuration
      switch (this.config.fallbackType) {
        case "minimal":
          return this.renderMinimalFallback()
        case "fullscreen":
          return this.renderFullscreenFallback()
        case "dashboard":
        default:
          return this.renderDashboardFallback()
      }
    }

    return this.props.children
  }
}

export default UnifiedErrorBoundary

// Hook for functional components to trigger error boundary
export const useErrorHandler = () => {
  return React.useCallback((error: Error) => {
    throw error
  }, [])
}

// Hook for functional components to handle chunk loading errors
export const useChunkErrorHandler = () => {
  // Stable event handler with useEffectEvent (React 19.2+)
  const onChunkError = React.useEffectEvent((event: ErrorEvent) => {
    if (event.error?.name === "ChunkLoadError" || event.message?.includes("Loading chunk")) {
      console.error("Chunk loading error detected, reloading page...")
      window.location.reload()
    }
  })

  React.useEffect(() => {
    window.addEventListener("error", onChunkError)
    return () => window.removeEventListener("error", onChunkError)
  }, []) // No dependencies needed - onChunkError always has fresh state
}

// Higher-order component for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  config?: ErrorBoundaryConfig
) {
  const WrappedComponent = React.forwardRef<any, P>((props, ref) => (
    <UnifiedErrorBoundary config={config}>
      <Component {...(props as P)} ref={ref} />
    </UnifiedErrorBoundary>
  ))

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`
  return WrappedComponent
}

// Predefined configurations for common use cases
export const ErrorBoundaryConfigs = {
  minimal: {
    fallbackType: "minimal" as const,
    maxRetries: 1,
    showDetails: false,
  },
  dashboard: {
    fallbackType: "dashboard" as const,
    maxRetries: 3,
    showDetails: process.env.NODE_ENV === "development",
  },
  fullscreen: {
    fallbackType: "fullscreen" as const,
    maxRetries: 3,
    showDetails: process.env.NODE_ENV === "development",
    enableChunkErrorHandling: true,
  },
  student: {
    fallbackType: "dashboard" as const,
    maxRetries: 3,
    showDetails: process.env.NODE_ENV === "development",
    onError: (error: Error, errorInfo: ErrorInfo) => {
      console.error("Student Dashboard Error:", error, errorInfo)
      // In production, send to error reporting service
    },
  },
} as const
