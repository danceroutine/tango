import { defineConfig } from 'tsdown';

export default defineConfig({
    entry: [
        'src/index.ts',
        'src/integration/index.ts',
        'src/vitest/index.ts',
        'src/mocks/index.ts',
        'src/factories/index.ts',
        'src/assertions/index.ts',
        'src/express/index.ts',
    ],
    format: ['esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    platform: 'node',
    target: 'node22',
    shims: false,
    external: ['@danceroutine/tango-config', '@danceroutine/tango-migrations', '@danceroutine/tango-orm'],
});
