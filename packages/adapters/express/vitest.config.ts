import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
    resolve: {
        alias: {
            '@danceroutine/tango-config': resolve(__dirname, '../../config/src/index.ts'),
            '@danceroutine/tango-config/': resolve(__dirname, '../../config/src/'),
            '@danceroutine/tango-core': resolve(__dirname, '../../core/src/index.ts'),
            '@danceroutine/tango-core/': resolve(__dirname, '../../core/src/'),
            '@danceroutine/tango-core/http': resolve(__dirname, '../../core/src/http/index.ts'),
            '@danceroutine/tango-resources/context': resolve(__dirname, '../../resources/src/context/index.ts'),
            '@danceroutine/tango-resources': resolve(__dirname, '../../resources/src/index.ts'),
            '@danceroutine/tango-resources/': resolve(__dirname, '../../resources/src/'),
            '@danceroutine/tango-migrations': resolve(__dirname, '../../migrations/src/index.ts'),
            '@danceroutine/tango-migrations/': resolve(__dirname, '../../migrations/src/'),
            '@danceroutine/tango-orm/connection': resolve(__dirname, '../../orm/src/connection/index.ts'),
            '@danceroutine/tango-orm/query': resolve(__dirname, '../../orm/src/query/index.ts'),
            '@danceroutine/tango-orm': resolve(__dirname, '../../orm/src/index.ts'),
            '@danceroutine/tango-orm/': resolve(__dirname, '../../orm/src/'),
            '@danceroutine/tango-schema': resolve(__dirname, '../../schema/src/index.ts'),
            '@danceroutine/tango-schema/domain': resolve(__dirname, '../../schema/src/domain/index.ts'),
            '@danceroutine/tango-schema/model': resolve(__dirname, '../../schema/src/model/index.ts'),
            '@danceroutine/tango-schema/': resolve(__dirname, '../../schema/src/'),
            '@danceroutine/tango-adapters-core/adapter': resolve(__dirname, '../core/src/adapter/index.ts'),
            '@danceroutine/tango-adapters-core': resolve(__dirname, '../core/src/index.ts'),
            '@danceroutine/tango-adapters-core/': resolve(__dirname, '../core/src/'),
            '@danceroutine/tango-testing': resolve(__dirname, '../../testing/src/index.ts'),
            '@danceroutine/tango-testing/': resolve(__dirname, '../../testing/src/'),
        },
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
