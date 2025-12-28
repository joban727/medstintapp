## Goals
- Verify SQL execution and commits for time records on Neon
- Improve error handling with specific, actionable messages
- Add monitoring and retries for transient failures
- Validate schema and connection configuration

## Audit & Verification (Read-Only)
1. Configuration & Connectivity
- Review `database/connection-pool` for Neon connection string and pool setup (env vars present and non-empty)
- Confirm `@neondatabase/serverless` or `pg` client usage and pool health checks are active
- Validate Clerk/role-derived user scoping in endpoints that query/write time records

2. Schema Consistency
- Verify required tables/columns exist on Neon: `time_records` (id, student_id, rotation_id, date, clock_in, clock_out, total_hours, notes, status, created_at, updated_at), plus `rotations`, `clinical_sites`, `site_assignments`, `users`
- Cross-check codepaths touching columns; avoid non-existent columns (e.g., `clinical_preceptor_id`) in all queries

3. SQL Statements
- Inspect ClockService:
  - Clock-in: parameterized insert into known columns; returns `id`
  - Clock-out: parameterized update of `clock_out`, `notes`, `status`, `total_hours`, `updated_at`; returns `id`
- Inspect list/history/status endpoints for Drizzle SQL generation correctness and filters
- Confirm all statements are parameterized to avoid injection

## Error Handling Improvements
4. Structured Error Mapping (Server)
- Map DB failures by category to user-facing errors:
  - Connection errors (e.g., ECONNREFUSED/ECONNRESET) → “Database connection failed”
  - Permission errors (Postgres `42501`) → “Insufficient database permissions”
  - Syntax/invalid column errors (`42601`/`42703`) → “Database query failed (syntax/column)”
  - Timeout (`ETIMEDOUT`/`StatementTimeout`) → “Database timeout, please retry”
- Add detailed logs via `logger.error` with `code`, `type`, `query` context (sanitized) in API handlers that read/write time records
- Ensure `withErrorHandling` wraps endpoints and returns `createErrorResponse` with details

5. Client Feedback (UI)
- Replace generic “Failed to load time records” with status-aware messages and `details.error.code` from server response
- Show clear toasts for 401/403/422/5xx, plus specific guidance (e.g., “sign in”, “insufficient permissions”, “retry later”)

## Monitoring & Reliability
6. Monitoring
- Instrument read/write endpoints with `TimingPerformanceMonitor` and log latency, success/failure counters
- Add context keys (operation name: `time-records:list|history|status|clock-in|clock-out`) for aggregation

7. Automatic Retries
- Use `RetryManager` for transient failures (connection reset/timeout) on write operations (already present in ClockService)
- Extend to read endpoints where appropriate (history/status) with conservative backoff

## Testing Scenarios
8. Functional Tests
- Clock-in/out happy path (manual and GPS)
- Early clock-out (< MIN_SESSION_MINUTES) → expect `SESSION_TOO_SHORT`
- Clock-out without clock-in → `NO_ACTIVE_SESSION`
- Large history pagination and filters (status/site/date)

9. Failure Simulation
- Temporarily break DB connection string → expect connection error surfaced
- Reference a non-existent column in a controlled test route → confirm syntax/column error mapping
- Reduce DB role permissions → confirm `42501` permission mapping
- Artificial timeout → confirm timeout mapping and retry behavior

## Implementation Steps
- Server: add error-category mapping and detailed logging in time-record endpoints, use `withErrorHandling` consistently; ensure parameterized SQL in ClockService and list/history/status routes
- Client: parse server `details` and status code; replace generic messages in time records UI with specific guidance
- Monitoring: add timing metrics around DB operations and log counters; apply `RetryManager` where safe

## Deliverables
- Verified DB connectivity and schema
- Specific error messages replacing generic failures
- Monitored endpoints with timing and counters
- Reliable clock-in/out and time-records listing with robust user feedback

Confirm and I will implement the logging, error mapping, client feedback enhancements, and monitoring, then run scenario tests to verify reliability end-to-end.