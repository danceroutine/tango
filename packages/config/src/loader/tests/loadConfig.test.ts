import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from '../loadConfig';

/**
 * Builds a minimal valid TangoConfig input with a SQLite dev/test
 * environment and a Postgres production environment. Callers can
 * override the development `db` block to test env-var merging.
 */
function aConfigInput(devDbOverrides: Record<string, unknown> = {}): () => unknown {
    return () => ({
        current: 'development',
        environments: {
            development: {
                name: 'development',
                db: {
                    adapter: 'sqlite',
                    filename: 'dev.db',
                    ...devDbOverrides,
                },
            },
            test: {
                name: 'test',
                db: {
                    adapter: 'sqlite',
                    filename: ':memory:',
                },
            },
            production: {
                name: 'production',
                db: {
                    adapter: 'postgres',
                    url: 'postgres://localhost/prod',
                },
            },
        },
    });
}

describe(loadConfig, () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('loads config from function', () => {
        const result = loadConfig(aConfigInput());

        expect(result.env).toBe('development');
        expect(result.current.db.adapter).toBe('sqlite');
        expect(result.current.db.filename).toBe('dev.db');
    });

    it('merges DATABASE_URL env var', () => {
        process.env.DATABASE_URL = 'postgres://override/db';

        const result = loadConfig(
            aConfigInput({
                adapter: 'postgres',
                url: 'postgres://original/db',
            })
        );

        expect(result.current.db.url).toBe('postgres://override/db');
    });

    it('prefers TANGO_DATABASE_URL over DATABASE_URL', () => {
        process.env.DATABASE_URL = 'postgres://fallback/db';
        process.env.TANGO_DATABASE_URL = 'postgres://preferred/db';

        const result = loadConfig(
            aConfigInput({
                adapter: 'postgres',
                url: 'postgres://original/db',
            })
        );

        expect(result.current.db.url).toBe('postgres://preferred/db');
    });

    it('merges TANGO_DB_ADAPTER env var', () => {
        process.env.TANGO_DB_ADAPTER = 'postgres';

        const result = loadConfig(aConfigInput());

        expect(result.current.db.adapter).toBe('postgres');
    });

    it('merges discrete DB connection env vars', () => {
        process.env.TANGO_DB_HOST = 'db.example.com';
        process.env.TANGO_DB_PORT = '5433';
        process.env.TANGO_DB_NAME = 'mydb';
        process.env.TANGO_DB_USER = 'admin';
        process.env.TANGO_DB_PASSWORD = 'secret';

        const result = loadConfig(
            aConfigInput({
                adapter: 'postgres',
                host: 'localhost',
                port: 5432,
            })
        );

        expect(result.current.db.host).toBe('db.example.com');
        expect(result.current.db.port).toBe(5433);
        expect(result.current.db.database).toBe('mydb');
        expect(result.current.db.user).toBe('admin');
        expect(result.current.db.password).toBe('secret');
    });

    it('merges migrations env vars', () => {
        process.env.TANGO_MIGRATIONS_DIR = 'db/migrations';
        process.env.TANGO_MIGRATIONS_ONLINE = 'true';

        const result = loadConfig(() => ({
            current: 'development',
            environments: {
                development: {
                    name: 'development',
                    db: {
                        adapter: 'sqlite',
                        filename: 'dev.db',
                    },
                    migrations: {
                        dir: 'migrations',
                        online: false,
                    },
                },
                test: {
                    name: 'test',
                    db: {
                        adapter: 'sqlite',
                        filename: ':memory:',
                    },
                },
                production: {
                    name: 'production',
                    db: {
                        adapter: 'postgres',
                        url: 'postgres://localhost/prod',
                    },
                },
            },
        }));

        expect(result.current.migrations.dir).toBe('db/migrations');
        expect(result.current.migrations.online).toBe(true);
    });

    it('merges sqlite filename env var', () => {
        process.env.TANGO_SQLITE_FILENAME = 'override.sqlite';

        const result = loadConfig(aConfigInput());

        expect(result.current.db.filename).toBe('override.sqlite');
    });

    it('applies default migrations config', () => {
        const result = loadConfig(aConfigInput());

        expect(result.current.migrations.dir).toBe('migrations');
        expect(result.current.migrations.online).toBe(false);
    });
});
