import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '@danceroutine/tango-config';

describe('TangoRuntime optional driver loading', () => {
    afterEach(() => {
        vi.doUnmock('pg');
        vi.resetModules();
    });

    it('does not load the Postgres driver when resolving a SQLite runtime adapter', async () => {
        vi.doMock('pg', () => {
            throw new Error('pg should not be loaded for a SQLite runtime.');
        });

        const { TangoRuntime } = await import('../TangoRuntime');
        const runtime = new TangoRuntime(() =>
            loadConfig(() => ({
                current: 'development',
                environments: {
                    development: {
                        name: 'development',
                        db: { adapter: 'sqlite', filename: ':memory:' },
                        migrations: { dir: './migrations' },
                    },
                    test: {
                        name: 'test',
                        db: { adapter: 'sqlite', filename: ':memory:' },
                        migrations: { dir: './migrations' },
                    },
                    production: {
                        name: 'production',
                        db: { adapter: 'sqlite', filename: ':memory:' },
                        migrations: { dir: './migrations' },
                    },
                },
            }))
        );

        expect(runtime.getAdapter().name).toBe('sqlite');
    });
});
