"use client"

import type { User } from "@clerk/nextjs/server"
import {
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle,
  Clock,
  GraduationCap,
  School,
  Settings,
  Shield,
  Users,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { UserRole } from "@/types"

interface UserData {
  id: string
  email: string
  name: string
  role: UserRole
  schoolId: string | null
  programId: string | null
}

interface OnboardingCompleteProps {
  user: UserData
  clerkUser: User
}

export function OnboardingComplete({ user, clerkUser }: OnboardingCompleteProps) {
  const router = useRouter()
  const [countdown, setCountdown] = useState(5)
  const [autoRedirect, setAutoRedirect] = useState(true)

  useEffect(() => {
    if (autoRedirect && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1)
      }, 1000)
      return () => clearTimeout(timer)
    }
    if (autoRedirect && countdown === 0) {
      router.push("/dashboard")
    }
  }, [countdown, autoRedirect, router])

  const getRoleInfo = () => {
    switch (user?.role) {
      case "SUPER_ADMIN":
        return {
          icon: Shield,
          title: "Super Administrator",
          color: "text-purple-600 dark:text-purple-400",
          bgColor: "bg-purple-100 dark:bg-purple-900/20",
          description: "You have full system access and can manage all aspects of the platform.",
          nextSteps: [
            { icon: Settings, text: "Configure system settings and permissions" },
            { icon: Users, text: "Manage user accounts and roles" },
            { icon: School, text: "Oversee school registrations and approvals" },
          ],
        }
      case "SCHOOL_ADMIN":
        return {
          icon: School,
          title: "School Administrator",
          color: "text-green-600 dark:text-green-400",
          bgColor: "bg-green-100 dark:bg-green-900/20",
          description:
            "You can manage your school's programs, students, and clinical partnerships.",
          nextSteps: [
            { icon: Users, text: "Invite and manage students" },
            { icon: BookOpen, text: "Set up clinical rotations and programs" },
            { icon: Settings, text: "Configure school settings and preferences" },
          ],
        }
      case "STUDENT":
        return {
          icon: GraduationCap,
          title: "Student",
          color: "text-blue-600 dark:text-blue-400",
          bgColor: "bg-blue-100 dark:bg-blue-900/20",
          description:
            "You can track your clinical rotations, log hours, and access educational resources.",
          nextSteps: [
            { icon: Calendar, text: "View your rotation schedule" },
            { icon: Clock, text: "Start logging clinical hours" },
            { icon: BookOpen, text: "Access learning materials and resources" },
          ],
        }
      default:
        return {
          icon: Users,
          title: "User",
          color: "text-gray-600 dark:text-gray-400",
          bgColor: "bg-gray-100 dark:bg-gray-900/20",
          description: "Welcome to the MedStint platform.",
          nextSteps: [
            { icon: Settings, text: "Complete your profile setup" },
            { icon: BookOpen, text: "Explore available features" },
          ],
        }
    }
  }

  const roleInfo = getRoleInfo()
  const RoleIcon = roleInfo.icon

  return (
    <Card className="w-full">
      <CardHeader className="text-center">
        <div
          className={`mx-auto h-20 w-20 ${roleInfo.bgColor} mb-4 flex items-center justify-center rounded-full`}
        >
          <CheckCircle className="h-10 w-10 text-green-500" />
        </div>
        <CardTitle className="font-bold text-2xl text-green-900 dark:text-green-100">
          Registration Complete!
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Welcome Message */}
        <div className="space-y-4 text-center">
          <div className="flex items-center justify-center space-x-2">
            <span className="text-lg">Welcome,</span>
            <span className="font-semibold text-lg">{user?.name || clerkUser.firstName}</span>
          </div>

          <div className="flex items-center justify-center space-x-2">
            <Badge variant="secondary" className="flex items-center space-x-1">
              <RoleIcon className={`h-4 w-4 ${roleInfo.color}`} />
              <span>{roleInfo.title}</span>
            </Badge>
          </div>

          <p className="mx-auto max-w-md text-gray-600 dark:text-gray-300">
            {roleInfo.description}
          </p>
        </div>

        {/* Next Steps */}
        <div className="space-y-4">
          <h3 className="text-center font-semibold text-lg">Next Steps</h3>
          <div className="space-y-3">
            {roleInfo.nextSteps.map((step, _index) => {
              const StepIcon = step.icon
              return (
                <div
                  key={`step-${step.text.replace(/\s+/g, "-").toLowerCase()}-${step.text.length}`}
                  className="flex items-center space-x-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-800"
                >
                  <div
                    className={`h-8 w-8 ${roleInfo.bgColor} flex flex-shrink-0 items-center justify-center rounded-full`}
                  >
                    <StepIcon className={`h-4 w-4 ${roleInfo.color}`} />
                  </div>
                  <span className="text-sm">{step.text}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Auto-redirect notice */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ArrowRight className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="text-blue-800 text-sm dark:text-blue-200">
                {autoRedirect
                  ? `Redirecting to dashboard in ${countdown} seconds...`
                  : "Ready to explore your dashboard"}
              </span>
            </div>
            {autoRedirect && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAutoRedirect(false)}
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                Cancel
              </Button>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            onClick={() => router.push("/dashboard")}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            <ArrowRight className="mr-2 h-4 w-4" />
            Go to Dashboard
          </Button>

          {user?.role === "SCHOOL_ADMIN" && (
            <Button
              variant="outline"
              onClick={() => router.push("/dashboard/settings")}
              className="flex-1"
            >
              <Settings className="mr-2 h-4 w-4" />
              School Settings
            </Button>
          )}

          {user?.role === "STUDENT" && (
            <Button
              variant="outline"
              onClick={() => router.push("/dashboard/rotations")}
              className="flex-1"
            >
              <Calendar className="mr-2 h-4 w-4" />
              View Rotations
            </Button>
          )}

          {user?.role === "SUPER_ADMIN" && (
            <Button
              variant="outline"
              onClick={() => router.push("/dashboard/admin")}
              className="flex-1"
            >
              <Shield className="mr-2 h-4 w-4" />
              Admin Panel
            </Button>
          )}
        </div>

        {/* Help Section */}
        <div className="border-gray-200 border-t pt-4 text-center dark:border-gray-700">
          <p className="mb-2 text-gray-500 text-sm dark:text-gray-400">
            Need help getting started?
          </p>
          <div className="flex justify-center space-x-4">
            <Button variant="link" size="sm" className="text-blue-600 hover:text-blue-700">
              View Help Guide
            </Button>
            <Button variant="link" size="sm" className="text-blue-600 hover:text-blue-700">
              Contact Support
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
