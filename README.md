# OPAL Frontend Common Node Library

[![npm version](https://img.shields.io/npm/v/@hmcts/opal-frontend-common-node)](https://www.npmjs.com/package/@hmcts/opal-frontend-common-node)
[![License](https://img.shields.io/npm/l/@hmcts/opal-frontend-common-node)](https://github.com/hmcts/opal-frontend-common-node-lib/blob/main/LICENSE)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=hmcts_opal-frontend-common-node-lib&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=hmcts_opal-frontend-common-node-lib)

This is a shared Node.js library containing common middleware, configurations, and utilities used across OPAL backend services.

## Table of Contents

- [Getting Started](#getting-started)
- [Scripts](#scripts)
- [Build Process](#build-process)
- [Release Checklist](#release-checklist)
- [Linting and Formatting](#linting-and-formatting)
- [Exports](#exports)
- [Using This Library in a Node.js Application](#using-this-library-in-a-nodejs-application)
- [Switching Between Local and Published Versions](#switching-between-local-and-published-versions)

## Getting Started

### Prerequisites

Ensure you have the following installed:

- [Node.js](https://nodejs.org/) v18 or later
- [Yarn](https://yarnpkg.com/) v4.x (Berry)
- ESM-compatible consumer setup (`import` syntax). CommonJS `require()` is not supported.

### Install Dependencies

```bash
yarn
```

## Build Process

Run the following to build the project:

```bash
yarn build
```

The compiled output will be available in the `dist/` folder. It includes runtime JavaScript and generated type declarations based on the TypeScript build configuration.

## Switching Between Local and Published Versions

See [opal-frontend](https://github.com/hmcts/opal-frontend) for how this library is consumed in practice.

Use the `yarn import:local:common-node-lib` and `yarn import:published:common-node-lib` scripts in your consuming project (`opal-frontend`) to switch between local development and the published npm version of the library.

To use a published version of this library during development in another project:

1. In the consuming project, run:
   ```bash
   yarn import:published:common-node-lib
   ```

To use a local version of this library during development in another project:

1. Build and pack this library:

   ```bash
   yarn pack:local
   ```

   This will generate a `.tgz` file (e.g. `hmcts-opal-frontend-common-node-X.Y.Z.tgz`) in the repository root.

2. In your consuming project (e.g. `opal-frontend`), ensure you have set an environment variable pointing to this library repository root (not `dist/`):

   ```bash
   # In your shell config file (.zshrc, .bash_profile, or .bashrc)
   export COMMON_NODE_LIB_PATH="[INSERT PATH TO COMMON NODE LIB REPOSITORY ROOT]"
   ```

3. In the consuming project (e.g. `opal-frontend`), run:

   ```bash
   yarn import:local:common-node-lib
   ```

   This will remove the currently installed version and install the locally packed `.tgz` artifact. Installing the tarball (rather than linking the repository folder directly) ensures the consuming project uses the same publish shape as npm, avoiding TypeScript and export-map resolution issues.

4. To switch back to the published version:

   ```bash
   yarn import:published:common-node-lib
   ```

This setup makes it easy to switch between development and production versions of the shared library.

## Publish the library

Once any changes have been approved and merged into the main branch, you'll need to publish a new version of the library so that it can be consumed by other projects. To do this:

1. Increment the version number in both the library's root `package.json`.
2. Commit and push those changes to the main branch.
3. On GitHub, create a new [release](https://github.com/hmcts/opal-frontend-common-node-lib/releases) and use the updated version number as a tag.
4. When the release workflow completes, the library will be published.

After this new version of the library is published, any consuming application should remove the local or outdated version of the library and then install the published version by running:

    ```bash
    yarn import:published:common-node-lib
    ```

## Release Checklist

Before creating a GitHub release tag:

1. Update `package.json` version to the intended release version.
2. Add a `CHANGELOG.md` entry under `## [Unreleased]` describing user-visible changes.
3. Run:

   ```bash
   yarn build
   npm pack --dry-run
   ```

4. Ensure export map changes are intentional and non-breaking (or include release notes/version bump for breaking changes).
5. Create a GitHub release with a tag matching `package.json` version (`vX.Y.Z` or `X.Y.Z`).

## Linting and Formatting

To lint and check formatting:

```bash
yarn lint
```

There is a custom lint rule for member ordering to ensure members in the code are ordered in the following format:

```json
[
  "private-static-field",
  "protected-static-field",
  "public-static-field",
  "private-instance-field",
  "protected-instance-field",
  "public-instance-field",
  "constructor",
  "private-static-method",
  "protected-static-method",
  "public-static-method",
  "private-instance-method",
  "protected-instance-method",
  "public-instance-method"
]
```

To fix formatting issues automatically:

```bash
yarn prettier:fix
```

## Exports

This library exposes multiple entry points under the `exports` field of `package.json`. Example usage:

```ts
import { CSRFToken } from '@hmcts/opal-frontend-common-node/csrf-token';
import { AppInsights } from '@hmcts/opal-frontend-common-node/app-insights';
import { Helmet } from '@hmcts/opal-frontend-common-node/helmet';
import { LaunchDarkly } from '@hmcts/opal-frontend-common-node/launch-darkly';
import {
  ExpiryConfiguration,
  RoutesConfiguration,
  SessionStorageConfiguration,
  TransferServerState,
} from '@hmcts/opal-frontend-common-node/interfaces';
```

Refer to the `exports` block in `package.json` for the full list of available modules.

## Commonly Used Commands

The following commands are available in the `package.json`:

- `yarn build`  
  Cleans the `dist/` folder and compiles TypeScript into the publishable `dist/` output.

- `yarn pack:local`  
  Builds the project (via the `prepack` hook) and creates a local `.tgz` package that mirrors the published npm artifact. Useful for testing changes in a consuming application.

- `yarn clean`  
  Removes the `dist/` directory.

- `yarn lint`  
  Runs ESLint across the `src/` directory and checks formatting using Prettier.

- `yarn prettier`  
  Checks if files are formatted correctly.

- `yarn prettier:fix`  
  Automatically formats the codebase.
