import { defineConfig, type TangoConfig } from '@danceroutine/tango-config';

export type TestTangoConfigOptions = {
    adapter?: 'sqlite' | 'postgres';
};

/**
 * Create a stable Tango config fixture for runtime-oriented tests.
 */
export function aTangoConfig(options: TestTangoConfigOptions = {}): TangoConfig {
    const adapter = options.adapter ?? 'sqlite';

    return defineConfig({
        current: 'test',
        environments: {
            development: {
                name: 'development',
                db:
                    adapter === 'sqlite'
                        ? { adapter: 'sqlite', filename: ':memory:', maxConnections: 1 }
                        : {
                              adapter: 'postgres',
                              url: 'postgres://postgres:postgres@localhost:5432/tango',
                              maxConnections: 1,
                          },
                migrations: { dir: 'migrations', online: adapter === 'postgres' },
            },
            test: {
                name: 'test',
                db:
                    adapter === 'sqlite'
                        ? { adapter: 'sqlite', filename: ':memory:', maxConnections: 1 }
                        : {
                              adapter: 'postgres',
                              url: 'postgres://postgres:postgres@localhost:5432/tango_test',
                              maxConnections: 1,
                          },
                migrations: { dir: 'migrations', online: adapter === 'postgres' },
            },
            production: {
                name: 'production',
                db:
                    adapter === 'sqlite'
                        ? { adapter: 'sqlite', filename: ':memory:', maxConnections: 1 }
                        : {
                              adapter: 'postgres',
                              url: 'postgres://postgres:postgres@localhost:5432/tango',
                              maxConnections: 1,
                          },
                migrations: { dir: 'migrations', online: adapter === 'postgres' },
            },
        },
    });
}
