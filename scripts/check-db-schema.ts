
import { db } from "../src/database/connection-pool";
import { sql } from "drizzle-orm";

async function checkSchema() {
    console.log("Checking database schema for 'cohorts' table...");

    try {
        const result = await db.execute(sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'cohorts'
      ORDER BY ordinal_position;
    `);

        if (result.rows.length === 0) {
            console.log("❌ Table 'cohorts' does not exist in the database.");
        } else {
            console.log("✅ Table 'cohorts' exists. Columns:");
            console.table(result.rows);
        }
    } catch (error) {
        console.error("Error checking schema:", error);
    } finally {
        process.exit(0);
    }
}

checkSchema();
