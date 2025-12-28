## Objectives

* Standardize and simplify program setup, clinical site management, and rotation scheduling for school admins.

* Add missing API endpoints, unify response contracts, move critical validation server-side.

* Preserve backward compatibility via feature flags and adapter layers; avoid regressions.

## High-Level Approach

1. Implement consistent CRUD APIs for programs and rotations with unified response shape.
2. Enforce capacity/overlap rules on the server for site assignments.
3. Thin the UI by using standardized APIs; introduce a guided Rotation Planner.
4. Consolidate role checks and RBAC configuration to reduce duplication.
5. Validate with shared schemas, add tests, and roll out behind feature flags.

## API Changes (Non‑Breaking)

* Create `src/app/api/programs/route.ts`

  * Methods: `GET`, `POST`, `PUT`, `DELETE` with shared `apiAuthMiddleware`, `withErrorHandling`.

  * Response: always `{ data: <payload> }`; errors normalized.

  * DTOs: `CreateProgramRequest`, `ProgramResponse` aligned with `src/database/schema.ts`.

* Create `src/app/api/rotations/route.ts`

  * Methods: `GET`, `POST`, `PUT` for listing, creating, updating rotations.

  * Same middleware/response contracts and DTOs (`CreateRotationRequest`, `RotationResponse`).

* Normalize existing endpoints

  * Update `src/app/api/clinical-sites/*`, `src/app/api/students/route.ts`, `src/app/api/site-assignments/route.ts` to use `{ data: ... }` and shared error helper.

* Add lightweight response adapter helper in UI (temporary)

  * Wrap fetch parsing once (e.g., `extractData(responseJson)`) to support both old and new shapes during transition.

## Server‑Side Business Rules

* Enhance `src/app/api/site-assignments/route.ts`

  * Capacity checks: prevent assignments exceeding site capacity for the selected dates.

  * Overlap checks: reject student assignments that overlap existing rotations/assignments.

  * Concurrency: use transaction-based validations to avoid race conditions on bulk operations.

## UI Updates (Incremental, Feature‑Flagged)

* Rotation Planner

  * Replace/augment `create-rotation-modal.tsx` with a guided flow: Program/ClassYear → Site/Preceptor (live capacity) → Dates (conflict validation).

  * Use new rotation API; feature flag `ROTATION_PLANNER_ENABLED`.

* Bulk assign improvements in `school-rotations-client.tsx`

  * Server‑validated bulk assign/unassign; show capacity/conflict badges.

* Capacity/conflict visibility

  * In `assign-students-modal.tsx`, show capacity used/remaining and conflict indicators (surface from API).

* Calendar view (optional, behind flag)

  * Add weekly/monthly rotation calendar in `school-admin-dashboard-client.tsx`.

## RBAC & Role Helpers

* Centralize `isSchoolAdmin` and helpers in `src/lib/school-utils.ts`.

* Refactor usages in `src/app/dashboard/layout.tsx`, `src/app/dashboard/school-admin/page.tsx`.

* Reduce RBAC path sprawl in `src/lib/rbac-middleware.ts`

  * Group by resource prefixes (e.g., `api/programs`, `api/rotations`, `api/site-assignments`) and apply permission sets programmatically.

## Validation & Types

* Extract shared zod schemas in `src/lib/validation.ts` (Programs, Rotations, SiteAssignments).

* Reuse schemas in both UI modals and API route handlers.

* Define request/response DTOs and ensure alignment with Drizzle types from `src/database/schema.ts`.

## Testing Strategy

* Unit tests: validation schemas, API handlers (success/error paths, capacity/overlap logic).

* Integration tests: end‑to‑end flows for program create, rotation plan, bulk assignments.

* Regression tests: ensure existing screens (`programs-client.tsx`, `school-rotations-client.tsx`, modals) continue to function via adapter helper.

* Load tests (targeted): bulk assignment concurrency and capacity enforcement.

## Performance & Data

* Confirm no DDL changes required (use existing schema). If needed, apply indexes suggested by `database-schema-validation-report.md` (e.g., on assignment date ranges, site+status) in a safe migration.

* Paginate large lists; add caching hints for frequent lookups (students/sites) if necessary.

## Rollout Plan

1. Implement APIs and shared helpers; add tests.
2. Normalize existing endpoints’ response shape and add UI adapter helper.
3. Ship server‑side validations in assignments.
4. Enable Rotation Planner behind feature flag for pilot admins.
5. Monitor error logs/metrics; expand rollout; remove adapter helper once all responses are standardized.

## Acceptance Criteria

* All program and rotation operations succeed via new APIs with `{ data }` responses.

* Client cannot create overlapping or over‑capacity assignments; server rejects invalid requests.

* Existing screens continue working during transition (no runtime errors; adapter covers old shapes).

* Rotation Planner improves time‑to‑schedule and reduces error rates (tracked via metrics).

## Risks & Mitigations

* UI expecting varied response shapes → use adapter helper and phased normalization.

* Permission misconfigurations → centralize helpers and apply middleware consistently.

* Concurrency issues on bulk assigns → transactional checks and idempotent operations.

* Timezone/date handling → standardize ISO and server validation across endpoints.

## Execution Order

1. Shared validation/DTOs and response helpers.
2. Programs and Rotations API routes with tests.
3. Normalize responses in existing endpoints + UI adapter.
4. Server‑side validations for assignments + tests.
5. Rotation Planner (feature‑flagged) + calendar view.
6. RBAC consolidation and role helpers refactor.
7. Performance tuning

