## Goals
- Remove unreferenced source files, unused assets, orphaned tests, temporary/backups, and unused dependencies.
- Keep functionality unchanged and verify build, tests, and runtime behavior.
- Produce a removal report, updated dependency manifest, and verification results.

## Current Project Snapshot
- Framework: Next.js App Router (TypeScript). Key refs: `src/app/manifest.ts:19` (uses `/favicon-v2.svg`), `src/app/layout.tsx:26` (uses `/favicon.svg`), `src/config/site.ts:9` (uses `/logo-medstint.svg`).
- DB: Drizzle + Neon (`src/database/connection-pool.ts:7`), also `postgres` client in `src/lib/db-optimization.ts:2`.
- Auth: Clerk, webhooks via Svix (`src/app/api/webhooks/clerk/route.ts:4`).
- State/UI: Tailwind v4, Radix, Lucide, Sonner, Embla, UploadThing.

## Preliminary Findings (candidates for removal/update)
- Unused assets
  - `public/logo-medstint-dark.svg` (no references)
  - `public/logo-medstint-v2.svg` (no references)
  - `public/logo.svg` (no references)
  - `public/logo.png` (no references)
  - Note: Keep `public/favicon.svg`, `public/favicon-v2.svg`, and `src/app/favicon.ico` (in use).
- Duplicate/unused code
  - Duplicate hook: keep `src/hooks/use-time-sync.ts` (referenced at `src/components/admin/time-sync-dashboard.tsx:25`), remove `src/hooks/useTimeSync.ts` (no project references).
  - Duplicate component: likely keep `src/components/onboarding-analytics-dashboard.tsx` (imported at `src/app/dashboard/admin/onboarding-analytics/page.tsx:2`), remove `src/components/analytics/onboarding-analytics-dashboard.tsx` (no references).
  - Legacy Express route: `src/api/routes/student/clock.ts:6` (Express types) is not wired to Next.js app routes; used only by an Express test harness.
  - Entire legacy `api/` folder at repo root appears unused (Next.js routes live under `src/app/api/**`).
- Config duplication
  - Prefer `next.config.ts` and remove `next.config.js` (TS config is comprehensive and modern).
- Temporary/backup artifacts
  - `test-results/**` (bundled test artifacts, HTML, assets) – remove.
  - `build-output.txt`, `lint-summary.txt`, `lint-summary-targeted.txt` – remove.
- Dependencies cleanup (initial static scan)
  - Unused: `@emotion/is-prop-valid` (no occurrences).
  - `express`: only used by the legacy Express tests (`src/tests/api-endpoints.test.ts:8`) and legacy handler. If we remove those, drop `express` entirely; otherwise move to `devDependencies`.
  - Keep: `svix`, `stripe`, `resend`, `ioredis`, `embla-carousel-react`, `nextjs-toploader`, `postgres`, `pg`, `drizzle-orm`, Radix/Lucide, UploadThing – confirmed in codebase.

## Methodology
- Inventory
  - Export a full file inventory with sizes and types; capture to `cleanup-inventory.json`.
- Static usage analysis
  - Run `knip` for unused files/exports and dep usage.
  - Run `depcheck` to confirm unused/invalid dependencies.
  - Optional: `ts-prune` to flag dead exports in TS.
- Asset reference check
  - Cross-reference `public/**` against code (`import`/URL usages, manifest, layout, config).
- Orphan test detection
  - Identify tests that target non-runtime code (e.g., Express-only harness). Remove alongside their targets to keep app-consistent test suite.
- Version control sanity
  - If `.git` present, check recent changes for any candidates to avoid removing recently reintroduced files.

## Implementation Steps
1) Baseline and backup
- `npm ci` to lock environment; record current build/test status.
- Zip `c:\Users\Administrator\Desktop\MedStintClerk1 - Backup` to `MedStintClerk1-cleanup-backup.zip`.

2) Generate inventory & analysis
- Produce `cleanup-inventory.json` (tree, sizes, types).
- Run `npx knip --report` and `npx depcheck` and save outputs to `cleanup-analysis/*.txt`.

3) Apply file cleanup (batch)
- Remove unused assets:
  - `public/logo-medstint-dark.svg`
  - `public/logo-medstint-v2.svg`
  - `public/logo.svg`
  - `public/logo.png`
- Remove duplicates/legacy:
  - `src/hooks/useTimeSync.ts`
  - `src/components/analytics/onboarding-analytics-dashboard.tsx`
  - `src/api/routes/student/clock.ts`
  - Root `api/**`
- Remove temp/backup artifacts:
  - `test-results/**`
  - `build-output.txt`, `lint-summary.txt`, `lint-summary-targeted.txt`
- Config consolidation:
  - Delete `next.config.js`; keep `next.config.ts`.

4) Dependency cleanup
- If Express legacy removed: `npm uninstall express`.
- `npm uninstall @emotion/is-prop-valid`.
- Consider moving any test-only libs to `devDependencies` (e.g., if Express retained for tests).

5) Verification
- Typecheck: `npm run check-types`.
- Lint/format: `npm run check`.
- Build: `npm run build`.
- Unit/integration tests: `npm run test:run`.
- Performance smoke: `npm run test:performance:dev` (optional, brief run).
- Spot-check key routes (e.g., clock, dashboard, webhooks) for 200s in local preview.

6) Reporting
- Generate `cleanup-report.md` with:
  - Files removed (paths, reason, size reclaimed).
  - Dependencies removed/relocated.
  - Tools’ findings (`knip`, `depcheck`) summaries.
  - Build/Test verification summary and counts.

## Quality Assurance
- Backup prior to deletion.
- Build and tests must pass after cleanup.
- Confirm runtime-critical refs:
  - Favicons: `src/app/manifest.ts:19`, `src/app/layout.tsx:26`.
  - Logo: `src/config/site.ts:9`.
  - Time sync: `src/components/admin/time-sync-dashboard.tsx:25` uses `use-time-sync` (keep).
  - Clerk webhook: `src/app/api/webhooks/clerk/route.ts:4` (keep `svix`).

## Deliverables
- Cleaned project directory.
- `cleanup-report.md` (removed files and deps, rationale, reclaimed size).
- Updated `package.json` / lockfile.
- Verification outputs: build log, test summary, analysis logs.

## Notes/Risks
- Removing Express-only test harness will drop those tests; Next.js API tests remain. If you’d prefer to retain Express tests, we’ll keep `express` as a devDependency and only relocate/remove the legacy route file.
- If `.git` isn’t present, “recent activity” confirmation is limited to timestamps; we’ll proceed conservatively.

Would you like me to execute this plan now?