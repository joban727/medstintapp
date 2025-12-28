// TODO: Add cache invalidation hooks for mutations
"use client"

import { useAuth } from "@clerk/nextjs"
import { CheckCircle, Database, Settings, Shield, User as UserIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useId, useState, useTransition } from "react"
import { toast } from "sonner"
import type { UserRole } from "../../types"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Progress } from "../ui/progress"
import { Textarea } from "../ui/textarea"

const validateEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

interface UserData {
  id: string
  email: string
  name: string
  role: UserRole
  schoolId: string | null
  programId: string | null
  onboardingCompleted?: boolean
}

interface ClerkUser {
  id: string
  firstName: string | null
  lastName: string | null
  emailAddresses: {
    id: string
    emailAddress: string
    verification: { status: string; strategy: string } | null
    linkedTo: string[]
  }[]
}

interface SuperAdminOnboardingProps {
  user: UserData
  clerkUser: ClerkUser
}

type Step = "welcome" | "profile" | "permissions" | "complete"

export function SuperAdminOnboarding({ user, clerkUser }: SuperAdminOnboardingProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [currentStep, setCurrentStep] = useState<Step>("welcome")
  const [_isSubmitting, setIsSubmitting] = useState(false)

  // Generate unique IDs for form fields
  const nameId = useId()
  const emailId = useId()
  const phoneId = useId()
  const departmentId = useId()
  const notesId = useId()

  const { getToken } = useAuth()

  // Form data
  const [profileData, setProfileData] = useState({
    name: user?.name || `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() || "",
    email: user?.email || clerkUser.emailAddresses?.[0]?.emailAddress || "",
    phone: "",
    department: "System Administration",
    notes: "",
  })

  const steps: Record<Step, { title: string; description: string; progress: number }> = {
    welcome: { title: "Welcome", description: "Super Admin Setup", progress: 25 },
    profile: { title: "Profile", description: "Administrator Information", progress: 50 },
    permissions: { title: "Permissions", description: "Access Configuration", progress: 75 },
    complete: { title: "Complete", description: "Setup Complete", progress: 100 },
  }

  const handleUpdateUser = async (
    updates: Partial<UserData> & { phone?: string; department?: string }
  ) => {
    try {
      const token = await getToken()
      const response = await fetch("/api/user/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        let message = "Failed to update user information"
        try {
          const data = await response.json().catch((err) => {
            console.error("Failed to parse JSON response:", err)
            throw new Error("Invalid response format")
          })
          message = data?.error || data?.message || message
        } catch {
          try {
            const text = await response.text()
            if (text) message = text
          } catch { }
        }
        throw new Error(message)
      }

      return await response.json()
    } catch (error) {
      // Error updating user
      const errorMessage =
        error instanceof Error ? error.message : "Failed to update user information"
      toast.error(errorMessage)
      throw error
    }
  }

  const _handleProfileUpdate = async () => {
    setIsSubmitting(true)
    try {
      const token = await getToken()
      const response = await fetch("/api/user/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: profileData.name,
          email: profileData.email,
          phone: profileData.phone,
          department: profileData.department,
          role: "SUPER_ADMIN",
        }),
      })

      if (!response.ok) {
        let message = "Failed to update user information"
        try {
          const data = await response.json().catch((err) => {
            console.error("Failed to parse JSON response:", err)
            throw new Error("Invalid response format")
          })
          message = data?.error || data?.message || message
        } catch {
          try {
            const text = await response.text()
            if (text) message = text
          } catch { }
        }
        throw new Error(message)
      }

      const _data = await response.json().catch((err) => {
        console.error("Failed to parse JSON response:", err)
        throw new Error("Invalid response format")
      })
      toast.success("Profile updated successfully")

      const completeRes = await fetch("/api/user/onboarding-complete", {
        method: "POST",
      })
      if (!completeRes.ok) {
        // Failed to mark onboarding complete
      }

      try {
        window.location.assign("/dashboard")
      } catch { }
    } catch (error) {
      // Error during onboarding completion
      const errorMessage =
        error instanceof Error ? error.message : "Failed to update user information"
      toast.error(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleNext = () => {
    startTransition(async () => {
      try {
        switch (currentStep) {
          case "welcome":
            setCurrentStep("profile")
            break
          case "profile":
            if (!profileData.name.trim()) {
              toast.error("Please enter your name")
              return
            }
            if (!profileData.email.trim()) {
              toast.error("Please enter your email")
              return
            }
            await handleUpdateUser({
              name: profileData.name,
              email: profileData.email,
              phone: profileData.phone,
              department: profileData.department,
              role: "SUPER_ADMIN",
            })
            setCurrentStep("permissions")
            break
          case "permissions":
            setCurrentStep("complete")
            break
          case "complete": {
            // Mark onboarding as complete using the proper API endpoint
            const token = await getToken()
            const completeResponse = await fetch("/api/user/onboarding-complete", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
            })

            if (!completeResponse.ok) {
              const errorData = await completeResponse.json()
              toast.error(errorData.error || "Failed to complete onboarding")
              return
            }

            toast.success("Super Admin account created successfully!")
            try {
              window.location.assign("/dashboard")
            } catch { }
            break
          }
        }
      } catch (_error) {
        // Onboarding error
      }
    })
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case "welcome":
        return (
          <div className="gap-6 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
              <Shield className="h-10 w-10 text-error dark:text-red-400" />
            </div>
            <div>
              <h3 className="mb-3 font-semibold text-2xl">Welcome, Super Administrator!</h3>
              <p className="mb-4 text-gray-600 dark:text-gray-300">
                You're about to set up a super administrator account with full platform access.
              </p>
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Important:</strong> Super administrators have unrestricted access to all
                  MedStint platform features, including user management, system configuration, and sensitive
                  data.
                </p>
              </div>
            </div>
          </div>
        )
      case "profile":
        return (
          <div className="gap-6">
            <div className="mb-6 text-center">
              <UserIcon className="mx-auto mb-4 h-12 w-12 text-red-500" />
              <h3 className="mb-2 font-semibold text-xl">Administrator Profile</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Set up your administrator profile information.
              </p>
            </div>
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="gap-2">
                  <Label htmlFor={nameId}>Full Name *</Label>
                  <Input
                    id={nameId}
                    value={profileData.name}
                    onChange={(e) => setProfileData((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter your full name"
                  />
                </div>
                <div className="gap-2">
                  <Label htmlFor={emailId}>Email Address *</Label>
                  <Input
                    id={emailId}
                    type="email"
                    value={profileData.email}
                    onChange={(e) => setProfileData((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="Enter your email"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="gap-2">
                  <Label htmlFor={phoneId}>Phone Number</Label>
                  <Input
                    id={phoneId}
                    value={profileData.phone}
                    onChange={(e) => setProfileData((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="Enter your phone number"
                  />
                </div>
                <div className="gap-2">
                  <Label htmlFor={departmentId}>Department</Label>
                  <Input
                    id={departmentId}
                    value={profileData.department}
                    onChange={(e) =>
                      setProfileData((prev) => ({ ...prev, department: e.target.value }))
                    }
                    placeholder="Your department"
                  />
                </div>
              </div>
              <div className="gap-2">
                <Label htmlFor={notesId}>Additional Notes (Optional)</Label>
                <Textarea
                  id={notesId}
                  value={profileData.notes}
                  onChange={(e) => setProfileData((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Any additional information about your role or responsibilities"
                  rows={3}
                />
              </div>
            </div>
          </div>
        )
      case "permissions":
        return (
          <div className="gap-6">
            <div className="mb-6 text-center">
              <Settings className="mx-auto mb-4 h-12 w-12 text-red-500" />
              <h3 className="mb-2 font-semibold text-xl">Super Administrator Permissions</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Review the permissions that will be granted to your account.
              </p>
            </div>
            <div className="gap-4">
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
                <div className="mb-3 flex items-center gap-3">
                  <Shield className="h-5 w-5 text-error" />
                  <h4 className="font-semibold text-red-900 dark:text-red-100">
                    Full Platform Access
                  </h4>
                </div>
                <ul className="gap-2 text-red-800 text-sm dark:text-red-200">
                  <li className="flex items-center gap-2">
                    <div className="h-1 w-1 rounded-full bg-error" />
                    <span>Manage all schools, programs, and users</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="h-1 w-1 rounded-full bg-error" />
                    <span>Access system configuration and settings</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="h-1 w-1 rounded-full bg-error" />
                    <span>View all data and generate comprehensive reports</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="h-1 w-1 rounded-full bg-error" />
                    <span>Create and manage other administrator accounts</span>
                  </li>
                </ul>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
                <div className="mb-3 flex items-center gap-3">
                  <Database className="h-5 w-5 text-medical-primary" />
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100">
                    Data Management
                  </h4>
                </div>
                <ul className="gap-2 text-blue-800 text-sm dark:text-blue-200">
                  <li className="flex items-center gap-2">
                    <div className="h-1 w-1 rounded-full bg-medical-primary" />
                    <span>Full database access and management</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="h-1 w-1 rounded-full bg-medical-primary" />
                    <span>Data export and backup capabilities</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="h-1 w-1 rounded-full bg-medical-primary" />
                    <span>Audit log access and monitoring</span>
                  </li>
                </ul>
              </div>
              <div className="flex items-center justify-center">
                <Badge variant="destructive" className="px-4 py-2 text-sm">
                  SUPER_ADMIN Role
                </Badge>
              </div>
            </div>
          </div>
        )
      case "complete":
        return (
          <div className="gap-6 text-center">
            <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
            <div>
              <h3 className="mb-3 font-semibold text-2xl text-green-900 dark:text-green-100">
                Super Admin Account Created!
              </h3>
              <p className="mb-4 text-gray-600 dark:text-gray-300">
                Your super administrator account has been successfully configured.
              </p>
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
                <p className="text-green-800 text-sm dark:text-green-200">
                  You now have full access to the MedStint platform. You can manage schools, users,
                  and system settings from your dashboard.
                </p>
              </div>
            </div>
          </div>
        )
      default:
        return null
    }
  }

  const currentStepInfo = steps[currentStep]

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="gap-2">
          <Progress value={currentStepInfo.progress} className="w-full" />
          <div className="flex justify-between text-gray-500 text-sm">
            <span>{currentStepInfo.description}</span>
            <span>{currentStepInfo.progress}%</span>
          </div>
        </div>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-red-500" />
          <span>{currentStepInfo.title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="gap-6">
        {renderStepContent()}
        <div className="flex justify-end">
          <Button
            onClick={handleNext}
            disabled={isPending}
            className="min-w-32 bg-error hover:bg-red-700"
          >
            {isPending
              ? "Processing..."
              : currentStep === "complete"
                ? "Go to Dashboard"
                : "Continue"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

interface UserTypeSelectionProps {
  user: UserData
  onNext: (data: any) => void
}
