"use client"

import { AlertTriangle, Loader2, Shield } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Alert, AlertDescription } from "../../../components/ui/alert"
import { Button } from "../../../components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card"
import { useUser } from "../../../hooks/use-clerk-safe"

export default function AdminSetupPage() {
  const router = useRouter()
  const { user, isLoaded } = useUser()
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingStatus, setIsCheckingStatus] = useState(true)
  const [canSetupAdmin, setCanSetupAdmin] = useState(false)
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)

  const checkAdminSetupStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/setup-status")
      if (response.ok) {
        const data = await response.json()
        setCanSetupAdmin(data.canSetupAdmin)
        setCurrentUserRole(data.currentUserRole)
      }
    } catch (error) {
      console.error("Error checking admin setup status:", error)
      toast.error("Failed to check admin setup status")
    } finally {
      setIsCheckingStatus(false)
    }
  }, [])

  useEffect(() => {
    if (!isLoaded) return

    if (!user) {
      router.push("/sign-in")
      return
    }

    checkAdminSetupStatus()
  }, [user, isLoaded, router, checkAdminSetupStatus])

  const handleSetupSuperAdmin = async () => {
    if (!user) return

    setIsLoading(true)
    try {
      const response = await fetch("/api/admin/setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
        }),
      })

      if (response.ok) {
        toast.success("Super admin setup completed successfully!")
        router.push("/dashboard/admin")
      } else {
        const error = await response.json()
        toast.error(error.message || "Failed to setup super admin")
      }
    } catch (error) {
      console.error("Error setting up super admin:", error)
      toast.error("Failed to setup super admin")
    } finally {
      setIsLoading(false)
    }
  }

  if (!isLoaded || isCheckingStatus) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  if (currentUserRole === "SUPER_ADMIN") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Shield className="mx-auto mb-4 h-12 w-12 text-green-600" />
            <CardTitle>Already Super Admin</CardTitle>
            <CardDescription>
              You are already a super admin. You can access the admin dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/dashboard/admin")} className="w-full">
              Go to Admin Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!canSetupAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-red-600" />
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              Super admin has already been set up for this application.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/dashboard")} className="w-full">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Shield className="mx-auto mb-4 h-12 w-12 text-blue-600" />
          <CardTitle>Setup Super Admin</CardTitle>
          <CardDescription>
            You are the first user to access this application. Set yourself up as the super admin to
            manage the system.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This action will grant you full administrative privileges. Only proceed if you are
              authorized to manage this application.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <p className="text-gray-600 text-sm">
              <strong>Email:</strong> {user.emailAddresses[0]?.emailAddress}
            </p>
            <p className="text-gray-600 text-sm">
              <strong>Name:</strong> {user.firstName} {user.lastName}
            </p>
          </div>

          <Button onClick={handleSetupSuperAdmin} disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Setting up...
              </>
            ) : (
              "Setup Super Admin"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
