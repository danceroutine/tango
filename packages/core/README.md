# @danceroutine/tango-core

`@danceroutine/tango-core` contains Tango's low-level HTTP, error, logging, and runtime primitives.

This package exists so that the rest of Tango can rely on one shared vocabulary for common server-side concerns. It is also useful outside Tango when you want fetch-compatible request and response helpers, application error types that map cleanly to HTTP, logger wiring, and runtime guards for common boundary checks. Keeping those concerns in one package makes the higher-level packages easier to understand because they do not each need their own local version of the same foundational ideas.

## Install

```bash
pnpm add @danceroutine/tango-core
```

## What lives here

The package groups together four kinds of primitives:

- HTTP types such as `TangoRequest`, `TangoResponse`, `TangoHeaders`, `TangoBody`, and `TangoQueryParams`
- application error types such as `ValidationError`, `NotFoundError`, `PermissionDenied`, `AuthenticationError`, and `ConflictError`
- logger utilities such as `ConsoleLogger`, `getLogger`, and `setLoggerFactory`
- runtime guards for common server-side values

These are the pieces other Tango packages build on when they need to describe a request, return a response, raise a domain error, narrow an unknown runtime value, or normalize query input.

## Quick start

```ts
import { NotFoundError, TangoResponse, HttpErrorFactory } from '@danceroutine/tango-core';

export async function getPost(id: string): Promise<Response> {
    const post = null;

    if (!post) {
        const error = HttpErrorFactory.toHttpError(new NotFoundError(`Post ${id} not found`));
        return TangoResponse.problem(error.body, { status: error.status });
    }

    return TangoResponse.json({ id, title: 'Hello' });
}
```

The error type expresses application intent, the HTTP mapping stays consistent, and the response helper keeps the endpoint code direct.

## Import style

Most projects will use curated root imports:

```ts
import { TangoResponse, ValidationError, getLogger } from '@danceroutine/tango-core';
```

If you are used to Django-style domain drill-down imports, the package also exposes namespace imports and subpaths that keep related primitives grouped together:

```ts
import '@danceroutine/tango-core/errors';
import '@danceroutine/tango-core/http';
import '@danceroutine/tango-core/logging';
import '@danceroutine/tango-core/runtime';
```

Available subpaths include `http`, `errors`, `logging`, and `runtime`.

## Documentation

- Official documentation: <https://tangowebframework.dev>
- Architecture topic: <https://tangowebframework.dev/topics/architecture>
- Resources API reference: <https://tangowebframework.dev/reference/resources-api>

## Development

```bash
pnpm --filter @danceroutine/tango-core build
pnpm --filter @danceroutine/tango-core typecheck
pnpm --filter @danceroutine/tango-core test
```

For the wider contributor workflow, use:

- <https://tangowebframework.dev/contributing>

## License

MIT
