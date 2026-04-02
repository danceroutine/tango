# @danceroutine/tango-adapters-core

`@danceroutine/tango-adapters-core` defines the contract that every Tango web-framework adapter implements.

Most Tango application developers will never need this package directly, because they will install a concrete adapter such as `@danceroutine/tango-adapters-express` or `@danceroutine/tango-adapters-next`. This package exists so that Tango can support multiple host frameworks while providing a sane standardization surface for Tango to integrate against. If you are building a new adapter for a currently-unsupported framework, this is the interface you'll implement against.

## Install

```bash
pnpm add @danceroutine/tango-adapters-core
```

## Adapter contract

Tango keeps its persistence and API layer independent of any one HTTP framework in order to enable the same API layer to run inside a given host framework. The adapter contract is the point where a framework-specific request lifecycle is translated into Tango's handler model.

That means an adapter is responsible for managing:

- The handoff of requests and route params from the host framework to Tango
- The translation of a Tango response back into the framework's response type

The contract stays narrow so that adapter authors can focus on translation, rather than having to reimplement Tango's higher-level behavior.

## Quick example

```ts
import type { FrameworkAdapter } from '@danceroutine/tango-adapters-core';

function registerAdapter(adapter: FrameworkAdapter): FrameworkAdapter {
    return adapter;
}
```

In practice, you usually implement `FrameworkAdapter` in a package of your own and then expose framework-specific registration helpers on top of it.

## Public API

The root export includes:

- `FrameworkAdapter`, the main adapter contract
- `FrameworkAdapterOptions`, the shared options type
- `FRAMEWORK_ADAPTER_BRAND` and `isFrameworkAdapter`, which support runtime identification of adapter instances

You can import these from the package root or from the `adapter` subpath, if you're used to Django's domain-drill-down style import paths:

```ts
import type { FrameworkAdapter } from '@danceroutine/tango-adapters-core';
import { adapter } from '@danceroutine/tango-adapters-core';
```

## Documentation

- Official documentation: <https://tangowebframework.dev>
- Architecture topic: <https://tangowebframework.dev/topics/architecture>

## Development

```bash
pnpm --filter @danceroutine/tango-adapters-core build
pnpm --filter @danceroutine/tango-adapters-core typecheck
pnpm --filter @danceroutine/tango-adapters-core test
```

For the wider contributor workflow, use:

- <https://tangowebframework.dev/contributors/contributing-code>

## License

MIT
