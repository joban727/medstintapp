// TODO: Add cache invalidation hooks for mutations
"use client"

import {
  ArrowRight,
  BookOpen,
  Building2,
  Calendar,
  CheckCircle,
  ClipboardList,
  GraduationCap,
  Settings,
  UserPlus,
  Users,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import type { UserRole } from "../../types"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
import { motion } from "framer-motion"

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
  schoolName?: string
  programName?: string
  studentId?: string
  firstName?: string
  lastName?: string
  adminFirstName?: string
  adminLastName?: string
  programs?: Array<{ id: string; name: string }>
}

interface OnboardingCompletionProps {
  userType: "school" | "student"
  userData: UserData
  onContinue: () => void
}

interface NextStep {
  icon: React.ReactNode
  title: string
  description: string
  action: string
  href: string
  priority: "high" | "medium" | "low"
}

export function OnboardingCompletion({
  userType,
  userData,
  onContinue,
}: OnboardingCompletionProps) {
  const router = useRouter()
  const [isRedirecting, setIsRedirecting] = useState(false)

  const getNextSteps = (): NextStep[] => {
    if (userType === "school") {
      return [
        {
          icon: <UserPlus className="h-5 w-5" />,
          title: "Invite Clinical Students",
          description: "Add students to your programs and manage their clinical rotations",
          action: "Manage Students",
          href: "/dashboard/admin/students",
          priority: "high",
        },
        {
          icon: <BookOpen className="h-5 w-5" />,
          title: "Configure Programs",
          description: "Set up curriculum, requirements, and clinical site partnerships",
          action: "Manage Programs",
          href: "/dashboard/admin/programs",
          priority: "high",
        },
        {
          icon: <Building2 className="h-5 w-5" />,
          title: "Add Clinical Sites",
          description: "Partner with hospitals and clinics for student rotations",
          action: "Manage Sites",
          href: "/dashboard/admin/clinical-sites",
          priority: "medium",
        },
        {
          icon: <Settings className="h-5 w-5" />,
          title: "School Settings",
          description: "Configure school policies, grading systems, and notifications",
          action: "School Settings",
          href: "/dashboard/admin/settings",
          priority: "low",
        },
      ]
    }

    return [
      {
        icon: <Calendar className="h-5 w-5" />,
        title: "View Schedule",
        description: "Check your upcoming clinical rotations and class schedule",
        action: "View Schedule",
        href: "/dashboard/schedule",
        priority: "high",
      },
      {
        icon: <ClipboardList className="h-5 w-5" />,
        title: "Complete Profile",
        description: "Add additional information and upload required documents",
        action: "Update Profile",
        href: "/dashboard/profile",
        priority: "high",
      },
      {
        icon: <BookOpen className="h-5 w-5" />,
        title: "Course Materials",
        description: "Access your program curriculum and learning resources",
        action: "View Courses",
        href: "/dashboard/courses",
        priority: "medium",
      },
      {
        icon: <Users className="h-5 w-5" />,
        title: "Connect with Peers",
        description: "Join study groups and connect with other students",
        action: "Student Community",
        href: "/dashboard/community",
        priority: "low",
      },
    ]
  }

  const nextSteps = getNextSteps()
  const highPrioritySteps = nextSteps.filter((step) => step.priority === "high")
  const otherSteps = nextSteps.filter((step) => step.priority !== "high")

  const handleContinue = async () => {
    setIsRedirecting(true)
    try {
      // Use atomic completion function to prevent race conditions
      const response = await fetch("/api/user/onboarding-complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch((err) => {
          console.error("Failed to parse JSON response:", err)
          throw new Error("Invalid response format")
        })
        throw new Error(errorData.error || "Failed to complete onboarding")
      }

      const _result = await response.json().catch((err) => {
        console.error("Failed to parse JSON response:", err)
        throw new Error("Invalid response format")
      })

      toast.success("Welcome to MedStint! Redirecting to your dashboard...")

      // Clear any onboarding state from sessionStorage
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("onboarding-state")
        sessionStorage.removeItem("onboarding-step")
        sessionStorage.removeItem("user-type")
      }

      // Redirect to dashboard (let the dashboard router handle role-specific routing)
      setTimeout(() => {
        router.push("/dashboard")
        onContinue()
      }, 1500)
    } catch (error) {
      // Error during final setup
      toast.error(
        error instanceof Error ? error.message : "Something went wrong. Please try again."
      )
      setIsRedirecting(false)
    }
  }

  const handleStepAction = (href: string) => {
    router.push(href)
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800 border-red-200"
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "low":
        return "bg-green-100 text-green-800 border-green-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 via-white to-green-100 p-4">
      <div className="w-full max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Card className="shadow-xl">
            <CardHeader className="pb-6 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="mx-auto mb-4"
              >
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle className="h-12 w-12 text-healthcare-green" />
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <CardTitle className="text-center text-2xl">Welcome to MedStint!</CardTitle>
                <CardDescription className="text-gray-600 text-lg">
                  {userType === "school"
                    ? `Your school has been successfully set up. You're now ready to manage your clinical education programs.`
                    : `Your student account has been created. You're now ready to begin your clinical education journey.`}
                </CardDescription>
              </motion.div>
            </CardHeader>
            <CardContent className="p-8">
              {/* Summary Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="mb-8"
              >
                <Card className="border-green-200 bg-gradient-to-r from-green-50 to-blue-50">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
                        {userType === "school" ? (
                          <Building2 className="h-6 w-6 text-healthcare-green" />
                        ) : (
                          <GraduationCap className="h-6 w-6 text-healthcare-green" />
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="mb-2 font-semibold text-gray-900">
                          {userType === "school"
                            ? "School Setup Complete"
                            : "Student Enrollment Complete"}
                        </h3>
                        <div className="gap-1 text-gray-600 text-sm">
                          {userType === "school" ? (
                            <>
                              <p>
                                <span className="font-medium">School:</span>{" "}
                                {userData?.schoolName || "Your School"}
                              </p>
                              <p>
                                <span className="font-medium">Administrator:</span>{" "}
                                {userData?.adminFirstName} {userData?.adminLastName}
                              </p>
                              <p>
                                <span className="font-medium">Programs:</span>{" "}
                                {userData?.programs?.length || 0} program(s) configured
                              </p>
                            </>
                          ) : (
                            <>
                              <p>
                                <span className="font-medium">Student:</span> {userData?.firstName}{" "}
                                {userData?.lastName}
                              </p>
                              <p>
                                <span className="font-medium">School:</span>{" "}
                                {userData?.schoolName || "Selected School"}
                              </p>
                              <p>
                                <span className="font-medium">Program:</span>{" "}
                                {userData?.programName || "Selected Program"}
                              </p>
                              <p>
                                <span className="font-medium">Student ID:</span>{" "}
                                {userData?.studentId}
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Next Steps */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="mb-8"
              >
                <h3 className="mb-6 font-semibold text-gray-900 text-xl">Recommended Next Steps</h3>

                {/* High Priority Steps */}
                {highPrioritySteps.length > 0 && (
                  <div className="mb-6">
                    <div className="mb-4 flex items-center gap-2">
                      <Badge className="border-red-200 bg-red-100 text-red-800">
                        High Priority
                      </Badge>
                      <span className="text-gray-600 text-sm">Complete these first</span>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {highPrioritySteps.map((step, index) => (
                        <motion.div
                          key={`high-priority-${step.title
                            .replace(/\s+/g, "-")
                            .toLowerCase()}-${step.href.split("/").pop()}`}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 1 + index * 0.1 }}
                        >
                          <Card
                            className="h-full cursor-pointer border-red-200 bg-red-50/30 transition-all duration-200 hover:shadow-md"
                            onClick={() => handleStepAction(step.href)}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-start gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-error">
                                  {step.icon}
                                </div>
                                <div className="flex-1">
                                  <h4 className="mb-1 font-medium text-gray-900">{step.title}</h4>
                                  <p className="mb-3 text-gray-600 text-sm">{step.description}</p>
                                  <Button size="sm" variant="outline" className="text-xs">
                                    {step.action}
                                    <ArrowRight className="ml-1 h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Other Steps */}
                {otherSteps.length > 0 && (
                  <div>
                    <div className="mb-4 flex items-center gap-2">
                      <Badge variant="outline">Additional Options</Badge>
                      <span className="text-gray-600 text-sm">Complete when ready</span>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {otherSteps.map((step, index) => (
                        <motion.div
                          key={`other-step-${step.title
                            .replace(/\s+/g, "-")
                            .toLowerCase()}-${step.priority}-${step.href.split("/").pop()}`}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 1.2 + index * 0.1 }}
                        >
                          <Card
                            className="h-full cursor-pointer transition-all duration-200 hover:shadow-md"
                            onClick={() => handleStepAction(step.href)}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-start gap-3">
                                <div
                                  className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                                    step.priority === "medium"
                                      ? "bg-yellow-100 text-yellow-600"
                                      : "bg-green-100 text-healthcare-green"
                                  }`}
                                >
                                  {step.icon}
                                </div>
                                <div className="flex-1">
                                  <div className="mb-1 flex items-center gap-2">
                                    <h4 className="font-medium text-gray-900">{step.title}</h4>
                                    <Badge
                                      variant="outline"
                                      className={`text-xs ${getPriorityColor(step.priority)}`}
                                    >
                                      {step.priority}
                                    </Badge>
                                  </div>
                                  <p className="mb-3 text-gray-600 text-sm">{step.description}</p>
                                  <Button size="sm" variant="outline" className="text-xs">
                                    {step.action}
                                    <ArrowRight className="ml-1 h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>

              {/* Continue Button */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.4 }}
                className="text-center"
              >
                <Button
                  onClick={handleContinue}
                  disabled={isRedirecting}
                  size="lg"
                  className="bg-healthcare-green px-8 py-3 text-lg text-white hover:bg-green-700 transition-colors duration-200"
                >
                  {isRedirecting ? (
                    "Redirecting to Dashboard..."
                  ) : (
                    <>
                      Go to Dashboard <ArrowRight className="ml-2 h-5 w-5" />
                    </>
                  )}
                </Button>
                <p className="mt-3 text-gray-500 text-sm">
                  You can access these features anytime from your dashboard
                </p>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
