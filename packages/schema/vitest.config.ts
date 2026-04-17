import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
    resolve: {
        alias: {
            '@danceroutine/tango-core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)),
            '@danceroutine/tango-core/': fileURLToPath(new URL('../core/src/', import.meta.url)),
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
                'src/model/registry/ResolvedRelationGraphSnapshot.ts',
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
