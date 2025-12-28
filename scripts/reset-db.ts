
import { config } from "dotenv";
config({ path: ".env" });

import { sql } from "drizzle-orm";

async function main() {
    console.log("DATABASE_URL present:", !!process.env.DATABASE_URL);

    try {
        const { db } = await import("../src/database/db");
        console.log("Dropping all tables...");

        // Drop all tables in public schema
        await db.execute(sql`
      DO $$ DECLARE
          r RECORD;
      BEGIN
          FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
              EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
          END LOOP;
      END $$;
    `);

        console.log("All tables dropped successfully.");
        process.exit(0);
    } catch (error) {
        console.error("Failed to drop tables:", error);
        process.exit(1);
    }
}

main();
