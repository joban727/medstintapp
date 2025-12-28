## Findings
- The time-records page shows a generic toast “Failed to load time records” because the client catch block always emits this message even when the server returns structured error details.
- The `/api/time-records/history` route is student-scoped and may return 401/403/422/5xx; server logs need to expose detailed error codes (connection, permission, syntax/column, timeout) for the client to relay.

## Implementation Plan
### Client (time-records-history)
1. Enhance `fetchTimeRecords`:
- Parse `response.status` and JSON body (`error`, `details`) and map to specific messages:
  - 401: “You are signed out. Please sign in and try again.”
  - 403: “Insufficient permission to view time records.”
  - 422: “Invalid request or business rule violation.”
  - 5xx: “Server/database error while loading time records.”
- Use `details.code` from server (e.g., Postgres `42703`, `42501`, connection/timeout) to display precise guidance.
- Replace the generic catch toast with the thrown `error.message`.
- Add offline check before fetch to show “No internet connection…”

### Server (history/recent/status routes)
2. Add detailed error mapping and logs:
- Wrap with `withErrorHandling` and return `createErrorResponse(message, status, details)` with:
  - `details.code` (Postgres code or Node error code)
  - `details.type` (CONNECTION_ERROR, PERMISSION_ERROR, SYNTAX_ERROR, TIMEOUT)
  - minimal context (operation name, sanitized params)
- Add `TimingPerformanceMonitor.measure("time-records-history")` and log latency with success/failure counters.

### Reliability
3. Optional retries for transient failures:
- Use `RetryManager` on server reads only for transient network/timeout errors with conservative backoff; keep disabled for validation/permission failures.

### Verification
4. Test scenarios:
- Auth: signed-out (401), wrong role (403)
- Business: empty records, large filters, invalid params (422)
- DB: simulate connection failure, permission issue (`42501`), syntax/column (`42703`), timeout → confirm precise messages and logs.

### Deliverables
- Client-specific error messages replacing the generic toast
- Server-side detailed error responses and logs
- Latency metrics and counters for monitoring
- Verified end-to-end reliability across scenarios

Confirm to proceed and I will implement the client error mapping, server details and monitoring, then validate with scenario tests.