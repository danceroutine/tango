import { defineConfig } from 'tsdown';

export default defineConfig({
    entry: ['src/index.ts', 'src/loader/index.ts', 'src/schema/index.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    platform: 'node',
    target: 'node22',
    shims: false,
});
