# Repository Guidelines

This file is the entrypoint. It stays brief and points to skills for detailed guidance.

## Skills Map
- `skills/opal-frontend-common-node/opal-frontend-common-node-repo-guidelines` for repo structure, build/lint commands, export map rules, and release guidance.
- `skills/opal-frontend-common-node/opal-frontend-common-node-review-guidelines` for code review severity rules and comment format.

## Always-Apply Guardrails
- Do not add secrets, tokens, or PII to code, logs, comments, or tests.
- Keep public exports synchronized: update `package.json` exports, `src/index.ts`, and `tsconfig.json` paths when adding or removing modules.
- Avoid breaking changes to exported APIs without a version bump and release notes.
