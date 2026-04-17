import { TangoResponse } from '@danceroutine/tango-core';
import { APIView, type RequestContext } from '@danceroutine/tango-resources';
import { z } from 'zod';
import { CommentReadSchema, PostModel, PostReadSchema, UserModel, UserReadSchema } from '../models/index';

const UserHydrationSchema = UserReadSchema;
const CommentHydrationSchema = CommentReadSchema.extend({
    author: UserHydrationSchema.nullable(),
});
const PostHydrationSchema = PostReadSchema.extend({
    author: UserHydrationSchema.nullable(),
    comments: z.array(CommentHydrationSchema),
});

export const EditorialOverviewResponseSchema = z.object({
    authorsWithRecentPosts: z.array(
        UserReadSchema.extend({
            posts: z.array(PostHydrationSchema),
        })
    ),
    recentPostsWithDiscussion: z.array(PostHydrationSchema),
});

/**
 * Read-only endpoint that exposes nested relation hydration through an
 * editorial-style overview response.
 */
export class EditorialOverviewAPIView extends APIView {
    protected override async get(ctx: RequestContext): Promise<TangoResponse> {
        const requestedLimit = Number(ctx.request.queryParams.get('limit') ?? '3');
        const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 10) : 3;

        const [authorsWithRecentPosts, recentPostsWithDiscussion] = await Promise.all([
            UserModel.objects
                .query()
                .orderBy('id')
                .limit(limit)
                .prefetchRelated('posts__author', 'posts__comments__author')
                .fetch(),
            PostModel.objects
                .query()
                .orderBy('id')
                .limit(limit)
                .selectRelated('author')
                .prefetchRelated('comments__author')
                .fetch(),
        ]);

        return TangoResponse.json(
            EditorialOverviewResponseSchema.parse({
                authorsWithRecentPosts: [...authorsWithRecentPosts],
                recentPostsWithDiscussion: [...recentPostsWithDiscussion],
            })
        );
    }
}
