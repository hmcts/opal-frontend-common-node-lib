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
- `src/*.d.ts` and `src/global.d.ts` provide ambient typings and are copied to `dist/`.
- `dist/` is build output and should be generated via `yarn build` (do not hand-edit).

## Build, Lint, and Audit Commands
- `yarn build` runs `clean`, compiles TypeScript, and copies `package.json`, root `.d.ts` files, and `README.md` to `dist/`.
- `yarn clean` removes `dist/`.
- `yarn lint` runs ESLint over `src/` and Prettier checks.
- `yarn prettier` checks formatting; `yarn prettier:fix` formats in place.
- `yarn audit:save` updates `yarn-known-issues`; `yarn audit:check` compares against current advisories (requires `jq`).

## Export Map and Public API
- This package is ESM (`"type": "module"`). Keep imports/exports in ESM style.
- `package.json` `exports` is the source of truth for published entry points.
- When adding or removing a public module, update all of:
  - `package.json` `exports`
  - `src/index.ts` (top-level re-exports)
  - `tsconfig.json` `paths` (local TS resolution)
  - `src/<module>/index.ts` (module-local exports)
  - any required ambient `.d.ts` in `src/` so it is copied to `dist/`

## Coding Style
- Follow `.editorconfig` and `.prettierrc`: 2-space indent, single quotes in TS, 120 print width, semicolons.
- Keep class members ordered per `@typescript-eslint/member-ordering` in `eslint.config.js`.
- Prefer small, focused modules; avoid unnecessary side effects at import time.

## Tooling and Environment
- Node.js v18+ and Yarn classic v1.22.22 (per `package.json` and `README.md`).
- `tsconfig.json` uses strict mode; avoid `any` and keep types explicit.

## Publishing
- Bump the version in `package.json`, create a GitHub release with that tag, and wait for the release workflow to publish (see `README.md`).
- `dist/` is generated during `yarn build` and is not committed.
