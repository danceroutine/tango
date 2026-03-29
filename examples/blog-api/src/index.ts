import express from 'express';
import { ExpressAdapter } from '@danceroutine/tango-adapters-express/adapter';
import { seedExampleData } from '../scripts/bootstrap';
import { createOpenAPISpec } from './openapi';
import { CommentViewSet, PostViewSet, UserViewSet } from './viewsets/index';
import { HealthAPIView, UserListCreateAPIView } from './views/index';

/**
 * Express example server entrypoint.
 *
 * This server intentionally exposes a broad set of CRUD/list routes so the
 * example exercises filtering, search, ordering, pagination, and custom actions.
 */
async function main(): Promise<void> {
    const app = express();
    app.use(express.json());

    if (process.env.AUTO_BOOTSTRAP === 'true') {
        await seedExampleData(Number(process.env.SEED_POSTS_COUNT || '1000'));
    }

    const userViewSet = new UserViewSet();
    const postViewSet = new PostViewSet();
    const commentViewSet = new CommentViewSet();
    const healthAPIView = new HealthAPIView();
    const userListCreateAPIView = new UserListCreateAPIView();
    const adapter = new ExpressAdapter();

    app.get('/health', (_req, res) => {
        res.json({ status: 'ok', adapter: 'sqlite', timestamp: new Date().toISOString() });
    });
    app.get('/api/openapi.json', (_req, res) => {
        res.json(createOpenAPISpec());
    });
    adapter.registerViewSet(app, '/api/users', userViewSet);
    adapter.registerViewSet(app, '/api/posts', postViewSet);
    adapter.registerViewSet(app, '/api/comments', commentViewSet);
    adapter.registerAPIView(app, '/api/healthz', healthAPIView);
    adapter.registerAPIView(app, '/api/generic/users', userListCreateAPIView);

    const port = Number(process.env.PORT) || 3000;
    app.listen(port, () => {
        console.log(`Blog API example listening on http://localhost:${port}`);
        console.log('Try: GET /api/posts?published=true&limit=20&offset=0&ordering=-createdAt&search=api');
    });
}

// oxlint-disable-next-line unicorn/prefer-top-level-await
main().catch((error: unknown) => {
    console.error('Failed to start blog-api example:', error);
    process.exit(1);
});
