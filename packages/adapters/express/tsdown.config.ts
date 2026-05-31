import { defineConfig } from 'tsdown';

export default defineConfig({
    entry: ['src/index.ts', 'src/adapter/index.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    platform: 'node',
    target: 'node22',
    shims: false,
    fixedExtension: false,
    external: ['@danceroutine/tango-resources', 'express'],
});
