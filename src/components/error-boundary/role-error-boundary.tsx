"use client"

import { Component, type ErrorInfo, type ReactNode } from "react"
import { AlertTriangle, RefreshCw, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
}

/**
 * Error boundary specifically for role-based access control errors
 * Handles permission conflicts and role mismatches gracefully
 */
export class RoleErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State | null {
    // Ignore NEXT_REDIRECT errors to allow Next.js to handle redirects
    if (error.message === "NEXT_REDIRECT" || error.message.includes("NEXT_REDIRECT")) {
      return null
    }

    // Check if this is a role-related error
    const isRoleError =
      error.message.includes("Invalid user role") ||
      error.message.includes("Unexpected user role") ||
      error.message.includes("role") ||
      error.message.includes("permission")

    return {
      hasError: true,
      error: isRoleError ? error : new Error("Access denied due to permission error"),
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error for security audit
    console.error("🚨 SECURITY ALERT - Role Error Boundary caught error:", error)
    console.error("🚨 SECURITY ALERT - Error info:", errorInfo)
    console.error("🚨 SECURITY ALERT - Timestamp:", new Date().toISOString())

    // Log additional context for debugging
    console.error("🔍 AUDIT: Role-based access error occurred")
    console.error("🔍 AUDIT: Error message:", error.message)
    console.error("🔍 AUDIT: Component stack:", errorInfo.componentStack)

    this.setState({ hasError: true, error, errorInfo })
  }

  handleRetry = () => {
    console.log("🔄 RoleErrorBoundary: User attempting to retry after role error")
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })
    // Force a page reload to restart the authentication flow
    window.location.reload()
  }

  handleSignOut = () => {
    console.log("🔄 RoleErrorBoundary: User signing out due to role error")
    console.log("🔍 AUDIT: User initiated sign-out from role error boundary")
    // Redirect to sign-out page
    window.location.href = "/auth/sign-out"
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI for role errors
      if (this.props.fallback) {
        return this.props.fallback
      }

      const isRoleError =
        this.state.error?.message.includes("Invalid user role") ||
        this.state.error?.message.includes("Unexpected user role")

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                {isRoleError ? (
                  <Shield className="h-6 w-6 text-error" />
                ) : (
                  <AlertTriangle className="h-6 w-6 text-error" />
                )}
              </div>
              <CardTitle className="text-xl font-semibold text-gray-900">
                {isRoleError ? "Access Permission Error" : "Authentication Error"}
              </CardTitle>
              <CardDescription className="text-gray-600">
                {isRoleError
                  ? "There's an issue with your account permissions. Please contact support."
                  : "We encountered an authentication problem. Please try signing in again."}
              </CardDescription>
            </CardHeader>
            <CardContent className="gap-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error Details</AlertTitle>
                <AlertDescription className="text-sm">
                  {this.state.error?.message || "An unexpected error occurred"}
                </AlertDescription>
              </Alert>
              <div className="flex flex-col gap-2">
                <Button onClick={this.handleRetry} className="w-full" variant="default">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try Again
                </Button>
                <Button onClick={this.handleSignOut} className="w-full" variant="outline">
                  Sign Out & Restart
                </Button>
              </div>
              {process.env.NODE_ENV === "development" && this.state.errorInfo && (
                <details className="mt-4 text-xs text-gray-500">
                  <summary className="cursor-pointer font-medium">
                    Technical Details (Development Only)
                  </summary>
                  <pre className="mt-2 whitespace-pre-wrap break-words">
                    {this.state.error?.stack}
                  </pre>
                  <pre className="mt-2 whitespace-pre-wrap break-words">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

export default RoleErrorBoundary
