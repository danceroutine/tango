import { defineConfig } from 'tsdown';

export default defineConfig({
    entry: [
        'src/index.ts',
        'src/errors/index.ts',
        'src/http/index.ts',
        'src/logging/index.ts',
        'src/runtime/index.ts',
        'src/sql/index.ts',
    ],
    format: ['esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    platform: 'node',
    target: 'node22',
    shims: false,
});
