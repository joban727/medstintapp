import { eq } from "drizzle-orm"
import { RotationTemplatesClient } from "@/components/dashboard/rotation-templates-client"
import { db } from "@/database/connection-pool"
import { rotationTemplates, programs, clinicalSites } from "@/database/schema"
import { requireAnyRole } from "@/lib/auth-clerk"

export default async function RotationTemplatesPage() {
    const user = await requireAnyRole(["SCHOOL_ADMIN"], "/dashboard")

    const schoolId = "schoolId" in user ? user.schoolId : null

    // If no schoolId, show empty state instead of redirecting
    if (!schoolId) {
        return (
            <RotationTemplatesClient
                templates={[]}
                programs={[]}
                clinicalSites={[]}
                stats={{ totalTemplates: 0, activeTemplates: 0, inactiveTemplates: 0 }}
                schoolId=""
            />
        )
    }

    // Fetch rotation templates for this school
    const templates = await db
        .select({
            id: rotationTemplates.id,
            name: rotationTemplates.name,
            description: rotationTemplates.description,
            specialty: rotationTemplates.specialty,
            defaultDurationWeeks: rotationTemplates.defaultDurationWeeks,
            defaultRequiredHours: rotationTemplates.defaultRequiredHours,
            defaultClinicalSiteId: rotationTemplates.defaultClinicalSiteId,
            objectives: rotationTemplates.objectives,
            isActive: rotationTemplates.isActive,
            sortOrder: rotationTemplates.sortOrder,
            programId: rotationTemplates.programId,
            programName: programs.name,
            clinicalSiteName: clinicalSites.name,
            createdAt: rotationTemplates.createdAt,
        })
        .from(rotationTemplates)
        .leftJoin(programs, eq(rotationTemplates.programId, programs.id))
        .leftJoin(clinicalSites, eq(rotationTemplates.defaultClinicalSiteId, clinicalSites.id))
        .where(eq(rotationTemplates.schoolId, schoolId))
        .orderBy(rotationTemplates.sortOrder, rotationTemplates.name)

    // Fetch programs for this school (for the dropdown)
    const schoolPrograms = await db
        .select({
            id: programs.id,
            name: programs.name,
        })
        .from(programs)
        .where(eq(programs.schoolId, schoolId))
        .orderBy(programs.name)

    // Fetch clinical sites for this school (for the dropdown)
    const schoolSites = await db
        .select({
            id: clinicalSites.id,
            name: clinicalSites.name,
        })
        .from(clinicalSites)
        .where(eq(clinicalSites.schoolId, schoolId))
        .orderBy(clinicalSites.name)

    // Parse objectives from JSON
    const templatesWithParsedObjectives = templates.map((template) => {
        let parsedObjectives: string[] = []
        try {
            const parsed = template.objectives ? JSON.parse(template.objectives) : []
            parsedObjectives = Array.isArray(parsed) ? parsed : []
        } catch (e) {
            console.error("Failed to parse objectives for template", template.id, e)
            parsedObjectives = []
        }
        return {
            ...template,
            objectives: parsedObjectives,
        }
    })

    // Calculate stats
    const stats = {
        totalTemplates: templates.length,
        activeTemplates: templates.filter((t) => t.isActive).length,
        inactiveTemplates: templates.filter((t) => !t.isActive).length,
    }

    return (
        <RotationTemplatesClient
            templates={templatesWithParsedObjectives}
            programs={schoolPrograms}
            clinicalSites={schoolSites}
            stats={stats}
            schoolId={schoolId}
        />
    )
}
