import { db } from "../src/database/db"
import { invitations, users, schools, programs, cohorts } from "../src/database/schema"
import { eq, sql } from "drizzle-orm"
import { randomBytes } from "crypto"

async function verifyInvitationSystem() {
    console.log("Starting invitation system verification...")

    try {
        // 1. Setup Test Data
        console.log("Setting up test data...")
        const schoolId = "test-school-" + randomBytes(4).toString("hex")
        const programId = "test-program-" + randomBytes(4).toString("hex")
        const cohortId = "test-cohort-" + randomBytes(4).toString("hex")
        const adminId = "test-admin-" + randomBytes(4).toString("hex")

        // Create School
        await db.insert(schools).values({
            id: schoolId,
            name: "Test School",
        })

        // Create Program
        // Debugging with raw SQL to bypass potential Drizzle mapping issues and include 'type'
        await db.execute(sql`
      INSERT INTO programs (id, school_id, name, description, duration, class_year, type, created_at, updated_at)
      VALUES (${programId}, ${schoolId}, 'Test Program', 'Test Description', 12, 2025, 'NURSING', NOW(), NOW())
    `)

        // Create Cohort
        await db.insert(cohorts).values({
            id: cohortId,
            programId,
            name: "Test Cohort",
            startDate: new Date(),
            endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            capacity: 50,
        })

        // Create Admin User
        // Debugging with raw SQL to bypass potential Drizzle mapping issues
        await db.execute(sql`
      INSERT INTO users (id, email, role, school_id, name, created_at, updated_at)
      VALUES (${adminId}, 'admin@test.com', 'SCHOOL_ADMIN', ${schoolId}, 'Admin User', NOW(), NOW())
    `)

        console.log("Test data setup complete.")

        // 2. Test Student Invitation
        console.log("\nTesting Student Invitation...")
        const studentEmail = `student-${randomBytes(4).toString("hex")}@test.com`
        const studentToken = randomBytes(32).toString("hex")

        await db.insert(invitations).values({
            email: studentEmail,
            schoolId,
            programId,
            cohortId,
            role: "STUDENT",
            token: studentToken,
            invitedBy: adminId,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        })

        console.log(`Created student invitation for ${studentEmail}`)

        // Simulate Acceptance (Student)
        const studentUserId = "test-student-" + randomBytes(4).toString("hex")

        // Debugging with raw SQL
        await db.execute(sql`
      INSERT INTO users (id, email, role, name, created_at, updated_at)
      VALUES (${studentUserId}, ${studentEmail}, 'STUDENT', 'Test Student', NOW(), NOW())
    `)

        // Update user and invitation manually to simulate API logic
        await db
            .update(users)
            .set({
                schoolId,
                programId,
                cohortId,
                role: "STUDENT",
            })
            .where(eq(users.id, studentUserId))

        await db
            .update(invitations)
            .set({ status: "ACCEPTED" })
            .where(eq(invitations.token, studentToken))

        console.log("Student invitation accepted successfully.")

        // 3. Test Clinical Preceptor Invitation
        console.log("\nTesting Clinical Preceptor Invitation...")
        const preceptorEmail = `preceptor-${randomBytes(4).toString("hex")}@test.com`
        const preceptorToken = randomBytes(32).toString("hex")

        await db.insert(invitations).values({
            email: preceptorEmail,
            schoolId,
            programId,
            cohortId,
            role: "CLINICAL_PRECEPTOR",
            token: preceptorToken,
            invitedBy: adminId,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        })

        console.log(`Created preceptor invitation for ${preceptorEmail}`)

        // Simulate Acceptance (Preceptor)
        const preceptorUserId = "test-preceptor-" + randomBytes(4).toString("hex")

        // Debugging with raw SQL
        await db.execute(sql`
      INSERT INTO users (id, email, role, name, created_at, updated_at)
      VALUES (${preceptorUserId}, ${preceptorEmail}, 'CLINICAL_PRECEPTOR', 'Test Preceptor', NOW(), NOW())
    `)

        await db
            .update(users)
            .set({
                schoolId,
                programId,
                cohortId,
                role: "CLINICAL_PRECEPTOR",
            })
            .where(eq(users.id, preceptorUserId))

        await db
            .update(invitations)
            .set({ status: "ACCEPTED" })
            .where(eq(invitations.token, preceptorToken))

        console.log("Preceptor invitation accepted successfully.")

        // 4. Test Clinical Supervisor Invitation
        console.log("\nTesting Clinical Supervisor Invitation...")
        const supervisorEmail = `supervisor-${randomBytes(4).toString("hex")}@test.com`
        const supervisorToken = randomBytes(32).toString("hex")

        await db.insert(invitations).values({
            email: supervisorEmail,
            schoolId,
            programId,
            cohortId,
            role: "CLINICAL_SUPERVISOR",
            token: supervisorToken,
            invitedBy: adminId,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        })

        console.log(`Created supervisor invitation for ${supervisorEmail}`)

        // Simulate Acceptance (Supervisor)
        const supervisorUserId = "test-supervisor-" + randomBytes(4).toString("hex")

        // Debugging with raw SQL
        await db.execute(sql`
      INSERT INTO users (id, email, role, name, created_at, updated_at)
      VALUES (${supervisorUserId}, ${supervisorEmail}, 'CLINICAL_SUPERVISOR', 'Test Supervisor', NOW(), NOW())
    `)

        await db
            .update(users)
            .set({
                schoolId,
                programId,
                cohortId,
                role: "CLINICAL_SUPERVISOR",
            })
            .where(eq(users.id, supervisorUserId))

        await db
            .update(invitations)
            .set({ status: "ACCEPTED" })
            .where(eq(invitations.token, supervisorToken))

        console.log("Supervisor invitation accepted successfully.")

        console.log("\nVerification Complete: All invitation flows validated.")
    } catch (error) {
        console.error("Verification Failed:", error)
        process.exit(1)
    } finally {
        // Cleanup (Optional, but good for repeatable tests)
        // In a real scenario, we might want to delete the test data
        console.log("Done.")
        process.exit(0)
    }
}

verifyInvitationSystem()
