import { defineConfig } from 'tsdown';

export default defineConfig({
    entry: [
        'src/index.ts',
        'src/cli.ts',
        'src/domain/index.ts',
        'src/builder/index.ts',
        'src/compilers/index.ts',
        'src/introspect/index.ts',
        'src/strategies/index.ts',
        'src/commands/index.ts',
        'src/runner/index.ts',
        'src/generator/index.ts',
        'src/diff/index.ts',
    ],
    format: ['esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    platform: 'node',
    target: 'node22',
    shims: false,
    external: ['@danceroutine/tango-schema', 'pg', 'better-sqlite3', 'kleur', 'yargs'],
});
