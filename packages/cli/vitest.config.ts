import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
    resolve: {
        alias: {
            '@danceroutine/tango-config': fileURLToPath(new URL('../config/src/index.ts', import.meta.url)),
            '@danceroutine/tango-config/': fileURLToPath(new URL('../config/src/', import.meta.url)),
            '@danceroutine/tango-codegen': fileURLToPath(new URL('../codegen/src/index.ts', import.meta.url)),
            '@danceroutine/tango-codegen/': fileURLToPath(new URL('../codegen/src/', import.meta.url)),
            '@danceroutine/tango-core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)),
            '@danceroutine/tango-core/sql': fileURLToPath(new URL('../core/src/sql/index.ts', import.meta.url)),
            '@danceroutine/tango-core/': fileURLToPath(new URL('../core/src/', import.meta.url)),
            '@danceroutine/tango-migrations': fileURLToPath(new URL('../migrations/src/index.ts', import.meta.url)),
            '@danceroutine/tango-migrations/': fileURLToPath(new URL('../migrations/src/', import.meta.url)),
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
