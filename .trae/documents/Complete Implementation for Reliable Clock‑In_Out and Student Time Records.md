## Scope
- Finalize and harden clock‑in/out across student endpoints and dashboard.
- Ensure schema‑safe DB writes on Neon and clear user feedback.
- Verify student time records visibility on `dashboard/student` and history pages.

## Client (Dashboard)
- Unify error handling for clock‑in/out: status‑aware mapping (401/403/400/422/5xx) plus specific `error.code` messages.
- Add dynamic guidance for `SESSION_TOO_SHORT`: compute remaining minutes from `GET /api/student/clock-status` and display in toast.
- Keep loading/disable state to prevent duplicate submissions; maintain offline checks.

## Service (ClockService)
- Read `MIN_SESSION_MINUTES` env (default 15) for clock‑out rule; enforce via configuration.
- Use schema‑safe operations for Neon:
  - Clock‑in: minimal select; insert only existing columns; return `id`.
  - Clock‑out: minimal select; update only existing columns; return `id`.

## API Routes
- Student endpoints (`/api/student/clock-in`, `/api/student/clock-out`, `/api/student/clock-status`):
  - Log `type`, `code`, `status` for successes/failures.
  - Wrap handlers with timing metrics; ensure standardized JSON response (`createSuccessResponse`, `createErrorResponse`).

## Time Records Visibility
- Confirm `GET /api/student/dashboard` returns recent time records (limit 10) for the authenticated student and is rendered in `StudentDashboardClient`.
- Ensure history view (`/api/time-records/history`) and recent (`/api/time-records/recent`) work for student role.

## Testing & Verification
- Manual flows:
  - Clock‑in without GPS (manual), then clock‑out after configured minimum; expect 200 and recent records updated.
  - Attempt early clock‑out (< min); expect 422 with `SESSION_TOO_SHORT` and precise guidance.
  - Clock‑out without clock‑in; expect 422 `NO_ACTIVE_SESSION`.
  - Auth mismatch; expect 401/403 with actionable message.
- Cross‑account tests: verify another `STUDENT` account follows the same rules and records are visible.

## Configuration & Ops
- Set `MIN_SESSION_MINUTES` for dev/testing (e.g., 2) to ease verification.
- No schema migrations required; code avoids non‑existent columns.

## Deliverables
- Updated client handlers with robust error mapping and guidance.
- Configurable clock‑out minimum duration via env.
- Schema‑safe DB writes and standardized API responses with logging/metrics.
- Verified student time records rendering on dashboard/history.

Confirm and I will implement the remaining client guidance (remaining minutes for `SESSION_TOO_SHORT`), finalize logs/metrics where needed, set up env configuration, and verify end‑to‑end with clear error messages and reliable behavior.