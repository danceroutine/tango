import { TemplateBuilder } from '../../../contracts/template/TemplateBuilder';
import type { FrameworkScaffoldContext } from '../../../contracts/template/ScaffoldTemplate';

export class TangoConfigTemplateBuilder extends TemplateBuilder {
    constructor() {
        super({ name: 'tango.config.ts' });
    }

    protected override resolveTemplate(context: FrameworkScaffoldContext): string {
        if (context.dialect === 'sqlite') {
            return `import { defineConfig } from '@danceroutine/tango-config';

export default defineConfig({
    current: (process.env.NODE_ENV || 'development') as 'development' | 'test' | 'production',
    environments: {
        development: {
            name: 'development',
            db: {
                adapter: 'sqlite',
                filename: process.env.TANGO_SQLITE_FILENAME || './.data/${context.projectName}.sqlite',
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
                filename: process.env.TANGO_SQLITE_FILENAME || './.data/${context.projectName}.sqlite',
                maxConnections: 1,
            },
            migrations: { dir: './migrations', online: false },
        },
    },
});
`;
        }

        return `import { defineConfig } from '@danceroutine/tango-config';

export default defineConfig({
    current: (process.env.NODE_ENV || 'development') as 'development' | 'test' | 'production',
    environments: {
        development: {
            name: 'development',
            db: {
                adapter: 'postgres',
                url: process.env.TANGO_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/${context.projectName}',
                maxConnections: 10,
            },
            migrations: { dir: './migrations', online: true },
        },
        test: {
            name: 'test',
            db: {
                adapter: 'postgres',
                url: process.env.TANGO_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/${context.projectName}_test',
                maxConnections: 5,
            },
            migrations: { dir: './migrations', online: true },
        },
        production: {
            name: 'production',
            db: {
                adapter: 'postgres',
                url: process.env.TANGO_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/${context.projectName}',
                maxConnections: 20,
            },
            migrations: { dir: './migrations', online: true },
        },
    },
});
`;
    }
}
