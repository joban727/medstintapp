import { db } from "../src/database/db"
import { sql } from "drizzle-orm"

async function fixSchoolsTable() {
    try {
        console.log("Fixing schools table schema...")

        // Add missing columns
        try {
            await db.execute(sql`ALTER TABLE schools ADD COLUMN IF NOT EXISTS accreditation text;`)
            console.log("Added accreditation column")
        } catch (e: any) {
            console.log("Error adding accreditation:", e.message)
        }

        try {
            await db.execute(sql`ALTER TABLE schools ADD COLUMN IF NOT EXISTS admin_id text REFERENCES users(id);`)
            console.log("Added admin_id column")
        } catch (e: any) {
            console.log("Error adding admin_id:", e.message)
        }

        console.log("Schools table schema fixed.")

    } catch (e) {
        console.error("Error fixing table:", e)
    }
    process.exit(0)
}

fixSchoolsTable()
