
import { config } from "dotenv"
import path from "path"
import { eq } from "drizzle-orm"

// Load env vars before importing database
config({ path: path.resolve(process.cwd(), ".env") })
config({ path: path.resolve(process.cwd(), ".env.local") })

async function main() {
    // Dynamic import to ensure env vars are loaded first
    const { db } = await import("../src/database/connection-pool")
    const { users } = await import("../src/database/schema")

    const email = "joban727@gmail.com"
    const newRole = "SCHOOL_ADMIN"

    console.log(`Updating user ${email} to role ${newRole}...`)

    const result = await db
        .update(users)
        .set({ role: newRole })
        .where(eq(users.email, email))
        .returning()

    if (result.length > 0) {
        console.log("✅ User updated successfully:", result[0])
    } else {
        console.error("❌ User not found")
    }

    process.exit(0)
}

main().catch(console.error)
