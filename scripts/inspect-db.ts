import { db } from "../src/database/db"
import { sql } from "drizzle-orm"

async function inspect() {
  try {
    console.log("--- USERS NAME COLUMNS ---")
    const usersResult = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name LIKE '%name%';
    `)
    console.log(usersResult.rows)

  } catch (e) {
    console.error(e)
  }
  process.exit(0)
}

inspect()
