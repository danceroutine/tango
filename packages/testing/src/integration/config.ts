import type { AdapterConfig } from '@danceroutine/tango-orm';
import { loadConfig } from '@danceroutine/tango-config';
import { Dialect } from './domain';

function readNumber(value: string | undefined): number | undefined {
    if (!value) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Resolve adapter configuration for a test harness from explicit options,
 * typed Tango config, and environment variables in that order.
 */
export function resolveAdapterConfig(
    dialect: Dialect,
    opts: {
        config?: Partial<AdapterConfig>;
        tangoConfigLoader?: () => unknown;
        sqliteFile?: string;
    }
): AdapterConfig {
    const fromOptions = opts.config ?? {};

    if (opts.tangoConfigLoader) {
        const loaded = loadConfig(opts.tangoConfigLoader);
        const current = loaded.current.db;
        const merged: AdapterConfig = {
            url: fromOptions.url ?? current.url,
            host: fromOptions.host ?? current.host,
            port: fromOptions.port ?? current.port,
            database: fromOptions.database ?? current.database,
            user: fromOptions.user ?? current.user,
            password: fromOptions.password ?? current.password,
            filename: fromOptions.filename ?? current.filename,
            maxConnections: fromOptions.maxConnections ?? current.maxConnections,
        };
        if (dialect === Dialect.Sqlite) {
            merged.filename = opts.sqliteFile ?? merged.filename ?? ':memory:';
        }
        return merged;
    }

    if (dialect === Dialect.Postgres) {
        return {
            url: fromOptions.url ?? process.env.TANGO_DATABASE_URL ?? process.env.DATABASE_URL,
            host: fromOptions.host ?? process.env.TANGO_DB_HOST,
            port: fromOptions.port ?? readNumber(process.env.TANGO_DB_PORT),
            database: fromOptions.database ?? process.env.TANGO_DB_NAME,
            user: fromOptions.user ?? process.env.TANGO_DB_USER,
            password: fromOptions.password ?? process.env.TANGO_DB_PASSWORD,
            maxConnections: fromOptions.maxConnections ?? 10,
        };
    }

    return {
        filename: opts.sqliteFile ?? fromOptions.filename ?? process.env.TANGO_SQLITE_FILENAME ?? ':memory:',
        maxConnections: fromOptions.maxConnections ?? 1,
    };
}
