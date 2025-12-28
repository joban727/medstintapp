## Objective
Implement auto-approval of time records when students clock out, but immediately require manual approval if any timecard correction is created or applied.

## Policy Rules
- Auto-approve on successful clock-out when validations pass.
- Keep manual creations as pending.
- When a correction is submitted for a record, set the record status back to pending and require approver action.
- Applying a correction does not auto-approve; approvers must approve explicitly afterward.

## API Changes
### Auto-Approve On Clock-Out
- Update `src/app/api/time-records/clock/route.ts`:
  - After successful clock-out and validation, set `status = "APPROVED"`, `approvedAt = now`, and leave `approvedBy` unset.
  - Feature flag via `AUTO_APPROVE_ON_CLOCK_OUT` env (default true) to enable/disable.
  - Add audit entry `TIME_RECORD_AUTO_APPROVED`.

- Update `src/app/api/time-records/route.ts` `PUT` (student clock-out via update):
  - If `clockOut` is set by the student and validations pass, perform the same auto-approval logic.

### Require Approval When Corrections Exist
- Update `src/app/api/timecard-corrections/route.ts` `POST`:
  - After inserting a new correction, update the original time record: set `status = "PENDING"`, clear `approvedBy`, and optionally keep `approvedAt` for audit visibility.
  - Add audit entry `TIME_RECORD_MARKED_PENDING_DUE_TO_CORRECTION`.

- Ensure `src/app/api/timecard-corrections/[id]/apply/route.ts`:
  - Leaves the time record `status` as-is (will be pending from creation step).
  - No auto-approval on apply; approvers confirm via `PUT /api/time-records?id=...&status=APPROVED`.

## UI/Reporting
- No schema changes required; existing dashboards count pending/approved based on `time_records.status`.
- Optional enhancement (follow-up): add a badge “Requires Approval (Correction)” on school admin time-records table using existing `corrections` array.

## Configuration
- Add `.env` entry: `AUTO_APPROVE_ON_CLOCK_OUT="true"` (default true).
- No other env changes required.

## Auditing
- Log actions:
  - `TIME_RECORD_AUTO_APPROVED` on auto approval with record id and user context.
  - `TIME_RECORD_MARKED_PENDING_DUE_TO_CORRECTION` when a correction is submitted.

## Verification
- Unit/integration tests:
  - Clock-out autopproval path sets status to `APPROVED` when flag enabled and validations pass.
  - Submitting a correction for an approved record flips status to `PENDING`.
  - Applying a correction keeps status `PENDING` until `PUT` approval.
  - Admin dashboard pending counts reflect changes.

## Files To Modify
- `src/app/api/time-records/clock/route.ts`
- `src/app/api/time-records/route.ts` (PUT path for student clock-out)
- `src/app/api/timecard-corrections/route.ts` (POST path)
- `.env.example` (add `AUTO_APPROVE_ON_CLOCK_OUT`)

If approved, I will implement the above changes and run type checks/tests to verify behavior end-to-end.