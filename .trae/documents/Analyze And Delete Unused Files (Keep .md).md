## Scope & Rules
- Analyze entire repository to find unused code and assets.
- Delete all unused files except files with the `.md` extension.
- Preserve configuration files, tests, database migrations, and anything used by build/dev tooling.

## Method
- Identify Next.js entry points: `src/app/**/page.tsx`, `src/app/layout.tsx`, `src/app/**/route.ts`, `src/app/providers.tsx`.
- Build a reference map by searching imports/uses across `src/**` and `package.json` scripts.
- Classify files as reachable (used), tool-required (configs), or orphaned (unused).
- Prepare a deletion list and keep a temporary backup before removal.

## Delete Candidates
- Generated/build:
  - `.next/**`
  - (Optional) `cleanup-archive/**` if you don’t need archived outputs
- Unused app file:
  - `src/app/auth/[pathname]/auth-client.tsx`
- Unused components:
  - `src/components/debug/onboarding-test.tsx`
  - `src/components/icons/discord-icon.tsx`
  - `src/components/icons/github-icon.tsx`
  - `src/components/icons/linkedin-icon.tsx`
  - `src/components/icons/x-icon.tsx`
  - `src/components/layout/Header.tsx`
  - `src/components/layout/Sidebar.tsx`
  - `src/components/layout/DashboardLayout.tsx`
  - `src/components/tutorial/tutorial-manager.tsx`
  - `src/components/tutorial/tutorial-overlay.tsx`
  - `src/components/ui/lazy-wrapper.tsx`
- Unused scripts (not referenced by `package.json`):
  - `scripts/seed-rotation-and-assignment.js`
  - `scripts/list-students-and-sites.js`
  - `scripts/check-neon-clock-data.js`
  - `scripts/fix-school-id-issues.ts`
- Unused root JS/TS utilities:
  - `diagnose-sutter-woodlake.js`
  - `link-facility-to-clinical-site.js`
  - `fix-css-patterns.js`
  - `fix-form-validation.js`
  - `fix-accessibility.js`
  - `fix-performance-patterns.js`
  - `fix-api-integration.js`
  - `fix-error-handling.js`
  - `fix-security-vulnerabilities.js`
  - `fix-role-validation.js`
  - `fix-typescript-issues.js`
  - `fix-frontend-database-imports.js`
  - `fix-enum-handling.js`
  - `fix-database-imports.js`
  - `check-existing-data.js`
  - `debug-accuracy.js`
  - `debug-validation.js`
  - `debug-school-admin.js`
  - `fix-school-admin-onboarding.js`

## Exclusions (intentionally kept)
- All `.md` documents.
- Configs and tool-required files: `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `eslint.config.js`, `drizzle.config.ts`, `tsconfig.json`, `artillery.config.yml`, `biome.json`, etc.
- Test suites in `src/__tests__/**` and testing setup.
- Database migrations in `drizzle/**`.
- Scripts referenced by `package.json`, e.g., `scripts/verify-fixes.ts`.
- Public assets under `public/**`.

## Safety Checks
- Double-check each candidate via whole-repo search to confirm no imports/usages.
- Keep a backup of deleted files under `cleanup-archive/<timestamp>/`.
- Do not remove any file if there is uncertainty (move to backup instead).

## Verification
- Run `npm run build` to confirm the app builds after cleanup.
- Run `npm run test` to ensure tests still pass.
- Smoke-run `npm run dev` and load key routes: `/`, `/dashboard`, `/onboarding`, and critical API routes.

## Deliverables
- Removed files list committed as changes (no `.md` removed).
- Backup archive path with timestamp.
- Post-cleanup verification report: build and test results and any follow-up adjustments needed.

Would you like me to proceed with this cleanup now?