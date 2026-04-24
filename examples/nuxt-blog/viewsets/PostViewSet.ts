import { FilterSet, ModelViewSet } from '@danceroutine/tango-resources';
import type { RequestContext } from '@danceroutine/tango-resources';
import { TangoResponse } from '@danceroutine/tango-core';
import { PostModel, type Post } from '~~/lib/models';
import { PostSerializer } from '~~/serializers';

export class PostViewSet extends ModelViewSet<Post, typeof PostSerializer> {
    static override readonly actions = ModelViewSet.defineViewSetActions([
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
                    slug: true,
                    tags__slug: true,
                },
                aliases: {
                    q: { fields: ['title', 'content', 'tags__name'], lookup: 'icontains' },
                },
            }),
            orderingFields: ['id', 'createdAt', 'updatedAt', 'title'],
            searchFields: ['title', 'content', 'tags__name'],
        });
    }

    async publish(_ctx: RequestContext, id: string): Promise<TangoResponse> {
        const updated = await PostModel.objects.update(Number(id), {
            published: true,
        } as Partial<Post>);

        return TangoResponse.json(await this.getSerializer().serialize(updated));
    }
}
