import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
    resolve: {
        alias: [
            {
                find: '@danceroutine/tango-config/',
                replacement: fileURLToPath(new URL('../config/src/', import.meta.url)),
            },
            {
                find: '@danceroutine/tango-config',
                replacement: fileURLToPath(new URL('../config/src/index.ts', import.meta.url)),
            },
            {
                find: '@danceroutine/tango-codegen/commands',
                replacement: fileURLToPath(new URL('../codegen/src/commands/index.ts', import.meta.url)),
            },
            {
                find: '@danceroutine/tango-codegen/generators',
                replacement: fileURLToPath(new URL('../codegen/src/generators/index.ts', import.meta.url)),
            },
            {
                find: '@danceroutine/tango-codegen/',
                replacement: fileURLToPath(new URL('../codegen/src/', import.meta.url)),
            },
            {
                find: '@danceroutine/tango-codegen',
                replacement: fileURLToPath(new URL('../codegen/src/index.ts', import.meta.url)),
            },
            {
                find: '@danceroutine/tango-core/sql',
                replacement: fileURLToPath(new URL('../core/src/sql/index.ts', import.meta.url)),
            },
            {
                find: '@danceroutine/tango-core/',
                replacement: fileURLToPath(new URL('../core/src/', import.meta.url)),
            },
            {
                find: '@danceroutine/tango-core',
                replacement: fileURLToPath(new URL('../core/src/index.ts', import.meta.url)),
            },
            {
                find: '@danceroutine/tango-migrations/',
                replacement: fileURLToPath(new URL('../migrations/src/', import.meta.url)),
            },
            {
                find: '@danceroutine/tango-migrations',
                replacement: fileURLToPath(new URL('../migrations/src/index.ts', import.meta.url)),
            },
            {
                find: '@danceroutine/tango-schema/domain',
                replacement: fileURLToPath(new URL('../schema/src/domain/index.ts', import.meta.url)),
            },
            {
                find: '@danceroutine/tango-schema/model',
                replacement: fileURLToPath(new URL('../schema/src/model/index.ts', import.meta.url)),
            },
            {
                find: '@danceroutine/tango-schema/',
                replacement: fileURLToPath(new URL('../schema/src/', import.meta.url)),
            },
            {
                find: '@danceroutine/tango-schema',
                replacement: fileURLToPath(new URL('../schema/src/index.ts', import.meta.url)),
            },
        ],
    },
    test: {
        globals: true,
        environment: 'node',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html', 'lcov'],
            exclude: [
                'node_modules/**',
                'dist/**',
                'build/**',
                '**/*.config.{js,ts,mjs,cjs}',
                '**/*.d.ts',
                '**/index.ts',
                '**/__tests__/**',
                '**/*.test.{ts,tsx,js,jsx}',
                '**/*.spec.{ts,tsx,js,jsx}',
                '**/cli.ts',
            ],
            thresholds: {
                lines: 100,
                functions: 100,
                branches: 100,
                statements: 100,
            },
            watermarks: {
                lines: [99, 100],
                functions: [99, 100],
                branches: [99, 100],
                statements: [99, 100],
            },
        },
    },
});
