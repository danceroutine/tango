import { fileURLToPath } from 'node:url';
import { defineNuxtConfig } from 'nuxt/config';

function resolveWorkspacePath(path: string): string {
    return fileURLToPath(new URL(path, import.meta.url));
}

export default defineNuxtConfig({
    compatibilityDate: '2026-03-31',
    alias: {
        '@danceroutine/tango-adapters-core': resolveWorkspacePath('../../packages/adapters/core/src'),
        '@danceroutine/tango-adapters-core/adapter': resolveWorkspacePath(
            '../../packages/adapters/core/src/adapter/index.ts'
        ),
        '@danceroutine/tango-adapters-nuxt': resolveWorkspacePath('../../packages/adapters/nuxt/src'),
        '@danceroutine/tango-config': resolveWorkspacePath('../../packages/config/src'),
        '@danceroutine/tango-core': resolveWorkspacePath('../../packages/core/src'),
        '@danceroutine/tango-core/sql': resolveWorkspacePath('../../packages/core/src/sql/index.ts'),
        '@danceroutine/tango-migrations': resolveWorkspacePath('../../packages/migrations/src'),
        '@danceroutine/tango-openapi': resolveWorkspacePath('../../packages/openapi/src'),
        '@danceroutine/tango-orm': resolveWorkspacePath('../../packages/orm/src'),
        '@danceroutine/tango-orm/connection': resolveWorkspacePath('../../packages/orm/src/connection/index.ts'),
        '@danceroutine/tango-orm/query': resolveWorkspacePath('../../packages/orm/src/query/index.ts'),
        '@danceroutine/tango-orm/runtime': resolveWorkspacePath('../../packages/orm/src/runtime/index.ts'),
        '@danceroutine/tango-resources': resolveWorkspacePath('../../packages/resources/src'),
        '@danceroutine/tango-schema': resolveWorkspacePath('../../packages/schema/src'),
        '@danceroutine/tango-schema/domain': resolveWorkspacePath('../../packages/schema/src/domain/index.ts'),
        '@danceroutine/tango-schema/model': resolveWorkspacePath('../../packages/schema/src/model/index.ts'),
    },
    serverHandlers: [
        { route: '/api/health', handler: './server/tango/health.ts' },
        { route: '/api/openapi', handler: './server/tango/openapi.ts' },
        { route: '/api/status', handler: './server/tango/status.ts' },
        { route: '/api/posts', handler: './server/tango/posts.ts' },
        { route: '/api/posts/**:tango', handler: './server/tango/posts.ts' },
        { route: '/api/posts-generic', handler: './server/tango/posts-generic.ts' },
        { route: '/api/posts-generic/**:tango', handler: './server/tango/posts-generic.ts' },
    ],
});
