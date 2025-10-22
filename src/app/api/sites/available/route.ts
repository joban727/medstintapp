import { auth } from "@clerk/nextjs/server"
import { and, eq } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/database/db"
import { clinicalSites, rotations, siteAssignments } from "@/database/schema"

export async function GET(_request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get all active site assignments for the student
    const availableSites = await db
      .select({
        siteId: clinicalSites.id,
        siteName: clinicalSites.name,
        siteAddress: clinicalSites.address,
        sitePhone: clinicalSites.phone,
        siteEmail: clinicalSites.email,
        siteType: clinicalSites.type,
        assignmentId: siteAssignments.id,
        assignmentStatus: siteAssignments.status,
        startDate: siteAssignments.startDate,
        endDate: siteAssignments.endDate,
        rotationName: rotations.specialty,
        rotationId: rotations.id,
      })
      .from(siteAssignments)
      .innerJoin(clinicalSites, eq(siteAssignments.clinicalSiteId, clinicalSites.id))
      .leftJoin(rotations, eq(siteAssignments.rotationId, rotations.id))
      .where(and(eq(siteAssignments.studentId, userId), eq(siteAssignments.status, "ACTIVE")))
      .orderBy(clinicalSites.name)

    // Filter sites that are currently active (within date range if specified)
    const now = new Date()
    const activeSites = availableSites.filter((site) => {
      const startDate = new Date(site.startDate)
      const endDate = site.endDate ? new Date(site.endDate) : null

      return startDate <= now && (!endDate || endDate >= now)
    })

    const formattedSites = activeSites.map((site) => ({
      id: site.siteId,
      name: site.siteName,
      address: site.siteAddress,
      phone: site.sitePhone,
      email: site.siteEmail,
      type: site.siteType,
      assignment: {
        id: site.assignmentId,
        status: site.assignmentStatus,
        startDate: site.startDate,
        endDate: site.endDate,
      },
      rotation: site.rotationId
        ? {
            id: site.rotationId,
            name: site.rotationName,
          }
        : null,
    }))

    return NextResponse.json({
      sites: formattedSites,
      total: formattedSites.length,
    })
  } catch (error) {
    console.error("Available sites error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
