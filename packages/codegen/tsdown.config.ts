import { defineConfig } from 'tsdown';

export default defineConfig({
    entry: [
        'src/index.ts',
        'src/domain/index.ts',
        'src/generators/index.ts',
        'src/frameworks/index.ts',
        'src/commands/index.ts',
    ],
    format: ['esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    platform: 'node',
    target: 'node22',
    shims: false,
    external: ['@danceroutine/tango-schema'],
});
