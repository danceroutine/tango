<script setup lang="ts">
import { PostModel, PostReadSchema } from '~~/lib/models';

const route = useRoute();
const slugParam = route.params.slug;
const slug = Array.isArray(slugParam) ? String(slugParam[0] ?? '') : String(slugParam);
const post = await PostModel.objects.query().filter({ slug }).fetchOne(PostReadSchema);

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
                <time>{{
                    new Date(post.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                    })
                }}</time>
            </header>

            <div class="content">
                <p v-for="(paragraph, index) in post.content.split('\n')" :key="index">{{ paragraph }}</p>
            </div>
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

.post-detail time {
    color: #6b7280;
}

.content {
    line-height: 1.8;
    color: #1f2937;
}
</style>
