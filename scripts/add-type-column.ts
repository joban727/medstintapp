
import { db } from "../src/database/connection-pool";
import { sql } from "drizzle-orm";

async function addColumn() {
    try {
        await db.execute(sql`
      ALTER TABLE "programs" ADD COLUMN "type" text;
    `);
        console.log("Successfully added type column to programs table.");
    } catch (error) {
        console.error("Error adding column:", error);
    }
    process.exit(0);
}

addColumn();
