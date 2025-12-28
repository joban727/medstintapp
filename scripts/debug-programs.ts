
import "dotenv/config"
import { db } from "@/database/connection-pool"
import { users, schools } from "@/database/schema"
import { getSchoolPrograms } from "@/lib/programs"
import { eq, sql } from "drizzle-orm"

async function main() {
    console.log("Starting debug script...")

    try {
        // Check users table columns
        const result: any = await db.execute(sql`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'programs'
        `)
        console.log("Programs table columns:", result.rows.map((c: any) => c.column_name))

        // Find a school admin
        const schoolAdmins = await db.select().from(users).where(eq(users.role, "SCHOOL_ADMIN")).limit(1)

        if (schoolAdmins.length === 0) {
            console.log("No school admin found.")
            return
        }

        const admin = schoolAdmins[0]
        console.log("Found school admin:", admin.email, "School ID:", admin.schoolId)

        if (!admin.schoolId) {
            console.log("Admin has no school ID.")
            return
        }

        // Try to fetch programs
        console.log("Fetching programs for school:", admin.schoolId)
        const programs = await getSchoolPrograms(admin.schoolId)
        console.log("Programs fetched successfully:", programs.length)
        console.log(programs)

    } catch (error: any) {
        console.error("Error in debug script:", error.message)
        console.error(error)
    } finally {
        process.exit(0)
    }
}

main()
