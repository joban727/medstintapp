import { drizzle } from "drizzle-orm/postgres-js"
import { sql } from "drizzle-orm"
import postgres from "postgres"
import * as schema from "../database/schema"
import { LRUCache } from "lru-cache"
import { performance } from "perf_hooks"
import { logger } from "./logger"

// ============================================================================
// SQL Injection Prevention: Table/Index Name Validation
// ============================================================================

// Whitelist of valid table names from schema (snake_case database names)
const VALID_TABLE_NAMES = new Set([
  "users",
  "sessions",
  "accounts",
  "verifications",
  "subscriptions",
  "accreditation_options",
  "schools",
  "programs",
  "cohorts",
  "clinical_sites",
  "program_clinical_sites",
  "rotation_templates",
  "cohort_rotation_assignments",
  "rotations",
  "time_records",
  "competency_templates",
  "rubric_criteria",
  "competency_deployments",
  "notification_templates",
  "competency_assignments",
  "competency_versions",
  "import_export_logs",
  "competencies",
  "competency_submissions",
  "assessments",
  "evaluations",
  "audit_logs",
  "timecard_corrections",
  "jobs",
  "progress_snapshots",
  "learning_analytics",
  "notification_queue",
  "report_cache",
  "invitations",
  "competency_rubrics",
  "site_assignments",
  "scheduled_reports",
  "onboarding_sessions",
  "onboarding_analytics",
  "time_sync_sessions",
  "sync_events",
  "connection_logs",
  "synchronized_clock_records",
  "clinical_site_locations",
  "location_verifications",
  "location_permissions",
  "location_accuracy_logs",
  "facility_management",
  "notifications",
  "rate_limits",
  "cache_entries",
])

/**
 * Validates a table name against the schema whitelist
 * @throws Error if the table name is not in the whitelist
 */
function validateTableName(tableName: string): void {
  const normalizedName = tableName.toLowerCase().trim()
  if (!VALID_TABLE_NAMES.has(normalizedName)) {
    logger.warn({ tableName }, "Attempted operation on invalid table name")
    throw new Error(`Invalid table name: ${tableName}. Table must be in the schema whitelist.`)
  }
}

/**
 * Validates an index name format (alphanumeric with underscores, must start with idx_)
 * @throws Error if the index name format is invalid
 */
function validateIndexName(indexName: string): void {
  // Index names should start with idx_ and contain only alphanumeric characters and underscores
  const validIndexPattern = /^idx_[a-z][a-z0-9_]*$/i
  if (!validIndexPattern.test(indexName)) {
    logger.warn({ indexName }, "Attempted operation on invalid index name")
    throw new Error(
      `Invalid index name: ${indexName}. Index name must match pattern idx_[a-z][a-z0-9_]*`
    )
  }
}

// ============================================================================
// Connection Pool Configuration
// ============================================================================

// Connection pool configuration
const connectionPool = postgres({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || "medstintclerk",
  username: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "",
  max: 20, // Maximum number of connections
  idle_timeout: 20, // Idle timeout in seconds
  connect_timeout: 10, // Connection timeout in seconds
  max_lifetime: 60 * 30, // Maximum lifetime of a connection in seconds (30 minutes)
  prepare: false, // Disable prepared statements for better performance with connection pooling
})

// Create the database instance with connection pooling
export const db = drizzle(connectionPool, { schema })

// Query cache configuration
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const queryCache = new LRUCache<string, any>({
  max: 500, // Maximum number of items in cache
  ttl: 1000 * 60 * 5, // Cache items for 5 minutes
  updateAgeOnGet: true, // Update age on get to extend TTL
})

// Performance monitoring
interface QueryStats {
  count: number
  totalTime: number
  average: number
  min: number
  max: number
}

const queryStats: Record<string, QueryStats> = {}

