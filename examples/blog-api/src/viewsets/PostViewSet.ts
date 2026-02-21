import { FilterSet, ModelViewSet, type RequestContext } from '@danceroutine/tango-resources';
import { PostModel, type Post } from '../models/index';
import { PostSerializer } from '../serializers/index';

/**
 * Viewset for the post resource.
 *
 * This class is a good example of how Tango turns model-manager behavior into an
 * HTTP-facing resource. The serializer owns the external contract and the
 * viewset gathers the route-level behavior in one place.
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
                    authorId: true,
                    published: true,
                },
                aliases: {
                    q: { fields: ['title', 'content'], lookup: 'icontains' },
                    created_after: { field: 'createdAt', lookup: 'gte' },
                    created_before: { field: 'createdAt', lookup: 'lte' },
                },
            }),
            orderingFields: ['id', 'createdAt', 'updatedAt', 'title'],
            searchFields: ['title', 'content'],
        });
    }

    /**
     * Example custom detail action for publishing a post.
     */
    async publish(_ctx: RequestContext, id: string): Promise<Post> {
        const updated = await PostModel.objects.update(Number(id), {
            published: true,
        } as Partial<Post>);

        return this.getSerializer().toRepresentation(updated);
    }
}
