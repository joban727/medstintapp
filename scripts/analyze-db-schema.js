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

            // Get foreign keys
            const fkQuery = `
                SELECT
                    tc.constraint_name,
                    kcu.column_name, 
                    ccu.table_name AS foreign_table_name,
                    ccu.column_name AS foreign_column_name,
                    rc.delete_rule as on_delete
                FROM 
                    information_schema.table_constraints AS tc 
                    JOIN information_schema.key_column_usage AS kcu
                      ON tc.constraint_name = kcu.constraint_name
                      AND tc.table_schema = kcu.table_schema
                    JOIN information_schema.constraint_column_usage AS ccu
                      ON ccu.constraint_name = tc.constraint_name
                      AND ccu.table_schema = tc.table_schema
                    JOIN information_schema.referential_constraints AS rc
                      ON rc.constraint_name = tc.constraint_name
                      AND rc.constraint_schema = tc.table_schema
                WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name=$1;
            `;
            const fkRes = await client.query(fkQuery, [table]);

            // Get indexes
            const indexQuery = `
                SELECT
                    t.relname as table_name,
                    i.relname as index_name,
                    a.attname as column_name
                FROM
                    pg_class t,
                    pg_class i,
                    pg_index ix,
                    pg_attribute a
                WHERE
                    t.oid = ix.indrelid
                    AND i.oid = ix.indexrelid
                    AND a.attrelid = t.oid
                    AND a.attnum = ANY(ix.indkey)
                    AND t.relkind = 'r'
                    AND t.relname = $1;
            `;
            const indexRes = await client.query(indexQuery, [table]);

            schema[table] = {
                columns: columnsRes.rows.map(col => ({
                    name: col.column_name,
                    type: col.data_type,
                    nullable: col.is_nullable === 'YES',
                    default: col.column_default
                })),
                foreignKeys: fkRes.rows,
                indexes: indexRes.rows.map(idx => idx.index_name)
            };
        }

        // Save to file
        fs.writeFileSync(path.resolve(__dirname, '../neon-schema-detailed.json'), JSON.stringify(schema, null, 2));
        console.log('Detailed schema saved to neon-schema-detailed.json');

    } catch (err) {
        console.error('Error analyzing schema:', err);
    } finally {
        await client.end();
    }
}

analyzeSchema();
