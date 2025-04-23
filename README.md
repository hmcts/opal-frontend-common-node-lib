# OPAL Frontend Common Node Library
[![npm version](https://img.shields.io/npm/v/@hmcts/opal-frontend-common-node)](https://www.npmjs.com/package/@hmcts/opal-frontend-common-node)
[![License](https://img.shields.io/npm/l/@hmcts/opal-frontend-common-node)](https://github.com/hmcts/opal-frontend-common-node-lib/blob/main/LICENSE)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=hmcts_opal-frontend-common-node-lib&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=hmcts_opal-frontend-common-node-lib)

This is a shared Node.js library containing common middleware, configurations, and utilities used across OPAL backend services.

## Table of Contents

- [Getting Started](#getting-started)
- [Scripts](#scripts)
- [Build Process](#build-process)
- [Linting and Formatting](#linting-and-formatting)
- [Exports](#exports)
- [Using This Library in a Node.js Application](#using-this-library-in-a-nodejs-application)
- [Switching Between Local and Published Versions](#switching-between-local-and-published-versions)

## Getting Started

### Prerequisites

Ensure you have the following installed:

- [Node.js](https://nodejs.org/) v18 or later
- [Yarn](https://classic.yarnpkg.com/) v1.22.22 or later

### Install Dependencies

```bash
yarn
```

## Build Process

Run the following to build the project:

```bash
yarn build
```

The compiled output will be available in the `dist/` folder. It includes `index.js`, type declarations, and any exported modules listed in the `exports` field.

## Switching Between Local and Published Versions

See [opal-frontend](https://github.com/hmcts/opal-frontend) for how this library is consumed in practice.

Use the `yarn import:local:common-node-lib` and `yarn import:published:common-node-lib` scripts in your consuming project (`opal-frontend`) to switch between local development and the published npm version of the library.

To use a published version of this library during development in another project:
1. In the consuming project, run:
    ```bash
    yarn import:published:common-node-lib
    ```

To use a local version of this library during development in another project:

1. Build this library:
    ```bash
    yarn build
    ```

2. In your consuming project (e.g. `opal-frontend`), ensure you have set an environment variable pointing to the local build:

    ```bash
    # In your shell config file (.zshrc, .bash_profile, or .bashrc)
    export COMMON_NODE_LIB_PATH="[INSERT PATH TO COMMON NODE LIB DIST FOLDER]"
    ```

3. In the consuming project (e.g. `opal-frontend`), run:
    ```bash
    yarn import:local:common-node-lib
    ```

    This will remove the published version and install the local build using the path provided.

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

## Linting and Formatting

To lint and check formatting:

```bash
yarn lint
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
  Cleans the `dist/` folder, compiles TypeScript, and copies relevant files to `dist/`.

- `yarn clean`  
  Removes the `dist/` directory.

- `yarn lint`  
  Runs ESLint across the `src/` directory and checks formatting using Prettier.

- `yarn prettier`  
  Checks if files are formatted correctly.

- `yarn prettier:fix`  
  Automatically formats the codebase.