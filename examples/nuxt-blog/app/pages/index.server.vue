<script setup lang="ts">
import { toNuxtQueryParams } from '@danceroutine/tango-adapters-nuxt';
import { OffsetPaginator } from '@danceroutine/tango-resources';
import { Q, type FilterInput } from '@danceroutine/tango-orm';
import { PostModel, TagModel, UserModel, type Post, type Tag, type User } from '~~/lib/models';

type PostCard = Post & {
    author?: User | null;
    tags: Tag[];
};

const route = useRoute();
const params = toNuxtQueryParams(route.query);
const search = params.getSearch();
const selectedTag = params.get('tag') ?? undefined;

let qs = PostModel.objects.query().orderBy('-createdAt').filter({ published: true });
if (selectedTag) {
    qs = qs.filter({ tags__slug: selectedTag });
}
if (search) {
    const searchFilters: FilterInput<Post>[] = [
        { title__icontains: search },
        { content__icontains: search },
        { tags__name__icontains: search },
    ];
    qs = qs.filter(Q.or(...searchFilters));
}

const paginator = new OffsetPaginator(qs, 12);
const { limit, offset } = paginator.parseParams(params);
const [page, totalCount, authorsResult, tagsResult] = await Promise.all([
    paginator.apply(qs.selectRelated('author').prefetchRelated('tags')).fetch(),
    qs.count(),
    UserModel.objects.query().orderBy('username').fetch(),
    TagModel.objects.query().orderBy('name').fetch(),
]);

const posts = await Promise.all(
    page.results.map(async (post) => ({
        ...post,
        tags: (await post.tags.all().fetch()).results,
    }))
);
const authors = authorsResult.results;
const tags = tagsResult.results;
const pagination = paginator.toResponse(posts, { totalCount, params });
const previousHref = pagination.previous ?? null;
const nextHref = pagination.next ?? null;
</script>

<template>
    <main class="page-shell">
        <header class="hero">
            <div>
                <p class="eyebrow">Tango + Nuxt</p>
                <h1>Blog posts with tags and relation-path filtering</h1>
                <p class="lede">
                    This page stays server-rendered, reads through `Model.objects`, filters by `tags__slug`, and
                    materializes the many-to-many manager into plain arrays only where the page needs them.
                </p>
            </div>

            <div class="hero-stats">
                <div>
                    <strong>{{ authors.length }}</strong>
                    <span>authors</span>
                </div>
                <div>
                    <strong>{{ tags.length }}</strong>
                    <span>tags</span>
                </div>
                <div>
                    <strong>{{ totalCount }}</strong>
                    <span>matching posts</span>
                </div>
            </div>
        </header>

        <section class="layout-grid">
            <div>
                <form method="GET" class="search-form">
                    <label>
                        Search
                        <input
                            type="text"
                            name="search"
                            :value="search ?? ''"
                            placeholder="Search title, content, or tag"
                        />
                    </label>

                    <label>
                        Tag
                        <select name="tag">
                            <option value="">All tags</option>
                            <option
                                v-for="tag in tags"
                                :key="tag.id"
                                :value="tag.slug"
                                :selected="tag.slug === selectedTag"
                            >
                                {{ tag.name }}
                            </option>
                        </select>
                    </label>

                    <input type="hidden" name="limit" :value="String(limit)" />
                    <button type="submit">Apply</button>
                </form>

                <section class="post-list">
                    <article v-for="post in posts" :key="post.id" class="post-card">
                        <div class="post-meta">
                            <span>{{ new Date(post.createdAt).toLocaleDateString() }}</span>
                            <span>{{ post.author?.username ?? 'Unknown author' }}</span>
                        </div>
                        <h2>{{ post.title }}</h2>
                        <p v-if="post.excerpt">{{ post.excerpt }}</p>

                        <div class="tag-row">
                            <NuxtLink
                                v-for="tag in post.tags"
                                :key="tag.id"
                                :to="`/?tag=${encodeURIComponent(tag.slug)}`"
                                class="tag-chip"
                            >
                                {{ tag.name }}
                            </NuxtLink>
                        </div>

                        <NuxtLink :to="`/posts/${post.slug}`">Read more</NuxtLink>
                    </article>

                    <p v-if="posts.length === 0" class="empty-state">No published posts match these filters.</p>
                </section>

                <footer class="pagination-row">
                    <NuxtLink v-if="previousHref" :to="previousHref">← Previous</NuxtLink>
                    <span v-else class="muted">← Previous</span>

                    <span>
                        Showing {{ posts.length === 0 ? 0 : offset + 1 }}-{{ offset + posts.length }} of
                        {{ totalCount }}
                    </span>

                    <NuxtLink v-if="nextHref" :to="nextHref">Next →</NuxtLink>
                    <span v-else class="muted">Next →</span>
                </footer>
            </div>

            <aside class="composer-panel">
                <PostComposer :authors="authors" :tags="tags" />
            </aside>
        </section>
    </main>
</template>

<style scoped>
.page-shell {
    max-width: 72rem;
    margin: 0 auto;
    padding: 3rem 1.5rem 4rem;
    font-family: system-ui, sans-serif;
}

.hero {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 1.5rem;
    align-items: end;
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

.hero-stats {
    display: flex;
    gap: 1rem;
}

.hero-stats div {
    display: grid;
    gap: 0.15rem;
    padding: 0.9rem 1rem;
    border: 1px solid #e5e7eb;
    border-radius: 0.85rem;
    background: #ffffff;
}

.hero-stats strong {
    font-size: 1.25rem;
}

.hero-stats span,
.muted,
.empty-state,
.post-meta,
.pagination-row {
    color: #6b7280;
}

.layout-grid {
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(18rem, 24rem);
    gap: 1.5rem;
    align-items: start;
}

.search-form {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 12rem auto;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
}

.search-form label {
    display: grid;
    gap: 0.35rem;
    font-size: 0.95rem;
}

.search-form input,
.search-form select {
    min-width: 0;
    padding: 0.85rem 1rem;
    border: 1px solid #d1d5db;
    border-radius: 0.75rem;
}

.search-form button {
    align-self: end;
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

.post-card a,
.pagination-row a {
    color: #8c2f39;
    text-decoration: none;
    font-weight: 600;
}

.post-meta {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    font-size: 0.9rem;
}

.tag-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 0.85rem;
}

.tag-chip {
    padding: 0.35rem 0.65rem;
    border-radius: 999px;
    background: #f3f4f6;
}

.composer-panel {
    position: sticky;
    top: 1.5rem;
}

.pagination-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    margin-top: 2rem;
}

@media (max-width: 900px) {
    .hero,
    .layout-grid {
        grid-template-columns: 1fr;
    }

    .search-form {
        grid-template-columns: 1fr;
    }

    .composer-panel {
        position: static;
    }

    .pagination-row {
        flex-direction: column;
        align-items: flex-start;
    }
}
</style>
