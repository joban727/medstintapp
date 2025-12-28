## Findings
- Frontend clock handlers:
  - `handleClockIn` builds payload and posts to `POST /api/student/clock-in`; shows generic error on non-200 (`src/components/dashboard/student-dashboard-client.tsx:498–574`).
  - `handleClockOut` posts to `POST /api/student/clock-out`; sends `location: null` when GPS absent (`src/components/dashboard/student-dashboard-client.tsx:576–626`).
  - Error alert renders but does not surface backend error codes/messages (`src/components/dashboard/student-dashboard-client.tsx:664–674`).
- API endpoints:
  - Clock-in handler with auth+role checks, rotation resolution fallbacks, and structured `ClockError` responses (`src/app/api/student/clock-in/route.ts:35–221`).
  - Clock-out handler with auth+role checks and structured errors (`src/app/api/student/clock-out/route.ts:32–121`).
- Service and validation:
  - ClockService enforces timestamp bounds, Zod schemas, eligibility rules, and atomic DB writes (`src/lib/clock-service.ts:232–462`, `624–698`, `703–768`).
  - Location and clock schemas allow `location` to be optional/nullable for both in/out (`src/lib/clock-validation.ts:47–55`, `77–85`).
- Database:
  - Attendance stored in `time_records` with unique active constraint and indexes (`src/database/schema.ts:255–314`).
- Logging/monitoring utilities exist (`src/lib/logger.ts:24–95`, `src/lib/enhanced-error-handling.ts:260–332`).

## Likely Root Cause
- Primary: Server-side validation previously rejected `location: null`; now schemas permit nullable location and clock-in payload already omits `location` when absent (`src/components/dashboard/student-dashboard-client.tsx:509–533`). Clock-out sending `location: null` is safe given `.nullable()`.
- Secondary contributors:
  - Generic frontend error handling hides informative backend errors (e.g., `ALREADY_CLOCKED_IN`, `NO_ACTIVE_SESSION`, `LOCATION_TOO_FAR`, `FUTURE_TIMESTAMP`).
  - Rotation resolution can fail when the student has no current rotation and hasn’t selected a site (`src/components/dashboard/student-dashboard-client.tsx:499–503`; `src/app/api/student/clock-in/route.ts:173–184`).
  - Time bounds and drift checks can reject bad timestamps (`src/lib/clock-service.ts:153–176`, `156–170`).
  - Auth/session issues return 401/403 (`src/app/api/student/clock-in/route.ts:45–57`, `src/app/api/student/clock-out/route.ts:42–54`).

## Fix Plan
### Frontend
1. Parse and display backend error details in clock-in/out handlers.
   - Read `result.error.code` and `result.error.message` from JSON; show actionable `toast` messages.
   - Surface specific guidance for `ALREADY_CLOCKED_IN`, `NO_ACTIVE_SESSION`, `LOCATION_TOO_FAR`, `FUTURE_TIMESTAMP`.
2. Improve user guidance and fallback:
   - If no `rotationId` and no `selectedSite`, prompt site selection before calling API.
   - Show network status (`navigator.onLine`) and retry option for network errors.
3. UX reliability tweaks:
   - Disable buttons during request; show loading state; debounce repeated clicks.
   - Ensure clock-in payload only includes `location` when present (already implemented; keep).

### API/Service
4. Keep nullable location acceptance (already in place).
5. Return consistent, actionable error payloads using `formatErrorResponse` (already in place); add context for common failures in logs.
6. Align timestamp handling:
   - Prefer server time when `timestamp` missing; for clients providing timestamps, include `clientTimestamp` to improve drift diagnostics.

### Data Consistency & Rules
7. Preserve atomicity and constraints (existing transactions and unique active constraint).
8. Enforce minimum session duration on clock-out (already implemented) and provide clear feedback.

### Monitoring
9. Add lightweight metrics and logs:
   - Count successes/failures per endpoint with `logger.info/warn/error` including `code`, `studentId` (masked), and `rotationId`.
   - Log timing (latency) and drift warnings; optionally reuse `TimingPerformanceMonitor` as in `time-records/clock`.
10. Audit trails:
   - For failed attempts with `AUTHORIZATION_ERROR` or repeated `BUSINESS_LOGIC_ERROR`, send an `AuditLogger.log` entry for pattern tracking.

## Implementation Steps
- Frontend: update `handleClockIn` and `handleClockOut` to parse error JSON and render specific messages; add disabled states and online-check; ensure site selection guard.
- API: optionally accept `clientTimestamp` and pass through to `ClockService.validateTimestamp`.
- Monitoring: add `logger` calls with context in success/failure paths of the student clock routes; add timing metrics.

## Verification
- Manual tests: clock-in/out with and without location; while already clocked-in; with no active rotation; with future/past timestamps.
- Observe: proper toasts, no generic “Failed to clock in”; records appear in `time_records`; errors carry correct codes; logs show metrics.

## User Instructions
- Ensure you are signed in as a `STUDENT` and select a clinical site when no current rotation is shown.
- If GPS is unavailable, proceed with manual clock-in/out; the system allows it.
- Keep device time accurate; avoid clocking far in the future/past.
- If you see messages like “Already clocked in” or “No active session,” follow the prompt to clock out first or start a new session as appropriate.

Confirm to proceed and I will implement the changes, add monitoring, and validate end-to-end.