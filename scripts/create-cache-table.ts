
import { db } from "../src/database/connection-pool"
import { sql } from "drizzle-orm"

async function main() {
    console.log("Creating cache_entries table...")
    await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "cache_entries" (
      "key" text PRIMARY KEY NOT NULL,
      "value" jsonb NOT NULL,
      "expires_at" timestamp with time zone NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
      "tags" text[]
    );
  `)

    console.log("Creating index...")
    await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "cache_entries_expires_at_idx" ON "cache_entries" ("expires_at");
  `)

    console.log("Done!")
    process.exit(0)
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
