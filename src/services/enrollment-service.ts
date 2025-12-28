import { and, desc, eq, isNull, lte, gte, count, or } from "drizzle-orm"
import { db } from "../database/connection-pool"
import {
  clinicalSites,
  programClinicalSites,
  siteAssignments,
} from "../database/schema"
import { logAuditEvent } from "../lib/rbac-middleware"

type AutoAssignParams = {
  studentId: string
  schoolId: string
  programId: string
  ipAddress?: string | null
  userAgent?: string | null
}

export async function autoAssignSiteForStudent(params: AutoAssignParams) {
  const { studentId, schoolId, programId, ipAddress, userAgent } = params
  const now = new Date()

  // Fetch mapped sites for the program ordered by priority and default flag
  const mappedSites = await db
    .select({
      id: programClinicalSites.id,
      programId: programClinicalSites.programId,
      clinicalSiteId: programClinicalSites.clinicalSiteId,
      schoolId: programClinicalSites.schoolId,
      priority: programClinicalSites.priority,
      capacityOverride: programClinicalSites.capacityOverride,
      isDefault: programClinicalSites.isDefault,
      startDate: programClinicalSites.startDate,
      endDate: programClinicalSites.endDate,
    })
    .from(programClinicalSites)
    .where(
      and(
        eq(programClinicalSites.programId, programId),
        eq(programClinicalSites.schoolId, schoolId),
        // active window: startDate <= now <= endDate or endDate null
        or(
          isNull(programClinicalSites.startDate),
          lte(programClinicalSites.startDate, now),
        ),
        or(
          isNull(programClinicalSites.endDate),
          gte(programClinicalSites.endDate, now),
        ),
      )
    )
    .orderBy(desc(programClinicalSites.isDefault), desc(programClinicalSites.priority))

  if (mappedSites.length === 0) {
    await logAuditEvent({
      userId: studentId,
      action: "AUTO_ASSIGN_SITE_SKIPPED",
      resource: "programClinicalSites",
      resourceId: programId,
      details: { reason: "No mapped clinical sites for program", schoolId },
      ipAddress: ipAddress || undefined,
      userAgent: userAgent || undefined,
      severity: "LOW",
      status: "SUCCESS",
    })
    return null
  }

  // Try to find a site with available capacity
  for (const map of mappedSites) {
    const [site] = await db
      .select({
        id: clinicalSites.id,
        capacity: clinicalSites.capacity,
        isActive: clinicalSites.isActive,
      })
      .from(clinicalSites)
      .where(eq(clinicalSites.id, map.clinicalSiteId))
      .limit(1)

    if (!site || !site.isActive) continue

    const capacityLimit = map.capacityOverride ?? site.capacity

    const [{ activeCount }] = await db
      .select({ activeCount: count(siteAssignments.id) })
      .from(siteAssignments)
      .where(
        and(
          eq(siteAssignments.clinicalSiteId, site.id),
          eq(siteAssignments.status, "ACTIVE"),
          // Active if startDate <= now and (endDate null or endDate >= now)
          lte(siteAssignments.startDate, now),
          or(isNull(siteAssignments.endDate), gte(siteAssignments.endDate, now)),
        )
      )

    if ((activeCount || 0) < (capacityLimit || 0)) {
      // Assign this site to the student
      const [assignment] = await db
        .insert(siteAssignments)
        .values({
          id: crypto.randomUUID(),
          studentId,
          clinicalSiteId: site.id,
          rotationId: null,
          schoolId,
          status: "ACTIVE",
          startDate: now,
          endDate: null,
          assignedBy: studentId, // auto assignment performed on behalf of student
          notes: "Auto-assigned on enrollment based on program mapping",
        })
        .returning()

      await logAuditEvent({
        userId: studentId,
        action: "AUTO_ASSIGN_SITE_SUCCESS",
        resource: "siteAssignments",
        resourceId: assignment.id,
        details: { programId, clinicalSiteId: site.id, schoolId },
        ipAddress: ipAddress || undefined,
        userAgent: userAgent || undefined,
        severity: "LOW",
        status: "SUCCESS",
      })

      return assignment
    }
  }

  await logAuditEvent({
    userId: studentId,
    action: "AUTO_ASSIGN_SITE_FAILED",
    resource: "programClinicalSites",
    resourceId: programId,
    details: { reason: "All mapped sites at capacity", schoolId },
    ipAddress: ipAddress || undefined,
    userAgent: userAgent || undefined,
    severity: "MEDIUM",
    status: "SUCCESS",
  })
  return null
}