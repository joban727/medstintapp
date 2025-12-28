## Current Observation
- Clock-in succeeds; clock-out shows a generic “Failed to clock out”.
- Likely cause: client doesn’t surface server error details when JSON parsing fails or non-200 responses return non-JSON. Another common server-side cause is short session duration (<15 min) or schema mismatch during update.

## Verification (Read-Only)
- Clock-out flow: `src/components/dashboard/student-dashboard-client.tsx:576–626` submits payload; parses response but lacks status-aware fallbacks (unlike clock-in).
- API: `src/app/api/student/clock-out/route.ts:32–121` gates auth/role and calls `ClockService.clockOut()` with error formatting.
- Service: `src/lib/clock-service.ts:465–540`, `703–768` validates timestamps, minimum duration (15 minutes), performs atomic update.

## Fix Plan
1. Frontend: add status-aware fallbacks to clock-out handler similar to clock-in.
   - Map 401/403/400/5xx to clear guidance.
   - Preserve code-based mappings (`NO_ACTIVE_SESSION`, `SESSION_TOO_SHORT`, `FUTURE_TIMESTAMP`, `PAST_TIMESTAMP`).
2. Backend: verify clock-out DB writes use safe column sets (already aligned for returning and select) to avoid Neon schema mismatches.
   - Confirm only existing columns are read/returned in clock-out path.
3. Monitoring: ensure error logs include `type`, `code`, `retryable` for clock-out to aid diagnostics (already present).

## Implementation Steps
- Update `handleClockOut` to compute a friendly message when `result` is null or status is non-200.
- Keep `clientTimestamp` forwarding and loading states.

## Expected Result
- Generic failures become actionable messages.
- If session <15 minutes, user sees “Session duration is too short to clock out…” instead of a generic error.
- If auth/permission issues, appropriate messages guide the user to sign in or correct role.

## Next Actions
- Implement the frontend update and re-test clock-out.
- If issues persist, capture Network response (`error.code`, `error.message`, status) to pinpoint server-side logic.

Confirm to proceed and I will apply the client handler update and validate end-to-end clock-out behavior.