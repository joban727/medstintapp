
import { config } from "dotenv";
config({ path: ".env" });

import { sql } from "drizzle-orm";

async function main() {
    console.log("DATABASE_URL present:", !!process.env.DATABASE_URL);

    try {
        const { db } = await import("../src/database/db");
        console.log("Testing database connection...");
        const result = await db.execute(sql`SELECT 1`);
        console.log("Database connection successful!", result);
        process.exit(0);
    } catch (error) {
        console.error("Database connection failed:", error);
        process.exit(1);
    }
}

main();
