# Dependency security

Use this process for supported dependency remediation and review evidence. Follow [AGENTS.md](../AGENTS.md) and the [repository guidelines](../skills/opal-frontend-common-node/opal-frontend-common-node-repo-guidelines/SKILL.md). This guide grants no risk acceptance; a documented security approval policy and decision owner have not been identified in this repository.

## Sources of truth and publication boundary

- [package.json](../package.json) declares Yarn 4.18.1, Node >=18, scripts, dependencies and public exports. [README.md](../README.md) describes the build and consumer workflow.
- [yarn.lock](../yarn.lock) defines this checkout's resolved graph; [.yarnrc.yml](../.yarnrc.yml) uses the node-modules linker. Discover workspaces, effective registry, audit filters and release-age controls each run without printing authentication configuration.
- [yarn-known-issues](../yarn-known-issues) is a raw production audit baseline, not evidence of an approved exception.
- [CI](../.github/workflows/npm_build.yml) and [Renovate](../.github/renovate.json) describe automation. Check actual runtime settings rather than job names: the Node 18 compatibility job currently selects Node 26. The packageManager pin takes precedence over the workflow's prepared Yarn fallback. Minimum-runtime verification is a separate gap.

This is a shared ESM Node/Express library, built with TypeScript. The root manifest governs publication of `dist`, README and LICENSE. It has one workspace and no repository Docker or SSR application build. A library lockfile refresh does not transfer to consumer lockfiles; inspect the actual tarball and verify consuming applications separately.

## Investigation and supported fixes

Capture these unfiltered scopes separately, outside application source:

```sh
corepack yarn workspaces list --json
corepack yarn npm audit --recursive --environment production --json
corepack yarn npm audit --recursive --json
```

If workspaces are added, select all with `--all` in both audits. Retain the exact invocation, tool versions, timestamp, revision/dirty state, stdout, stderr and exit status. Record effective `npmAuditExcludePackages`, `npmAuditIgnoreAdvisories` and `npmMinimalAgeGate`. Never interpret malformed, missing, incomplete, unexpected or uncorroborated empty output as clean. Corroborate empty JSON using the same scope without `--json` and require explicit successful completion.

Yarn 4.18.1 emits tree records with `value` and `children` fields. Separate security advisory URLs from deprecation IDs, even when both have moderate severity. Count distinct canonical GHSA IDs in the complete graph as the primary metric; report production separately without adding the totals. An advisory remains unresolved while any affected version/path remains. Exceptions, changed filters and deprecations are not fixes.

The existing `audit:check` script expects the older `auditAdvisory/data.advisory.id` schema and masks scanner status using `|| true`. It can pass both real findings and scanner failure with empty parsed sets. Treat its success as inconclusive and retain raw audits. Enforcement repair is separate work: require tests for findings, deprecations, clean completion, empty/malformed/incomplete reports and execution failure, plus an explicit decision about complete-graph coverage. Do not regenerate the baseline to obtain a pass.

For each advisory, correlate authoritative affected/patched ranges with recursive `corepack yarn why <package> -R --json`, all lockfile routes, installed parent manifests and actual source usage. Shared subtrees may be collapsed by `why`; account for every distinct parent route. Inspect package engines, peers and module/API compatibility as well as runtime, test/build and packed exposure. Authentication and telemetry may be exposed through library consumers even without a standalone server here.

Prefer a compatible maintained direct/parent upgrade. Where existing ranges permit the patch, use a targeted `corepack yarn up -R <package>` refresh and review every changed descriptor. Respect release-age controls. Cross-major overrides require compatibility evidence for every consumer, verified ownership, tracking and a removal condition; fewer audit findings alone do not justify them. Do not silently raise the public runtime floor. Inspect existing bot diffs and their actual bases/checks to coordinate related updates.

## Exceptions and suppressions

Use [SECURITY_EXCEPTIONS.md](SECURITY_EXCEPTIONS.md). Suppression records without specific approval and required metadata remain unresolved. Never create or broaden an exception, assign an owner or invent a ticket/expiry from a dependency-fix request. Remove baseline entries only after their finding is verified resolved across every scoped path. Keep unchanged unresolved records visible without treating them as accepted risk.

## Verification and human review

Run checks from the isolated review checkout with the declared Yarn pin and record the actual Node runtime:

```sh
corepack yarn install --immutable
corepack yarn npm audit --recursive --environment production --json
corepack yarn npm audit --recursive --json
corepack yarn test
corepack yarn lint
corepack yarn check:exports
corepack yarn check:exports:esm
corepack yarn check:pack-shape
corepack yarn pack:local
```

`test` builds first and exercises proxy/telemetry behavior. Run build, tests and packing sequentially because they share `dist`. Inspect warnings and diagnostics as well as statuses. Package-surface changes also require `npm pack --dry-run` under the repository guidance. `pack:local` runs a local npm pack through its prepack build; it does not publish.

Refresh all affected paths and inspect the tarball. Exercise relevant query/form parsing, authentication, proxy/session/cookie and telemetry behavior using established local test configuration. Record unavailable live services and minimum-runtime/consumer coverage rather than implying success. A newer local runtime does not prove Node 18 compatibility. Local checks do not establish CI, image contents or deployed behavior.

Keep dated findings, comparable counts, command logs, compatibility decisions, source hashes and draft PR text in a retained review pack. Require human diff and evidence review before integration. Docker packaging, CI/bot settings, publishing and deployment need their own scope and authorization. Reassess remaining findings when advisory data, parent releases, dependency paths or exposure change.
