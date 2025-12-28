## Goals
- Eliminate redundancies and dead code
- Standardize naming and coding conventions
- Align configuration and deployment with Next.js best practices
- Improve test coverage and reliability
- Reduce architectural risk (cycles, unclear boundaries)

## Phase 1: Quick Wins
1. Remove unused components/modules
   - Delete `src/components/debug/onboarding-test.tsx`
   - Remove unused landing non‑enhanced components
   - Delete unused `email-notification-system.tsx`
   - Remove `cache.config.ts` if not referenced
2. Fix obvious inconsistencies
   - Remove invalid role values ("ADMIN") in `src/lib/auth-clerk.ts`
   - Remove unused imports (e.g., `EnhancedLocationDisplay` in student dashboard)
   - Standardize component filenames to PascalCase in `src/components/**`
3. Documentation sync
   - Update stack versions (Next 15, React 19) across `COMPREHENSIVE_*` docs and `.trae/documents/*`

## Phase 2: Auth Consolidation
1. Centralize role routes and permissions
   - Keep `src/lib/auth.ts` as the single source of truth
   - Refactor `src/lib/auth-clerk.ts` to reference `auth.ts` for routes/roles
2. Strengthen environment validation
   - Add startup checks in `src/lib/production-config.ts`

## Phase 3: Configuration Alignment
1. Lint/format
   - Pick one: Biome or ESLint; default to Biome
   - If ESLint retained, re‑enable build errors; otherwise remove ESLint config
2. Next/Vercel configuration
   - Remove incorrect `vercel.json` rewrite to `index.html`
   - Enable build checks: set `ignoreBuildErrors: false` and `ignoreDuringBuilds: false` once stabilized
3. Environment consistency
   - Align `NEXT_PUBLIC_APP_URL` with dev port; document envs in `.env.example`

## Phase 4: Testing Strategy
1. Consolidate Vitest configs
   - Single `vitest.config.ts` with projects: unit + integration
   - Include `src/tests/**` patterns for unit; `src/app/api/**` for integration
2. Add meaningful tests
   - Critical modules: `src/lib/auth.ts`, `src/lib/clock-service.ts`, API routes under `src/app/api/time-records/*`
   - UI: student dashboard flows and location permission handler
3. Coverage targets
   - Start global 70% → raise gradually; maintain 100% on critical modules

## Phase 5: Architecture Cleanups
1. Module boundaries
   - Clarify `src/lib/**` into subfolders (auth, errors, performance, cache, location)
   - Rename `src/lib/cache.ts` to `error-handling.ts` and migrate callers
2. Circular‑dependency hygiene
   - Replace dynamic imports with explicit dependency inversion (e.g., pass functions via interfaces)
3. Performance modules
   - Merge naming: keep server‑side `performance-monitor.ts` and client hook `performance-monitoring.ts`

## Phase 6: Verification & CI
1. Add CI jobs
   - Lint + typecheck + unit + integration + coverage report
2. Smoke tests
   - Student clock‑in/out API happy‑path + failure cases
3. Deployment checklists
   - Env validation, database connectivity, Clerk keys presence

## Deliverables
- Cleanup PRs (by phase) with a change log
- Updated documentation
- Unified testing configuration and initial coverage report
- CI pipeline updates

## Rollout
- Execute Phase 1–2 in one PR, then Phase 3–4, finally Phase 5–6.
- Keep changes atomic per phase to simplify review and rollback.