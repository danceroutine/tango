#!/usr/bin/env node

try {
    await import('../dist/cli.mjs');
} catch {
    console.error('The Tango CLI has not been built yet. Run `pnpm --filter @danceroutine/tango-cli build` first.');
    process.exit(1);
}
