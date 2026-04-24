import type { z } from 'zod';
import type { MaterializedModelRecord } from '@danceroutine/tango-orm';
import { ModelSerializer, relation } from '@danceroutine/tango-resources';
import {
    PostCreateSchema,
    PostModel,
    PostReadSchema,
    PostTagSummarySchema,
    TagModel,
    type Post,
    type PostResource,
} from '~~/lib/models';

function omitUndefined<T extends Record<string, unknown>>(input: T): Partial<T> {
    return Object.fromEntries(
        Object.entries(input).filter(([, value]) => value !== undefined)
    ) as Partial<T>;
}

export class PostSerializer extends ModelSerializer<
    Post,
    typeof PostCreateSchema,
    ReturnType<typeof PostCreateSchema.partial>,
    typeof PostReadSchema,
    MaterializedModelRecord<typeof PostModel.schema>
> {
    static override readonly model = PostModel;
    static override readonly createSchema = PostCreateSchema;
    static override readonly updateSchema = PostCreateSchema.partial();
    static override readonly outputSchema = PostReadSchema;
    static override readonly relationFields = {
        tags: relation.manyToMany({
            read: relation.nested(PostTagSummarySchema),
            write: relation.slugList({
                model: TagModel,
                lookupField: 'slug',
                createIfMissing: true,
                buildCreateInput: (slug: string) => ({
                    name: slug,
                    slug,
                }),
            }),
        }),
    };

    protected override async beforeCreate(input: z.output<typeof PostCreateSchema>): Promise<Partial<Post>> {
        return {
            title: input.title,
            slug: input.slug,
            content: input.content,
            excerpt: input.excerpt,
            authorId: input.authorId,
            published: input.published,
        };
    }

    protected override async beforeUpdate(
        _id: Post[keyof Post],
        input: z.output<ReturnType<typeof PostCreateSchema.partial>>
    ): Promise<Partial<Post>> {
        return omitUndefined({
            title: input.title,
            slug: input.slug,
            content: input.content,
            excerpt: input.excerpt,
            authorId: input.authorId,
            published: input.published,
        });
    }
}

export type { PostResource };
