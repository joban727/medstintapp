"use client"

import { Building2, Globe } from "lucide-react"
import { useEffect, useState } from "react"
import type { UserRole } from "../../types"
import { Badge } from "../ui/badge"

// Role validation utilities
const hasRole = (userRole: UserRole, allowedRoles: UserRole[]): boolean => {
  return allowedRoles.includes(userRole)
}

const isAdmin = (userRole: UserRole): boolean => {
  return hasRole(userRole, ["ADMIN" as UserRole, "SUPER_ADMIN" as UserRole])
}

const isSchoolAdmin = (userRole: UserRole): boolean => {
  return hasRole(userRole, [
    "SCHOOL_ADMIN" as UserRole,
    "ADMIN" as UserRole,
    "SUPER_ADMIN" as UserRole,
  ])
}

interface SchoolContext {
  schoolId: string | null
  schoolName: string | null
  userRole: UserRole
  userId: string
  canAccessAllSchools: boolean
}

interface SchoolNameDisplayProps {
  user: {
    id: string
    role: UserRole
    schoolId: string | null
  }
}

export function SchoolNameDisplay({ user }: SchoolNameDisplayProps) {
  const [schoolContext, setSchoolContext] = useState<SchoolContext | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null)

  useEffect(() => {
    // Get selected school from session storage for super admins
    if (typeof window !== "undefined" && user.role === ("SUPER_ADMIN" as UserRole as UserRole)) {
      const storedSchoolId = sessionStorage.getItem("selectedSchoolId")
      setSelectedSchoolId(storedSchoolId)
    }
  }, [user.role])

  useEffect(() => {
    async function fetchSchoolContext() {
      try {
        setIsLoading(true)
        const response = await fetch("/api/school-context")
        if (response.ok) {
          const context = await response.json().catch((err) => {
            console.error("Failed to parse JSON response:", err)
            throw new Error("Invalid response format")
          })
          setSchoolContext(context)
        }
      } catch (_error) {
        // Failed to fetch school context
      } finally {
        setIsLoading(false)
      }
    }

    fetchSchoolContext()
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 animate-pulse text-muted-foreground" />
        <span className="text-muted-foreground text-sm">Loading...</span>
      </div>
    )
  }

  if (!schoolContext) {
    return null
  }

  // For super admins, show selected school or global view
  if (user.role === ("SUPER_ADMIN" as UserRole as UserRole)) {
    if (selectedSchoolId && schoolContext.schoolName) {
      return (
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-medical-primary" />
          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
            {schoolContext.schoolName}
          </Badge>
        </div>
      )
    }
    return (
      <div className="flex items-center gap-2">
        <Globe className="h-4 w-4 text-purple-600" />
        <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700">
          All Schools
        </Badge>
      </div>
    )
  }

  // For other roles, show their associated school
  if (schoolContext.schoolName) {
    return (
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-medical-primary" />
        <Badge variant="outline" className="border-blue-200 bg-blue-50 font-medium text-blue-700">
          {schoolContext.schoolName}
        </Badge>
      </div>
    )
  }

  return null
}
