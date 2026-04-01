<script setup lang="ts">
import { toNuxtQueryParams } from '@danceroutine/tango-adapters-nuxt';
import { OffsetPaginator } from '@danceroutine/tango-resources';
import { Q, type FilterInput } from '@danceroutine/tango-orm';
import { PostModel, PostReadSchema, type Post } from '~~/lib/models';

function withSearchParam(url: string | null, search: string | undefined): string | null {
    if (!url || !search) {
        return url;
    }

    const params = new URLSearchParams(url.startsWith('?') ? url.slice(1) : url);
    params.set('search', search);
    return `?${params.toString()}`;
}

const route = useRoute();
const params = toNuxtQueryParams(route.query);
const search = params.getSearch();

let qs = PostModel.objects.query().orderBy('-createdAt').filter({ published: true });
if (search) {
    const searchFilters: FilterInput<Post>[] = [{ title__icontains: search }, { content__icontains: search }];
    qs = qs.filter(Q.or(...searchFilters));
}

const paginator = new OffsetPaginator(qs, 20);
const { limit, offset } = paginator.parseParams(params);
const [{ results: posts }, totalCount] = await Promise.all([paginator.apply(qs).fetch(PostReadSchema), qs.count()]);
const pagination = paginator.toResponse(posts, { totalCount });
const previousHref = withSearchParam(pagination.previous ?? null, search);
const nextHref = withSearchParam(pagination.next ?? null, search);
</script>

<template>
    <main class="page-shell">
        <header class="hero">
            <p class="eyebrow">Tango + Nuxt</p>
            <h1>Blog posts</h1>
            <p class="lede">SQLite-backed example with search, pagination, Nitro handlers, and Tango resources.</p>
        </header>

        <form method="GET" class="search-form">
            <input type="text" name="search" :value="search ?? ''" placeholder="Search title or content" />
            <input type="hidden" name="limit" :value="String(limit)" />
            <button type="submit">Search</button>
        </form>

        <section class="post-list">
            <article v-for="post in posts" :key="post.id" class="post-card">
                <div class="post-meta">
                    <span>{{ new Date(post.createdAt).toLocaleDateString() }}</span>
                    <span>{{ post.published ? 'Published' : 'Draft' }}</span>
                </div>
                <h2>{{ post.title }}</h2>
                <p v-if="post.excerpt">{{ post.excerpt }}</p>
                <NuxtLink :to="`/posts/${post.slug}`">Read more</NuxtLink>
            </article>

            <p v-if="posts.length === 0" class="empty-state">No published posts yet.</p>
        </section>

        <footer class="pagination-row">
            <NuxtLink v-if="previousHref" :to="previousHref">← Previous</NuxtLink>
            <span v-else class="muted">← Previous</span>

            <span>
                Showing {{ posts.length === 0 ? 0 : offset + 1 }}-{{ offset + posts.length }} of {{ totalCount }}
            </span>

            <NuxtLink v-if="nextHref" :to="nextHref">Next →</NuxtLink>
            <span v-else class="muted">Next →</span>
        </footer>
    </main>
</template>

<style scoped>
.page-shell {
    max-width: 64rem;
    margin: 0 auto;
    padding: 3rem 1.5rem 4rem;
    font-family: system-ui, sans-serif;
}

.hero {
    margin-bottom: 2rem;
}

.eyebrow {
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 0.8rem;
    color: #8c2f39;
    margin-bottom: 0.75rem;
}

.hero h1 {
    font-size: clamp(2.5rem, 6vw, 4rem);
    margin: 0;
}

.lede {
    color: #4b5563;
    max-width: 42rem;
    margin-top: 0.75rem;
}

.search-form {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.75rem;
    margin-bottom: 2rem;
}

.search-form input[type='text'] {
    min-width: 0;
    padding: 0.85rem 1rem;
    border: 1px solid #d1d5db;
    border-radius: 0.75rem;
}

.search-form button {
    padding: 0.85rem 1.25rem;
    border: none;
    border-radius: 0.75rem;
    background: #111827;
    color: #ffffff;
    font-weight: 600;
}

.post-list {
    display: grid;
    gap: 1rem;
}

.post-card {
    border: 1px solid #e5e7eb;
    border-radius: 1rem;
    padding: 1.25rem;
    background: #ffffff;
}

.post-card h2 {
    margin: 0.5rem 0;
}

.post-card p {
    color: #374151;
}

.post-card a,
.pagination-row a {
    color: #8c2f39;
    text-decoration: none;
    font-weight: 600;
}

.post-meta,
.pagination-row,
.muted,
.empty-state {
    color: #6b7280;
}

.post-meta {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    font-size: 0.9rem;
}

.pagination-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    margin-top: 2rem;
}

@media (max-width: 640px) {
    .search-form {
        grid-template-columns: 1fr;
    }

    .pagination-row {
        flex-direction: column;
        align-items: flex-start;
    }
}
</style>
