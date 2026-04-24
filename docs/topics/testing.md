# Testing

Testing a Tango application usually means testing more than one layer of behavior.

Some code can be proved with a fast unit test. Some behavior depends on a real database because query compilation, schema changes, or dialect differences are part of the contract. Some failures only appear once the application process, the adapter, and the route wiring are all running together.

Tango's testing support follows those different levels of confidence, so choosing the test boundary comes before choosing the helper that matches it.

## Start by choosing the test boundary

If the behavior is pure application logic, a fast unit test is usually enough.

If the behavior depends on `Model.objects`, query composition, migrations, or backend-specific schema behavior, a real database-backed integration test is usually the right tool.

If the behavior depends on the adapter, request translation, route registration, or full application startup, a smoke test or higher-level integration test is usually the better fit.

## Fast unit tests

Tango's mock helpers exist for tests that want the shape of Tango's contracts without paying the cost of a real database.

That is the right level when application code depends on a model manager or query interface, but the test is really about the application's own branching, error handling, or result handling. In that situation, helpers such as `aManager`, `aModelQuerySet`, `aDBClient`, and `aQueryExecutor` let the test stay close to Tango's public contracts without pretending to prove real SQL behavior.

This level is a good fit for:

- service objects that call a manager
- resource code with error-handling branches
- logic that reacts to query results but does not need the real database to produce those results

```ts
import { expect, it } from 'vitest';
import { aManager, aModelQuerySet } from '@danceroutine/tango-testing';
import type { PostModel } from '@/lib/models';

it('tests service logic without starting a real database', async () => {
    const queryset = aModelQuerySet<PostModel>({
        fetchOne: async () => ({
            id: 1,
            title: 'Hello, Tango',
            published: true,
        }),
    });
    const manager = aManager<PostModel>({ querySet: queryset });

    const latest = await manager.query().filter({ published: true }).fetchOne();

    expect(latest?.title).toBe('Hello, Tango');
    expect(queryset.filter).toHaveBeenCalledWith({ published: true });
});
```

## Factories and repeatable data

As a test suite grows, the next source of friction is often the data setup rather than the query layer.

`ModelDataFactory` exists so that one model-shaped fixture can be created repeatedly with sensible defaults and predictable variation. That keeps test setup readable and reduces fixture duplication across a suite.

Factories are especially useful when:

- several tests need the same model shape
- you want sequence-based defaults
- the tests care about the content of the data, but not about how the rows reached the database

They fit naturally alongside both unit tests and integration tests.

```ts
import { z } from 'zod';
import { ModelDataFactory } from '@danceroutine/tango-testing';

const PostShape = {
    create: (data: { id: number; title: string; slug: string; published: boolean }) => data,
    parse: (data: unknown) =>
        z
            .object({
                id: z.number(),
                title: z.string(),
                slug: z.string(),
                published: z.boolean(),
            })
            .parse(data),
};

class PostFactory extends ModelDataFactory<typeof PostShape> {
    protected sequenceDefaults() {
        const n = this.getSequence();
        return {
            id: n,
            title: `Post ${n}`,
            slug: `post-${n}`,
        };
    }
}

const factory = new PostFactory(PostShape, { published: false });

const draft = factory.build();
const published = factory.build({ published: true });
const batch = factory.buildList(2);
```

## Integration tests with a real database

Once the behavior under test depends on real persistence behavior, move to a database-backed integration test.

At that point, Tango's `TestHarness` becomes the useful tool. It creates a dialect-specific test harness around a real database workflow so the test can apply migrations, seed data, run queries, and inspect schema state against an actual backend.

That is the right tool when you need to prove behavior such as:

- model manager reads and writes
- queryset compilation and execution
- migration application
- schema introspection
- dialect-sensitive behavior

At this level, the database is part of the contract. The test is proving that the application and the database behave correctly together.

```ts
import { afterAll, beforeAll, expect, it } from 'vitest';
import {
    TestHarness,
    applyAndVerifyMigrations,
    createModelQuerySetFixture,
    seedTable,
} from '@danceroutine/tango-testing';

let harness: Awaited<ReturnType<typeof TestHarness.sqlite>>;

beforeAll(async () => {
    harness = await TestHarness.sqlite();
    await harness.setup();
    await applyAndVerifyMigrations(harness, {
        migrationsDir: './migrations',
    });
});

afterAll(async () => {
    await harness.teardown();
});

it('executes a queryset against the real test database', async () => {
    await seedTable(harness, 'posts', [
        { id: 1, title: 'Hello, Tango', published: true },
        { id: 2, title: 'Draft', published: false },
    ]);

    const queryset = createModelQuerySetFixture<{
        id: number;
        title: string;
        published: boolean;
    }>({
        harness,
        meta: {
            table: 'posts',
            pk: 'id',
            columns: {
                id: 'serial',
                title: 'text',
                published: 'bool',
            },
        },
    });

    const result = await queryset.filter({ published: true }).fetch();

    expect(result.length).toBe(1);
    expect(result.at(0)?.title).toBe('Hello, Tango');
});
```

