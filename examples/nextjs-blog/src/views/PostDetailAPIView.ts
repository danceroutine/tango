import { RetrieveUpdateDestroyAPIView } from '@danceroutine/tango-resources';
import { type Post } from '@/lib/models';
import { PostSerializer } from '@/serializers';

/**
 * GenericAPIView example for detail retrieve/update/delete flows.
 */
export class PostDetailAPIView extends RetrieveUpdateDestroyAPIView<Post, typeof PostSerializer> {
    constructor() {
        super({
            serializer: PostSerializer,
        });
    }
}
