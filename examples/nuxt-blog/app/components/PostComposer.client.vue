<script setup lang="ts">
import { slugify } from '~~/lib/slugify';

type AuthorOption = {
    id: number;
    username: string;
};

type TagOption = {
    id: number;
    name: string;
    slug: string;
};

const props = defineProps<{
    authors: readonly AuthorOption[];
    tags: readonly TagOption[];
}>();

const title = ref('');
const excerpt = ref('');
const content = ref('');
const authorId = ref(String(props.authors[0]?.id ?? ''));
const published = ref(true);
const tagInput = ref('');
const pending = ref(false);
const errorMessage = ref<string | null>(null);

const suggestedTags = computed(() => props.tags.slice(0, 8));

function normalizeTagSlugs(raw: string): string[] {
    return [
        ...new Set(
            raw
                .split(',')
                .map((value) => slugify(value.trim()))
                .filter(Boolean)
        ),
    ];
}

async function submit(): Promise<void> {
    pending.value = true;
    errorMessage.value = null;

    try {
        await $fetch('/api/posts', {
            method: 'POST',
            body: {
                title: title.value,
                excerpt: excerpt.value || undefined,
                content: content.value,
                authorId: Number(authorId.value),
                published: published.value,
                tags: normalizeTagSlugs(tagInput.value),
            },
        });
        await reloadNuxtApp({ path: '/' });
    } catch (error) {
        errorMessage.value = error instanceof Error ? error.message : 'Unable to create post.';
    } finally {
        pending.value = false;
    }
}
</script>

<template>
    <section class="composer">
        <div>
            <p class="composer-eyebrow">Client-side form</p>
            <h2>Create a tagged post</h2>
            <p class="composer-copy">
                This form lives in a `.client.vue` component, while the page data stays in the `.server.vue` page.
            </p>
        </div>

        <form class="compose-form" @submit.prevent="submit">
            <label>
                Title
                <input v-model="title" type="text" maxlength="200" required />
            </label>

            <label>
                Excerpt
                <textarea v-model="excerpt" rows="3" maxlength="280"></textarea>
            </label>

            <label>
                Content
                <textarea v-model="content" rows="8" required></textarea>
            </label>

            <label>
                Author
                <select v-model="authorId" required>
                    <option v-for="author in authors" :key="author.id" :value="String(author.id)">
                        {{ author.username }}
                    </option>
                </select>
            </label>

            <label>
                Tags
                <input v-model="tagInput" type="text" placeholder="tango, nuxt, orm" />
            </label>

            <p class="suggestions">
                Suggestions:
                <span v-for="tag in suggestedTags" :key="tag.id">{{ tag.slug }}</span>
            </p>

            <label class="checkbox-row">
                <input v-model="published" type="checkbox" />
                Publish immediately
            </label>

            <button type="submit" :disabled="pending">{{ pending ? 'Publishing…' : 'Publish post' }}</button>
            <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
        </form>
    </section>
</template>

<style scoped>
.composer {
    display: grid;
    gap: 1rem;
    padding: 1.25rem;
    border: 1px solid #e5e7eb;
    border-radius: 1rem;
    background: #ffffff;
}

.composer-eyebrow {
    margin: 0 0 0.35rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 0.75rem;
    color: #8c2f39;
}

.composer h2 {
    margin: 0;
}

.composer-copy {
    margin: 0.35rem 0 0;
    color: #4b5563;
}

.compose-form {
    display: grid;
    gap: 0.85rem;
}

.compose-form label {
    display: grid;
    gap: 0.35rem;
    font-size: 0.95rem;
}

.compose-form input,
.compose-form select,
.compose-form textarea {
    min-width: 0;
    padding: 0.8rem 0.9rem;
    border: 1px solid #d1d5db;
    border-radius: 0.75rem;
    font: inherit;
}

.checkbox-row {
    grid-template-columns: auto 1fr;
    align-items: center;
}

.suggestions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    color: #6b7280;
    font-size: 0.9rem;
}

.suggestions span {
    padding: 0.2rem 0.45rem;
    border-radius: 999px;
    background: #f3f4f6;
}

button {
    padding: 0.85rem 1rem;
    border: none;
    border-radius: 0.75rem;
    background: #111827;
    color: #ffffff;
    font-weight: 600;
}

button:disabled {
    opacity: 0.7;
}

.error {
    margin: 0;
    color: #b91c1c;
}
</style>
