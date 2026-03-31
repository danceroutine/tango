import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { GenericAPIView } from '../GenericAPIView';
import { ListCreateAPIView } from '../generics/ListCreateAPIView';
import { RetrieveUpdateDestroyAPIView } from '../generics/RetrieveUpdateDestroyAPIView';
import { RequestContext } from '../../context/index';
import { FilterSet } from '../../filters/index';
import { CursorPaginator } from '../../paginators/CursorPaginator';
import { ModelSerializer } from '../../serializer/index';
import { aManager, aQuerySet, aRequestContext } from '@danceroutine/tango-testing';
import type { ManagerLike } from '@danceroutine/tango-orm';
import type { ResourceModelLike } from '../../resource/index';

type UserRecord = {
    id: number;
    email: string;
    name: string;
    active?: boolean;
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

class UserListCreateView extends ListCreateAPIView<UserRecord, typeof UserSerializer> {}

class UserDetailView extends RetrieveUpdateDestroyAPIView<UserRecord, typeof UserSerializer> {}

class HookProbeView extends GenericAPIView<UserRecord, typeof UserSerializer> {
    exposeHooks(ctx: RequestContext) {
        return {
            manager: this.getManager(),
            serializerClass: this.getSerializerClass(),
            serializer: this.getSerializer(),
            outputSchema: this.getOutputSchema(),
            createSchema: this.getCreateSchema(),
            updateSchema: this.getUpdateSchema(),
            lookupField: this.getLookupField(),
            lookupValue: this.getLookupValue(ctx),
        };
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

describe(GenericAPIView, () => {
    it('lists records and creates new ones for collection routes', async () => {
        const querySetDouble = aQuerySet<UserRecord>();
        vi.mocked(querySetDouble.fetch).mockResolvedValue({
            results: [{ id: 1, email: 'a@example.com', name: 'A' }],
            nextCursor: null,
        });
        vi.mocked(querySetDouble.count).mockResolvedValue(1);

        const manager = aManager<UserRecord>({
            meta: { table: 'users', pk: 'id', columns: { id: 'int', email: 'text', name: 'text' } },
            query: vi.fn(() => querySetDouble),
            create: vi.fn(async (input) => ({ id: 2, ...input }) as UserRecord),
        });
        currentUserModel = { objects: manager };

        const view = new UserListCreateView({
            serializer: UserSerializer,
            orderingFields: ['id', 'email', 'name'],
            searchFields: ['email', 'name'],
        });

        const listResponse = await view.dispatch(
            aResourcesRequestContext('GET', 'https://example.test/users?limit=20&offset=0&ordering=-name')
        );
        expect(listResponse.status).toBe(200);
        expect(vi.mocked(querySetDouble.orderBy)).toHaveBeenCalledWith('-name');

        const createResponse = await view.dispatch(
            aResourcesRequestContext('POST', 'https://example.test/users', {
                email: 'new@example.com',
                name: 'New User',
            })
        );
        const created = await createResponse.json();
        expect(createResponse.status).toBe(201);
        expect(created).toEqual({ id: 2, email: 'new@example.com', name: 'New User' });
    });

    it('handles search filters during list requests and normalizes list errors', async () => {
        const querySetDouble = aQuerySet<UserRecord>();
        vi.mocked(querySetDouble.fetch).mockRejectedValue(new Error('list failed'));

        currentUserModel = {
            objects: aManager<UserRecord>({
                meta: { table: 'users', pk: 'id', columns: { id: 'int', email: 'text', name: 'text' } },
                query: vi.fn(() => querySetDouble),
            }),
        };

        const view = new UserListCreateView({
            serializer: UserSerializer,
            searchFields: ['email', 'name'],
        });

        const response = await view.dispatch(
            aResourcesRequestContext('GET', 'https://example.test/users?search=user&limit=20&offset=0')
        );
        expect(response.status).toBe(500);
        expect(vi.mocked(querySetDouble.filter)).toHaveBeenCalled();
    });

    it('reads, updates, and deletes an existing record', async () => {
        const querySetDouble = aQuerySet<UserRecord>();
        vi.mocked(querySetDouble.fetchOne).mockResolvedValue({ id: 1, email: 'a@example.com', name: 'A' });

        const manager: ManagerLike<UserRecord> = aManager<UserRecord>({
            meta: { table: 'users', pk: 'id', columns: { id: 'int', email: 'text', name: 'text' } },
            query: vi.fn(() => querySetDouble),
            update: vi.fn(async (_id, patch) => ({ id: 1, email: 'a@example.com', name: 'A', ...patch })),
            delete: vi.fn(async () => {}),
        });
        currentUserModel = { objects: manager };

        const view = new UserDetailView({
            serializer: UserSerializer,
        });

        const retrieveCtx = aResourcesRequestContext('GET', 'https://example.test/users/1');
        retrieveCtx.params = { id: '1' };
        const retrieveResponse = await view.dispatch(retrieveCtx);
        expect(retrieveResponse.status).toBe(200);

        const patchCtx = aResourcesRequestContext('PATCH', 'https://example.test/users/1', { name: 'Updated' });
        patchCtx.params = { id: '1' };
        const patchResponse = await view.dispatch(patchCtx);
        expect(patchResponse.status).toBe(200);

        const deleteCtx = aResourcesRequestContext('DELETE', 'https://example.test/users/1');
        deleteCtx.params = { id: '1' };
        const deleteResponse = await view.dispatch(deleteCtx);
        expect(deleteResponse.status).toBe(204);
    });

    it('returns 404 when lookup exists but manager returns no row', async () => {
        const querySetDouble = aQuerySet<UserRecord>();
        vi.mocked(querySetDouble.fetchOne).mockResolvedValue(null);

        currentUserModel = {
            objects: aManager<UserRecord>({
                meta: { table: 'users', pk: 'id', columns: { id: 'int', email: 'text', name: 'text' } },
                query: vi.fn(() => querySetDouble),
            }),
        };

        const view = new UserDetailView({ serializer: UserSerializer });
        const retrieveCtx = aResourcesRequestContext('GET', 'https://example.test/users/111');
        retrieveCtx.params = { id: '111' };

        const response = await view.dispatch(retrieveCtx);
        expect(response.status).toBe(404);
    });

    it('returns 404 when retrieve requests do not provide the lookup param', async () => {
        currentUserModel = {
            objects: aManager<UserRecord>({
                meta: { table: 'users', pk: 'id', columns: { id: 'int', email: 'text', name: 'text' } },
            }),
        };

        const view = new UserDetailView({ serializer: UserSerializer });
        const response = await view.dispatch(aResourcesRequestContext('GET', 'https://example.test/users/1'));
        expect(response.status).toBe(404);
    });

    it('applies configured filters and supports custom paginator factories', async () => {
        const querySetDouble = aQuerySet<UserRecord>();
        vi.mocked(querySetDouble.fetch).mockResolvedValue({ results: [], nextCursor: null });
        vi.mocked(querySetDouble.count).mockResolvedValue(0);

        currentUserModel = {
            objects: aManager<UserRecord>({
                meta: { table: 'users', pk: 'id', columns: { id: 'int', email: 'text', name: 'text' } },
                query: vi.fn(() => querySetDouble),
            }),
            metadata: {
                name: 'User',
                fields: [{ name: 'active', type: 'bool' }],
            },
        };

        const view = new UserListCreateView({
            serializer: UserSerializer,
            filters: FilterSet.define<UserRecord>({
                fields: {
                    email: true,
                },
            }),
            paginatorFactory: (queryset) => new CursorPaginator(queryset),
        });

        const response = await view.dispatch(
            aResourcesRequestContext('GET', 'https://example.test/users?email=a@example.com')
        );
        expect(response.status).toBe(200);
        expect(vi.mocked(querySetDouble.filter)).toHaveBeenCalled();
    });

    it('coerces boolean query params from model metadata during list filters', async () => {
        const querySetDouble = aQuerySet<UserRecord>();
        vi.mocked(querySetDouble.fetch).mockResolvedValue({ results: [], nextCursor: null });
        vi.mocked(querySetDouble.count).mockResolvedValue(0);

        currentUserModel = {
            objects: aManager<UserRecord>({
                meta: { table: 'users', pk: 'id', columns: { id: 'int', email: 'text', name: 'text' } },
                query: vi.fn(() => querySetDouble),
            }),
            metadata: {
                name: 'User',
                fields: [{ name: 'active', type: 'bool' }],
            },
        };

        const view = new UserListCreateView({
            serializer: UserSerializer,
            filters: FilterSet.define<UserRecord>({
                fields: {
                    active: true,
                },
            }),
        });

        const response = await view.dispatch(aResourcesRequestContext('GET', 'https://example.test/users?active=true'));
        expect(response.status).toBe(200);
        expect(vi.mocked(querySetDouble.filter)).toHaveBeenCalledWith({
            kind: 'and',
            nodes: [{ kind: 'atom', where: { active: true } }],
        });
    });

    it('coerces numeric query params from model metadata during list filters', async () => {
        const querySetDouble = aQuerySet<UserRecord>();
        vi.mocked(querySetDouble.fetch).mockResolvedValue({ results: [], nextCursor: null });
        vi.mocked(querySetDouble.count).mockResolvedValue(0);

        currentUserModel = {
            objects: aManager<UserRecord>({
                meta: { table: 'users', pk: 'id', columns: { id: 'int', email: 'text', name: 'text' } },
                query: vi.fn(() => querySetDouble),
            }),
            metadata: {
                name: 'User',
                fields: [{ name: 'id', type: 'serial', primaryKey: true }],
            },
        };

        const view = new UserListCreateView({
            serializer: UserSerializer,
            filters: FilterSet.define<UserRecord>({
                fields: {
                    id: ['gte'],
                },
            }),
        });

        const response = await view.dispatch(aResourcesRequestContext('GET', 'https://example.test/users?id__gte=10'));
        expect(response.status).toBe(200);
        expect(vi.mocked(querySetDouble.filter)).toHaveBeenCalledWith({
            kind: 'and',
            nodes: [{ kind: 'atom', where: { id__gte: 10 } }],
        });
    });

    it('skips empty filter results and ignores invalid ordering tokens', async () => {
        const querySetDouble = aQuerySet<UserRecord>();
        vi.mocked(querySetDouble.fetch).mockResolvedValue({ results: [], nextCursor: null });
        vi.mocked(querySetDouble.count).mockResolvedValue(0);

        currentUserModel = {
            objects: aManager<UserRecord>({
                meta: { table: 'users', pk: 'id', columns: { id: 'int', email: 'text', name: 'text' } },
                query: vi.fn(() => querySetDouble),
            }),
        };

        const view = new UserListCreateView({
            serializer: UserSerializer,
            filters: FilterSet.define<UserRecord>({
                fields: {
                    email: true,
                },
            }),
            orderingFields: ['email'],
        });

        const response = await view.dispatch(
            aResourcesRequestContext('GET', 'https://example.test/users?ordering=unknown')
        );
        expect(response.status).toBe(200);
        expect(vi.mocked(querySetDouble.filter)).not.toHaveBeenCalled();
        expect(vi.mocked(querySetDouble.orderBy)).not.toHaveBeenCalled();
    });

    it('exposes serializer-backed hooks and OpenAPI metadata', () => {
        const manager = aManager<UserRecord>({
            meta: { table: 'users', pk: 'id', columns: { id: 'int', email: 'text', name: 'text' } },
        });
        currentUserModel = {
            objects: manager,
            metadata: {
                name: 'User',
                fields: [{ name: 'id', type: 'serial', primaryKey: true }],
            },
        };

        const view = new HookProbeView({
            serializer: UserSerializer,
            lookupField: 'email',
            lookupParam: 'email',
        });
        const ctx = aResourcesRequestContext({ method: 'GET', url: 'https://example.test/users/a@example.com' });
        ctx.params = { email: 'a@example.com' };

        const hooks = view.exposeHooks(ctx);
        expect(hooks.manager).toBe(manager);
        expect(hooks.serializerClass).toBe(UserSerializer);
        expect(hooks.serializer).toBeInstanceOf(UserSerializer);
        expect(hooks.outputSchema).toBe(userReadSchema);
        expect(hooks.createSchema).toBe(userWriteSchema);
        expect(hooks.updateSchema).toBe(UserSerializer.updateSchema);
        expect(hooks.lookupField).toBe('email');
        expect(hooks.lookupValue).toBe('a@example.com');

        const description = view.describeOpenAPI();
        expect(description.outputSchema).toBe(userReadSchema);
        expect(description.createSchema).toBe(userWriteSchema);
        expect(description.updateSchema).toBe(UserSerializer.updateSchema);
    });

    it('derives the OpenAPI lookup field from model metadata when no explicit lookup field is configured', () => {
        currentUserModel = {
            objects: aManager<UserRecord>({
                meta: { table: 'users', pk: 'id', columns: { id: 'int', email: 'text', name: 'text' } },
            }),
            metadata: {
                name: 'User',
                fields: [{ name: 'id', type: 'serial', primaryKey: true }],
            },
        };

        const view = new UserDetailView({ serializer: UserSerializer });
        expect(view.describeOpenAPI().lookupField).toBe('id');
    });

    it('rejects OpenAPI generation when serializer model metadata is missing', () => {
        currentUserModel = {
            objects: aManager<UserRecord>({
                meta: { table: 'users', pk: 'id', columns: { id: 'int', email: 'text', name: 'text' } },
            }),
        };

        const view = new UserDetailView({ serializer: UserSerializer });
        expect(() => view.describeOpenAPI()).toThrow(
            'OpenAPI generation requires Tango model metadata on GenericAPIView models.'
        );
    });

    it('rejects OpenAPI generation when model metadata does not mark a primary key field', () => {
        currentUserModel = {
            objects: aManager<UserRecord>({
                meta: { table: 'users', pk: 'id', columns: { id: 'int', email: 'text', name: 'text' } },
            }),
            metadata: {
                name: 'User',
                fields: [{ name: 'id', type: 'serial' }],
            },
        };

        const view = new UserDetailView({ serializer: UserSerializer });
        expect(() => view.describeOpenAPI()).toThrow(
            'OpenAPI generation requires a primary key field in Tango model metadata.'
        );
    });

    it('returns 404 when update or destroy requests do not provide the lookup param', async () => {
        currentUserModel = {
            objects: aManager<UserRecord>({
                meta: { table: 'users', pk: 'id', columns: { id: 'int', email: 'text', name: 'text' } },
            }),
        };

        const view = new UserDetailView({ serializer: UserSerializer });

        const patchResponse = await view.dispatch(
            aResourcesRequestContext('PATCH', 'https://example.test/users/1', { name: 'Missing params' })
        );
        expect(patchResponse.status).toBe(404);

        const deleteResponse = await view.dispatch(aResourcesRequestContext('DELETE', 'https://example.test/users/1'));
        expect(deleteResponse.status).toBe(404);
    });

    it('normalizes serializer create errors into HTTP responses', async () => {
        currentUserModel = {
            objects: aManager<UserRecord>({
                meta: { table: 'users', pk: 'id', columns: { id: 'int', email: 'text', name: 'text' } },
                create: vi.fn(async () => {
                    throw new Error('create failed');
                }),
            }),
        };

        const view = new UserListCreateView({ serializer: UserSerializer });
        const response = await view.dispatch(
            aResourcesRequestContext('POST', 'https://example.test/users', {
                email: 'error@example.com',
                name: 'Error',
            })
        );
        expect(response.status).toBe(500);
    });
});