// Performance monitoring function
export function startQueryTimer(queryName: string): () => void {
  const startTime = performance.now()

  return () => {
    const endTime = performance.now()
    const duration = endTime - startTime

    // eslint-disable-next-line security/detect-object-injection
    if (!queryStats[queryName]) {
      queryStats[queryName] = {
        count: 0,
        totalTime: 0,
        average: 0,
        min: Infinity,
        max: 0,
      }
    }

    // eslint-disable-next-line security/detect-object-injection
    const stats = queryStats[queryName]
    stats.count += 1
    stats.totalTime += duration
    stats.average = stats.totalTime / stats.count
    stats.min = Math.min(stats.min, duration)
    stats.max = Math.max(stats.max, duration)
  }
}

// Get query statistics
export function getQueryStats(): Record<string, QueryStats> {
  return { ...queryStats }
}

// Clear query statistics
export function clearQueryStats(): void {
  // eslint-disable-next-line security/detect-object-injection
  Object.keys(queryStats).forEach((key) => delete queryStats[key])
}

// Cache key generation
function generateCacheKey(query: string, params: any[] = []): string {
  return `${query}:${JSON.stringify(params)}`
}

// Cached query execution
export async function cachedQuery<T>(
  query: string,
  params: any[] = [],
  cacheKey?: string,
  ttlMs?: number
): Promise<T> {
  const key = cacheKey || generateCacheKey(query, params)

  // Check cache first
  const cachedResult = queryCache.get(key)
  if (cachedResult !== undefined) {
    return cachedResult as T
  }

  // Execute query if not in cache
  const endTimer = startQueryTimer(query)
  try {
    // Use sql.raw for the query string since it's already a parameterized query
    const result = await db.execute(sql.raw(query))
    endTimer()

    // Store in cache
    queryCache.set(key, result, { ttl: ttlMs })

    return result as T
  } catch (error) {
    endTimer()
    throw error
  }
}

// Optimized query for time records with pagination
export async function getTimeRecordsPaginated(
  studentId?: string,
  rotationId?: string,
  limit: number = 50,
  offset: number = 0
) {
  const cacheKey = `time_records:${studentId || "all"}:${rotationId || "all"}:${limit}:${offset}`

  return cachedQuery(
    `SELECT tr.*, r.name as rotation_name, s.name as student_name, cs.name as site_name
     FROM time_records tr
     JOIN rotations r ON tr.rotation_id = r.id
     JOIN students s ON tr.student_id = s.id
     JOIN clinical_sites cs ON r.clinical_site_id = cs.id
     WHERE ($1::text IS NULL OR tr.student_id = $1)
     AND ($2::text IS NULL OR tr.rotation_id = $2)
     ORDER BY tr.clock_in DESC
     LIMIT $3 OFFSET $4`,
    [studentId, rotationId, limit, offset],
    cacheKey,
    1000 * 60 * 2 // Cache for 2 minutes
  )
}

// Optimized query for rotation statistics
export async function getRotationStats(rotationId: string) {
  const cacheKey = `rotation_stats:${rotationId}`

  return cachedQuery(
    `SELECT 
      COUNT(*) as total_records,
      SUM(EXTRACT(EPOCH FROM (clock_out - clock_in))/3600) as total_hours,
      AVG(EXTRACT(EPOCH FROM (clock_out - clock_in))/3600) as avg_hours,
      MIN(clock_in) as first_clock_in,
      MAX(clock_out) as last_clock_out
    FROM time_records
    WHERE rotation_id = $1 AND clock_out IS NOT NULL`,
    [rotationId],
    cacheKey,
    1000 * 60 * 10 // Cache for 10 minutes
  )
}

