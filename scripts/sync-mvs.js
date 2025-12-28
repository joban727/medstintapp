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

const sql = `
-- Drop existing views to ensure schema update
DROP MATERIALIZED VIEW IF EXISTS mv_user_progress_summary CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_school_statistics CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_daily_activity_summary CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_competency_analytics CASCADE;

-- mv_user_progress_summary
CREATE MATERIALIZED VIEW mv_user_progress_summary AS
SELECT
    u.id AS user_id,
    p.id AS program_id,
    ca.id AS rotation_id, -- Placeholder/Grouping
    COUNT(ca.id) AS total_assignments,
    COUNT(CASE WHEN ca.status = 'COMPLETED' THEN 1 END) AS completed_assignments,
    COUNT(CASE WHEN ca.status = 'ASSIGNED' THEN 1 END) AS pending_assignments,
    COUNT(CASE WHEN ca.status = 'OVERDUE' THEN 1 END) AS overdue_assignments,
    CASE WHEN COUNT(ca.id) > 0 THEN (COUNT(CASE WHEN ca.status = 'COMPLETED' THEN 1 END)::DECIMAL / COUNT(ca.id)) * 100 ELSE 0 END AS completion_rate,
    AVG(ca.progress_percentage) AS average_score,
    0 AS total_rotations, -- Placeholder
    0 AS active_rotations, -- Placeholder
    NOW() AS last_updated
FROM users u
LEFT JOIN competency_assignments ca ON u.id = ca.user_id
LEFT JOIN programs p ON ca.program_id = p.id
GROUP BY u.id, p.id, ca.id;

-- mv_school_statistics (Corrected to match Drizzle Schema)
CREATE MATERIALIZED VIEW mv_school_statistics AS
SELECT
    s.id AS school_id,
    COUNT(DISTINCT u.id) AS total_students,
    COUNT(DISTINCT CASE WHEN u.is_active = true THEN u.id END) AS active_students,
    COUNT(DISTINCT r.id) AS total_rotations,
    COUNT(DISTINCT CASE WHEN r.status = 'ACTIVE' THEN r.id END) AS active_rotations,
    AVG(ca.progress_percentage) AS completion_rate,
    NOW() AS last_updated
FROM schools s
LEFT JOIN users u ON s.id = u.school_id
LEFT JOIN rotations r ON u.id = r.student_id
LEFT JOIN programs p ON s.id = p.school_id
LEFT JOIN competencies c ON p.id = c.program_id
LEFT JOIN competency_assignments ca ON c.id = ca.competency_id
GROUP BY s.id;

-- mv_daily_activity_summary
CREATE MATERIALIZED VIEW mv_daily_activity_summary AS
SELECT
    DATE(tr.date) AS activity_date,
    s.id AS school_id,
    p.id AS program_id,
    COUNT(DISTINCT tr.student_id) AS active_users,
    SUM(tr.total_hours) AS total_hours,
    COUNT(DISTINCT cs.id) AS submissions,
    COUNT(DISTINCT e.id) AS evaluations
FROM time_records tr
LEFT JOIN users u ON tr.student_id = u.id
LEFT JOIN schools s ON u.school_id = s.id
LEFT JOIN programs p ON u.program_id = p.id
LEFT JOIN competency_submissions cs ON u.id = cs.student_id AND DATE(cs.submitted_at) = DATE(tr.date)
LEFT JOIN evaluations e ON u.id = e.student_id AND DATE(e.created_at) = DATE(tr.date)
GROUP BY DATE(tr.date), s.id, p.id;

-- mv_competency_analytics
CREATE MATERIALIZED VIEW mv_competency_analytics AS
SELECT
    c.id AS competency_id,
    c.name AS competency_name,
    COUNT(ca.id) AS total_assignments,
    COUNT(CASE WHEN ca.status = 'COMPLETED' THEN 1 END) AS completed_assignments,
    AVG(ca.progress_percentage) AS average_score,
    0 AS pass_rate,
    CASE WHEN COUNT(ca.id) > 0 THEN (COUNT(CASE WHEN ca.status = 'COMPLETED' THEN 1 END)::DECIMAL / COUNT(ca.id)) * 100 ELSE 0 END AS completion_rate,
    s.id AS school_id,
    p.id AS program_id,
    NOW() AS last_updated
FROM competencies c
LEFT JOIN competency_assignments ca ON c.id = ca.competency_id
LEFT JOIN programs p ON c.program_id = p.id
LEFT JOIN schools s ON p.school_id = s.id
GROUP BY c.id, c.name, s.id, p.id;

-- Create indexes for performance
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_user_progress_summary_user_id ON mv_user_progress_summary(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_school_statistics_school_id ON mv_school_statistics(school_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily_activity_summary_date_school ON mv_daily_activity_summary(activity_date, school_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_competency_analytics_competency_id ON mv_competency_analytics(competency_id);
`;

async function syncMVs() {
    try {
        await client.connect();
        console.log('Connected to database');

        console.log('Executing SQL to recreate Materialized Views...');
        await client.query(sql);
        console.log('Successfully recreated Materialized Views and Indexes');

    } catch (err) {
        console.error('Error syncing MVs:', err);
    } finally {
        await client.end();
    }
}

syncMVs();
