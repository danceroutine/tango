import { ModelSerializer } from '@danceroutine/tango-resources';
import { PostCreateSchema, PostModel, PostReadSchema, type Post } from '~~/lib/models';

export class PostSerializer extends ModelSerializer<
    Post,
    typeof PostCreateSchema,
    ReturnType<typeof PostCreateSchema.partial>,
    typeof PostReadSchema
> {
    static override readonly model = PostModel;
    static override readonly createSchema = PostCreateSchema;
    static override readonly updateSchema = PostCreateSchema.partial();
    static override readonly outputSchema = PostReadSchema;
}
