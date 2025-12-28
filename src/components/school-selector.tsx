"use client"

import { Building2, CheckCircle, Users } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useId, useState } from "react"
import { Badge } from "./ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"

const validateEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

interface School {
  id: string
  name: string
  address: string | null
  email: string | null
  phone: string | null
  website: string | null
  isActive: boolean
  adminId: string | null
  createdAt: Date
  updatedAt: Date
}

interface SchoolSelectorProps {
  schools: School[]
  currentSchoolId?: string
  userRole: string
  className?: string
}

export function SchoolSelector({
  schools,
  currentSchoolId,
  userRole,
  className,
}: SchoolSelectorProps) {
  const [selectedSchool, setSelectedSchool] = useState<string>(currentSchoolId || "all")
  const router = useRouter()
  const selectId = useId()

  // Only show school selector for super admins
  if (userRole !== "SUPER_ADMIN") {
    return null
  }

  const handleSchoolChange = (schoolId: string) => {
    setSelectedSchool(schoolId)

    // Store selected school in session storage for persistence
    if (typeof window !== "undefined") {
      if (schoolId === "all") {
        sessionStorage.removeItem("selectedSchoolId")
      } else {
        try {
          sessionStorage.setItem("selectedSchoolId", schoolId)
        } catch (error) {
          console.error("Failed to save selected school ID:", error)
        }
      }
    }

    // Refresh the page to apply new school context
    router.refresh()
  }

  const selectedSchoolData = schools.find((school) => school.id === selectedSchool)

  return (
    <div className={className}>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-medical-primary" />
              <CardTitle className="text-lg">School Context</CardTitle>
            </div>
            <Badge variant="outline" className="bg-purple-50 text-purple-700">
              Super Admin
            </Badge>
          </div>
          <CardDescription>
            Select a school to view its specific data and manage its operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="gap-4">
            <div>
              <label htmlFor={selectId} className="mb-2 block font-medium text-sm">
                Active School Context
              </label>
              <Select value={selectedSchool} onValueChange={handleSchoolChange}>
                <SelectTrigger id={selectId} className="w-full">
                  <SelectValue placeholder="Select a school..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span>All Schools (Global View)</span>
                    </div>
                  </SelectItem>
                  {schools.map((school) => (
                    <SelectItem key={school.id} value={school.id}>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        <span>{school.name}</span>
                        {school.isActive && <CheckCircle className="h-3 w-3 text-green-500" />}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedSchoolData && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium text-blue-900">{selectedSchoolData.name}</h4>
                    <p className="mt-1 text-blue-700 text-sm">
                      {selectedSchoolData.address || "Address not provided"}
                    </p>
                    <p className="mt-1 text-medical-primary text-sm">
                      {selectedSchoolData.email || "Email not provided"}
                    </p>
                  </div>
                  <Badge
                    variant={selectedSchoolData.isActive ? "default" : "secondary"}
                    className={selectedSchoolData.isActive ? "bg-green-100 text-green-800" : ""}
                  >
                    {selectedSchoolData.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
            )}
            {selectedSchool === "all" && (
              <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-purple-600" />
                  <span className="font-medium text-purple-900 text-sm">Global View Active</span>
                </div>
                <p className="mt-1 text-purple-700 text-sm">
                  You can see data from all schools and manage system-wide operations.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Hook to get current school context
export function useSchoolContext() {
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null)

  useEffect(() => {
    // Get selected school from session storage
    if (typeof window !== "undefined") {
      const storedSchoolId = sessionStorage.getItem("selectedSchoolId")
      setSelectedSchoolId(storedSchoolId)
    }
  }, [])

  return {
    selectedSchoolId,
    isGlobalView: !selectedSchoolId,
  }
}
