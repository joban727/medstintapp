import { auth } from "@clerk/nextjs/server"
import { neon, neonConfig } from "@neondatabase/serverless"

// Configure Neon for serverless environments to prevent WebSocket issues
neonConfig.fetchConnectionCache = true
neonConfig.webSocketConstructor = undefined // Disable WebSocket to prevent s.unref errors

/**
 * Get Neon database connection with Clerk authentication token
 * This enables Row Level Security (RLS) policies that use auth.user_id()
 */
export async function getNeonWithAuth() {
  const { getToken } = await auth()

  const databaseUrl =
    process.env.DATABASE_AUTHENTICATED_URL ||
    process.env.DATABASE_URL ||
    "postgresql://placeholder:placeholder@localhost:5432/placeholder"

  const sql = neon(databaseUrl, {
    authToken: async () => {
      const token = await getToken()
      if (!token) {
        throw new Error("No authentication token available")
      }
      return token
    },
  })

  return sql
}

/**
 * Execute a query with Clerk authentication context
 * @param query SQL query string
 * @param params Query parameters
 * @returns Query results
 */
export async function executeWithAuth<T = unknown>(
  query: string,
  _params?: unknown[]
): Promise<T[]> {
  const sql = await getNeonWithAuth()
  // Use template literal syntax for neon
  const result = await sql`${query}`
  return result as T[]
}

/**
 * Helper function to get current user ID for RLS policies
 * This should be used in SQL queries that need the current user context
 */
export async function getCurrentUserId(): Promise<string | null> {
  const { userId } = await auth()
  return userId
}

/**
 * Example usage for RLS-enabled queries:
 *
 * // For a todos table with RLS policies
 * const todos = await executeWithAuth(
 *   'SELECT * FROM todos WHERE user_id = auth.user_id()'
 * )
 *
 * // Or with explicit user ID filtering for performance
 * const userId = await getCurrentUserId()
 * const todos = await executeWithAuth(
 *   'SELECT * FROM todos WHERE user_id = $1',
 *   [userId]
 * )
 */
