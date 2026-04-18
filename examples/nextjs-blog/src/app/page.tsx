import { TangoQueryParams } from '@danceroutine/tango-core';
import { OffsetPaginator } from '@danceroutine/tango-resources';
import { Q, type FilterInput } from '@danceroutine/tango-orm';
import { PostModel, type Post } from '@/lib/models';

export default async function HomePage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const params = TangoQueryParams.fromRecord(await searchParams);
    const search = params.getSearch();

    let qs = PostModel.objects.all().orderBy('-createdAt').filter({ published: true });

    if (search) {
        const searchFilters: FilterInput<Post>[] = [{ title__icontains: search }, { content__icontains: search }];
        qs = qs.filter(Q.or(...searchFilters));
    }

    const paginator = new OffsetPaginator(qs, 20);
    const { limit, offset } = paginator.parseParams(params);
    const [page, totalCount] = await Promise.all([paginator.apply(qs.selectRelated('author')).fetch(), qs.count()]);
    const pagination = paginator.toResponse(page, { totalCount, params });
    const previousHref = pagination.previous ?? undefined;
    const nextHref = pagination.next ?? undefined;

    return (
        <main className="container mx-auto px-4 py-8 max-w-4xl">
            <header className="mb-8">
                <h1 className="text-4xl font-bold mb-2">Blog Posts</h1>
                <p className="text-gray-600">
                    SQLite-backed example with search, pagination, and joined author hydration.
                </p>
            </header>

            <form method="GET" className="mb-8 flex gap-2">
                <input
                    type="text"
                    name="search"
                    defaultValue={search}
                    placeholder="Search title or content"
                    className="flex-1 border rounded px-3 py-2"
                />
                <input type="hidden" name="limit" value={String(limit)} />
                <button type="submit" className="bg-black text-white rounded px-4 py-2">
                    Search
                </button>
            </form>

            <div className="space-y-6">
                {page.length === 0 ? (
                    <p className="text-gray-500">No published posts yet.</p>
                ) : (
                    page.map((post) => (
                        <article key={post.id} className="border rounded-lg p-6 shadow-sm">
                            <div className="mb-3 flex items-center justify-between text-sm text-gray-500">
                                <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                                <span>By {post.author?.username ?? 'Unknown author'}</span>
                            </div>
                            <h2 className="text-2xl font-semibold mb-2">{post.title}</h2>
                            {post.excerpt && <p className="text-gray-600 mb-4">{post.excerpt}</p>}
                            <div className="flex justify-between items-center text-sm text-gray-500">
                                <span>{post.published ? 'Published' : 'Draft'}</span>
                                <a href={`/posts/${post.slug}`} className="text-blue-600 hover:underline">
                                    Read more →
                                </a>
                            </div>
                        </article>
                    ))
                )}
            </div>

            <footer className="mt-8 flex items-center justify-between text-sm">
                {previousHref ? (
                    <a href={previousHref}>← Previous</a>
                ) : (
                    <span className="text-gray-400">← Previous</span>
                )}

                <span>
                    Showing {page.length === 0 ? 0 : offset + 1}-{offset + page.length} of {totalCount}
                </span>

                {nextHref ? <a href={nextHref}>Next →</a> : <span className="text-gray-400">Next →</span>}
            </footer>
        </main>
    );
}
