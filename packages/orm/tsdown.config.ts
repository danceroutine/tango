import { defineConfig } from 'tsdown';

export default defineConfig({
    entry: [
        'src/index.ts',
        'src/query/index.ts',
        'src/connection/index.ts',
        'src/transaction/index.ts',
        'src/manager/index.ts',
        'src/runtime/index.ts',
    ],
    format: ['esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    platform: 'node',
    target: 'node22',
    shims: false,
    external: ['pg', 'better-sqlite3', '@danceroutine/tango-config'],
});
