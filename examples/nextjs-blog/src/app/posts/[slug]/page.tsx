import { PostModel } from '@/lib/models';
import { notFound } from 'next/navigation';

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const post = await PostModel.objects
        .query()
        .filter({ slug })
        .selectRelated('author')
        .prefetchRelated('comments__author')
        .fetchOne();

    if (!post || !post.published) {
        notFound();
    }

    return (
        <main className="container mx-auto px-4 py-8 max-w-3xl">
            <article>
                <header className="mb-8">
                    <a href="/" className="text-blue-600 hover:underline">
                        ← Back to all posts
                    </a>
                    <h1 className="mt-4 text-4xl font-bold mb-2">{post.title}</h1>
                    <div className="flex flex-wrap gap-4 text-gray-500">
                        <time>
                            {new Date(post.createdAt).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                            })}
                        </time>
                        <span>By {post.author?.username ?? 'Unknown author'}</span>
                        <span>{post.comments.length} comments</span>
                    </div>
                </header>

                <div className="prose prose-lg max-w-none">
                    {post.content.split('\n').map((paragraph: string, idx: number) => (
                        <p key={idx}>{paragraph}</p>
                    ))}
                </div>
            </article>

            <section className="mt-12 border-t pt-8">
                <h2 className="mb-4 text-2xl font-semibold">Discussion</h2>
                {post.comments.length === 0 ? (
                    <p className="text-gray-500">No comments yet.</p>
                ) : (
                    <div className="space-y-4">
                        {post.comments.map((comment) => (
                            <article key={comment.id} className="rounded-lg border p-4">
                                <div className="mb-2 flex flex-wrap gap-3 text-sm text-gray-500">
                                    <span>{comment.author?.username ?? 'Unknown reader'}</span>
                                    <time>{new Date(comment.createdAt).toLocaleDateString()}</time>
                                </div>
                                <p>{comment.content}</p>
                            </article>
                        ))}
                    </div>
                )}
            </section>
        </main>
    );
}
