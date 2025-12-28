Changelog

2025-11-15 Cleanup — Phase 1
- Archived deprecated configuration: `jest.config.js` → `cleanup-archive/2025-11-15/`
- Archived unused assets: `public/logo.svg` and logo variants `logo-medstint-dark.svg`, `logo-medstint-v2.svg`, `logo.png` → `cleanup-archive/2025-11-15/public/`
- Archived temp files: `build-output.txt`, `lint-summary.txt`, `lint-summary-targeted.txt` → `cleanup-archive/2025-11-15/`
- Minor manifest consistency: updated `src/app/manifest.ts` icon `sizes` for SVG

Verification
- Ran format, lint, and type checks; existing diagnostics remain, no new errors introduced by cleanup
- Build failed due to pre-existing module resolution in `src/lib/db-optimization.ts` → `./schema`
- Tests executed; existing integration/unit failures unchanged