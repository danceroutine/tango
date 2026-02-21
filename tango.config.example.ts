import { defineConfig } from '@danceroutine/tango-config';

export default defineConfig({
    current: (process.env.NODE_ENV || 'development') as 'development' | 'test' | 'production',
    environments: {
        development: {
            name: 'development',
            db: {
                adapter: 'postgres',
                host: process.env.DB_HOST || 'localhost',
                port: Number(process.env.DB_PORT || 5432),
                database: process.env.DB_NAME || 'tango_dev',
                user: process.env.DB_USER || 'postgres',
                password: process.env.DB_PASSWORD || 'postgres',
                maxConnections: 10,
            },
            migrations: {
                dir: './migrations',
                online: false,
            },
        },
        test: {
            name: 'test',
            db: {
                adapter: process.env.CI ? 'postgres' : 'sqlite',
                filename: process.env.CI ? undefined : ':memory:',
                url: process.env.TEST_DATABASE_URL,
                maxConnections: 5,
            },
            migrations: {
                dir: './migrations',
                online: false,
            },
        },
        production: {
            name: 'production',
            db: {
                adapter: 'postgres',
                url: process.env.DATABASE_URL,
                maxConnections: 20,
            },
            migrations: {
                dir: './migrations',
                online: true,
            },
        },
    },
});
