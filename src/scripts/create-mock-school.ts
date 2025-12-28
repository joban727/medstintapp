
import { Client } from 'pg';
import { v4 as uuidv4 } from 'uuid';

const DB_URL = "postgresql://neondb_owner:npg_EjlGx9I6yZMT@ep-muddy-term-afe7ddw1.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require";

async function createMockSchool() {
    console.log("--- Creating Mock School ---");

    const client = new Client({
        connectionString: DB_URL,
        ssl: true
    });

    try {
        await client.connect();
        console.log("Connected to DB.");

        const email = 'admin_manual_8442@example.com';
        const userId = 'user_36b8YENXEJGPOCECHFHQbUCsgmC'; // ID from create-user.ts output

        // 1. Get User or Create
        let userRes = await client.query("SELECT * FROM users WHERE email = $1", [email]);

        if (userRes.rows.length === 0) {
            console.log("User not found in DB, inserting...");
            const insertUserQuery = `
                INSERT INTO users (id, email, name, role, is_active, onboarding_completed, email_verified, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
                RETURNING *
            `;
            userRes = await client.query(insertUserQuery, [
                userId, email, 'Manual Admin', 'SCHOOL_ADMIN', true, true, true
            ]);
        }

        const user = userRes.rows[0];
        console.log("Found/Created User:", user.id);

        // 2. Create School
        const schoolId = `school_${uuidv4()}`;
        const schoolName = "Mock School";
        const address = "123 Mock St, Mock City, MC 12345";
        const phone = "555-0123";
        const schoolEmail = "contact@mockschool.edu";
        const website = "https://mockschool.edu";

        const insertSchoolQuery = `
            INSERT INTO schools (id, name, address, phone, email, website, admin_id, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
            RETURNING *
        `;

        const schoolRes = await client.query(insertSchoolQuery, [
            schoolId, schoolName, address, phone, schoolEmail, website, user.id
        ]);

        console.log("Created School:", schoolRes.rows[0].id);

        // 3. Update User with School ID
        const updateUserQuery = `
            UPDATE users 
            SET school_id = $1, 
                updated_at = NOW()
            WHERE id = $2
        `;

        await client.query(updateUserQuery, [schoolId, user.id]);
        console.log("Updated User with School ID.");

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await client.end();
    }
}

createMockSchool();
