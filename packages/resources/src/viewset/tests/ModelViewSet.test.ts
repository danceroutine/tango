import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { ModelViewSet } from '..';
import type { ViewSetActionDescriptor } from '..';
import { RequestContext } from '../../context';
import { FilterSet } from '../../filters';
import { CursorPaginator } from '../../paginators/CursorPaginator';
import { ModelSerializer, type AnyModelSerializerClass } from '../../serializer/index';
import { aManager, aQueryResult, aQuerySet, aRequestContext } from '@danceroutine/tango-testing';
import type { ManagerLike } from '@danceroutine/tango-orm';
import type { ResourceModelLike } from '../../resource/index';

type UserRecord = {
    id: number;
    email: string;
    name: string;
    active?: boolean;
};

type UserModelRecord = UserRecord & {
    tags: {
        all(): Promise<readonly string[]>;
    };
};

const userReadSchema = z.object({
    id: z.number(),
    email: z.string().email(),
    name: z.string(),
});

const userReadWithTagsSchema = userReadSchema.extend({
    tags: z.array(z.string()),
});

const userWriteSchema = z.object({
    email: z.string().email(),
    name: z.string(),
});

let currentUserModel: unknown;
type AnyTestModelViewSet = ModelViewSet<Record<string, unknown>, AnyModelSerializerClass>;

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
        return currentUserModel as ResourceModelLike<UserRecord>;
    }
}

class UserViewSet extends ModelViewSet<UserRecord, typeof UserSerializer> {}

class UserModelRecordSerializer extends ModelSerializer<
    UserRecord,
    typeof userWriteSchema,
    ReturnType<typeof userWriteSchema.partial>,
    typeof userReadWithTagsSchema,
    UserModelRecord
> {
    static readonly model = undefined as unknown as ResourceModelLike<UserRecord, UserModelRecord>;
    static readonly createSchema = userWriteSchema;
    static readonly updateSchema = userWriteSchema.partial();
    static readonly outputSchema = userReadWithTagsSchema;
    static readonly outputResolvers = {
        tags: async (record: UserModelRecord) => await record.tags.all(),
    };

    override getModel(): ResourceModelLike<UserRecord, UserModelRecord> {
        return currentUserModel as ResourceModelLike<UserRecord, UserModelRecord>;
    }
}

class UserModelRecordViewSet extends ModelViewSet<UserRecord, typeof UserModelRecordSerializer> {}

class ActionUserViewSet extends ModelViewSet<UserRecord, typeof UserSerializer> {
    static readonly actions = ModelViewSet.defineViewSetActions([
        {
            name: 'activateAccount',
            scope: 'detail',
            methods: ['POST'],
        },
        {
            name: 'metrics',
            scope: 'collection',
            methods: ['GET'],
            path: 'metrics/daily',
        },
    ]);

    protected override resolveActionPath(action: ViewSetActionDescriptor): string {
        if (action.name === 'activateAccount') {
            return 'custom-activate';
        }
        return super.resolveActionPath(action);
    }
}

