/**
 * Database Connection Module
 * Re-exports the main database connection for test compatibility
 */

export { db, dbUtils } from "@/database/db"
export { checkDatabaseConnection } from "@/database/connection-pool"
