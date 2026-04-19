import { describe, expect, it, vi } from 'vitest';
import type { TangoResponse } from '@danceroutine/tango-core';
import { z } from 'zod';
import { CreateAPIView } from '../generics/CreateAPIView';
import { ListAPIView } from '../generics/ListAPIView';
import { RetrieveDestroyAPIView } from '../generics/RetrieveDestroyAPIView';
import { RetrieveAPIView } from '../generics/RetrieveAPIView';
import { RetrieveUpdateAPIView } from '../generics/RetrieveUpdateAPIView';
import { RetrieveUpdateDestroyAPIView } from '../generics/RetrieveUpdateDestroyAPIView';
import { RequestContext } from '../../context/index';
import { ModelSerializer } from '../../serializer/index';
import { aManager, aQueryResult, aQuerySet, aRequestContext } from '@danceroutine/tango-testing';
import type { ResourceModelLike } from '../../resource/index';

type UserRecord = {
    id: number;
    email: string;
    name: string;
};

const userReadSchema = z.object({
    id: z.number(),
    email: z.string().email(),
    name: z.string(),
});

const userWriteSchema = z.object({
    email: z.string().email(),
    name: z.string(),
});

let currentUserModel: ResourceModelLike<UserRecord>;

class UserSerializer extends ModelSerializer<
    UserRecord,
    typeof userWriteSchema,
    ReturnType<typeof userWriteSchema.partial>,
    typeof userReadSchema
> {
    static readonly model = undefined as unknown as ResourceModelLike<UserRecord>;
    static readonly createSchema = userWriteSchema;
    static readonly updateSchema = userWriteSchema.partial();
    static readonly outputSchema = userReadSchema;

    override getModel(): ResourceModelLike<UserRecord> {
        return currentUserModel;
    }
}

class CreateUserView extends CreateAPIView<UserRecord, typeof UserSerializer> {}
class ListUserView extends ListAPIView<UserRecord, typeof UserSerializer> {}
class RetrieveUserView extends RetrieveAPIView<UserRecord, typeof UserSerializer> {}
class RetrieveUpdateUserView extends RetrieveUpdateAPIView<UserRecord, typeof UserSerializer> {}
class RetrieveUpdateDestroyUserView extends RetrieveUpdateDestroyAPIView<UserRecord, typeof UserSerializer> {}
class RetrieveDestroyUserView extends RetrieveDestroyAPIView<UserRecord, typeof UserSerializer> {
    runDelete(ctx: RequestContext): Promise<TangoResponse> {
        return this.delete(ctx);
    }
}

function aResourcesRequestContext(method: string, url: string, body?: unknown): RequestContext;
function aResourcesRequestContext(options?: {
    method?: string;
    url?: string;
    body?: unknown;
    params?: Record<string, string>;
}): RequestContext;
function aResourcesRequestContext(
    optionsOrMethod:
        | {
              method?: string;
              url?: string;
              body?: unknown;
              params?: Record<string, string>;
          }
        | string = {},
    urlArg?: string,
    bodyArg?: unknown
): RequestContext {
    if (typeof optionsOrMethod === 'string') {
        return aRequestContext({
            method: optionsOrMethod,
            url: urlArg,
            body: bodyArg,
            contextFactory: RequestContext.create,
        });
    }

    return aRequestContext({
        ...optionsOrMethod,
        contextFactory: RequestContext.create,
    });
}

