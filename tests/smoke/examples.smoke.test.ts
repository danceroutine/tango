import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { AppProcessHarness } from '@danceroutine/tango-testing/integration';

const smokeDescribe = process.env.TANGO_RUN_SMOKE === 'true' ? describe.sequential : describe.skip;

function ensureSmokeBuildPrerequisites(): void {
    const commands: ReadonlyArray<ReadonlyArray<string>> = [
        ['--filter', '@danceroutine/tango-cli', 'build'],
        ['--filter', '@danceroutine/tango-adapters-express', 'build'],
        ['--filter', '@danceroutine/tango-adapters-next', 'build'],
        ['--filter', '@danceroutine/tango-adapters-nuxt', 'build'],
    ];

    for (const args of commands) {
        const result = spawnSync('pnpm', [...args], {
            cwd: process.cwd(),
            env: process.env,
            encoding: 'utf8',
        });

        if (result.status === 0) {
            continue;
        }

        throw new Error(
            [
                `smoke prerequisite build failed: pnpm ${args.join(' ')}`,
                `exit=${String(result.status)}`,
                result.stdout ?? '',
                result.stderr ?? '',
            ].join('\n')
        );
    }
}

function runSmokeCommand(label: string, args: readonly string[], env?: NodeJS.ProcessEnv): void {
    const result = spawnSync('pnpm', [...args], {
        cwd: process.cwd(),
        env: {
            ...process.env,
            ...env,
        },
        encoding: 'utf8',
    });

    if (result.status === 0) {
        return;
    }

    throw new Error(
        [
            `${label} failed: pnpm ${args.join(' ')}`,
            `exit=${String(result.status)}`,
            result.stdout ?? '',
            result.stderr ?? '',
        ].join('\n')
    );
}

function getFirstAuthorIdFromPostList(payload: unknown): number {
    const posts = Array.isArray(payload)
        ? payload
        : typeof payload === 'object' && payload !== null && Array.isArray((payload as { results?: unknown }).results)
          ? (payload as { results: unknown[] }).results
          : [];

    for (const post of posts) {
        if (
            typeof post === 'object' &&
            post !== null &&
            typeof (post as { authorId?: unknown }).authorId === 'number'
        ) {
            return (post as { authorId: number }).authorId;
        }
    }

    // Smoke runs start from a fresh SQLite file. The example bootstrap scripts seed
    // users before posts, so the first seeded user id is stable across runs.
    return 1;
}

