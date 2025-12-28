
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

async function main() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        console.error('DATABASE_URL is not defined');
        process.exit(1);
    }

    // Extract endpoint ID for verification
    const endpointMatch = connectionString.match(/@([^.]+)\./);
    const endpointId = endpointMatch ? endpointMatch[1] : 'unknown';
    console.log(`Verifying database at endpoint: ${endpointId}`);

    const pool = new Pool({
        connectionString,
        ssl: true,
    });

    try {
        const client = await pool.connect();

        // 1. Verify Tables
        const tablesToCheck = ['rotation_templates', 'cohort_rotation_assignments', 'cohorts', 'rotations', 'time_records'];
        console.log('\n--- Verifying Tables ---');
        for (const table of tablesToCheck) {
            const res = await client.query(
                "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1)",
                [table]
            );
            const exists = res.rows[0].exists;
            console.log(`Table '${table}': ${exists ? '✅ Found' : '❌ MISSING'}`);
        }

        // 2. Verify Specific Columns
        const columnsToCheck = [
            { table: 'cohorts', column: 'graduation_year' },
            { table: 'cohorts', column: 'enrollment_count' },
            { table: 'rotations', column: 'rotation_template_id' },
            { table: 'rotations', column: 'cohort_rotation_assignment_id' },
            { table: 'time_records', column: 'clock_in_source' },
            { table: 'time_records', column: 'clock_out_source' },
            { table: 'competency_assignments', column: 'completion_date' },
            { table: 'users', column: 'approval_status' },
        ];

        console.log('\n--- Verifying Columns ---');
        for (const check of columnsToCheck) {
            const res = await client.query(
                "SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2)",
                [check.table, check.column]
            );
            const exists = res.rows[0].exists;
            console.log(`Column '${check.table}.${check.column}': ${exists ? '✅ Found' : '❌ MISSING'}`);
        }

        // 3. Verify Constraints
        const constraintsToCheck = [
            'users_email_unique',
            'students_student_number_unique',
            'invitations_token_unique'
        ];

        console.log('\n--- Verifying Constraints ---');
        for (const constraint of constraintsToCheck) {
            const res = await client.query(
                "SELECT EXISTS (SELECT FROM information_schema.table_constraints WHERE constraint_schema = 'public' AND constraint_name = $1)",
                [constraint]
            );
            const exists = res.rows[0].exists;
            console.log(`Constraint '${constraint}': ${exists ? '✅ Found' : '❌ MISSING'}`);
        }

        client.release();
    } catch (err) {
        console.error('Error verifying schema:', err);
    } finally {
        await pool.end();
    }
}

main();
