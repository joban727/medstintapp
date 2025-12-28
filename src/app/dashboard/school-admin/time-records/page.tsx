import { and, desc, eq, gte, inArray, lte, or, sql, count } from "drizzle-orm"
import { db } from "@/database/connection-pool"
import {
  clinicalSites,
  rotations,
  timecardCorrections,
  timeRecords,
  users,
} from "@/database/schema"
import { requireAnyRole } from "@/lib/auth-clerk"
import { TimeRecordsClient } from "./time-records-client"

interface TimeRecordWithDetails {
  id: string
  studentId: string
  rotationId: string
  clockIn: string | null
  clockOut: string | null
  totalHours: number | null
  activities: string | null
  notes: string | null
  status: "PENDING" | "APPROVED" | "REJECTED"
  createdAt: string
  updatedAt: string
  student: {
    id: string
    name: string
    email: string
    schoolId: string
  }
  rotation: {
    id: string
    name: string
    startDate: string
    endDate: string
  }
  site: {
    id: string
    name: string
  } | null
  corrections: {
    id: string
    correctionType: string
    status: string
    createdAt: Date
  }[]
}

interface SearchParams {
  search?: string
  status?: string
  dateFrom?: string
  dateTo?: string
  student?: string
  rotation?: string
}

export default async function AdminTimecardMonitoringPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams | undefined>
}) {
  // Await searchParams as required by Next.js 15
  const searchParamsResolved = await searchParams
  // Ensure searchParams is not null/undefined
  const params = searchParamsResolved || {}

  // Extract individual search parameters
  const { search, status, dateFrom, dateTo, student: _student, rotation: _rotation } = params
  const user = await requireAnyRole(["SCHOOL_ADMIN"], "/dashboard")
  const userSchoolId = "schoolId" in user ? user.schoolId : null
  console.log("User:", user)
  console.log("UserSchoolId:", userSchoolId)

  if (!userSchoolId) {
    console.log("User has no schoolId, returning empty data")
    // If user has no school associated, return empty state instead of error
    // This allows the page to load for users who skipped onboarding
  }

  // Build filters
  const filters = []
  try {
    // School isolation - only add if userSchoolId is valid
    if (userSchoolId && userSchoolId !== null && userSchoolId !== undefined) {
      console.log("Adding school filter with userSchoolId:", userSchoolId)
      // We'll filter by school after fetching data since we need joins
    } else {
      console.log("Skipping school filter - userSchoolId is null/undefined:", userSchoolId)
    }

    // Search filter - we'll implement this after fetching data
    if (params.search) {
      console.log("Search parameter provided:", params.search)
    }

    // Status filter
    if (params.status && params.status !== "all") {
      filters.push(eq(timeRecords.status, params.status as "PENDING" | "APPROVED" | "REJECTED"))
    }

    // Date range filter
    console.log("Processing date filters - dateFrom:", params.dateFrom, "dateTo:", params.dateTo)
    if (params.dateFrom && params.dateFrom !== null && params.dateFrom !== undefined) {
      try {
        const fromDate = new Date(params.dateFrom)
        console.log("Created fromDate:", fromDate, "isValid:", !Number.isNaN(fromDate.getTime()))
        if (!Number.isNaN(fromDate.getTime())) {
          filters.push(gte(timeRecords.clockIn, fromDate))
        }
      } catch (error) {
        console.error("Error creating dateFrom filter:", error, params.dateFrom)
      }
    }
    if (params.dateTo && params.dateTo !== null && params.dateTo !== undefined) {
      try {
        const toDate = new Date(params.dateTo)
        console.log("Created toDate:", toDate, "isValid:", !Number.isNaN(toDate.getTime()))
        if (!Number.isNaN(toDate.getTime())) {
          filters.push(lte(timeRecords.clockIn, toDate))
        }
      } catch (error) {
        console.error("Error creating dateTo filter:", error, params.dateTo)
      }
    }
    console.log("Built filters:", filters.length, "filters")
  } catch (error) {
    console.error("Error building filters:", error)
  }

  // Filter out any null or undefined filters
  const validFilters = filters.filter((filter) => filter != null)
  console.log("Valid filters:", validFilters.length, "out of", filters.length)

  // Define interfaces for type safety
  interface TimeRecordData {
    id: string
    studentId: string
    rotationId: string
    clockIn: Date | null
    clockOut: Date | null
    status: string
    createdAt: Date
    updatedAt: Date
    totalHours: string | null
    activities: string | null
    notes: string | null
    studentName: string | null
    studentEmail: string | null
    studentSchoolId: string | null
  }

  interface StudentData {
    id: string
    name: string
    email: string
    role: string
    schoolId: string
    studentId: string
    isActive: boolean
  }

  interface CorrectionData {
    id: string
    originalTimeRecordId: string
    correctionType: string
    status: string
    createdAt: Date
  }

  interface RotationData {
    id: string
    specialty: string
    startDate: Date | null
    endDate: Date | null
    clinicalSiteId: string
  }

  interface SiteData {
    id: string
    name: string
  }

  // Fetch time records with joins
  let timeRecordsData: TimeRecordData[] = []

  // Initialize lookup maps
  let _rotationsMap = new Map()
  let _sitesMap = new Map()

  try {
    console.log("Executing time records query with joins...")

    // Execute time records query with joins and school filter
    console.log("Executing time records query with joins...")

    // Execute time records query with joins and school filter
    const baseQuery = db
      .select({
        id: timeRecords.id,
        studentId: timeRecords.studentId,
        rotationId: timeRecords.rotationId,
        clockIn: timeRecords.clockIn,
        clockOut: timeRecords.clockOut,
        status: timeRecords.status,
        createdAt: timeRecords.createdAt,
        updatedAt: timeRecords.updatedAt,
        totalHours: timeRecords.totalHours,
        activities: timeRecords.activities,
        notes: timeRecords.notes,
        studentName: users.name,
        studentEmail: users.email,
        studentSchoolId: users.schoolId,
      })
      .from(timeRecords)
      .leftJoin(users, eq(timeRecords.studentId, users.id))
      .orderBy(desc(timeRecords.clockIn))
      .limit(50)

    // Only execute query if we have a school ID to filter by
    if (userSchoolId) {
      // Add school filter to validFilters
      validFilters.push(eq(users.schoolId, userSchoolId))

      // Only add where clause if we have valid filters
      if (validFilters.length > 0) {
        console.log("Applying filters to query...")
        timeRecordsData = await baseQuery.where(and(...validFilters))
      } else {
        console.log("No filters to apply, executing base query...")
        timeRecordsData = await baseQuery
      }
    } else {
      console.log("No school ID, skipping query execution")
      timeRecordsData = []
    }

    // Apply search filter if needed
    if (params.search) {
      const searchTerm = params.search.toLowerCase()
      timeRecordsData = timeRecordsData.filter(
        (record) =>
          record.studentName?.toLowerCase().includes(searchTerm) ||
          record.studentEmail?.toLowerCase().includes(searchTerm)
      )
    }

    console.log("Time records query result:", timeRecordsData.length, "records")

    // Fetch related data separately
    const rotationIds = [...new Set(timeRecordsData.map((r) => r.rotationId).filter(Boolean))]

    let rotationsData: RotationData[] = []
    let sitesData: SiteData[] = []

    if (rotationIds.length > 0) {
      rotationsData = await db.select().from(rotations).where(inArray(rotations.id, rotationIds))
      const siteIds = [...new Set(rotationsData.map((r) => r.clinicalSiteId).filter(Boolean))]
      if (siteIds.length > 0) {
        sitesData = await db.select().from(clinicalSites).where(inArray(clinicalSites.id, siteIds))
      }
    }

    // Populate lookup maps
    _rotationsMap = new Map(rotationsData.map((r) => [r.id, r]))
    _sitesMap = new Map(sitesData.map((s) => [s.id, s]))

    console.log("Fetched related data:", {
      filteredTimeRecords: timeRecordsData.length,
      rotations: rotationsData.length,
      sites: sitesData.length,
    })
  } catch (error) {
    console.error("Error executing time records query:", error)
    timeRecordsData = []
  }

  // Fetch corrections for each time record
  const timeRecordIds = (timeRecordsData || [])
    .map((record) => record.id)
    .filter((id) => id != null)
  console.log("Time record IDs for corrections query:", timeRecordIds.length)

  let corrections: CorrectionData[] = []
  if (timeRecordIds.length > 0) {
    try {
      console.log("About to execute corrections query...")
      corrections = await db
        .select({
          id: timecardCorrections.id,
          originalTimeRecordId: timecardCorrections.originalTimeRecordId,
          correctionType: timecardCorrections.correctionType,
          status: timecardCorrections.status,
          createdAt: timecardCorrections.createdAt,
        })
        .from(timecardCorrections)
        .where(inArray(timecardCorrections.originalTimeRecordId, timeRecordIds))
      console.log("Corrections query result:", corrections.length, "corrections")
      console.log("Sample correction:", corrections[0])
    } catch (error) {
      console.error("Error fetching corrections:", error)
      corrections = []
    }
  } else {
    console.log("No time record IDs, skipping corrections query")
  }

  // Group corrections by time record ID
  console.log("About to process corrections with reduce...")
  console.log("Corrections array type:", typeof corrections, "length:", corrections?.length)
  console.log("Is corrections an array?", Array.isArray(corrections))

  let correctionsByRecord: Record<string, CorrectionData[]> = {}
  try {
    if (Array.isArray(corrections) && corrections.length > 0) {
      correctionsByRecord = corrections.reduce(
        (acc, correction) => {
          console.log(
            "Processing correction:",
            correction?.id,
            "for originalTimeRecordId:",
            correction?.originalTimeRecordId
          )
          if (!correction || !correction.originalTimeRecordId) {
            console.warn("Invalid correction object:", correction)
            return acc
          }
          if (!acc[correction.originalTimeRecordId]) {
            acc[correction.originalTimeRecordId] = []
          }
          acc[correction.originalTimeRecordId].push(correction)
          return acc
        },
        {} as Record<string, CorrectionData[]>
      )
      console.log("Corrections grouped successfully")
    } else {
      console.log("No corrections to process or corrections is not an array")
      correctionsByRecord = {}
    }
  } catch (error) {
    console.error("Error in corrections reduce:", error)
    correctionsByRecord = {}
  }

  // Combine data with joined results using lookup maps
  const enrichedTimeRecords: TimeRecordWithDetails[] = (timeRecordsData || []).map((record) => {
    try {
      const rotation = _rotationsMap?.get(record.rotationId)
      const site = rotation ? _sitesMap?.get(rotation.clinicalSiteId) : null

      return {
        id: record.id,
        studentId: record.studentId,
        rotationId: record.rotationId,
        clockIn: record.clockIn ? new Date(record.clockIn).toISOString() : null,
        clockOut: record.clockOut ? new Date(record.clockOut).toISOString() : null,
        totalHours: record.totalHours != null ? Number(record.totalHours) : null,
        activities: record.activities,
        notes: record.notes,
        status: record.status as "PENDING" | "APPROVED" | "REJECTED",
        createdAt: new Date(record.createdAt).toISOString(),
        updatedAt: new Date(record.updatedAt).toISOString(),
        student: {
          id: record.studentId,
          name: record.studentName || "Unknown Student",
          email: record.studentEmail || "unknown@example.com",
          schoolId: record.studentSchoolId || "",
        },
        rotation: {
          id: record.rotationId,
          name: rotation?.specialty || "Unknown Rotation",
          startDate: rotation?.startDate
            ? new Date(rotation.startDate).toISOString()
            : new Date().toISOString(),
          endDate: rotation?.endDate
            ? new Date(rotation.endDate).toISOString()
            : new Date().toISOString(),
        },
        site: site
          ? {
            id: site.id,
            name: site.name || "Unknown Site",
          }
          : null,
        corrections: correctionsByRecord[record.id] || [],
      }
    } catch (error) {
      console.error("Error processing record:", record, error)
      throw error
    }
  })

  // NOTE: School filtering now happens earlier at the query level (after fetching students)
  // This prevents issues with null/empty student.schoolId values causing blank results

  // Calculate summary statistics
  const totalRecords = (enrichedTimeRecords || []).length
  const pendingRecords = (enrichedTimeRecords || []).filter((r) => r.status === "PENDING").length
  const approvedRecords = (enrichedTimeRecords || []).filter((r) => r.status === "APPROVED").length
  const rejectedRecords = (enrichedTimeRecords || []).filter((r) => r.status === "REJECTED").length

  // Debug totalHours calculation
  let totalHours = 0
  try {
    totalHours = (enrichedTimeRecords || [])
      .filter((r) => r && r.totalHours != null)
      .reduce((sum, r) => {
        const hours = Number(r.totalHours ?? 0) || 0
        return sum + hours
      }, 0)
  } catch (error) {
    console.error("Error calculating totalHours:", error, enrichedTimeRecords)
    totalHours = 0
  }

  const totalCorrections = (corrections || []).length
  const pendingCorrections = (corrections || []).filter((c) => c && c.status === "PENDING").length

  // Get unique students and rotations for filters
  let _uniqueStudents: { id: string; name: string; email: string }[] = []
  let _uniqueRotations: { id: string; name: string; startDate: string; endDate: string }[] = []

  try {
    _uniqueStudents = Array.from(
      new Map(
        (enrichedTimeRecords || []).filter((r) => r?.student).map((r) => [r.student.id, r.student])
      ).values()
    )
  } catch (error) {
    console.error("Error calculating uniqueStudents:", error)
    _uniqueStudents = []
  }

  try {
    _uniqueRotations = Array.from(
      new Map(
        (enrichedTimeRecords || [])
          .filter((r) => r?.rotation)
          .map((r) => [r.rotation.id, r.rotation])
      ).values()
    )
  } catch (error) {
    console.error("Error calculating uniqueRotations:", error)
    _uniqueRotations = []
  }

  return (
    <TimeRecordsClient
      timeRecords={enrichedTimeRecords}
      summaryStats={{
        totalRecords,
        pendingRecords,
        approvedRecords,
        rejectedRecords,
        totalHours,
        totalCorrections,
        pendingCorrections,
      }}
      searchParams={{
        search,
        status,
        dateFrom,
        dateTo,
      }}
    />
  )
}
