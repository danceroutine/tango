import { defineConfig } from '@danceroutine/tango-config';

export default defineConfig({
    current: (process.env.NODE_ENV || 'development') as 'development' | 'test' | 'production',
    environments: {
        development: {
            name: 'development',
            db: {
                adapter: process.env.USE_SQLITE ? 'sqlite' : 'postgres',
                filename: process.env.TANGO_SQLITE_FILENAME || './.data/dev.db',
                url: process.env.DATABASE_URL,
                maxConnections: 10,
            },
            migrations: {
                dir: 'migrations',
                online: false,
            },
        },
        test: {
            name: 'test',
            db: {
                adapter: process.env.CI ? 'postgres' : 'sqlite',
                filename: ':memory:',
                url: process.env.TEST_DATABASE_URL,
                maxConnections: 5,
            },
            migrations: {
                dir: 'migrations',
                online: false,
            },
        },
        production: {
            name: 'production',
            db: {
                adapter: 'postgres',
                url: process.env.DATABASE_URL!,
                maxConnections: 20,
            },
            migrations: {
                dir: 'migrations',
                online: true,
            },
        },
    },
});
