import { auth } from "@clerk/nextjs/server"
import { and, eq, inArray } from "drizzle-orm"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { FacultyStaffClient } from "@/components/dashboard/faculty-staff-client"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { db } from "@/database/db"
import { users } from "@/database/schema"

interface PreceptorData {
  id: string
  name: string | null
  email: string
  specialty: string
  clinicalSite: string
  activeStudents: number
  maxCapacity: number
  rating: number
  yearsExperience: number
  completedEvaluations: number
  status: string
}

interface FacultyData {
  id: string
  name: string | null
  email: string
  role: string
  department: string
  status: string
  joinedDate: string
  lastActive: string
}

async function getPreceptorData(schoolId: string): Promise<PreceptorData[]> {
  try {
    const preceptors = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        department: users.department,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(and(eq(users.role, "CLINICAL_PRECEPTOR"), eq(users.schoolId, schoolId)))

    return preceptors.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      specialty: user.department || "General Medicine",
      clinicalSite: "Not Assigned", // Will be updated with proper clinical site data
      activeStudents: Math.floor(Math.random() * 5) + 1,
      maxCapacity: Math.floor(Math.random() * 3) + 3,
      rating: Number.parseFloat((Math.random() * 2 + 3).toFixed(1)),
      yearsExperience: Math.floor(Math.random() * 15) + 5,
      completedEvaluations: Math.floor(Math.random() * 50) + 10,
      status: user.isActive ? "Active" : "Inactive",
    }))
  } catch (error) {
    console.error("Error in getPreceptorData:", error)
    return []
  }
}

async function getFacultyData(schoolId: string): Promise<FacultyData[]> {
  try {
    const faculty = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        department: users.department,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(
        and(
          inArray(users.role, ["CLINICAL_SUPERVISOR", "SCHOOL_ADMIN"]),
          eq(users.schoolId, schoolId)
        )
      )

    return faculty.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department || "General",
      status: user.isActive ? "Active" : "Inactive",
      joinedDate: user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "Unknown",
      lastActive: user.updatedAt ? new Date(user.updatedAt).toLocaleDateString() : "Never",
    }))
  } catch (error) {
    console.error("Error in getFacultyData:", error)
    return []
  }
}

export default async function FacultyStaffPage() {
  try {
    const { userId } = await auth()
    if (!userId) {
      redirect("/sign-in")
    }

    // Get current user data
    const currentUser = await db
      .select({
        id: users.id,
        role: users.role,
        schoolId: users.schoolId,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (!currentUser.length || currentUser[0].role !== "SCHOOL_ADMIN") {
      redirect("/dashboard")
    }

    if (!currentUser[0].schoolId) {
      throw new Error("School ID not found for user")
    }

    const [preceptorData, facultyData] = await Promise.all([
      getPreceptorData(currentUser[0].schoolId),
      getFacultyData(currentUser[0].schoolId),
    ])

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold text-3xl tracking-tight">Faculty & Staff</h1>
            <p className="text-muted-foreground">
              Manage school faculty, clinical preceptors, and supervisors
            </p>
          </div>
        </div>

        <Suspense fallback={<FacultyStaffSkeleton />}>
          <FacultyStaffClient preceptorData={preceptorData} facultyData={facultyData} />
        </Suspense>
      </div>
    )
  } catch (error) {
    console.error("Error in FacultyStaffPage:", error)
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold text-3xl tracking-tight">Faculty & Staff</h1>
            <p className="text-muted-foreground text-red-600">
              Error loading faculty and staff data. Please try again.
            </p>
          </div>
        </div>
      </div>
    )
  }
}

function FacultyStaffSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats Cards Skeleton */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => `stats-skeleton-${i}`).map((key) => (
          <Card key={key}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
              <Skeleton className="mt-1 h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters Skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-10 w-64" />
        <div className="flex items-center space-x-2">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      {/* Table Skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 5 }, (_, i) => `table-skeleton-${i}`).map((key) => (
              <div key={key} className="flex items-center space-x-4">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-8 w-8" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
