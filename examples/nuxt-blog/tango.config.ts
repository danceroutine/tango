import { defineConfig } from '@danceroutine/tango-config';

export default defineConfig({
    current: (process.env.NODE_ENV || 'development') as 'development' | 'test' | 'production',
    environments: {
        development: {
            name: 'development',
            db: {
                adapter: 'sqlite',
                filename: process.env.TANGO_SQLITE_FILENAME || './.data/nuxt-blog.sqlite',
                maxConnections: 1,
            },
            migrations: { dir: './migrations', online: false },
        },
        test: {
            name: 'test',
            db: {
                adapter: 'sqlite',
                filename: process.env.TANGO_SQLITE_FILENAME || ':memory:',
                maxConnections: 1,
            },
            migrations: { dir: './migrations', online: false },
        },
        production: {
            name: 'production',
            db: {
                adapter: 'sqlite',
                filename: process.env.TANGO_SQLITE_FILENAME || './.data/nuxt-blog.sqlite',
                maxConnections: 1,
            },
            migrations: { dir: './migrations', online: false },
        },
    },
});