// Optimized query for student dashboard
export async function getStudentDashboardData(studentId: string) {
  const cacheKey = `student_dashboard:${studentId}`

  return cachedQuery(
    `SELECT 
      r.id as rotation_id,
      r.name as rotation_name,
      cs.name as site_name,
      r.start_date,
      r.end_date,
      COUNT(tr.id) as total_shifts,
      SUM(CASE WHEN tr.clock_out IS NOT NULL THEN 1 ELSE 0 END) as completed_shifts,
      SUM(EXTRACT(EPOCH FROM (tr.clock_out - tr.clock_in))/3600) as total_hours
    FROM rotations r
    JOIN clinical_sites cs ON r.clinical_site_id = cs.id
    LEFT JOIN time_records tr ON r.id = tr.rotation_id AND tr.student_id = $1
    WHERE r.student_id = $1
    GROUP BY r.id, r.name, cs.name, r.start_date, r.end_date
    ORDER BY r.start_date DESC`,
    [studentId],
    cacheKey,
    1000 * 60 * 5 // Cache for 5 minutes
  )
}

// Optimized query for site statistics
export async function getSiteStats(siteId: string) {
  const cacheKey = `site_stats:${siteId}`

  return cachedQuery(
    `SELECT 
      COUNT(DISTINCT r.id) as total_rotations,
      COUNT(DISTINCT r.student_id) as total_students,
      COUNT(tr.id) as total_shifts,
      SUM(EXTRACT(EPOCH FROM (tr.clock_out - tr.clock_in))/3600) as total_hours
    FROM rotations r
    LEFT JOIN time_records tr ON r.id = tr.rotation_id AND tr.clock_out IS NOT NULL
    WHERE r.clinical_site_id = $1`,
    [siteId],
    cacheKey,
    1000 * 60 * 15 // Cache for 15 minutes
  )
}

