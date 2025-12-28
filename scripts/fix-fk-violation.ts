
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

async function main() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        console.error('DATABASE_URL is not defined');
        process.exit(1);
    }

    const pool = new Pool({
        connectionString,
        ssl: true,
    });

    try {
        console.log('Connecting to database...');
        const client = await pool.connect();
        console.log('Connected.');

        const query = `
      DELETE FROM competency_assignments 
      WHERE competency_id NOT IN (SELECT id FROM competencies);
    `;

        console.log('Executing cleanup query:', query);
        const result = await client.query(query);
        console.log(`Deleted ${result.rowCount} orphan rows from competency_assignments.`);

        client.release();
    } catch (err) {
        console.error('Error executing query:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
