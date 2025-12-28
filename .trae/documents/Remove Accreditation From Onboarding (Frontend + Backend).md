## Scope
- Remove accreditation from onboarding wizard UX and validation.
- Remove backend requirements and endpoints tied to accreditation.
- Align types, RBAC, and database schema.

## Backend Changes
1. Remove accreditation requirements in school registration/evaluations
- Edit `src/app/api/evaluations/route.ts`: delete `accreditationBody`, `accreditationNumber`, `accreditationExpiry` from schema and logic; stop writing to `schools.accreditation`.
- Edit `src/app/api/schools/(create|[id]|route).ts`: stop accepting/setting `accreditation` (remove default `"LCME"`), don’t return it in responses.
- Edit `src/app/api/student/dashboard/route.ts`: remove `schoolAccreditation` from payload.

2. Remove accreditation options API and RBAC
- Delete or disable `src/app/api/accreditation-options/route.ts` (return 404 or remove route).
- Update RBAC mapping to remove `manage_accreditation` and route permissions in `src/lib/auth.ts` and `src/lib/rbac-middleware.ts`.

3. Clean up debug data
- Remove `accreditation` references in `src/app/api/debug/setup-school/route.ts` and archived mocks.

## Frontend Changes
1. Onboarding wizard UI
- Edit `src/components/onboarding/school-onboarding.tsx`: remove form field/state/validation for `accreditation`.
- Edit `src/components/onboarding/school-registration.tsx`: remove `AccreditationOption` usage and any dropdowns.
- Edit `src/components/onboarding/student-onboarding.tsx`: stop displaying `school.accreditation` in selection cards.
- Edit `src/app/onboarding/student/page.tsx`: stop selecting/using `schools.accreditation` in queries.

2. Types and schemas
- Edit `src/types/index.ts`: remove `accreditation` from `School` type.
- Adjust any Zod schemas in onboarding actions/components accordingly.

3. Marketing copy
- Edit `src/components/landing/medstint-features-enhanced.tsx`: remove mentions like “Support accreditation requirements”.

## Database Changes
- Option A (hard removal): drop `accreditation_options` table and `schools.accreditation` column via migration; verify on a temporary Neon branch, then commit.
- Option B (soft removal): keep columns/table but stop reading/writing; schedule later migration.

## Validation & Tests
- Run app, exercise onboarding flow (school admin and student) to confirm no broken UI or API contracts.
- Verify `schools` creation/update and `student/dashboard` responses without accreditation.

## Backward Compatibility
- For clients sending `accreditation`, ignore gracefully (do not error); add deprecation note in API responses if needed.

## Deliverables
- Updated APIs, components, types, and RBAC with accreditation removed.
- Optional Neon migration prepared and verified.

Would you like hard removal (drop DB fields) or soft removal (hide/ignore, keep DB fields)? Once confirmed, I’ll implement the changes end-to-end and verify in the running app.