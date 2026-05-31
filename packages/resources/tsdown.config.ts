import { defineConfig } from 'tsdown';

export default defineConfig({
    entry: [
        'src/index.ts',
        'src/context/index.ts',
        'src/filters/index.ts',
        'src/pagination/index.ts',
        'src/paginators/index.ts',
        'src/resource/index.ts',
        'src/serializer/index.ts',
        'src/view/index.ts',
        'src/viewset/index.ts',
    ],
    format: ['esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    platform: 'node',
    target: 'node22',
    shims: false,
    fixedExtension: false,
    external: ['@danceroutine/tango-core', '@danceroutine/tango-orm', 'zod'],
});
