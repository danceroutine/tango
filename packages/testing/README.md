# @danceroutine/tango-testing

`@danceroutine/tango-testing` provides Tango's testing helpers for unit tests, integration tests, and smoke-test workflows.

This package exists because framework-level testing needs more than a handful of mocks. Once a codebase has managers, query composition, migrations, dialect differences, and real application processes, test support has to cover several levels of confidence at once. Tango keeps those helpers together so that application and framework code can move from fast isolated tests to realistic integration coverage without rebuilding the same harness machinery for every project.

## Install

```bash
pnpm add -D @danceroutine/tango-testing vitest
```

Depending on your tests, you may also need the database driver or Tango packages your application already uses.

## What kinds of testing it supports

The package spans three common testing layers:

- lightweight mocks for fast unit tests
- integration harnesses for database-backed query, manager, and migration tests
- Vitest helpers and smoke-test utilities for higher-level workflows

Those layers let one package support fast unit tests, dialect-backed integration tests, and full process-level smoke tests without changing mental models between them.

## Quick start

Register the Vitest helper surface:

```ts
import { beforeAll } from 'vitest';
import { registerVitestTango } from '@danceroutine/tango-testing/vitest';

beforeAll(() => {
    registerVitestTango();
});
```

For unit tests, you can use the mock helpers directly:

```ts
import { aManager } from '@danceroutine/tango-testing';

const manager = aManager();
```

Runtime-focused tests can also start from a shared config and runtime setup helper instead of rebuilding Tango config in every file:

```ts
import { aTangoConfig, setupTestTangoRuntime } from '@danceroutine/tango-testing';

const config = aTangoConfig({ adapter: 'sqlite' });
const runtime = await setupTestTangoRuntime();
```

`aTangoConfig` gives tests a stable config fixture, and `setupTestTangoRuntime` resets and initializes the process-default Tango runtime in one call.

For integration tests, the package exposes the `TestHarness` and dialect strategies that create real database-backed workflows.

## Public API

The root export covers three main jobs. Mock helpers such as `aDBClient`, `aManager`, `aQueryExecutor`, and `aQuerySet` keep unit tests lightweight. Runtime and integration helpers such as `aTangoConfig`, `setupTestTangoRuntime`, `TestHarness`, and `createQuerySetFixture` support database-backed and framework-backed workflows. `ModelDataFactory` and the Vitest integration surface round out the package for data fixtures and test-runner setup.

The package also exposes subpaths such as `mocks`, `factories`, `assertions`, `integration`, and `vitest` when you want a more explicit import boundary.

## Documentation

- Official documentation: <https://tangowebframework.dev>
- Testing topic: <https://tangowebframework.dev/topics/testing>
- New dialect onboarding: <https://tangowebframework.dev/contributors/how-to/new-dialect-onboarding>

## Development

```bash
pnpm --filter @danceroutine/tango-testing build
pnpm --filter @danceroutine/tango-testing typecheck
pnpm --filter @danceroutine/tango-testing test
```

For the wider contributor workflow, use:

- <https://tangowebframework.dev/contributing>

## License

MIT
