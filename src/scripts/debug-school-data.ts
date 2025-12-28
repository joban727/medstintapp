// Force correct DB URL from .env.production
const DB_URL = "postgresql://neondb_owner:npg_1iKjd0pnXbYM@ep-divine-thunder-a6wnchyt-pooler.us-west-2.aws.neon.tech/neondb?channel_binding=require&sslmode=require"

import { Client } from 'pg'

async function debugData() {
    console.log("--- Debugging User Data ---")
    console.log("Using DATABASE_URL:", DB_URL)

    const client = new Client({
        connectionString: DB_URL,
        ssl: true
    })

    try {
        await client.connect()
        console.log("Connected successfully.")

        // 0. Find a valid Admin ID
        const adminRes = await client.query("SELECT id FROM users WHERE role = 'SCHOOL_ADMIN' LIMIT 1")
        if (adminRes.rows.length === 0) {
            console.error("No SCHOOL_ADMIN found to assign as school admin.")
            return
        }
        const adminId = adminRes.rows[0].id
        console.log("Using Admin ID:", adminId)

        // 1. Create School
        const schoolId = "school_" + Date.now()
        await client.query(`
            INSERT INTO schools (id, name, address, phone, email, website, admin_id, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
            ON CONFLICT (id) DO NOTHING
        `, [schoolId, "Antigravity Medical School", "123 Future Way", "555-0123", "info@antigravity.edu", "https://antigravity.edu", adminId])
        console.log("Created School:", schoolId)

        // 2. Create Program
        const programId = "program_" + Date.now()
        await client.query(`
            INSERT INTO programs (id, name, description, duration, class_year, school_id, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        `, [programId, "Doctor of Medicine", "MD Program", 48, 2026, schoolId])
        console.log("Created Program:", programId)

        // 3. Update Target User (admin_789@example.com)
        const updateRes = await client.query(`
            UPDATE users 
            SET school_id = $1, program_id = $2, onboarding_completed = true, updated_at = NOW()
            WHERE email = 'admin_789@example.com'
            RETURNING id, email
        `, [schoolId, programId])
        console.log("Updated Users:", updateRes.rows)

        // 4. Create Mock Student
        const studentId = "student_" + Date.now()
        await client.query(`
            INSERT INTO users (id, name, email, role, school_id, is_active, onboarding_completed, created_at, updated_at, email_verified)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), true)
        `, [studentId, "John Doe", `student_${Date.now()}@example.com`, "STUDENT", schoolId, true, true])
        console.log("Created Student:", studentId)

        // 5. Create Mock Site
        const siteId = "site_" + Date.now()
        await client.query(`
            INSERT INTO clinical_sites (id, school_id, name, address, phone, email, type, capacity, is_active, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        `, [siteId, schoolId, "General Hospital", "123 Main St", "555-0101", "contact@generalhospital.com", "HOSPITAL", 10, true])
        console.log("Created Site:", siteId)

        // 6. List All Users
        const usersRes = await client.query("SELECT id, email, role, onboarding_completed, school_id FROM users")
        console.log("All Users:", usersRes.rows)

    } catch (e) {
        console.error("Error:", e)
    } finally {
        await client.end()
    }
}

debugData()
