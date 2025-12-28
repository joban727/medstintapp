## Scope & Objectives
- Remove unused files, dead code, and redundant implementations across app, API, components, scripts.
- Standardize formatting, naming, and simplify complex conditionals.
- Preserve removals in an archive and document changes in the changelog.

## Tooling & Standards
- Formatting/lint: use `biome.json`, `npm run lint`, `npm run format`.
- Types: `npm run check-types` (`tsc --noEmit`).
- Tests: `vitest` (`npm run test:run`), Playwright (if configured), skip performance (`artillery`) unless requested.
- Build: `npm run build`.
- Proposed analysis additions (dev-only): `knip` (unused files/exports), `ts-prune` (unused exports), `depcheck` (unused dependencies). Will add only with approval.

## Static Code Analysis
- Run baseline checks:
  - `npm run check-types`
  - `npm run lint`
- Detect unused exports/files:
  - Use `knip` to scan `src/**` and `api/**` for unused files/exports.
  - Use `ts-prune` to corroborate unused TypeScript exports.
- Identify dead/unreachable code:
  - Enable Biome/ESLint rules for `no-unreachable`, `no-unused-vars`, `no-constant-condition` using existing config (`eslint.config.js`) without changing standards.
  - Grep patterns like `if (false)`, `return;` followed by code, unreachable branches.
- Duplicate implementations:
  - Search for repeated helpers in `src/lib`, `src/components/**/utils`, and `scripts/`. Use AST-aware checks (`biome lint --highlight`) and string similarity to detect duplicates.
- Unused imports:
  - Rely on Biome lint and TypeScript. Auto-fix with `npm run lint:fix` after approval.

## File System Cleanup
- Assets (`public/*`): cross-reference image/font filenames via project-wide search; keep only referenced assets. Example: verify usages of `logo*.svg`, `favicon*.svg`, `logo.png` and remove unused variants.
- Deprecated configs: evaluate `jest.config.js` (vitest is primary) and remove if unused; confirm no `jest` scripts are invoked.
- Temporary/cache files: remove committed artifacts like `build-output.txt`; ensure `.next/` and cache dirs are git-ignored only.
- Obsolete documentation: review top-level `*_REPORT.md`, `*_DOCUMENTATION.md`; keep canonical docs, archive redundant/outdated ones.
- Legacy API folders: audit top-level `api/` (parallel to `src/app/api/**`) for unused endpoints; remove if not referenced.

## Code Quality Improvements
- Standardize formatting with Biome:
  - `npm run format:fix` after changes.
- Consistent naming conventions:
  - Apply TypeScript/React conventions (PascalCase components, camelCase vars, clear file names). Rename where inconsistencies are found.
- Remove commented-out blocks:
  - Search for long comment blocks containing code; delete where superseded.
- Simplify complex conditionals:
  - Target high-churn areas (time records, dashboard, clock APIs). Extract helpers, early-returns, and guard clauses.

## Backup & Documentation
- Backup removed files to `cleanup-archive/<timestamp>.zip` with original paths preserved.
- Update root `CHANGELOG.md` (create if missing) with sections:
  - Summary of removals
  - Key refactors and simplifications
  - Tooling/standard changes (if any)
  - Verification outcomes (tests/build/bundle size)

## Verification
- Run tests: `npm run test:run` and component/integration subsets (`npm run test:components`, `npm run test:integration`).
- Build: `npm run build` and capture output.
- Dev runtime: `npm run dev` and smoke-check key pages (`/dashboard/student`, `/dashboard/student/time-records`).
- Bundle size:
  - Compare `.next` build artifacts before/after; record total size and major chunk sizes.

## Deliverables
- Archive file with all removals.
- Updated `CHANGELOG.md` documenting cleanup.
- A short report summarizing:
  - Files removed, refactors, and rationale
  - Lint/type check results
  - Test/build outcomes
  - Bundle size delta

## Execution Plan
1. Baseline snapshot: collect lint, type-check, build size metrics.
2. Static analysis pass (knip/ts-prune/depcheck, Biome/ESLint) to produce a candidate removal list.
3. Asset usage audit and mark unused files.
4. Incremental removals with backups; run `format:fix`.
5. Simplifications in critical modules; re-run checks.
6. Full verification suite.
7. Prepare archive and changelog; handoff for review.

## Approval Needed
- Permission to add dev-only analysis tools (`knip`, `ts-prune`, `depcheck`).
- Agreement to remove unused `jest.config.js` and other deprecated files discovered.
- Confirmation to archive docs considered obsolete.