import { ModelSerializer } from '@danceroutine/tango-resources';
import {
    CommentCreateSchema,
    CommentModel,
    CommentReadSchema,
    CommentUpdateSchema,
    type Comment,
} from '../models/index';

export class CommentSerializer extends ModelSerializer<
    Comment,
    typeof CommentCreateSchema,
    typeof CommentUpdateSchema,
    typeof CommentReadSchema
> {
    static readonly model = CommentModel;
    static readonly createSchema = CommentCreateSchema;
    static readonly updateSchema = CommentUpdateSchema;
    static readonly outputSchema = CommentReadSchema;
}
