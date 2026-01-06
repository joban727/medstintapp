"use client"

import { AlertTriangle, RefreshCw } from "lucide-react"
import React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: React.ErrorInfo
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error Boundary caught an error:", error, errorInfo)

    // Log chunk loading errors specifically
    if (error.name === "ChunkLoadError" || error.message.includes("Loading chunk")) {
      console.error("Chunk loading error detected:", {
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      })
    }

    this.setState({
      error,
      errorInfo,
    })
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })

    // For chunk loading errors, reload the page
    if (
      this.state.error?.name === "ChunkLoadError" ||
      this.state.error?.message?.includes("Loading chunk")
    ) {
      window.location.reload()
    }
  }

  render() {
    if (this.state.hasError) {
      const { error } = this.state
      const isChunkError =
        error?.name === "ChunkLoadError" || error?.message?.includes("Loading chunk")

      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback
        return (
          <FallbackComponent error={error || new Error("Unknown error")} retry={this.handleRetry} />
        )
      }

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
              {process.env.NODE_ENV === "development" && error && (
                <div className="rounded-md bg-gray-50 p-3">
                  <p className="font-medium text-gray-900 text-sm">Error Details:</p>
                  <p className="mt-1 font-mono text-gray-600 text-xs">{error.message}</p>
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={this.handleRetry}
                  className="flex-1"
                  variant="default"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {isChunkError ? "Reload Page" : "Try Again"}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    window.location.href = "/"
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Go Home
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary

// Hook for functional components to handle chunk loading errors
export const useChunkErrorHandler = () => {
  React.useEffect(() => {
    const handleChunkError = (event: ErrorEvent) => {
      if (event.error?.name === "ChunkLoadError" || event.message?.includes("Loading chunk")) {
        console.error("Chunk loading error detected, reloading page...")
        window.location.reload()
      }
    }

    window.addEventListener("error", handleChunkError)
    return () => window.removeEventListener("error", handleChunkError)
  }, [])
}
