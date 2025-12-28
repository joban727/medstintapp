
import "dotenv/config"
import { db } from "@/database/connection-pool"
import { sql } from "drizzle-orm"
import fs from "fs"
import path from "path"

async function main() {
    console.log("Running migration 0012...")
    try {
        const migrationPath = path.join(process.cwd(), "migrations", "0012_add_missing_user_columns.sql")
        const migrationSql = fs.readFileSync(migrationPath, "utf-8")

        // Split by semicolon to run statements individually if needed, but db.execute might handle it.
        // Drizzle's db.execute usually executes a single statement.
        // But let's try executing the whole block.

        await db.execute(sql.raw(migrationSql))

        console.log("Migration 0012 executed successfully.")
    } catch (error) {
        console.error("Error running migration:", error)
    } finally {
        process.exit(0)
    }
}

main()