class InvalidActionPathViewSet extends ModelViewSet<UserRecord, typeof UserSerializer> {
    static readonly actions = ModelViewSet.defineViewSetActions([
        {
            name: '',
            scope: 'collection',
            methods: ['POST'],
            path: '/',
        },
    ]);
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

describe(ModelViewSet, () => {
    let manager: ManagerLike<UserRecord>;
    let viewset: UserViewSet;
    let querySetDouble: ReturnType<typeof aQuerySet<UserRecord>>;

    beforeEach(() => {
        querySetDouble = aQuerySet<UserRecord>();
        vi.mocked(querySetDouble.fetch).mockResolvedValue(aQueryResult({ items: [] }));
        vi.mocked(querySetDouble.fetchOne).mockResolvedValue(null);
        vi.mocked(querySetDouble.count).mockResolvedValue(0);

        manager = aManager<UserRecord>({
            meta: { table: 'users', pk: 'id', columns: { id: 'int', email: 'text', name: 'text' } },
            query: vi.fn(() => querySetDouble),
            create: vi.fn(async (input) => ({ id: 1, ...input }) as UserRecord),
            update: vi.fn(async (id, patch) => ({
                id: Number(id),
                email: 'existing@example.com',
                name: 'Existing',
                ...patch,
            })),
            delete: vi.fn(async () => {}),
        });

        currentUserModel = {
            objects: manager,
            metadata: {
                name: 'User',
                fields: [
                    { name: 'id', type: 'serial', primaryKey: true },
                    { name: 'active', type: 'bool' },
                ],
            },
        };

        viewset = new UserViewSet({
            serializer: UserSerializer,
            orderingFields: ['id', 'email', 'name'],
            searchFields: ['email', 'name', 'tags__name'],
        });
    });

    it('lists records with search and ordering', async () => {
        vi.mocked(querySetDouble.fetch).mockResolvedValueOnce(
            aQueryResult({
                items: [{ id: 1, email: 'user@example.com', name: 'User' }],
            })
        );
        vi.mocked(querySetDouble.count).mockResolvedValueOnce(1);

        const response = await viewset.list(
            aResourcesRequestContext('GET', 'https://example.test/users?search=user&ordering=-name,unknown')
        );
        expect(response.status).toBe(200);
        expect(vi.mocked(querySetDouble.filter)).toHaveBeenCalledWith({
            kind: 'or',
            nodes: [
                { kind: 'atom', where: { email__icontains: 'user' } },
                { kind: 'atom', where: { name__icontains: 'user' } },
                { kind: 'atom', where: { tags__name__icontains: 'user' } },
            ],
        });
        expect(vi.mocked(querySetDouble.orderBy)).toHaveBeenCalledWith('-name');
    });

    it('counts the filtered queryset before applying offset pagination', async () => {
        const filteredQuerySet = aQuerySet<UserRecord>();
        const paginatedQuerySet = aQuerySet<UserRecord>();

        vi.mocked(querySetDouble.filter).mockReturnValue(filteredQuerySet);
        vi.mocked(filteredQuerySet.limit).mockReturnValue(filteredQuerySet);
        vi.mocked(filteredQuerySet.offset).mockReturnValue(paginatedQuerySet);
        vi.mocked(filteredQuerySet.count).mockResolvedValue(5);
        vi.mocked(paginatedQuerySet.fetch).mockResolvedValue(
            aQueryResult({
                items: [
                    { id: 3, email: 'c@example.com', name: 'C' },
                    { id: 4, email: 'd@example.com', name: 'D' },
                ],
            })
        );
        vi.mocked(paginatedQuerySet.count).mockResolvedValue(2);

        const response = await viewset.list(
            aResourcesRequestContext('GET', 'https://example.test/users?search=example&limit=2&offset=2')
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            count: 5,
            next: '?limit=2&offset=4',
            previous: '?limit=2&offset=0',
            results: [
                { id: 3, email: 'c@example.com', name: 'C' },
                { id: 4, email: 'd@example.com', name: 'D' },
            ],
        });
        expect(vi.mocked(filteredQuerySet.count)).toHaveBeenCalledOnce();
        expect(vi.mocked(paginatedQuerySet.count)).not.toHaveBeenCalled();
    });

    it('creates, retrieves, updates, and destroys a resource', async () => {
        vi.mocked(querySetDouble.fetchOne).mockResolvedValue({ id: 1, email: 'user@example.com', name: 'User' });

        const retrieveResponse = await viewset.retrieve(
            aResourcesRequestContext('GET', 'https://example.test/users/1'),
            '1'
        );
        expect(retrieveResponse.status).toBe(200);

        const createResponse = await viewset.create(
            aResourcesRequestContext('POST', 'https://example.test/users', { email: 'new@example.com', name: 'New' })
        );
        expect(createResponse.status).toBe(201);

        const updateResponse = await viewset.update(
            aResourcesRequestContext('PATCH', 'https://example.test/users/1', { name: 'Updated' }),
            '1'
        );
        expect(updateResponse.status).toBe(200);

        const destroyResponse = await viewset.destroy(
            aResourcesRequestContext('DELETE', 'https://example.test/users/1'),
            '1'
        );
        expect(destroyResponse.status).toBe(204);
    });

    it('supports configured filters and paginator factories', async () => {
        const withFilters = new UserViewSet({
            serializer: UserSerializer,
            filters: FilterSet.define<UserRecord>({
                fields: {
                    email: true,
                },
            }),
            paginatorFactory: (queryset) => new CursorPaginator(queryset),
        });
        vi.mocked(querySetDouble.fetch).mockResolvedValueOnce(aQueryResult({ items: [] }));

        const response = await withFilters.list(
            aResourcesRequestContext('GET', 'https://example.test/users?email=a@example.com')
        );
        expect(response.status).toBe(200);
        expect(vi.mocked(querySetDouble.filter)).toHaveBeenCalled();
    });

    it('supports a serializer whose model row is richer than the outward resource record', async () => {
        const querySetForModelRow = aQuerySet<UserModelRecord>();
        vi.mocked(querySetForModelRow.fetch).mockResolvedValueOnce(
            aQueryResult({
                items: [
                    {
                        id: 7,
                        email: 'rich@example.com',
                        name: 'Rich',
                        tags: {
                            all: async () => ['staff'],
                        },
                    },
                ],
            })
        );
        vi.mocked(querySetForModelRow.count).mockResolvedValueOnce(1);

        currentUserModel = {
            objects: aManager<UserModelRecord>({
                meta: { table: 'users', pk: 'id', columns: { id: 'int', email: 'text', name: 'text' } },
                query: vi.fn(() => querySetForModelRow),
                create: vi.fn(
                    async (input) =>
                        ({
                            id: 7,
                            email: 'rich@example.com',
                            name: 'Rich',
                            ...input,
                            tags: {
                                all: async () => ['staff'],
                            },
                        }) as UserModelRecord
                ),
            }),
            metadata: {
                name: 'User',
                fields: [{ name: 'id', type: 'serial', primaryKey: true }],
            },
        } as ResourceModelLike<UserRecord, UserModelRecord>;

        const viewsetWithModelRow = new UserModelRecordViewSet({
            serializer: UserModelRecordSerializer,
            orderingFields: ['id', 'email', 'name'],
        });

        const response = await viewsetWithModelRow.list(aResourcesRequestContext('GET', 'https://example.test/users'));
        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            count: 1,
            results: [{ id: 7, email: 'rich@example.com', name: 'Rich', tags: ['staff'] }],
        });
    });

    it('coerces boolean query params from model metadata when applying filters', async () => {
        const withFilters = new UserViewSet({
            serializer: UserSerializer,
            filters: FilterSet.define<UserRecord>({
                fields: {
                    active: true,
                },
            }),
        });
        vi.mocked(querySetDouble.fetch).mockResolvedValueOnce(aQueryResult({ items: [] }));
        vi.mocked(querySetDouble.count).mockResolvedValueOnce(0);

        const response = await withFilters.list(
            aResourcesRequestContext('GET', 'https://example.test/users?active=true')
        );

        expect(response.status).toBe(200);
        expect(vi.mocked(querySetDouble.filter)).toHaveBeenCalledWith({
            kind: 'and',
            nodes: [{ kind: 'atom', where: { active: true } }],
        });
    });

    it('coerces numeric query params from model metadata when applying filters', async () => {
        const withFilters = new UserViewSet({
            serializer: UserSerializer,
            filters: FilterSet.define<UserRecord>({
                fields: {
                    id: ['gte'],
                },
            }),
        });
        vi.mocked(querySetDouble.fetch).mockResolvedValueOnce(aQueryResult({ items: [] }));
        vi.mocked(querySetDouble.count).mockResolvedValueOnce(0);

        const response = await withFilters.list(
            aResourcesRequestContext('GET', 'https://example.test/users?id__gte=10')
        );

        expect(response.status).toBe(200);
        expect(vi.mocked(querySetDouble.filter)).toHaveBeenCalledWith({
            kind: 'and',
            nodes: [{ kind: 'atom', where: { id__gte: 10 } }],
        });
    });

    it('skips empty filter results, ignores invalid ordering tokens, and supports constructors without actions', async () => {
        const noActionsConstructor = function NoActions() {
            return undefined;
        } as unknown as new (...args: never[]) => AnyTestModelViewSet;

        expect(ModelViewSet.getActions(noActionsConstructor)).toEqual([]);

        const withFilters = new UserViewSet({
            serializer: UserSerializer,
            filters: FilterSet.define<UserRecord>({
                fields: {
                    email: true,
                },
            }),
            orderingFields: ['email'],
        });
        vi.mocked(querySetDouble.fetch).mockResolvedValueOnce(aQueryResult({ items: [] }));
        vi.mocked(querySetDouble.count).mockResolvedValueOnce(0);

        const response = await withFilters.list(
            aResourcesRequestContext('GET', 'https://example.test/users?ordering=unknown')
        );

        expect(response.status).toBe(200);
        expect(vi.mocked(querySetDouble.filter)).not.toHaveBeenCalled();
        expect(vi.mocked(querySetDouble.orderBy)).not.toHaveBeenCalled();
    });

    it('exposes the serializer class for the resource contract', () => {
        expect(viewset.getSerializerClass()).toBe(UserSerializer);
    });

    it('resolves custom actions from constructors and instances', () => {
        const actionsFromCtor = ActionUserViewSet.getActions(
            ActionUserViewSet as unknown as new (...args: never[]) => AnyTestModelViewSet
        );
        expect(actionsFromCtor).toEqual([
            { name: 'activateAccount', scope: 'detail', methods: ['POST'], path: 'activate-account' },
            { name: 'metrics', scope: 'collection', methods: ['GET'], path: 'metrics/daily' },
        ]);

        const instance = new ActionUserViewSet({ serializer: UserSerializer });
        const actionsFromInstance = ActionUserViewSet.getActions(instance as unknown as AnyTestModelViewSet);
        expect(actionsFromInstance).toEqual([
            { name: 'activateAccount', scope: 'detail', methods: ['POST'], path: 'custom-activate' },
            { name: 'metrics', scope: 'collection', methods: ['GET'], path: 'metrics/daily' },
        ]);
    });

    it('describes serializer-backed OpenAPI metadata and validates action paths', () => {
        const actionViewset = new ActionUserViewSet({ serializer: UserSerializer });
        const description = actionViewset.describeOpenAPI();

        expect(description.outputSchema).toBe(userReadSchema);
        expect(description.createSchema).toBe(userWriteSchema);
        expect(description.updateSchema).toBe(UserSerializer.updateSchema);
        expect(description.actions).toHaveLength(2);
        expect(() =>
            InvalidActionPathViewSet.getActions(
                InvalidActionPathViewSet as unknown as new (...args: never[]) => AnyTestModelViewSet
            )
        ).toThrow("Invalid custom action path for ''.");
    });

    it('rejects OpenAPI generation when serializer model metadata is missing', () => {
        currentUserModel = { objects: manager };
        const minimal = new UserViewSet({ serializer: UserSerializer });
        expect(() => minimal.describeOpenAPI()).toThrow(
            'OpenAPI generation requires Tango model metadata on ModelViewSet models.'
        );
    });

    it('rejects OpenAPI generation when serializer model metadata has no primary key field', () => {
        currentUserModel = {
            objects: manager,
            metadata: {
                name: 'User',
                fields: [{ name: 'email', type: 'text' }],
            },
        } as ResourceModelLike<UserRecord>;

        const minimal = new UserViewSet({ serializer: UserSerializer });

        expect(() => minimal.describeOpenAPI()).toThrow(
            'OpenAPI generation requires a primary key field in Tango model metadata.'
        );
    });

    it('returns 404 when retrieve cannot find a row', async () => {
        vi.mocked(querySetDouble.fetchOne).mockResolvedValue(null);

        const response = await viewset.retrieve(
            aResourcesRequestContext('GET', 'https://example.test/users/999'),
            '999'
        );
        expect(response.status).toBe(404);
    });

    it('normalizes serializer and manager errors into HTTP responses', async () => {
        vi.mocked(querySetDouble.fetch).mockRejectedValueOnce(new Error('list failed'));
        vi.mocked(manager.create).mockRejectedValueOnce(new Error('create failed'));
        vi.mocked(manager.update).mockRejectedValueOnce(new Error('update failed'));
        vi.mocked(manager.delete).mockRejectedValueOnce(new Error('delete failed'));

        const listResponse = await viewset.list(
            aResourcesRequestContext('GET', 'https://example.test/users?limit=20&offset=0')
        );
        expect(listResponse.status).toBe(500);

        const createResponse = await viewset.create(
            aResourcesRequestContext('POST', 'https://example.test/users', { email: 'boom@example.com', name: 'Boom' })
        );
        expect(createResponse.status).toBe(500);

        const updateResponse = await viewset.update(
            aResourcesRequestContext('PATCH', 'https://example.test/users/1', { name: 'Boom' }),
            '1'
        );
        expect(updateResponse.status).toBe(500);

        const destroyResponse = await viewset.destroy(
            aResourcesRequestContext('DELETE', 'https://example.test/users/1'),
            '1'
        );
        expect(destroyResponse.status).toBe(500);
    });
});
