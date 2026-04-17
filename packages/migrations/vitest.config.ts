import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
    resolve: {
        alias: {
            '@danceroutine/tango-config': fileURLToPath(new URL('../config/src/index.ts', import.meta.url)),
            '@danceroutine/tango-config/': fileURLToPath(new URL('../config/src/', import.meta.url)),
            '@danceroutine/tango-codegen': fileURLToPath(new URL('../codegen/src/index.ts', import.meta.url)),
            '@danceroutine/tango-codegen/commands': fileURLToPath(
                new URL('../codegen/src/commands/index.ts', import.meta.url)
            ),
            '@danceroutine/tango-codegen/generators': fileURLToPath(
                new URL('../codegen/src/generators/index.ts', import.meta.url)
            ),
            '@danceroutine/tango-codegen/': fileURLToPath(new URL('../codegen/src/', import.meta.url)),
            '@danceroutine/tango-core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)),
            '@danceroutine/tango-core/sql': fileURLToPath(new URL('../core/src/sql/index.ts', import.meta.url)),
            '@danceroutine/tango-core/': fileURLToPath(new URL('../core/src/', import.meta.url)),
            '@danceroutine/tango-migrations': fileURLToPath(new URL('./src/index.ts', import.meta.url)),
            '@danceroutine/tango-migrations/': fileURLToPath(new URL('./src/', import.meta.url)),
            '@danceroutine/tango-testing/integration': fileURLToPath(
                new URL('../testing/src/integration/index.ts', import.meta.url)
            ),
            '@danceroutine/tango-testing': fileURLToPath(new URL('../testing/src/index.ts', import.meta.url)),
            '@danceroutine/tango-testing/': fileURLToPath(new URL('../testing/src/', import.meta.url)),
            '@danceroutine/tango-orm/connection': fileURLToPath(
                new URL('../orm/src/connection/index.ts', import.meta.url)
            ),
            '@danceroutine/tango-orm/query': fileURLToPath(new URL('../orm/src/query/index.ts', import.meta.url)),
            '@danceroutine/tango-orm': fileURLToPath(new URL('../orm/src/index.ts', import.meta.url)),
            '@danceroutine/tango-orm/': fileURLToPath(new URL('../orm/src/', import.meta.url)),
            '@danceroutine/tango-resources/context': fileURLToPath(
                new URL('../resources/src/context/index.ts', import.meta.url)
            ),
            '@danceroutine/tango-resources': fileURLToPath(new URL('../resources/src/index.ts', import.meta.url)),
            '@danceroutine/tango-resources/': fileURLToPath(new URL('../resources/src/', import.meta.url)),
            '@danceroutine/tango-schema': fileURLToPath(new URL('../schema/src/index.ts', import.meta.url)),
            '@danceroutine/tango-schema/domain': fileURLToPath(
                new URL('../schema/src/domain/index.ts', import.meta.url)
            ),
            '@danceroutine/tango-schema/model': fileURLToPath(new URL('../schema/src/model/index.ts', import.meta.url)),
            '@danceroutine/tango-schema/': fileURLToPath(new URL('../schema/src/', import.meta.url)),
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
