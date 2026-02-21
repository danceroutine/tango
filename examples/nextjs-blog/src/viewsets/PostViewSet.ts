import { FilterSet, ModelViewSet } from '@danceroutine/tango-resources';
import type { RequestContext } from '@danceroutine/tango-resources';
import { TangoResponse } from '@danceroutine/tango-core';
import { PostModel, type Post } from '@/lib/models';
import { PostSerializer } from '@/serializers';

/**
 * Viewset for posts in the Next.js example.
 *
 * This project uses Next.js route handlers as its host-framework entry point.
 * Within that structure, the viewset still groups the HTTP behavior for one
 * resource into a class. The adapter connects the class to the host framework,
 * the serializer owns the request and response contract, and the model owns
 * persistence through `objects`.
 */
export class PostViewSet extends ModelViewSet<Post, typeof PostSerializer> {
    static readonly actions = ModelViewSet.defineViewSetActions([
        {
            name: 'publish',
            scope: 'detail',
            methods: ['POST'],
            path: 'publish',
        },
    ]);

    constructor() {
        super({
            serializer: PostSerializer,
            filters: FilterSet.define<Post>({
                fields: {
                    published: true,
                },
                aliases: {
                    q: { fields: ['title', 'content'], lookup: 'icontains' },
                },
            }),
            orderingFields: ['id', 'createdAt', 'updatedAt', 'title'],
            searchFields: ['title', 'content'],
        });
    }

    /**
     * Example custom detail action for publishing a post.
     */
    async publish(_ctx: RequestContext, id: string): Promise<TangoResponse> {
        const updated = await PostModel.objects.update(Number(id), {
            published: true,
        } as Partial<Post>);

        return TangoResponse.json(this.getSerializer().toRepresentation(updated));
    }
}
