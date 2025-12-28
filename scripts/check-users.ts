
import { config } from "dotenv"
import path from "path"

// Load env vars before importing database
config({ path: path.resolve(process.cwd(), ".env") })
config({ path: path.resolve(process.cwd(), ".env.local") })

async function main() {
    // Dynamic import to ensure env vars are loaded first
    const { db } = await import("../src/database/connection-pool")
    const { users } = await import("../src/database/schema")

    console.log("Fetching users...")
    const allUsers = await db.select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        schoolId: users.schoolId
    }).from(users)

    console.table(allUsers)
    process.exit(0)
}

main().catch(console.error)
