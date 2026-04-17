<script setup lang="ts">
import { PostModel } from '~~/lib/models';

const route = useRoute();
const slugParam = route.params.slug;
const slug = Array.isArray(slugParam) ? String(slugParam[0] ?? '') : String(slugParam);
const post = await PostModel.objects
    .query()
    .filter({ slug })
    .selectRelated('author')
    .prefetchRelated('comments__author')
    .fetchOne();

if (!post || !post.published) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' });
}
</script>

<template>
    <main class="page-shell">
        <article class="post-detail">
            <header>
                <NuxtLink to="/" class="back-link">← Back to all posts</NuxtLink>
                <h1>{{ post.title }}</h1>
                <div class="detail-meta">
                    <time>{{
                        new Date(post.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                        })
                    }}</time>
                    <span>By {{ post.author?.username ?? 'Unknown author' }}</span>
                    <span>{{ post.comments.length }} comments</span>
                </div>
            </header>

            <div class="content">
                <p v-for="(paragraph, index) in post.content.split('\n')" :key="index">{{ paragraph }}</p>
            </div>

            <section class="discussion">
                <h2>Discussion</h2>
                <p v-if="post.comments.length === 0" class="muted">No comments yet.</p>
                <article v-for="comment in post.comments" :key="comment.id" class="comment-card">
                    <div class="comment-meta">
                        <span>{{ comment.author?.username ?? 'Unknown reader' }}</span>
                        <time>{{ new Date(comment.createdAt).toLocaleDateString() }}</time>
                    </div>
                    <p>{{ comment.content }}</p>
                </article>
            </section>
        </article>
    </main>
</template>

<style scoped>
.page-shell {
    max-width: 56rem;
    margin: 0 auto;
    padding: 3rem 1.5rem 4rem;
    font-family: system-ui, sans-serif;
}

.post-detail header {
    margin-bottom: 2rem;
}

.back-link {
    display: inline-block;
    margin-bottom: 1rem;
    color: #8c2f39;
    text-decoration: none;
    font-weight: 600;
}

.post-detail h1 {
    font-size: clamp(2.25rem, 5vw, 3.5rem);
    margin: 0 0 0.5rem;
}

.detail-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    color: #6b7280;
}

.post-detail time {
    color: #6b7280;
}

.content {
    line-height: 1.8;
    color: #1f2937;
}

.discussion {
    margin-top: 3rem;
    padding-top: 2rem;
    border-top: 1px solid #e5e7eb;
}

.discussion h2 {
    margin-bottom: 1rem;
}

.comment-card {
    border: 1px solid #e5e7eb;
    border-radius: 0.85rem;
    padding: 1rem;
    background: #ffffff;
}

.comment-card + .comment-card {
    margin-top: 1rem;
}

.comment-meta,
.muted {
    color: #6b7280;
}

.comment-meta {
    display: flex;
    gap: 1rem;
    margin-bottom: 0.5rem;
    font-size: 0.9rem;
}
</style>
