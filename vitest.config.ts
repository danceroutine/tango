import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
    resolve: {
        alias: {
            '@danceroutine/tango-testing/integration': fileURLToPath(
                new URL('./packages/testing/src/integration/index.ts', import.meta.url)
            ),
            '@danceroutine/tango-testing/': fileURLToPath(new URL('./packages/testing/src/', import.meta.url)),
            '@danceroutine/tango-config': fileURLToPath(new URL('./packages/config/src/index.ts', import.meta.url)),
            '@danceroutine/tango-config/': fileURLToPath(new URL('./packages/config/src/', import.meta.url)),
            '@danceroutine/tango-core': fileURLToPath(new URL('./packages/core/src/index.ts', import.meta.url)),
            '@danceroutine/tango-core/': fileURLToPath(new URL('./packages/core/src/', import.meta.url)),
            '@danceroutine/tango-migrations': fileURLToPath(
                new URL('./packages/migrations/src/index.ts', import.meta.url)
            ),
            '@danceroutine/tango-migrations/': fileURLToPath(new URL('./packages/migrations/src/', import.meta.url)),
            '@danceroutine/tango-orm/connection': fileURLToPath(
                new URL('./packages/orm/src/connection/index.ts', import.meta.url)
            ),
            '@danceroutine/tango-orm/query': fileURLToPath(new URL('./packages/orm/src/query/index.ts', import.meta.url)),
            '@danceroutine/tango-orm': fileURLToPath(new URL('./packages/orm/src/index.ts', import.meta.url)),
            '@danceroutine/tango-orm/': fileURLToPath(new URL('./packages/orm/src/', import.meta.url)),
            '@danceroutine/tango-resources/context': fileURLToPath(
                new URL('./packages/resources/src/context/index.ts', import.meta.url)
            ),
            '@danceroutine/tango-schema': fileURLToPath(new URL('./packages/schema/src/index.ts', import.meta.url)),
            '@danceroutine/tango-schema/domain': fileURLToPath(
                new URL('./packages/schema/src/domain/index.ts', import.meta.url)
            ),
            '@danceroutine/tango-schema/model': fileURLToPath(
                new URL('./packages/schema/src/model/index.ts', import.meta.url)
            ),
            '@danceroutine/tango-schema/': fileURLToPath(new URL('./packages/schema/src/', import.meta.url)),
            '@danceroutine/tango-testing': fileURLToPath(new URL('./packages/testing/src/index.ts', import.meta.url)),
            '@danceroutine/tango-resources': fileURLToPath(
                new URL('./packages/resources/src/index.ts', import.meta.url)
            ),
            '@danceroutine/tango-resources/': fileURLToPath(new URL('./packages/resources/src/', import.meta.url)),
        },
    },
    test: {
        environment: 'node',
    },
});