## Testing across dialects

Tango's integration support is dialect-aware because DBMS capabilities vary, producing non-identical environments.

`TestHarness` can provision SQLite and PostgreSQL harnesses today. That makes it possible to run the same class of integration test against more than one backend family when the application needs that confidence.

This matters most when:

- the application supports more than one database backend
- a migration needs confidence against the same backend family used in production
- a query or schema behavior may vary by dialect

For many projects, SQLite is still useful for fast local integration coverage. PostgreSQL is often the stronger reference backend for production-oriented confidence.

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TestHarness } from '@danceroutine/tango-testing';

describe.each([
    {
        name: 'sqlite',
        createHarness: () => TestHarness.sqlite(),
    },
    {
        name: 'postgres',
        createHarness: () => TestHarness.postgres(),
    },
])('$name integration coverage', ({ createHarness }) => {
    let harness: Awaited<ReturnType<typeof createHarness>>;

    beforeAll(async () => {
        harness = await createHarness();
        await harness.setup();
    });

    afterAll(async () => {
        await harness.teardown();
    });

    it('exposes the dialect capabilities for this backend', () => {
        expect(harness.capabilities).toBeDefined();
    });
});
```

## Vitest integration

Tango extends the test runner you are already using with helpers that understand Tango's runtime, ORM, and migration contracts.

In a Vitest-based project, importing `@danceroutine/tango-testing/vitest` registers Tango-specific helpers and assertions so that tests can share harness setup and make clearer assertions about schema and migration behavior.

That helper surface is useful when a suite wants one place to keep the active harness, create query fixtures, seed tables, inspect schema state, or assert migration plans without rebuilding the same glue code in every file.

The result is that Vitest can work more naturally with Tango's runtime, migrations, and ORM contracts.

```ts
// vitest.setup.ts
import '@danceroutine/tango-testing/vitest';

// posts.integration.test.ts
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { TestHarness } from '@danceroutine/tango-testing';

beforeAll(async () => {
    await vi.tango.useHarness(() => TestHarness.sqlite());
    await vi.tango.applyAndVerifyMigrations({
        migrationsDir: './migrations',
    });
});

afterAll(async () => {
    await vi.tango.getTestHarness().teardown();
});

it('uses Tango-aware helpers inside Vitest', async () => {
    await vi.tango.seedTable('posts', [{ id: 1, title: 'Hello, Tango' }]);

    expect({ id: 1, title: 'Hello, Tango' }).toMatchSchema(
        z.object({
            id: z.number(),
            title: z.string(),
        })
    );
});
```

## Smoke tests and full application behavior

Some failures only show up once the application process is running for real.

Adapter registration, framework bootstrapping, environment loading, and full HTTP routing are all examples of behavior that may pass unit and integration tests while still failing in a live process. For that layer, `AppProcessHarness` gives Tango applications a way to start a real child process and probe the running application from the outside.

These tests are slower, so they usually focus on a smaller number of high-value paths:

- application startup
- migration bootstrapping
- one or two representative endpoints
- route and adapter wiring

They give confidence that the layers you tested separately can still work together in one running application.

```ts
import { afterAll, beforeAll, expect, it } from 'vitest';
import { AppProcessHarness } from '@danceroutine/tango-testing';

let app: AppProcessHarness;

beforeAll(async () => {
    app = await AppProcessHarness.start({
        command: 'pnpm',
        args: ['dev'],
        cwd: process.cwd(),
        baseUrl: 'http://127.0.0.1:3000',
        readyPath: '/api/healthz',
    });
});

afterAll(async () => {
    await app.stop();
});

it('proves the running application responds through real HTTP routes', async () => {
    const response = await app.request('/api/healthz');

    await app.assertResponseStatus(response, 200, 'health endpoint should boot cleanly');
    expect(await response.json()).toEqual(
        expect.objectContaining({
            status: 'ok',
        })
    );
});
```

## Related pages

- [Run Tango in CI/CD](/how-to/ci-cd-pipelines)
- [Configure databases](/how-to/databases)
- [ORM and QuerySets](/topics/orm-and-querysets)
- [Migrations](/topics/migrations)
