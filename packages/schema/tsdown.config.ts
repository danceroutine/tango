import { defineConfig } from 'tsdown';

export default defineConfig({
    entry: ['src/index.ts', 'src/domain/index.ts', 'src/model/index.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    platform: 'node',
    target: 'node22',
    shims: false,
});
