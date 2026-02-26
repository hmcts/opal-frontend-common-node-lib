---
name: opal-frontend-common-node-repo-guidelines
description: Repository structure, build/lint commands, export map rules, and release guidance for opal-frontend-common-node-lib. Use when navigating the repo, adding modules, or running tooling.
---

# Opal Frontend Common Node Library Guidelines

## Overview
Use these rules to keep work aligned with the library structure, build tooling, and public API.

## Project Structure
- `src/` contains TypeScript source organized by feature folders (`app-insights/`, `csrf-token/`, `health/`, `helmet/`, `session/`, etc.).
- `src/interfaces/` holds shared types; `src/index.ts` re-exports public modules.
- `src/*.d.ts` (for example `src/global.d.ts` and `src/session.d.ts`) provide ambient typings and are copied to `dist/` by the build.
- `dist/` is build output and should be generated via `yarn build` (do not hand-edit).

## Build, Lint, and Audit Commands
- `yarn build` runs `clean`, compiles TypeScript, and copies root ambient `.d.ts` files to `dist/`.
- `yarn pack:local` runs `prepack` (`yarn build`) and creates a fresh local `.tgz` artifact in repo root for consumer testing.
- `yarn check:exports` validates every `package.json` export target exists in `dist/`.
- `yarn check:exports:esm` smoke-tests ESM import of all public subpaths.
- `yarn check:pack-shape` validates packed tarball contents against `exports`, `types`, and `typesVersions`.
- `npm pack --dry-run` shows exact publish payload; run it whenever package surface changes.
- `yarn clean` removes `dist/`.
- `yarn lint` runs ESLint over `src/` and Prettier checks.
- `yarn prettier` checks formatting; `yarn prettier:fix` formats in place.
- `yarn audit:save` updates `yarn-known-issues`; `yarn audit:check` compares against current advisories (requires `jq`).

## Export Map and Public API
- This package is ESM (`"type": "module"`). Keep imports/exports in ESM style.
- `package.json` `exports` is the source of truth for published entry points.
- Keep subpath exports explicit and intentional; do not rely on unpublished deep imports into `dist/`.
- Every exported subpath should have both runtime (`.js`) and declaration (`.d.ts`) targets that exist after build and are included in the packed tarball.
- When adding or removing a public module, update all of:
  - `package.json` `exports`
  - `src/index.ts` (top-level re-exports)
  - `tsconfig.json` `paths` (local TS resolution)
  - `src/<module>/index.ts` (module-local exports)
  - `typesVersions` (if needed for legacy TS resolver compatibility)
  - any required ambient `.d.ts` in `src/` so it is copied to `dist/`

## Packaging Gate (Required for Package-Surface Changes)
- Apply this gate when changing `exports`, `types`, `typesVersions`, `files`, build output layout, or publish scripts.
- Run: `yarn build`.
- Run: `yarn check:exports`.
- Run: `yarn check:exports:esm`.
- Run: `yarn check:pack-shape`.
- Run: `npm pack --dry-run`.
- Treat any failure as blocking until resolved.

## Coding Style
- Follow `.editorconfig` and `.prettierrc`: 2-space indent, single quotes in TS, 120 print width, semicolons.
- Keep class members ordered per `@typescript-eslint/member-ordering` in `eslint.config.js`.
- Prefer small, focused modules; avoid unnecessary side effects at import time.

## Tooling and Environment
- Node.js v18+ and Yarn v4.x (Berry) (per `package.json` and `README.md`).
- `tsconfig.json` uses strict mode; avoid `any` and keep types explicit.

## Publishing
- Bump the version in `package.json`, create a GitHub release with that tag, and wait for the release workflow to publish (see `README.md`).
- `dist/` is generated during `yarn build` and is not committed.
- Publish from the repository root `package.json` (single source of truth).
- Do not generate or copy a second `package.json` into `dist/`.
- For local consumer testing, install from the generated `.tgz` (`yarn pack:local`) rather than linking the raw repository folder.