smokeDescribe('example smoke tests', () => {
    let expressHarness: AppProcessHarness | null = null;
    let nextHarness: AppProcessHarness | null = null;
    let nuxtHarness: AppProcessHarness | null = null;
    const expressSqliteFile = `/tmp/tango-smoke-express-${randomUUID()}.sqlite`;
    const nextSqliteFile = `/tmp/tango-smoke-next-${randomUUID()}.sqlite`;
    const nuxtSqliteFile = `/tmp/tango-smoke-nuxt-${randomUUID()}.sqlite`;

    beforeAll(async () => {
        ensureSmokeBuildPrerequisites();

        // Ensure a clean database state for repeatable smoke runs.
        await rm(expressSqliteFile, { force: true });
        await rm(nextSqliteFile, { force: true });
        await rm(nuxtSqliteFile, { force: true });

        runSmokeCommand('next bootstrap', ['--filter', '@danceroutine/tango-example-nextjs-blog', 'bootstrap'], {
            TANGO_SQLITE_FILENAME: nextSqliteFile,
        });
        runSmokeCommand('nuxt bootstrap', ['--filter', '@danceroutine/tango-example-nuxt-blog', 'bootstrap'], {
            TANGO_SQLITE_FILENAME: nuxtSqliteFile,
        });

        expressHarness = await AppProcessHarness.start({
            command: 'pnpm',
            args: ['--filter', '@danceroutine/tango-example-express-blog-api', 'start'],
            baseUrl: 'http://127.0.0.1:3210',
            readyPath: '/health',
            env: {
                PORT: '3210',
                AUTO_BOOTSTRAP: 'false',
                TANGO_SQLITE_FILENAME: expressSqliteFile,
            },
            readyTimeoutMs: 45_000,
        });

        nextHarness = await AppProcessHarness.start({
            command: 'pnpm',
            args: ['--filter', '@danceroutine/tango-example-nextjs-blog', 'dev', '--port', '3211'],
            baseUrl: 'http://127.0.0.1:3211',
            readyPath: '/',
            env: {
                TANGO_SQLITE_FILENAME: nextSqliteFile,
            },
            readyTimeoutMs: 90_000,
            readyIntervalMs: 300,
        });

        nuxtHarness = await AppProcessHarness.start({
            command: 'pnpm',
            args: ['--filter', '@danceroutine/tango-example-nuxt-blog', 'dev', '--port', '3212', '--host', '127.0.0.1'],
            baseUrl: 'http://127.0.0.1:3212',
            readyPath: '/api/health',
            env: {
                TANGO_SQLITE_FILENAME: nuxtSqliteFile,
            },
            readyTimeoutMs: 120_000,
            readyIntervalMs: 300,
        });
    }, 120_000);

    afterAll(async () => {
        if (nuxtHarness) {
            await nuxtHarness.stop();
        }
        if (nextHarness) {
            await nextHarness.stop();
        }
        if (expressHarness) {
            await expressHarness.stop();
        }
        await rm(expressSqliteFile, { force: true });
        await rm(nextSqliteFile, { force: true });
        await rm(nuxtSqliteFile, { force: true });
    });

    it('smokes express CRUD routes with one-call viewset registration', async () => {
        const health = await expressHarness!.request('/health');
        expect(health.status).toBe(200);
        const openapi = await expressHarness!.request('/api/openapi.json');
        await expressHarness!.assertResponseStatus(openapi, 200, 'express openapi endpoint failed');
        const expressSpec = (await openapi.json()) as { openapi?: string; paths?: Record<string, unknown> };
        expect(expressSpec.openapi).toBe('3.1.0');
        expect(expressSpec.paths).toBeDefined();

        const created = await expressHarness!.request('/api/users', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ email: 'smoke@example.com', username: 'smoke-user' }),
        });
        expect(created.status).toBe(201);
        const user = (await created.json()) as { id: number; username: string };
        expect(user.username).toBe('smoke-user');

        const retrieved = await expressHarness!.request(`/api/users/${String(user.id)}`);
        expect(retrieved.status).toBe(200);

        const patched = await expressHarness!.request(`/api/users/${String(user.id)}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ username: 'smoke-user-updated' }),
        });
        expect(patched.status).toBe(200);

        const activated = await expressHarness!.request(`/api/users/${String(user.id)}/activate-account`, {
            method: 'POST',
        });
        await expressHarness!.assertResponseStatus(activated, 200, 'express activate action failed');

        const deleted = await expressHarness!.request(`/api/users/${String(user.id)}`, {
            method: 'DELETE',
        });
        expect(deleted.status).toBe(204);

        const apiViewHealth = await expressHarness!.request('/api/healthz');
        expect(apiViewHealth.status).toBe(200);

        const genericList = await expressHarness!.request('/api/generic/users?limit=1&offset=0');
        expect(genericList.status).toBe(200);
    });

    it('returns 400 for invalid express create payloads', async () => {
        const invalid = await expressHarness!.request('/api/users', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                username: 'missing-email',
            }),
        });

        await expressHarness!.assertResponseStatus(invalid, 400, 'express invalid create should return 400');
        const body = (await invalid.json()) as { error?: string; details?: Record<string, string[]> };
        expect(typeof body.error).toBe('string');
        expect(body.details).toBeDefined();
    });

    it('smokes next CRUD routes through catch-all viewset handlers', async () => {
        const listBefore = await nextHarness!.request('/api/posts');
        expect(listBefore.status).toBe(200);
        const nextAuthorId = getFirstAuthorIdFromPostList(await listBefore.json());
        const openapi = await nextHarness!.request('/api/openapi');
        await nextHarness!.assertResponseStatus(openapi, 200, 'next openapi endpoint failed');
        const nextSpec = (await openapi.json()) as { openapi?: string; paths?: Record<string, unknown> };
        expect(nextSpec.openapi).toBe('3.1.0');
        expect(nextSpec.paths).toBeDefined();

        const created = await nextHarness!.request('/api/posts', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                title: 'Smoke Title',
                content: 'Smoke Content',
                authorId: nextAuthorId,
                published: false,
            }),
        });
        await nextHarness!.assertResponseStatus(created, 201, 'next create /api/posts failed');
        const post = (await created.json()) as { id: number; title: string };
        expect(post.title).toBe('Smoke Title');

        const retrieved = await nextHarness!.request(`/api/posts/${String(post.id)}`);
        await nextHarness!.assertResponseStatus(retrieved, 200, 'next retrieve /api/posts/:id failed');

        const patched = await nextHarness!.request(`/api/posts/${String(post.id)}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                title: 'Smoke Title Updated',
            }),
        });
        await nextHarness!.assertResponseStatus(patched, 200, 'next patch /api/posts/:id failed');

        const published = await nextHarness!.request(`/api/posts/${String(post.id)}/publish`, {
            method: 'POST',
        });
        await nextHarness!.assertResponseStatus(published, 200, 'next publish /api/posts/:id/publish failed');

        const genericRetrieve = await nextHarness!.request(`/api/posts-generic/${String(post.id)}`);
        await nextHarness!.assertResponseStatus(genericRetrieve, 200, 'next generic api view retrieve failed');

        const deleted = await nextHarness!.request(`/api/posts/${String(post.id)}`, {
            method: 'DELETE',
        });
        await nextHarness!.assertResponseStatus(deleted, 204, 'next delete /api/posts/:id failed');

        const apiViewStatus = await nextHarness!.request('/api/status');
        await nextHarness!.assertResponseStatus(apiViewStatus, 200, 'next api view /api/status failed');
    });

    it('returns 400 for invalid next create payloads', async () => {
        const invalid = await nextHarness!.request('/api/posts', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                title: 'Invalid payload without required content',
            }),
        });

        await nextHarness!.assertResponseStatus(invalid, 400, 'next invalid create should return 400');
        const body = (await invalid.json()) as { error?: string; details?: Record<string, string[]> };
        expect(typeof body.error).toBe('string');
        expect(body.details).toBeDefined();
    });

    it('smokes nuxt SSR pages and Nitro CRUD routes', async () => {
        const home = await nuxtHarness!.request('/');
        await nuxtHarness!.assertResponseStatus(home, 200, 'nuxt home page failed');
        expect(await home.text()).toContain('Tango + Nuxt');

        const listBefore = await nuxtHarness!.request('/api/posts');
        await nuxtHarness!.assertResponseStatus(listBefore, 200, 'nuxt list /api/posts failed');
        const nuxtAuthorId = getFirstAuthorIdFromPostList(await listBefore.json());

        const openapi = await nuxtHarness!.request('/api/openapi');
        await nuxtHarness!.assertResponseStatus(openapi, 200, 'nuxt openapi endpoint failed');
        const nuxtSpec = (await openapi.json()) as { openapi?: string; paths?: Record<string, unknown> };
        expect(nuxtSpec.openapi).toBe('3.1.0');
        expect(nuxtSpec.paths).toBeDefined();

        const created = await nuxtHarness!.request('/api/posts', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                title: 'Nuxt Smoke Title',
                content: 'Nuxt Smoke Content',
                authorId: nuxtAuthorId,
                published: false,
            }),
        });
        await nuxtHarness!.assertResponseStatus(created, 201, 'nuxt create /api/posts failed');
        const post = (await created.json()) as { id: number; title: string; slug: string };
        expect(post.title).toBe('Nuxt Smoke Title');

        const retrieved = await nuxtHarness!.request(`/api/posts/${String(post.id)}`);
        await nuxtHarness!.assertResponseStatus(retrieved, 200, 'nuxt retrieve /api/posts/:id failed');

        const patched = await nuxtHarness!.request(`/api/posts/${String(post.id)}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                title: 'Nuxt Smoke Title Updated',
            }),
        });
        await nuxtHarness!.assertResponseStatus(patched, 200, 'nuxt patch /api/posts/:id failed');

        const published = await nuxtHarness!.request(`/api/posts/${String(post.id)}/publish`, {
            method: 'POST',
        });
        await nuxtHarness!.assertResponseStatus(published, 200, 'nuxt publish /api/posts/:id/publish failed');

        const page = await nuxtHarness!.request(`/posts/${post.slug}`);
        await nuxtHarness!.assertResponseStatus(page, 200, 'nuxt post page failed');
        expect(await page.text()).toContain('Nuxt Smoke Title Updated');

        const genericRetrieve = await nuxtHarness!.request(`/api/posts-generic/${String(post.id)}`);
        await nuxtHarness!.assertResponseStatus(genericRetrieve, 200, 'nuxt generic api view retrieve failed');

        const apiViewStatus = await nuxtHarness!.request('/api/status');
        await nuxtHarness!.assertResponseStatus(apiViewStatus, 200, 'nuxt api view /api/status failed');

        const deleted = await nuxtHarness!.request(`/api/posts/${String(post.id)}`, {
            method: 'DELETE',
        });
        await nuxtHarness!.assertResponseStatus(deleted, 204, 'nuxt delete /api/posts/:id failed');
    });

    it('returns 400 for invalid nuxt create payloads', async () => {
        const invalid = await nuxtHarness!.request('/api/posts', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                title: 'Invalid payload without required content',
            }),
        });

        await nuxtHarness!.assertResponseStatus(invalid, 400, 'nuxt invalid create should return 400');
        const body = (await invalid.json()) as { error?: string; details?: Record<string, string[]> };
        expect(typeof body.error).toBe('string');
        expect(body.details).toBeDefined();
    });
});
