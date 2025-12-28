## Objectives

- Cut local workspace size significantly (>50%) and still be able to build and preview the app.
- Avoid breaking developer workflows; keep dev mode available when needed.

## Diagnosis

- Heavy folders present locally: `.next/cache`, `.next/trace`, and dev caches; `node_modules` footprint; archive folders (`cleanup-archive/*`); misc docs under `.trae/documents/*`.
- `.gitignore` already excludes `node_modules`, `.turbo`, `build`, but does not exclude `.next`.

## Strategy

1. Ignore and clean local build caches
- Add `.next/` to ignore list so the repo doesn’t carry build outputs.
- Add a `clean` script to remove: `.next/*`, `.turbo/*`, `coverage/*`, `dist/*`, `*.log`, `cleanup-archive/*`.
- Use the clean script in CI and locally before zipping or backing up.

2. Switch to pnpm for a smaller project folder
- Use `corepack enable` and `pnpm import` to convert the lockfile.
- `pnpm` symlinks dependencies and stores them in a global content-addressable store, shrinking the project folder footprint while keeping builds intact.

3. Add a “production preview” flow to avoid dev dependencies locally
- Scripts:
  - `preview:install`: install prod-only deps (`--prod` or `--omit=dev`).
  - `preview:build`: `next build` with `typescript.ignoreBuildErrors: true` (temporary) to skip requiring `typescript` dev dep.
  - `preview:start`: `next start`.
- This allows previewing the built app with a smaller `node_modules`.

4. Slim assets
- Convert heavy images to WebP/AVIF; set `images.formats` in `next.config.ts`.
- Remove unused assets and move large binaries (videos, PDFs) to a CDN or object storage; reference via URLs.

5. Git history housekeeping (if applicable)
- If this is a git repo with >1GB history, purge large binaries from history using `git filter-repo` and then `git gc --aggressive`.
- Keep large artifacts out of the repo via `.gitignore` or Git LFS (for collaboration, not for local size).

6. CI/build artifacts
- Build on CI and publish a minimal artifact (e.g., `.next` output) without caching folders; do not commit build outputs.
- Locally, run the preview scripts after a clean to keep footprint small.

## Implementation Steps

1. Update `.gitignore` to include `.next/`.
2. Add `clean` and `preview:*` scripts to `package.json`.
3. Migrate to `pnpm` and update CI workflow (minimal changes).
4. Add image format config and run a one-time asset compression pass.
5. Optional: perform git history cleanup if a git repo is used.

## Verification

- Measure folder size before/after clean and after pnpm migration.
- Run `preview:install`, `preview:build`, and `preview:start` to verify that the app can be built and previewed with a reduced footprint.

## Expected Outcome

- Project folder footprint reduction by 70–90% (depending on node_modules and caches), while still able to build and preview reliably.
