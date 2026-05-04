# Changelog

All notable changes to this package should be documented in this file.

The format is based on Keep a Changelog and this project follows semantic versioning.

## [Unreleased]

### Changed
- _Add entries here for each PR that changes public behavior, exports, or consumer configuration._
- Add a reusable `redis` helper module for reading JSON object cache entries from the configured Redis client.
- Add a reusable `user-state` route helper for serving user state from Redis with application-supplied route/cache configuration and user-service fallback.

## Changelog Policy

- Add entries to `## [Unreleased]` for user-visible changes.
- Move entries from `## [Unreleased]` into a versioned section during release.
- Call out breaking changes explicitly with migration notes.
- Mention any `package.json` `exports` changes that affect consumers.
