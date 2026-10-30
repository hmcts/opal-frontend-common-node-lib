# Security exceptions

Follow [DEPENDENCY_SECURITY.md](DEPENDENCY_SECURITY.md). This register records status; it does not grant approval. No repository-specific exception authority or policy has been verified. Dependency remediation requests and existing suppression records do not accept risk.

## Approved current exceptions

None verified. No new exceptions have been approved by this remediation. This does not mean the dependency graph is free of findings.

Any approved entry must include the canonical advisory/source; package and every approved version/path; rationale/exposure; verified mitigation; accountable owner; real tracking reference; approver/date/evidence of exact scope; and policy-compliant review or expiry date. Changed paths or versions require renewed scope assessment.

## Incomplete and unresolved entries

### uuid — unverified legacy baseline, unresolved

[GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) affects the installed uuid 8.3.2. Its current dependency path is this library → @hmcts/properties-volume 1.4.1 → @azure/identity 4.13.0 → @azure/msal-node 3.8.6 → uuid 8.3.2.

The raw [baseline](../yarn-known-issues) identifies the advisory and MSAL parent but supplies no approval, accountable owner, ticket, mitigation or review/expiry date. It remains unchanged because the finding remains unresolved; it is not a current authorized exception.

The inspected MSAL consumer uses uuid v4 without an output buffer, while the advisory concerns v3/v5/v6 with buffers. This limits observed reachability, not advisory presence or future consumer exposure. This library also imports MSAL directly in its SSO implementation through that transitive installation. The latest supported MSAL 3.x parent retains uuid 8.x. A newer Identity/MSAL route requires runtime and integration work; a cross-major uuid override is not approved.

Next action: repository maintainers must arrange the properties-volume/Identity/MSAL dependency and runtime decision, track it, and verify SSO and consuming applications. Responsible owner, tracking, approval and expiry are **not assigned or evidenced** here.

### OpenTelemetry Core — unresolved, no exception

[GHSA-8988-4f7v-96qf](https://github.com/advisories/GHSA-8988-4f7v-96qf) remains in Core 1.30.1 under these paths, all prefixed by this library → applicationinsights 2.9.8:

- @opentelemetry/core 1.30.1
- @opentelemetry/sdk-trace-base 1.30.1 → @opentelemetry/core 1.30.1
- @opentelemetry/sdk-trace-base 1.30.1 → @opentelemetry/resources 1.30.1 → @opentelemetry/core 1.30.1

The parent constrains Core to 1.x; patching the separate 2.x paths does not resolve this advisory. Telemetry is enabled through the exported integration, but deployed baggage propagation and transport limits are unverified. No deployment mitigation or exception is asserted. A maintained parent migration requires runtime/API review; forcing Core 2.x beneath 1.x consumers is not supported by the evidence.

Next action: repository maintainers must arrange an Application Insights migration and runtime decision, verify telemetry/proxy behavior in consumers, and track remaining exposure. Responsible owner, tracking, approval and review/expiry are **not assigned or evidenced** here.

## Reassessment

Retain run-specific counts, all paths, compatibility decisions and raw checks with the change's external review evidence. Reassess these entries when upstream releases, runtime support, exposure or the graph changes. Require fresh production and complete audits and full path verification before removing a finding or matching baseline record. If an exception is later requested, obtain the actual policy decision with complete metadata; do not silently approve, renew, broaden or transfer scope.
