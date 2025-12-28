
import { db } from "../src/database/connection-pool"
import { programs, cohorts, users } from "../src/database/schema"
import { eq, isNull, sql } from "drizzle-orm"

async function migrateCohorts() {
    console.log("Starting cohort migration...")

    // 1. Create default cohorts for programs that don't have any
    const programsWithoutCohorts = await db
        .select({
            id: programs.id,
            name: programs.name,
            classYear: programs.classYear,
            duration: programs.duration,
            schoolId: programs.schoolId,
        })
        .from(programs)
        .leftJoin(cohorts, eq(programs.id, cohorts.programId))
        .where(isNull(cohorts.id))

    console.log(`Found ${programsWithoutCohorts.length} programs without cohorts. Creating defaults...`)

    for (const program of programsWithoutCohorts) {
        const cohortId = `cohort_${crypto.randomUUID()}`
        const name = `Class of ${program.classYear}`
        const startDate = new Date()
        const endDate = new Date(new Date().setFullYear(new Date().getFullYear() + (program.duration || 4))) // Default 4 years if null

        console.log(`Creating cohort '${name}' for program '${program.name}' (${program.id})`)

        await db.insert(cohorts).values({
            id: cohortId,
            name: name,
            programId: program.id,
            startDate: startDate,
            endDate: endDate,
            capacity: 100,
            status: "ACTIVE",
        })
    }

    // 2. Assign students to cohorts if they have a program but no cohort
    const studentsWithoutCohorts = await db
        .select({
            id: users.id,
            programId: users.programId,
        })
        .from(users)
        .where(
            sql`${users.role} = 'STUDENT' AND ${users.programId} IS NOT NULL AND ${users.cohortId} IS NULL`
        )

    console.log(`Found ${studentsWithoutCohorts.length} students with program but no cohort. Assigning...`)

    for (const student of studentsWithoutCohorts) {
        if (!student.programId) continue

        // Find a cohort for this program (pick the first one, likely the one we just created or an existing one)
        const programCohorts = await db
            .select()
            .from(cohorts)
            .where(eq(cohorts.programId, student.programId))
            .limit(1)

        if (programCohorts.length > 0) {
            const cohort = programCohorts[0]
            console.log(`Assigning student ${student.id} to cohort '${cohort.name}' (${cohort.id})`)
            await db
                .update(users)
                .set({ cohortId: cohort.id })
                .where(eq(users.id, student.id))
        } else {
            console.warn(`No cohort found for program ${student.programId} (Student ${student.id})`)
        }
    }

    console.log("Migration complete.")
}

migrateCohorts()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err)
        process.exit(1)
    })