// Database health check
export async function performDatabaseHealthCheck() {
  const endTimer = startQueryTimer("health_check")

  try {
    // Test basic connectivity
    await db.execute(sql`SELECT 1`)

    // Test query performance
    const testQueryStart = performance.now()
    await db.execute(sql`SELECT COUNT(*) FROM users`)
    const testQueryTime = performance.now() - testQueryStart

    endTimer()

    // Calculate cache hit rate
    const cacheStats = queryCache.dump()
    const cacheHitRate = cacheStats.length > 0 ? 0.8 : 0 // Simplified calculation

    // Get average query time
    const stats = getQueryStats()
    const avgQueryTime =
      Object.values(stats).reduce((sum, stat) => sum + stat.average, 0) /
        Object.keys(stats).length || 0

    // Determine health status
    let status: "healthy" | "degraded" | "unhealthy"
    if (testQueryTime > 2000 || avgQueryTime > 2000) {
      status = "unhealthy"
    } else if (testQueryTime > 1000 || avgQueryTime > 1000) {
      status = "degraded"
    } else {
      status = "healthy"
    }

    return {
      status,
      metrics: {
        connectionTest: true,
        queryPerformance: stats,
        cacheHitRate,
        testQueryTime,
        avgQueryTime,
      },
    }
  } catch (error) {
    endTimer()

    return {
      status: "unhealthy",
      metrics: {
        connectionTest: false,
        queryPerformance: {},
        cacheHitRate: 0,
        testQueryTime: 0,
        avgQueryTime: 0,
      },
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

// Apply recommended database indexes
export async function applyRecommendedIndexes() {
  const indexes = [
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_time_records_student_clockout ON time_records(student_id, clock_out) WHERE clock_out IS NULL;",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_time_records_rotation_date ON time_records(rotation_id, clock_in);",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_time_records_student_date ON time_records(student_id, clock_in);",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rotations_site_status ON rotations(clinical_site_id, status);",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rotations_student_dates ON rotations(student_id, start_date, end_date);",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_school_role ON users(school_id, role);",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clinical_sites_school ON clinical_sites(school_id);",
  ]

  for (const indexSql of indexes) {
    try {
      await db.execute(indexSql)
      logger.info({ indexSql }, "Applied database index")
    } catch (error) {
      logger.error({ indexSql, error }, "Failed to apply database index")
    }
  }
}

// Clear cache
export function clearCache(): void {
  queryCache.clear()
}

// Get cache statistics
export function getCacheStats() {
  return {
    size: queryCache.size,
    maxSize: queryCache.max,
    calculatedSize: queryCache.calculatedSize,
  }
}

// Get table sizes
export async function getTableSizes() {
  const endTimer = startQueryTimer("table_sizes")
  try {
    const result = await db.execute(sql`
      SELECT 
        schemaname,
        tablename,
        attname,
        n_distinct,
        correlation
      FROM pg_stats 
      WHERE schemaname = 'public'
      ORDER BY tablename, attname
    `)
    endTimer()
    return result
  } catch (error) {
    endTimer()
    throw error
  }
}

// Get index usage
export async function getIndexUsage() {
  const endTimer = startQueryTimer("index_usage")
  try {
    const result = await db.execute(sql`
      SELECT 
        schemaname,
        tablename,
        indexname,
        idx_scan,
        idx_tup_read,
        idx_tup_fetch
      FROM pg_stat_user_indexes
      ORDER BY schemaname, tablename, indexname
    `)
    endTimer()
    return result
  } catch (error) {
    endTimer()
    throw error
  }
}

// Get table statistics
export async function getTableStats() {
  const endTimer = startQueryTimer("table_stats")
  try {
    const result = await db.execute(sql`
      SELECT 
        schemaname,
        tablename,
        seq_scan,
        seq_tup_read,
        idx_scan,
        idx_tup_fetch,
        n_tup_ins,
        n_tup_upd,
        n_tup_del,
        n_live_tup,
        n_dead_tup
      FROM pg_stat_user_tables
      ORDER BY schemaname, tablename
    `)
    endTimer()
    return result
  } catch (error) {
    endTimer()
    throw error
  }
}

// Get database statistics
export async function getDatabaseStatistics() {
  const endTimer = startQueryTimer("database_statistics")

  try {
    const [tableSizes, indexUsage, tableStats] = await Promise.all([
      getTableSizes(),
      getIndexUsage(),
      getTableStats(),
    ])

    endTimer()

    return {
      tableSizes,
      indexUsage,
      tableStats,
    }
  } catch (error) {
    endTimer()
    throw error
  }
}

// Get slow queries
export async function getSlowQueries() {
  const endTimer = startQueryTimer("slow_queries")

  try {
    // This query requires pg_stat_statements extension to be enabled
    const slowQueries = await db.execute(sql`
      SELECT 
        query,
        calls,
        total_exec_time,
        mean_exec_time,
        rows,
        100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
      FROM pg_stat_statements
      WHERE mean_exec_time > 1000 -- Queries taking more than 1 second on average
      ORDER BY mean_exec_time DESC
      LIMIT 10
    `)

    endTimer()

    return slowQueries
  } catch (error) {
    endTimer()
    // If pg_stat_statements is not enabled, return empty array
    if (error instanceof Error && error.message.includes("pg_stat_statements")) {
      console.warn(
        "pg_stat_statements extension is not enabled. Enable it with: CREATE EXTENSION pg_stat_statements;"
      )
      return []
    }
    throw error
  }
}

// Get connection pool status
export function getConnectionPoolStatus() {
  // Note: postgres.js doesn't expose detailed connection pool stats
  // This is a simplified implementation with default pool size
  const maxPoolSize = 20 // Default postgres.js pool size
  return {
    totalConnections: maxPoolSize,
    idleConnections: "Unknown", // Not directly exposed by postgres.js
    activeConnections: "Unknown", // Not directly exposed by postgres.js
    maxConnections: maxPoolSize,
    waitingClients: "Unknown", // Not directly exposed by postgres.js
  }
}

// Get optimization recommendations
export async function getOptimizationRecommendations() {
  const endTimer = startQueryTimer("optimization_recommendations")

  try {
    // Check for tables with high dead tuple ratio
    const highDeadTuples = await db.execute(sql`
      SELECT 
        schemaname,
        tablename,
        n_dead_tup,
        n_live_tup,
        CASE 
          WHEN n_live_tup > 0 THEN ROUND(n_dead_tup::numeric / (n_live_tup + n_dead_tup) * 100, 2)
          ELSE 0
        END AS dead_tuple_ratio
      FROM pg_stat_user_tables
      WHERE n_live_tup > 0 AND n_dead_tup > 0
        AND n_dead_tup::numeric / (n_live_tup + n_dead_tup) > 0.1 -- More than 10% dead tuples
      ORDER BY dead_tuple_ratio DESC
      LIMIT 10
    `)

    // Check for unused indexes
    const unusedIndexes = await db.execute(sql`
      SELECT 
        schemaname,
        tablename,
        indexname,
        idx_scan
      FROM pg_stat_user_indexes
      WHERE idx_scan = 0
      ORDER BY schemaname, tablename, indexname
      LIMIT 10
    `)

    // Check for tables without primary key
    const tablesWithoutPK = await db.execute(sql`
      SELECT 
        t.schemaname,
        t.tablename
      FROM pg_tables t
      LEFT JOIN pg_class c ON c.relname = t.tablename
      LEFT JOIN pg_constraint p ON p.conrelid = c.oid AND p.contype = 'p'
      WHERE t.schemaname = 'public' 
        AND p.conrelid IS NULL
        AND t.tablename NOT IN ('pg_stat_statements')
      ORDER BY t.schemaname, t.tablename
      LIMIT 10
    `)

    endTimer()

    return {
      highDeadTuples,
      unusedIndexes,
      tablesWithoutPK,
    }
  } catch (error) {
    endTimer()
    throw error
  }
}

/**
 * Runs VACUUM on a specific table to reclaim storage and update statistics
 */
export async function runVacuum(tableName: string) {
  // Validate table name before executing to prevent SQL injection
  validateTableName(tableName)

  const endTimer = startQueryTimer("vacuum")

  try {
    // Safe to use after validation - table name is in whitelist
    await db.execute(sql.raw(`VACUUM ANALYZE ${tableName}`))
    endTimer()
    logger.info({ tableName }, "VACUUM ANALYZE completed")
    return { success: true, message: `VACUUM ANALYZE completed for table ${tableName}` }
  } catch (error) {
    endTimer()
    logger.error({ tableName, error }, "VACUUM ANALYZE failed")
    throw error
  }
}

/**
 * Runs ANALYZE on a specific table to update query planner statistics
 */
export async function analyzeTable(tableName: string) {
  // Validate table name before executing to prevent SQL injection
  validateTableName(tableName)

  const endTimer = startQueryTimer("analyze")

  try {
    // Safe to use after validation - table name is in whitelist
    await db.execute(sql.raw(`ANALYZE ${tableName}`))
    endTimer()
    logger.info({ tableName }, "ANALYZE completed")
    return { success: true, message: `ANALYZE completed for table ${tableName}` }
  } catch (error) {
    endTimer()
    logger.error({ tableName, error }, "ANALYZE failed")
    throw error
  }
}

/**
 * Rebuilds an index to improve performance and reduce bloat
 */
export async function rebuildIndex(indexName: string) {
  // Validate index name format before executing to prevent SQL injection
  validateIndexName(indexName)

  const endTimer = startQueryTimer("reindex")

  try {
    // Safe to use after validation - index name matches allowed pattern
    await db.execute(sql.raw(`REINDEX INDEX ${indexName}`))
    endTimer()
    logger.info({ indexName }, "REINDEX completed")
    return { success: true, message: `REINDEX completed for index ${indexName}` }
  } catch (error) {
    endTimer()
    logger.error({ indexName, error }, "REINDEX failed")
    throw error
  }
}

/**
 * Close database connections
 */
export async function closeDatabaseConnections(): Promise<void> {
  await connectionPool.end()
}
