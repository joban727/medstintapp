## Findings (Read-Only)
- API responses for student clock-out use `formatErrorResponse`, so JSON error is under `result.error.{code,message}` (`src/app/api/student/clock-out/route.ts:93–114`).
- The dashboard’s clock-out handler parses `result.error` and shows messages, but only maps 400/401/403/5xx; 422 is left to `message` fallback (`src/components/dashboard/student-dashboard-client.tsx:644–657`).
- Service enforces a hard minimum session duration of 15 minutes (`src/lib/clock-service.ts:724–734`) which can cause repeated failures during short test sessions.
- Neon DB previously caused 500 due to missing columns; clock-out now updates a safe subset (`src/lib/clock-service.ts:737–751`).

## Root Cause Candidates
1. Business rule violation: attempts to clock out before 15 minutes → `SESSION_TOO_SHORT` (422).
2. Auth/role mismatch: non-`STUDENT` or expired session → 401/403.
3. Data issues: no active session (`NO_ACTIVE_SESSION`), or timestamp drift → validation errors.
4. Residual DB schema differences: unlikely now, but monitored.

## Plan
### A. Client Error Mapping
- Extend clock-out handler to explicitly map 422 to actionable messages so users don’t see a generic failure.

### B. Configurable Minimum Session Duration
- Introduce `MIN_SESSION_MINUTES` env (default 15) to allow shorter duration (e.g., 1–2 minutes) in development/testing.
- Update `ClockService.clockOut` to read this env and enforce the configured minimum.

### C. Diagnostics & Feedback
- Enhance logs in clock-out route to include status and `error.code` for quick triage.
- Add guidance in the toast when `SESSION_TOO_SHORT` to indicate remaining time.

### D. Verification
- Test flows:
  - Clock-in then clock-out under the configured minimum.
  - Clock-out without clock-in (expect `NO_ACTIVE_SESSION`).
  - Auth/role mismatch (expect 401/403).
  - Ensure 422 shows specific guidance.

### Implementation Steps
1. Update frontend: add 422 mapping for clock-out and improved message for `SESSION_TOO_SHORT`.
2. Update service: read `MIN_SESSION_MINUTES` and enforce configurable minimum.
3. Augment clock-out route logging with `type`/`code`/status.
4. Validate end-to-end and share reproduction plus logs.

Confirm to proceed and I will implement these changes and validate clock-out reliability with clear, user-facing messages.