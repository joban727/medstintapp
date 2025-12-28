
import { db } from "../src/database/connection-pool"
import { users, schools, programs, cohorts, rotations, onboardingSessions } from "../src/database/schema"
import { eq } from "drizzle-orm"

async function resetOnboarding() {
    console.log("Resetting Onboarding Status...")

    // Hardcoded email for the test user we want to reset
    // Replace this with the actual email you are using in the browser
    const targetEmail = "joban727@gmail.com"

    try {
        const [user] = await db.select().from(users).where(eq(users.email, targetEmail))

        if (!user) {
            console.error(`User with email ${targetEmail} not found.`)
            process.exit(1)
        }

        console.log(`Found user: ${user.id} (${user.email})`)

        // 1. Reset User Fields
        await db.update(users).set({
            onboardingCompleted: false,
            schoolId: null,
            programId: null,
        }).where(eq(users.id, user.id))
        console.log("User onboarding status reset.")

        // 2. Clear Onboarding Session
        await db.delete(onboardingSessions).where(eq(onboardingSessions.userId, user.id))
        console.log("Onboarding session cleared.")

        // 3. Optional: Delete associated school/programs if you want a clean slate
        // Be careful with this in production!
        if (user.schoolId) {
            console.log(`Deleting associated school data for schoolId: ${user.schoolId}`)
            // Delete rotations
            await db.delete(rotations).where(eq(rotations.schoolId, user.schoolId))
            // Delete cohorts (need to find programs first or use cascade if set up)
            // Delete programs
            await db.delete(programs).where(eq(programs.schoolId, user.schoolId))
            // Delete school
            await db.delete(schools).where(eq(schools.id, user.schoolId))
            console.log("School data deleted.")
        }

        console.log("Reset Complete. You can now restart the onboarding wizard.")

    } catch (error) {
        console.error("Reset Failed:", error)
        process.exit(1)
    } finally {
        process.exit(0)
    }
}

resetOnboarding()
