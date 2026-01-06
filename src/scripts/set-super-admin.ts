import "dotenv/config"
import { eq } from "drizzle-orm"
import { db } from "../database/connection-pool"
import { users } from "../database/schema"
import { logger } from "../lib/logger"

async function setSuperAdmin() {
    const email = process.argv[2]
    const force = process.argv.includes("--force")

    if (!email) {
        console.error("Please provide an email address: npx tsx src/scripts/set-super-admin.ts <email> [--force]")
        process.exit(1)
    }

    try {
        // 1. Check if ANY Super Admin already exists
        const existingSuperAdmins = await db
            .select()
            .from(users)
            .where(eq(users.role, "SUPER_ADMIN"))

        if (existingSuperAdmins.length > 0) {
            // Check if the requested user is ALREADY the super admin
            if (existingSuperAdmins[0].email === email) {
                console.log(`User ${email} is already the Super Admin.`)
                process.exit(0)
            }

            if (!force) {
                console.error("ERROR: A Super Admin account already exists. Only one is allowed.")
                console.error(`Existing Super Admin: ${existingSuperAdmins[0].email}`)
                console.error("Use --force to demote the existing Super Admin and promote the new one.")
                process.exit(1)
            }

            console.log(`Demoting existing Super Admin: ${existingSuperAdmins[0].email}...`)
            await db
                .update(users)
                .set({
                    role: "STUDENT", // Demote to safe default
                    updatedAt: new Date(),
                })
                .where(eq(users.id, existingSuperAdmins[0].id))
        }

        // 2. Find the user to promote
        const targetUser = await db.query.users.findFirst({
            where: eq(users.email, email),
        })

        if (!targetUser) {
            console.error(`ERROR: User with email ${email} not found.`)
            process.exit(1)
        }

        // 3. Promote the user
        await db
            .update(users)
            .set({
                role: "SUPER_ADMIN",
                updatedAt: new Date(),
            })
            .where(eq(users.email, email))

        console.log(`SUCCESS: User ${email} has been promoted to SUPER_ADMIN.`)
        logger.info({ email }, "User promoted to SUPER_ADMIN via script")

    } catch (error) {
        console.error("An error occurred:", error)
        process.exit(1)
    }
}

setSuperAdmin()
