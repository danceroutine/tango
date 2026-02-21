import { PostModel, type Post } from '@/lib/models';

/**
 * Seed the example SQLite database with many posts for pagination demos.
 */
export async function seedPosts(count = 1000): Promise<void> {
    const existing = await PostModel.objects.query().count();
    if (existing >= count) {
        console.log(`[nextjs-blog bootstrap] Skipped; already have ${existing} posts.`);
        return;
    }

    const rows: Array<Partial<Post>> = [];
    const now = Date.now();
    for (let index = existing; index < count; index += 1) {
        const createdAt = new Date(now - index * 90_000).toISOString();
        rows.push({
            title: `Tango Blog Post #${index + 1}`,
            slug: `tango-blog-post-${index + 1}`,
            content: `Post ${index + 1}. Lorem ipsum dolor sit amet, consectetur adipiscing elit.`,
            excerpt: `Example seeded post #${index + 1}.`,
            published: index % 6 !== 0,
            createdAt,
            updatedAt: createdAt,
        });
    }

    const batchSize = 100;
    for (let index = 0; index < rows.length; index += batchSize) {
        await PostModel.objects.bulkCreate(rows.slice(index, index + batchSize));
    }

    console.log(`[nextjs-blog bootstrap] Seeded ${rows.length} posts (target total: ${count}).`);
}

/**
 * Populate the Next.js example SQLite database.
 */
async function main(): Promise<void> {
    const count = Number(process.env.SEED_POSTS_COUNT || '1000');
    await seedPosts(Number.isFinite(count) ? count : 1000);
}

// oxlint-disable-next-line unicorn/prefer-top-level-await
main().catch((error: unknown) => {
    console.error('[nextjs-blog bootstrap] Failed:', error);
    process.exit(1);
});
