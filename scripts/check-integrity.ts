
import { db } from "../src/database/connection-pool"
import { programs, cohorts, users } from "../src/database/schema"
import { eq, isNull, sql } from "drizzle-orm"

async function checkDataIntegrity() {
    console.log("Checking for programs without cohorts...")
    const programsWithoutCohorts = await db
        .select({
            id: programs.id,
            name: programs.name,
            classYear: programs.classYear,
            duration: programs.duration,
        })
        .from(programs)
        .leftJoin(cohorts, eq(programs.id, cohorts.programId))
        .where(isNull(cohorts.id))

    console.log(`Found ${programsWithoutCohorts.length} programs without cohorts.`)
    if (programsWithoutCohorts.length > 0) {
        console.table(programsWithoutCohorts)
    }

    console.log("\nChecking for students without cohorts...")
    const studentsWithoutCohorts = await db
        .select({
            id: users.id,
            name: users.name,
            email: users.email,
            programId: users.programId,
        })
        .from(users)
        .where(
            sql`${users.role} = 'STUDENT' AND ${users.cohortId} IS NULL`
        )

    console.log(`Found ${studentsWithoutCohorts.length} students without cohorts.`)
    if (studentsWithoutCohorts.length > 0) {
        console.table(studentsWithoutCohorts)
    }
}

checkDataIntegrity()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err)
        process.exit(1)
    })
