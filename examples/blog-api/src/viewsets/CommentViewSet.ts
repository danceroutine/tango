import { FilterSet, ModelViewSet } from '@danceroutine/tango-resources';
import type { Comment } from '../models/index';
import { CommentSerializer } from '../serializers/index';
/**
 * Viewset for the comment resource.
 *
 * A viewset gives the example one place to describe how comments behave as an
 * HTTP resource. The serializer defines the edge contract, while the model-backed
 * manager and the list-query features stay part of the same resource definition.
 */
export class CommentViewSet extends ModelViewSet<Comment, typeof CommentSerializer> {
    constructor() {
        super({
            serializer: CommentSerializer,
            filters: FilterSet.define<Comment>({
                fields: {
                    postId: true,
                    authorId: true,
                },
                aliases: {
                    q: { fields: ['content'], lookup: 'icontains' },
                },
            }),
            orderingFields: ['id', 'createdAt'],
            searchFields: ['content'],
        });
    }
}
