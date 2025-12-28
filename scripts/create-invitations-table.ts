import { db } from "../src/database/db"
import { sql } from "drizzle-orm"

async function createTable() {
    try {
        console.log("Creating invitations table...")

        // 1. Create Enum (if not exists)
        // We'll try to create it, ignore if exists (or check first)
        // Drizzle might name it 'invitations_role'
        try {
            await db.execute(sql`CREATE TYPE invitations_role AS ENUM ('STUDENT', 'CLINICAL_PRECEPTOR', 'CLINICAL_SUPERVISOR');`)
            console.log("Created enum invitations_role")
        } catch (e: any) {
            console.log("Enum might already exist:", e.message)
        }

        try {
            await db.execute(sql`CREATE TYPE invitations_status AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED');`)
            console.log("Created enum invitations_status")
        } catch (e: any) {
            console.log("Enum might already exist:", e.message)
        }

        // 2. Create Table
        // Note: We need to match the schema exactly.
        // References: schools.id, programs.id, cohorts.id, users.id
        // We assume these tables exist.

        await db.execute(sql`
      CREATE TABLE IF NOT EXISTS invitations (
        id text PRIMARY KEY,
        email text NOT NULL,
        school_id text NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        program_id text NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
        cohort_id text NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
        role text NOT NULL DEFAULT 'STUDENT', -- We'll use text with check constraint or cast to enum if we want strictness
        token text NOT NULL UNIQUE,
        status text NOT NULL DEFAULT 'PENDING',
        expires_at timestamp NOT NULL,
        invited_by text NOT NULL REFERENCES users(id),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
    `)

        // Add check constraints if we didn't use the enum type directly in the table definition (simpler for now)
        // Or alter column to use enum.
        // Let's try to use the enum type if possible, or just text check.
        // Drizzle schema says: text("role", { enum: ... })
        // This usually maps to a text column with a check constraint in some setups, or an enum type.
        // Let's add check constraints to be safe and compatible.

        await db.execute(sql`
      ALTER TABLE invitations ADD CONSTRAINT invitations_role_check CHECK (role IN ('STUDENT', 'CLINICAL_PRECEPTOR', 'CLINICAL_SUPERVISOR'));
    `)

        await db.execute(sql`
      ALTER TABLE invitations ADD CONSTRAINT invitations_status_check CHECK (status IN ('PENDING', 'ACCEPTED', 'EXPIRED'));
    `)

        // Indexes
        await db.execute(sql`CREATE INDEX IF NOT EXISTS invitations_email_school_idx ON invitations (email, school_id);`)
        await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS invitations_token_idx ON invitations (token);`)

        console.log("Invitations table created successfully.")

    } catch (e) {
        console.error("Error creating table:", e)
    }
    process.exit(0)
}

createTable()
