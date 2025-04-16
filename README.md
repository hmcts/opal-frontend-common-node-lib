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

## Getting Started

### Prerequisites

Ensure you have the following installed:

- [Node.js](https://nodejs.org/) v18 or later
- [Yarn](https://classic.yarnpkg.com/) v1.22.22 or later

### Install Dependencies

```bash
yarn
```

## Scripts

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

## Build Process

Run the following to build the project:

```bash
yarn build
```

The compiled output will be available in the `dist/` folder. It includes `index.js`, type declarations, and any exported modules listed in the `exports` field.

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

## Using This Library in a Node.js Application

Install the published package using:

```bash
yarn add @hmcts/opal-frontend-common-node-lib
```

If consuming from a local build:

```bash
yarn remove @hmcts/opal-frontend-common-node-lib
yarn add @hmcts/opal-frontend-common-node-lib@file:../opal-frontend-common-node-lib/dist
```

Ensure paths reflect your actual local setup when using the `file:` specifier.