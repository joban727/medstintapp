/**
 * Database Connection Module
 * Re-exports the main database connection for test compatibility
 */

export { db, dbUtils } from '@/database/db'
export type { DatabaseConnection } from '@/database/connection-pool'