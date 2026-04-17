import { CommentModel, PostModel, UserModel, type Comment, type Post, type User } from '@/lib/models';

async function ensureUsers(targetUserCount = 8): Promise<readonly User[]> {
    const existing = await UserModel.objects.query().count();
    if (existing < targetUserCount) {
        const rows: Array<Partial<User>> = [];
        for (let index = existing; index < targetUserCount; index += 1) {
            rows.push({
                email: `writer${index + 1}@example.com`,
                username: `writer${index + 1}`,
                createdAt: new Date(Date.now() - index * 86_400_000).toISOString(),
            });
        }
        await UserModel.objects.bulkCreate(rows);
    }

    return (await UserModel.objects.query().orderBy('id').fetch()).toArray();
}

async function ensurePosts(users: readonly User[], targetPostCount: number): Promise<readonly Post[]> {
    const existing = await PostModel.objects.query().count();
    if (existing < targetPostCount) {
        const rows: Array<Partial<Post>> = [];
        const now = Date.now();
        for (let index = existing; index < targetPostCount; index += 1) {
            const createdAt = new Date(now - index * 90_000).toISOString();
            const author = users[index % users.length]!;
            rows.push({
                title: `Tango Blog Post #${index + 1}`,
                slug: `tango-blog-post-${index + 1}`,
                content: `Post ${index + 1}. Lorem ipsum dolor sit amet, consectetur adipiscing elit.`,
                excerpt: `Example seeded post #${index + 1}.`,
                authorId: author.id,
                published: index % 6 !== 0,
                createdAt,
                updatedAt: createdAt,
            });
        }

        const batchSize = 100;
        for (let index = 0; index < rows.length; index += batchSize) {
            await PostModel.objects.bulkCreate(rows.slice(index, index + batchSize));
        }
    }

    return (await PostModel.objects.query().orderBy('id').fetch()).toArray();
}

async function ensureComments(users: readonly User[], posts: readonly Post[]): Promise<number> {
    const existing = await CommentModel.objects.query().count();
    if (existing > 0) {
        return existing;
    }

    const rows: Array<Partial<Comment>> = [];
    for (const [index, post] of posts.entries()) {
        if (typeof post.authorId !== 'number' || index % 2 !== 0) {
            continue;
        }

        rows.push({
            content: `Reader note on ${post.title}.`,
            postId: post.id,
            authorId: users[(index + 1) % users.length]!.id,
            createdAt: new Date(Date.now() - index * 45_000).toISOString(),
        });

        if (index % 3 === 0) {
            rows.push({
                content: `Follow-up discussion for ${post.title}.`,
                postId: post.id,
                authorId: users[(index + 2) % users.length]!.id,
                createdAt: new Date(Date.now() - index * 30_000).toISOString(),
            });
        }
    }

    const batchSize = 100;
    for (let index = 0; index < rows.length; index += batchSize) {
        await CommentModel.objects.bulkCreate(rows.slice(index, index + batchSize));
    }

    return rows.length;
}

export async function seedPosts(count = 1000): Promise<void> {
    const users = await ensureUsers();
    const posts = await ensurePosts(users, count);
    const createdComments = await ensureComments(users, posts);

    console.log(
        `[nextjs-blog bootstrap] Ready with ${users.length} users, ${posts.length} posts, and ${createdComments || (await CommentModel.objects.query().count())} comments.`
    );
}

async function main(): Promise<void> {
    const count = Number(process.env.SEED_POSTS_COUNT || '1000');
    await seedPosts(Number.isFinite(count) ? count : 1000);
}

main().catch((error: unknown) => {
    console.error('[nextjs-blog bootstrap] Failed:', error);
    process.exit(1);
});
