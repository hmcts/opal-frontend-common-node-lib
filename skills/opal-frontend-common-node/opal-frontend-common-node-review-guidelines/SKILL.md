---
name: opal-frontend-common-node-review-guidelines
description: Automated review rules for opal-frontend-common-node-lib PRs. Use when asked to review code, run @codex review, or provide PR feedback; apply severity levels and the required comment format.
---

# Opal Frontend Common Node Review Guidelines

## Overview
Apply these rules when reviewing changes in this Node.js library; focus on P0/P1 blockers and use the required comment format.

## Scope and Process

- Apply rules to changes in the PR only.
- Prefer specific, line-anchored feedback with rationale and concrete fixes.
- Treat P0 and P1 as blocking; treat P2 as advisory.

## Repo Scope

- This is an ESM TypeScript library built with `tsc` and published via `package.json` exports.
- Consumers are Node/Express services in the OPAL ecosystem.

## P0 Rules (Blockers)

### Security and Safety

- Avoid credentials, tokens, secrets, or PII in code, logs, comments, or tests.
- Avoid disabling security middleware defaults (Helmet/CSRF/session) without explicit justification and tests.
- Do not introduce insecure defaults (e.g., weak cookie/session settings, relaxed CORS, disabling CSRF) without clear opt-in.
- Do not log sensitive request/session data.

### Build and API Integrity

- Do not break the published API surface without a version bump and release notes.
- Keep `package.json` exports, `src/index.ts`, and `tsconfig.json` paths in sync for any public module change.
- Avoid TypeScript errors, failing lint/prettier, or build regressions.

## P1 Rules (High Priority)

### Node/Express Correctness

- Ensure middleware is ordered correctly (e.g., body parser before routes, CSRF after session).
- Avoid mutating shared state across requests; keep per-request state in `req`/`res`.
- Use async error handling (pass to `next`) and avoid unhandled promise rejections.

### TypeScript Quality

- Prefer explicit types for exported APIs; avoid `any` in public interfaces.
- Keep functions small and single-purpose; extract helpers for readability.
- Use consistent error shapes and typed config interfaces.

### Dependency and Performance Risk

- Avoid introducing heavy dependencies unless justified; note impact in review.
- Prefer streaming for large payloads; avoid loading large buffers in memory without need.

### Testing

- Add or update tests for new logic and error paths when feasible.
- Ensure changes are reflected in README usage if public APIs change.

## P2 Rules (Advisory)

- Keep exported modules focused; avoid side effects at import time.
- Prefer clear naming over abbreviations; keep folder structure consistent with `src/` layout.
- Keep `.d.ts` files minimal and aligned to actual runtime behavior.

## Comment Format

Use this exact shape:

```
[Severity]: <Rule name>
Problem: <what is wrong in one sentence>
Why: <risk/impact>
Fix: <specific change>
Example: <code snippet or link to guideline>
```
