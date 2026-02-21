import { CommentModel, PostModel, type Post, type User, UserModel } from '../src/models/index';
/**
 * Word banks used to generate deterministic-but-varied post titles.
 *
 * The seed output is intentionally simple and predictable so developers can
 * quickly verify filtering, ordering, and pagination behavior.
 */
const ADJECTIVES = ['Silent', 'Rapid', 'Modern', 'Robust', 'Elegant', 'Pragmatic', 'Focused', 'Typed'];
const NOUNS = ['API', 'Manager', 'Query', 'Migration', 'ViewSet', 'Schema', 'Adapter', 'Paginator'];

/**
 * Build a repeatable lorem paragraph for a seeded row index.
 */
function loremParagraph(seed: number): string {
    return `Post ${seed}: Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer posuere erat a ante venenatis dapibus posuere velit aliquet. Sed posuere consectetur est at lobortis.`;
}

/**
 * Build a readable title from the seed index.
 */
function postTitle(index: number): string {
    const adjective = ADJECTIVES[index % ADJECTIVES.length];
    const noun = NOUNS[index % NOUNS.length];
    return `${adjective} ${noun} Patterns #${index + 1}`;
}

/**
 * Seed users and posts through the model manager API.
 */
export async function seedExampleData(count = 1000): Promise<void> {
    const existingUsers = await UserModel.objects.query().count();
    if (!existingUsers) {
        const users: Array<Partial<User>> = Array.from({ length: 10 }).map((_, index) => ({
            email: `author${index + 1}@example.com`,
            username: `author_${index + 1}`,
        }));
        await UserModel.objects.bulkCreate(users);
    }

    const existingPosts = await PostModel.objects.query().count();
    if (existingPosts >= count) {
        console.log(`[bootstrap] Skipped; already have ${existingPosts} posts.`);
        return;
    }

    const now = Date.now();
    const toCreate = count - existingPosts;
    const rows: Array<Partial<Post>> = Array.from({ length: toCreate }).map((_, index) => {
        const position = existingPosts + index;
        const date = new Date(now - position * 60_000).toISOString();
        return {
            title: postTitle(position),
            content: loremParagraph(position),
            authorId: (position % 10) + 1,
            published: position % 5 !== 0,
            createdAt: date,
            updatedAt: date,
        };
    });

    const batchSize = 100;
    for (let index = 0; index < rows.length; index += batchSize) {
        await PostModel.objects.bulkCreate(rows.slice(index, index + batchSize));
    }

    const existingComments = await CommentModel.objects.query().count();
    if (!existingComments) {
        await CommentModel.objects.bulkCreate(
            Array.from({ length: 50 }).map((_, index) => ({
                content: `Comment ${index + 1}: ${loremParagraph(index)}`,
                postId: (index % Math.max(count, 1)) + 1,
                authorId: (index % 10) + 1,
                createdAt: new Date(now - index * 30_000).toISOString(),
            }))
        );
    }

    console.log(`[bootstrap] Seeded ${toCreate} posts (target total: ${count}).`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const count = Number(process.env.SEED_POSTS_COUNT || '1000');
    // oxlint-disable-next-line unicorn/prefer-top-level-await
    seedExampleData(Number.isFinite(count) ? count : 1000).catch((error: unknown) => {
        console.error('[bootstrap] Failed:', error);
        process.exit(1);
    });
}
