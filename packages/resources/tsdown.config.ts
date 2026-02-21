import { defineConfig } from 'tsdown';

export default defineConfig({
    entry: ['src/index.ts', 'src/view/index.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    platform: 'node',
    target: 'node22',
    shims: false,
    external: ['@danceroutine/tango-core', '@danceroutine/tango-orm', 'zod'],
});
