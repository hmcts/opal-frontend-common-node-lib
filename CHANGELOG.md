# Changelog

All notable changes to this package should be documented in this file.

The format is based on Keep a Changelog and this project follows semantic versioning.

## [Unreleased]

### Changed
- _Add entries here for each PR that changes public behavior, exports, or consumer configuration._
- Add a configurable `user-state` route module for returning cached user state from the logged-in session.
- BREAKING: `Routes.enableFor` consumers must provide `userStateConfiguration` when enabling common routes.
- Add a reusable `redis` service for reading JSON object cache entries from the configured Redis client.

## Changelog Policy

- Add entries to `## [Unreleased]` for user-visible changes.
- Move entries from `## [Unreleased]` into a versioned section during release.
- Call out breaking changes explicitly with migration notes.
- Mention any `package.json` `exports` changes that affect consumers.
