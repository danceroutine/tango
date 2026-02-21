import { ModelSerializer } from '@danceroutine/tango-resources';
import { PostCreateSchema, PostModel, PostReadSchema, type Post } from '@/lib/models';

export class PostSerializer extends ModelSerializer<
    Post,
    typeof PostCreateSchema,
    ReturnType<typeof PostCreateSchema.partial>,
    typeof PostReadSchema
> {
    static readonly model = PostModel;
    static readonly createSchema = PostCreateSchema;
    static readonly updateSchema = PostCreateSchema.partial();
    static readonly outputSchema = PostReadSchema;
}