describe('Generic class wrappers', () => {
    it('apply the generic wrappers to each supported view type', async () => {
        const querySetDouble = aQuerySet<UserRecord>();

        vi.mocked(querySetDouble.fetch).mockResolvedValue(
            aQueryResult({
                items: [{ id: 1, email: 'a@example.com', name: 'A' }],
            })
        );
        vi.mocked(querySetDouble.fetchOne).mockResolvedValue({ id: 1, email: 'a@example.com', name: 'A' });
        vi.mocked(querySetDouble.count).mockResolvedValue(1);

        currentUserModel = {
            objects: aManager<UserRecord>({
                meta: { table: 'users', pk: 'id', columns: { id: 'int', email: 'text', name: 'text' } },
                query: vi.fn(() => querySetDouble),
                create: vi.fn(async (input) => ({ id: 2, ...input }) as UserRecord),
                update: vi.fn(async (_id, patch) => ({ id: 1, email: 'a@example.com', name: 'A', ...patch })),
            }),
        };

        const createView = new CreateUserView({ serializer: UserSerializer });
        const createResponse = await createView.dispatch(
            aResourcesRequestContext('POST', 'https://example.test/users', { email: 'b@example.com', name: 'B' })
        );
        expect(createResponse.status).toBe(201);

        const listView = new ListUserView({ serializer: UserSerializer });
        const listResponse = await listView.dispatch(aResourcesRequestContext('GET', 'https://example.test/users'));
        expect(listResponse.status).toBe(200);

        const retrieveView = new RetrieveUserView({ serializer: UserSerializer });
        const retrieveCtx = aResourcesRequestContext('GET', 'https://example.test/users/1');
        retrieveCtx.params = { id: '1' };
        const retrieveResponse = await retrieveView.dispatch(retrieveCtx);
        expect(retrieveResponse.status).toBe(200);

        const retrieveUpdateView = new RetrieveUpdateUserView({ serializer: UserSerializer });
        const retrieveUpdateGetCtx = aResourcesRequestContext('GET', 'https://example.test/users/1');
        retrieveUpdateGetCtx.params = { id: '1' };
        const retrieveUpdateGetResponse = await retrieveUpdateView.dispatch(retrieveUpdateGetCtx);
        expect(retrieveUpdateGetResponse.status).toBe(200);

        const patchCtx = aResourcesRequestContext('PATCH', 'https://example.test/users/1', { name: 'Updated Again' });
        patchCtx.params = { id: '1' };
        const patchResponse = await retrieveUpdateView.dispatch(patchCtx);
        expect(patchResponse.status).toBe(200);

        const putCtx = aResourcesRequestContext('PUT', 'https://example.test/users/1', { name: 'Put Update' });
        putCtx.params = { id: '1' };
        const putResponse = await retrieveUpdateView.dispatch(putCtx);
        expect(putResponse.status).toBe(200);

        const retrieveUpdateDestroyView = new RetrieveUpdateDestroyUserView({ serializer: UserSerializer });
        const detailRetrieveCtx = aResourcesRequestContext('GET', 'https://example.test/users/1');
        detailRetrieveCtx.params = { id: '1' };
        const detailRetrieveResponse = await retrieveUpdateDestroyView.dispatch(detailRetrieveCtx);
        expect(detailRetrieveResponse.status).toBe(200);

        const detailPatchCtx = aResourcesRequestContext('PATCH', 'https://example.test/users/1', { name: 'Patched' });
        detailPatchCtx.params = { id: '1' };
        const detailPatchResponse = await retrieveUpdateDestroyView.dispatch(detailPatchCtx);
        expect(detailPatchResponse.status).toBe(200);

        const detailPutCtx = aResourcesRequestContext('PUT', 'https://example.test/users/1', { name: 'Put Patched' });
        detailPutCtx.params = { id: '1' };
        const detailPutResponse = await retrieveUpdateDestroyView.dispatch(detailPutCtx);
        expect(detailPutResponse.status).toBe(200);

        const detailDeleteCtx = aResourcesRequestContext('DELETE', 'https://example.test/users/1');
        detailDeleteCtx.params = { id: '1' };
        const detailDeleteResponse = await retrieveUpdateDestroyView.dispatch(detailDeleteCtx);
        expect(detailDeleteResponse.status).toBe(204);

        const retrieveDestroyView = new RetrieveDestroyUserView({ serializer: UserSerializer });
        const destroyGetCtx = aResourcesRequestContext('GET', 'https://example.test/users/1');
        destroyGetCtx.params = { id: '1' };
        const destroyGetResponse = await retrieveDestroyView.dispatch(destroyGetCtx);
        expect(destroyGetResponse.status).toBe(200);

        const destroyDeleteCtx = aResourcesRequestContext('DELETE', 'https://example.test/users/1');
        destroyDeleteCtx.params = { id: '1' };
        const destroyDeleteResponse = await retrieveDestroyView.dispatch(destroyDeleteCtx);
        expect(destroyDeleteResponse.status).toBe(204);

        const directDeleteCtx = aResourcesRequestContext('DELETE', 'https://example.test/users/1');
        directDeleteCtx.params = { id: '1' };
        const directDeleteResponse = await retrieveDestroyView.runDelete(directDeleteCtx);
        expect(directDeleteResponse.status).toBe(204);
    });
});
