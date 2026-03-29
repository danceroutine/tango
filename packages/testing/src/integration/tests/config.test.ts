import { afterEach, describe, expect, it } from 'vitest';
import { resolveAdapterConfig } from '../config';
import { Dialect } from '../domain';

const originalEnv = process.env;

describe(resolveAdapterConfig, () => {
    afterEach(() => {
        process.env = { ...originalEnv };
    });

    it('builds postgres config from environment variables', () => {
        process.env = {
            ...originalEnv,
            TANGO_DATABASE_URL: 'postgres://env/db',
            TANGO_DB_HOST: 'db.local',
            TANGO_DB_PORT: '5433',
            TANGO_DB_NAME: 'app',
            TANGO_DB_USER: 'user',
            TANGO_DB_PASSWORD: 'secret',
        };

        const cfg = resolveAdapterConfig(Dialect.Postgres, { config: {} });
        expect(cfg).toEqual({
            url: 'postgres://env/db',
            host: 'db.local',
            port: 5433,
            database: 'app',
            user: 'user',
            password: 'secret',
            maxConnections: 10,
        });
    });

    it('returns undefined postgres port for non-numeric env values', () => {
        process.env = { ...originalEnv, TANGO_DB_PORT: 'NaN' };
        const cfg = resolveAdapterConfig(Dialect.Postgres, { config: {} });
        expect(cfg.port).toBeUndefined();
    });

    it('prefers explicit sqlite options over environment defaults', () => {
        process.env = { ...originalEnv, TANGO_SQLITE_FILENAME: 'env.sqlite' };
        const fromEnv = resolveAdapterConfig(Dialect.Sqlite, { config: {} });
        expect(fromEnv).toEqual({ filename: 'env.sqlite', maxConnections: 1 });

        const fromOptions = resolveAdapterConfig(Dialect.Sqlite, {
            sqliteFile: 'opt.sqlite',
            config: { maxConnections: 3 },
        });
        expect(fromOptions).toEqual({ filename: 'opt.sqlite', maxConnections: 3 });
    });

    it('falls back to the test sqlite filename from tango config', () => {
        const cfg = resolveAdapterConfig(Dialect.Sqlite, {
            config: { maxConnections: 5 },
            tangoConfigLoader: () => ({
                current: 'development',
                environments: {
                    development: {
                        name: 'development',
                        db: {
                            adapter: 'sqlite',
                            filename: undefined,
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
                            url: 'postgres://prod',
                        },
                    },
                },
            }),
        });

        expect(cfg.filename).toBe(':memory:');
        expect(cfg.maxConnections).toBe(5);
    });

    it('resolves from tango config loader for postgres without sqlite filename override', () => {
        const cfg = resolveAdapterConfig(Dialect.Postgres, {
            config: { user: 'override-user' },
            tangoConfigLoader: () => ({
                current: 'development',
                environments: {
                    development: {
                        name: 'development',
                        db: {
                            adapter: 'postgres',
                            url: 'postgres://from-config/db',
                            host: 'db.internal',
                            port: 5432,
                            database: 'app',
                            user: 'from-config-user',
                            password: 'pw',
                            maxConnections: 11,
                        },
                    },
                    test: {
                        name: 'test',
                        db: { adapter: 'sqlite', filename: ':memory:' },
                    },
                    production: {
                        name: 'production',
                        db: { adapter: 'postgres', url: 'postgres://prod/db' },
                    },
                },
            }),
        });

        expect(cfg.url).toBe('postgres://from-config/db');
        expect(cfg.user).toBe('override-user');
        expect(cfg.maxConnections).toBe(11);
        expect(cfg.filename).toBeUndefined();
    });
});
