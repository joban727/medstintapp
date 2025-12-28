import { auth } from "@clerk/nextjs/server"
import { and, eq, inArray } from "drizzle-orm"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { FacultyStaffClient } from "@/components/dashboard/faculty-staff-client"
import { PageContainer, PageHeader } from "@/components/ui/page-container"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { db } from "@/database/connection-pool"
import { clinicalPreceptors, clinicalSites, evaluations, rotations, users } from "@/database/schema"
import type { UserRole } from "@/types"

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
    // First get preceptor base data
    const preceptors = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        department: users.department,
        isActive: users.isActive,
        createdAt: users.createdAt,
        clinicalSiteName: clinicalSites.name,
        maxStudents: clinicalPreceptors.maxStudents,
        currentStudentCount: clinicalPreceptors.currentStudentCount,
        yearsOfExperience: clinicalPreceptors.yearsOfExperience,
      })
      .from(users)
      .leftJoin(clinicalPreceptors, eq(users.id, clinicalPreceptors.userId))
      .leftJoin(clinicalSites, eq(clinicalPreceptors.clinicalSiteId, clinicalSites.id))
      .where(and(eq(users.role, "CLINICAL_PRECEPTOR"), eq(users.schoolId, schoolId)))

    // Get active student counts per preceptor from rotations
    const activeRotations = await db
      .select({
        preceptorId: rotations.preceptorId,
      })
      .from(rotations)
      .where(eq(rotations.status, "ACTIVE"))

    const activeStudentCounts = new Map<string, number>()
    for (const r of activeRotations) {
      if (r.preceptorId) {
        activeStudentCounts.set(r.preceptorId, (activeStudentCounts.get(r.preceptorId) || 0) + 1)
      }
    }

    // Get evaluation counts per preceptor
    const evalCounts = await db
      .select({
        evaluatorId: evaluations.evaluatorId,
      })
      .from(evaluations)

    const evaluationCounts = new Map<string, number>()
    for (const e of evalCounts) {
      if (e.evaluatorId) {
        evaluationCounts.set(e.evaluatorId, (evaluationCounts.get(e.evaluatorId) || 0) + 1)
      }
    }

    // Get average ratings per preceptor from evaluations
    const avgRatings = await db
      .select({
        evaluatorId: evaluations.evaluatorId,
        rating: evaluations.overallRating,
      })
      .from(evaluations)

    const ratingData = new Map<string, { sum: number; count: number }>()
    for (const e of avgRatings) {
      if (e.evaluatorId && e.rating !== null) {
        const current = ratingData.get(e.evaluatorId) || { sum: 0, count: 0 }
        current.sum += parseFloat(e.rating)
        current.count += 1
        ratingData.set(e.evaluatorId, current)
      }
    }

    return preceptors.map((user) => {
      const ratingInfo = ratingData.get(user.id)
      const avgRating = ratingInfo && ratingInfo.count > 0
        ? Math.round((ratingInfo.sum / ratingInfo.count) * 10) / 10
        : 0

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        specialty: user.department || "General Medicine",
        clinicalSite: user.clinicalSiteName || "Not Assigned",
        activeStudents: activeStudentCounts.get(user.id) || user.currentStudentCount || 0,
        maxCapacity: user.maxStudents || 4,
        rating: avgRating,
        yearsExperience: user.yearsOfExperience || 0,
        completedEvaluations: evaluationCounts.get(user.id) || 0,
        status: user.isActive ? "Active" : "Inactive",
      }
    })
  } catch (error) {
    console.error("Error in getPreceptorData:", error)
    return []
  }
}

async function getClinicalSites(schoolId: string) {
  try {
    return await db
      .select({
        id: clinicalSites.id,
        name: clinicalSites.name,
      })
      .from(clinicalSites)
      .where(and(eq(clinicalSites.schoolId, schoolId), eq(clinicalSites.isActive, true)))
      .orderBy(clinicalSites.name)
  } catch (error) {
    console.error("Error in getClinicalSites:", error)
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
      role: user.role ?? "Unknown",
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

    if (!currentUser.length || currentUser[0].role !== ("SCHOOL_ADMIN" as UserRole)) {
      redirect("/dashboard")
    }

    // If no school ID (e.g. skipped onboarding), return empty data
    if (!currentUser[0].schoolId) {
      return (
        <PageContainer>
          <PageHeader
            title="Faculty & Staff"
            description="Manage school faculty, clinical preceptors, and supervisors"
          />
          <FacultyStaffClient preceptorData={[]} facultyData={[]} clinicalSites={[]} />
        </PageContainer>
      )
    }

    const [preceptorData, facultyData, clinicalSitesData] = await Promise.all([
      getPreceptorData(currentUser[0].schoolId),
      getFacultyData(currentUser[0].schoolId),
      getClinicalSites(currentUser[0].schoolId),
    ])

    return (
      <PageContainer>
        <PageHeader
          title="Faculty & Staff"
          description="Manage school faculty, clinical preceptors, and supervisors"
        />

        <Suspense fallback={<FacultyStaffSkeleton />}>
          <FacultyStaffClient
            preceptorData={preceptorData}
            facultyData={facultyData}
            clinicalSites={clinicalSitesData}
          />
        </Suspense>
      </PageContainer>
    )
  } catch (error) {
    console.error("Error in FacultyStaffPage:", error)
    return (
      <PageContainer>
        <PageHeader
          title="Faculty & Staff"
          description="Error loading faculty and staff data. Please try again."
        />
      </PageContainer>
    )
  }
}

function FacultyStaffSkeleton() {
  return (
    <div className="space-y-6 stagger-children">
      {/* Stats Cards Skeleton */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => `stats-skeleton-${i}`).map((key) => (
          <Card key={key} className="glass-card overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24 shimmer-loading" />
              <Skeleton className="h-4 w-4 shimmer-loading" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 shimmer-loading" />
              <Skeleton className="mt-1 h-3 w-20 shimmer-loading" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters Skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between glass-card-subtle p-4 rounded-lg">
        <Skeleton className="h-10 w-64 shimmer-loading" />
        <div className="flex items-center space-x-2">
          <Skeleton className="h-10 w-40 shimmer-loading" />
          <Skeleton className="h-10 w-32 shimmer-loading" />
          <Skeleton className="h-10 w-32 shimmer-loading" />
        </div>
      </div>

      {/* Table Skeleton */}
      <Card className="glass-card overflow-hidden">
        <CardHeader>
          <Skeleton className="h-6 w-48 shimmer-loading" />
          <Skeleton className="h-4 w-64 shimmer-loading" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 5 }, (_, i) => `table-skeleton-${i}`).map((key) => (
              <div key={key} className="flex items-center space-x-4 p-2">
                <Skeleton className="h-8 w-8 rounded-full shimmer-loading" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48 shimmer-loading" />
                  <Skeleton className="h-3 w-32 shimmer-loading" />
                </div>
                <Skeleton className="h-6 w-20 shimmer-loading" />
                <Skeleton className="h-6 w-24 shimmer-loading" />
                <Skeleton className="h-8 w-8 shimmer-loading" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
