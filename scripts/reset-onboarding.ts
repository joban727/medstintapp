
import { config } from "dotenv"
import path from "path"
import fs from "fs"

const envPath = path.resolve(process.cwd(), ".env")
if (fs.existsSync(envPath)) {
    config({ path: envPath })
} else {
    console.warn("Warning: .env file not found at", envPath)
    config() // Fallback to default
}

// Dynamic imports to ensure env vars are loaded first
async function main() {
    const { db } = await import("../database/connection-pool")
    const { users, schools } = await import("../database/schema")
    const { eq } = await import("drizzle-orm")

    async function resetOnboarding(email: string) {
        console.log(`Resetting onboarding for ${email}...`)

        const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)

        if (!user) {
            console.log("User not found. Creating mock user...")
            const newId = `user_mock_${email.split('@')[0]}`
            await db.insert(users).values({
                id: newId,
                email: email,
                name: "Mock Admin",
                role: "SCHOOL_ADMIN",
                onboardingCompleted: false,
                isActive: true,
                emailVerified: true
            })
            console.log(`Created user ${email} with ID ${newId}`)
            return
        }

        console.log("Current User State:", {
            id: user.id,
            role: user.role,
            schoolId: user.schoolId,
            onboardingCompleted: user.onboardingCompleted,
        })

        // Update user
        await db
            .update(users)
            .set({
                onboardingCompleted: false,
                schoolId: null,
                // role: null, // Uncomment to reset role as well
            })
            .where(eq(users.id, user.id))

        console.log("User updated. Onboarding reset.")

        // Verify
        const [updatedUser] = await db.select().from(users).where(eq(users.id, user.id)).limit(1)
        console.log("New User State:", {
            id: updatedUser.id,
            role: updatedUser.role,
            schoolId: updatedUser.schoolId,
            onboardingCompleted: updatedUser.onboardingCompleted,
        })
    }

    // List all users for debugging
    const allUsers = await db.select({ email: users.email, id: users.id }).from(users)
    console.log("All Users in DB:", allUsers)

    // Reset for the main user
    await resetOnboarding("joban727@gmail.com")

    // Also reset the manual test user if it exists
    await resetOnboarding("admin_manual_8442@example.com")

    // Reset requested user
    await resetOnboarding("admin_789@example.com")

    process.exit(0)
}

main().catch((err) => {
    console.error("Error:", err)
    process.exit(1)
})
