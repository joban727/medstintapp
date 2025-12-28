## Goals
- Align and standardize all frontend API endpoints to fully support the unified Control Center and reduce navigation.
- Establish consistent response contracts, filters, and error handling across Programs, Rotations, Sites, and Time Records.
- Add endpoints needed for timeline scheduling, conflict detection, capacity checks, and real-time updates.

## Response Contract Standard
- Success: `{ success: true, data: <payload>, message?: string }`
- Error: `{ success: false, error: <code>, message: <string>, details?: <object> }`
- Pagination: `{ items: <array>, pagination: { page, limit, total, totalPages, hasNext, hasPrev } }`

## Endpoint Changes by Module
### Programs
- `GET /api/programs?schoolId=<id>&includeStats=true`
  - Response: `{ success, data: Program[], message? }`; each program may include `stats.totalStudents`.
  - Align with current usage in `src/components/dashboard/programs-client.tsx:73` and `src/components/dashboard/school-admin-control-center.tsx:29`.
- `POST /api/programs` / `PUT /api/programs/:id` / `DELETE /api/programs/:id`
  - Enforce RBAC and audit logging; return success contracts.

### Rotations
- `GET /api/rotations`
  - Accept filters: `studentId`, `clinicalSiteId`, `preceptorId`, `status`, `specialty`, `startDate`, `endDate`.
  - Response: `{ success, data: { items: Rotation[], pagination }, message? }`.
  - Align with usage in `src/components/dashboard/school-admin-control-center.tsx:56` and other reporting/consumer code.
- `POST /api/rotations` / `PUT /api/rotations/:id` / `DELETE /api/rotations/:id`
  - Validate inputs, enforce RBAC, audit all changes.

### Clinical Sites
- `GET /api/sites/available`
  - Response: `{ success, data: { sites: Site[] } }` where fields include `id, name, address, contactPerson?, contactEmail?, contactPhone?, isActive`.
  - Align with consumers in `src/components/student/time-records-history.tsx:70`, `src/components/dashboard/school-admin-control-center.tsx:84`, and `src/components/dashboard/student-dashboard-client.tsx`.
- `GET /api/clinical-sites` (admin directory)
  - Response: `{ success, data: { sites: Site[], pagination } }` and filters for name, active, capacity.

### Time Records
- `GET /api/time-records/history`
  - Accept filters: `status`, `siteId`, `dateFrom`, `dateTo`, `studentId`.
  - Response: `{ success, data: { records: TimeRecord[], pagination }, message? }`.
  - Align with `src/components/student/time-records-history.tsx:42`.
- `POST /api/time-records` / `PUT /api/time-records?id=<id>` / `DELETE /api/time-records?id=<id>`
  - Keep normalized fields returned (clockInTime, clockOutTime, totalHours, status, site/rotation info).
- `GET /api/time-records/status` and `POST /api/time-records/clock`
  - Standardize success/error responses; wire audit.

## New Endpoints for Schedule & Sync
- `GET /api/schedule/timeline`
  - Returns aggregated rotations in timeline-ready format grouped by program/site/student.
- `POST /api/schedule/assign` / `POST /api/schedule/move`
  - Drag-and-drop actions (assign student to rotation, move rotation window); server-side validation.
- `GET /api/schedule/conflicts`
  - Detect overlaps (student double-booking, site capacity, preceptor availability, time-log overlap).
- `GET /api/sites/capacity?siteId=<id>`
  - Live capacity and availability snapshot.
- `GET /api/sync/events?channel=schedule|time|sites` (SSE)
  - Push schedule/time/site updates for real-time UI sync.

## RBAC & Audit
- Add all endpoints above to `PROTECTED_API_ROUTES` with proper roles/permissions (see `src/lib/rbac-middleware.ts:98`).
- Use `apiAuthMiddleware` for route guards (see `src/lib/rbac-middleware.ts:607`).
- Log all mutating actions via `logAuditEvent` (see `src/lib/rbac-middleware.ts:526`).

## Alignment Tasks
1. Standardize response contracts across existing endpoints (Programs, Rotations, Sites, Time Records).
2. Update consumers to rely on standardized shapes (`data.items` + `pagination` or `data.sites`/`data.records`).
3. Implement new schedule endpoints and SSE event channels; subscribe in the Control Center.
4. Extend filters on Programs/Rotations/Sites endpoints to support workspace views.
5. Wire RBAC and audit entries for all mutating endpoints.

## Verification
- Add unit tests for each endpoint’s response contract and filters.
- Run manual tests in the Control Center to confirm 2-click access and integrated flows.
- Telemetry: capture click counts on key actions to compute improvements.

## Files to Touch (Representative)
- API routes: `src/app/api/programs/route.ts`, `src/app/api/rotations/route.ts`, `src/app/api/sites/available/route.ts`, `src/app/api/time-records/**`.
- RBAC: `src/lib/rbac-middleware.ts` (route whitelist + middleware usage).
- Control Center consumers: `src/components/dashboard/school-admin-control-center.tsx` and composed components.

On approval, I will standardize endpoint contracts, add the schedule/sync endpoints, update RBAC and audit, and verify all Control Center panels consume the new contracts consistently with tests and telemetry.