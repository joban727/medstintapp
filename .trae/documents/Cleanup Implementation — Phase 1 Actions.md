## Goals (Phase 1)
- Archive unused assets and deprecated configs with a dated backup.
- Run format/lint/type checks and capture baselines.
- Make zero-risk manifest update.

## Actions
1. Assets audit
- Verify usage of `public/*` images; archive unused: `logo-medstint-dark.svg`, `logo-medstint-v2.svg`, `logo.png`, and already unused `logo.svg` (found no references).
- Preserve originals under `cleanup-archive/<date>/public/`.

2. Deprecated configs
- Archive `jest.config.js` under `cleanup-archive/<date>/`.

3. Temp/cache files
- Archive `build-output.txt`, `lint-summary.txt`, `lint-summary-targeted.txt` to `cleanup-archive/<date>/`.

4. Quality & consistency
- Run `npm run format:fix`, `npm run lint`, `npm run check-types` to establish baselines and auto-fix trivial issues.
- Apply minimal manifest icon sizing fix to `src/app/manifest.ts`.

## Verification
- Run `npm run build` and `npm run test:run`; record outcomes.
- Confirm no new errors due to cleanup.

## Deliverables
- `cleanup-archive/<date>/` with backups.
- Updated `CHANGELOG.md` summarizing actions.
- Reported build/test status and next-step recommendations.

## Note
- Larger refactors (dead code removal, duplicate logic consolidation, and conditional simplification) will be planned for Phase 2 after Phase 1 completes cleanly.