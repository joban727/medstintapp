
import "dotenv/config"
import { db } from "@/database/connection-pool"
import { sql } from "drizzle-orm"

async function main() {
    console.log("Verifying users table schema...")
    try {
        const result: any = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users'
    `)

        const columns = result.rows.map((r: any) => r.column_name).sort()
        console.log("Existing columns in DB:", columns)

        const expectedColumns = [
            "id", "name", "email", "email_verified", "image", "avatar", "avatar_url", "role",
            "school_id", "department", "phone", "address", "is_active", "approval_status",
            "student_id", "program_id", "cohort_id", "enrollment_date", "expected_graduation",
            "academic_status", "gpa", "total_clinical_hours", "completed_rotations",
            "onboarding_completed", "onboarding_completed_at", "created_at", "updated_at",
            "stripe_customer_id", "subscription_status", "subscription_id"
        ].sort()

        const missingColumns = expectedColumns.filter(c => !columns.includes(c))

        if (missingColumns.length > 0) {
            console.error("MISSING COLUMNS:", missingColumns)
        } else {
            console.log("All expected columns are present.")
        }

        // Verify cohorts table
        const cohortsResult: any = await db.execute(sql`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'cohorts'
        `)
        const cohortsColumns = cohortsResult.rows.map((r: any) => r.column_name).sort()
        console.log("Existing columns in cohorts table:", cohortsColumns)

        const expectedCohortsColumns = [
            "id", "program_id", "name", "start_date", "end_date", "graduation_year",
            "capacity", "description", "status", "created_at", "updated_at"
        ].sort()

        const missingCohortsColumns = expectedCohortsColumns.filter(c => !cohortsColumns.includes(c))
        if (missingCohortsColumns.length > 0) {
            console.error("MISSING COHORTS COLUMNS:", missingCohortsColumns)
        } else {
            console.log("All expected cohorts columns are present.")
        }

    } catch (error) {
        console.error("Error verifying schema:", error)
    } finally {
        process.exit(0)
    }
}

main()
