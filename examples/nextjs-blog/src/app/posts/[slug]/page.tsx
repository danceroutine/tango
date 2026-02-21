import { PostModel, PostReadSchema } from '@/lib/models';
import { notFound } from 'next/navigation';
/**
 * Server-rendered detail page that reads from the same Tango-backed manager
 * used by the API routes, which keeps page rendering and HTTP endpoints aligned.
 */
export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const post = await PostModel.objects.query().filter({ slug }).fetchOne(PostReadSchema);

    if (!post || !post.published) {
        notFound();
    }

    return (
        <main className="container mx-auto px-4 py-8 max-w-3xl">
            <article>
                <header className="mb-8">
                    <h1 className="text-4xl font-bold mb-2">{post.title}</h1>
                    <time className="text-gray-500">
                        {new Date(post.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                        })}
                    </time>
                </header>

                <div className="prose prose-lg max-w-none">
                    {post.content.split('\n').map((paragraph: string, idx: number) => (
                        <p key={idx}>{paragraph}</p>
                    ))}
                </div>
            </article>

            <footer className="mt-12 pt-8 border-t">
                <a href="/" className="text-blue-600 hover:underline">
                    ← Back to all posts
                </a>
            </footer>
        </main>
    );
}
