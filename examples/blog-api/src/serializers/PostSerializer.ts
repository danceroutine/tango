import { ModelSerializer } from '@danceroutine/tango-resources';
import { PostCreateSchema, PostModel, PostReadSchema, PostUpdateSchema, type Post } from '../models/index';

export class PostSerializer extends ModelSerializer<
    Post,
    typeof PostCreateSchema,
    typeof PostUpdateSchema,
    typeof PostReadSchema
> {
    static readonly model = PostModel;
    static readonly createSchema = PostCreateSchema;
    static readonly updateSchema = PostUpdateSchema;
    static readonly outputSchema = PostReadSchema;
}
