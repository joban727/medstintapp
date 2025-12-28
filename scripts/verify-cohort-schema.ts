
import { db } from "../src/database/connection-pool"
import { schools, programs, cohorts } from "../src/database/schema"
import { eq } from "drizzle-orm"

async function verifySchema() {
    console.log("Verifying Cohort Schema...")
    const testId = "test-" + Date.now()
    const schoolId = `school-${testId}`
    const programId = `program-${testId}`
    const cohortId = `cohort-${testId}`

    try {
        // 1. Create School
        console.log("Creating Test School...")
        await db.insert(schools).values({
            id: schoolId,
            name: "Test School",
            isActive: true,
        })

        // 2. Create Program
        console.log("Creating Test Program...")
        await db.insert(programs).values({
            id: programId,
            schoolId: schoolId,
            name: "Test Program",
            description: "Test Description",
            duration: 12,
            classYear: 2025,
            isActive: true,
        })

        // 3. Create Cohort
        console.log("Creating Test Cohort...")
        await db.insert(cohorts).values({
            id: cohortId,
            programId: programId,
            name: "Class of 2025",
            startDate: new Date(),
            endDate: new Date(),
            capacity: 50,
            status: "ACTIVE",
        })

        // 4. Verify
        const [fetchedCohort] = await db
            .select()
            .from(cohorts)
            .where(eq(cohorts.id, cohortId))

        if (fetchedCohort && fetchedCohort.programId === programId) {
            console.log("SUCCESS: Cohort created and linked to program correctly.")
            console.log("Cohort:", fetchedCohort)
        } else {
            console.error("FAILURE: Could not fetch cohort or link is broken.")
        }

    } catch (error) {
        console.error("Verification Failed:", error)
    } finally {
        // Cleanup
        console.log("Cleaning up...")
        try {
            await db.delete(cohorts).where(eq(cohorts.id, cohortId))
            await db.delete(programs).where(eq(programs.id, programId))
            await db.delete(schools).where(eq(schools.id, schoolId))
        } catch (cleanupError) {
            console.error("Cleanup failed:", cleanupError)
        }
        process.exit(0)
    }
}

verifySchema()
