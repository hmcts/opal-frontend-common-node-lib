# Changelog

All notable changes to this package should be documented in this file.

The format is based on Keep a Changelog and this project follows semantic versioning.

## [Unreleased]

### Changed
- _Add entries here for each PR that changes public behavior, exports, or consumer configuration._
- Add a configurable `user-state` route module for returning cached user state from the logged-in session.
- BREAKING: `Routes.enableFor` consumers must provide `userStateConfiguration` when enabling common routes.
- Add a reusable `redis` service for reading JSON object cache entries from the shared session Redis client at
  `app.locals.redisClient`.
- Export Redis cache error classes from the services module.
- Export `REDIS_CLIENT_APP_LOCAL_KEY` from the constants module and use it for session storage, health checks, and Redis
  cache reads.
- Treat Redis setup, read, and invalid-payload failures as user-state cache failures rather than cache misses.
- Remove `redisClientKey` from `UserStateConfiguration`; user-state now always uses the shared session Redis
  client.
- Remove the obsolete generic `opalApiUrl` proxy configuration from `ProxyConfiguration` and default proxy
  config.
- Use the configured Redis-backed user-state route cache during SSO user checks to avoid refreshing Redis on repeat
  sign-ins when cached state already exists.

## Changelog Policy

- Add entries to `## [Unreleased]` for user-visible changes.
- Move entries from `## [Unreleased]` into a versioned section during release.
- Call out breaking changes explicitly with migration notes.
- Mention any `package.json` `exports` changes that affect consumers.
