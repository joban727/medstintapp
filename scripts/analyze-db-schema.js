const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('DATABASE_URL not found in .env');
    process.exit(1);
}

const client = new Client({
    connectionString,
    ssl: {
        rejectUnauthorized: false
    }
});

async function analyzeSchema() {
    try {
        await client.connect();
        console.log('Connected to database');

        // Get tables
        const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE';
    `;
        const tablesRes = await client.query(tablesQuery);
        const tables = tablesRes.rows.map(r => r.table_name);

        // Get materialized views
        const mvsQuery = `
      SELECT matviewname as table_name
      FROM pg_matviews
      WHERE schemaname = 'public';
    `;
        const mvsRes = await client.query(mvsQuery);
        const mvs = mvsRes.rows.map(r => r.table_name);

        const allTables = [...tables, ...mvs];
        const schema = {};

        for (const table of allTables) {
            // Get columns
            const columnsQuery = `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1;
      `;
            let columnsRes = await client.query(columnsQuery, [table]);

            if (columnsRes.rows.length === 0) {
                // Fallback for MVs if not in information_schema
                const attQuery = `
            SELECT a.attname as column_name, format_type(a.atttypid, a.atttypmod) as data_type, 
                   CASE WHEN a.attnotnull THEN 'NO' ELSE 'YES' END as is_nullable,
                   null as column_default
            FROM pg_attribute a
            JOIN pg_class c ON a.attrelid = c.oid
            JOIN pg_namespace n ON c.relnamespace = n.oid
            WHERE c.relname = $1 AND n.nspname = 'public' AND a.attnum > 0 AND NOT a.attisdropped;
           `;
                columnsRes = await client.query(attQuery, [table]);
            }

            schema[table] = columnsRes.rows.map(col => ({
                name: col.column_name,
                type: col.data_type,
                nullable: col.is_nullable === 'YES',
                default: col.column_default
            }));
        }

        console.log(JSON.stringify(schema, null, 2));

        // Save to file
        fs.writeFileSync(path.resolve(__dirname, '../neon-schema.json'), JSON.stringify(schema, null, 2));
        console.log('Schema saved to neon-schema.json');

    } catch (err) {
        console.error('Error analyzing schema:', err);
    } finally {
        await client.end();
    }
}

analyzeSchema();
