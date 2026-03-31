import type { FilterInput, ManagerLike, QuerySet } from '@danceroutine/tango-orm';
import { HttpErrorFactory, TangoResponse, type JsonValue, NotFoundError } from '@danceroutine/tango-core';
import type { RequestContext } from '../context/index';
import type { FilterSet } from '../filters/index';
import { inferModelFieldParsers } from '../filters/inferModelFieldParsers';
import { OffsetPaginator } from '../paginators/OffsetPaginator';
import { Q } from '@danceroutine/tango-orm';
import type { Paginator } from '../pagination/index';
import type { ModelViewSetOpenAPIDescription } from '../resource/index';
import type { ResourceModelLike } from '../resource/index';
import type {
    AnyModelSerializerClass,
    ModelSerializerClass,
    SerializerOutput,
    SerializerSchema,
} from '../serializer/index';

export type ViewSetActionScope = 'detail' | 'collection';
export type ViewSetActionMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ViewSetActionDescriptor {
    name: string;
    scope: ViewSetActionScope;
    methods: readonly ViewSetActionMethod[];
    path?: string;
}

export interface ResolvedViewSetActionDescriptor extends ViewSetActionDescriptor {
    path: string;
}

type AnyModelViewSet = ModelViewSet<Record<string, unknown>, AnyModelSerializerClass>;

/**
 * Configuration for a ModelViewSet, defining how a serializer-backed model is exposed as an API resource.
 */
export interface ModelViewSetConfig<
    TModel extends Record<string, unknown>,
    TSerializer extends ModelSerializerClass<TModel, SerializerSchema, SerializerSchema, SerializerSchema>,
> {
    /** Serializer class that owns validation, representation, and persistence hooks */
    serializer: TSerializer;

    /** Optional filter set defining which query parameters can filter the list endpoint */
    filters?: FilterSet<TModel>;

    /** Fields that clients are allowed to sort by via query parameters */
    orderingFields?: (keyof TModel)[];

    /** Fields that are searched when a free-text search query parameter is provided */
    searchFields?: (keyof TModel)[];

    /** Optional paginator factory used by list endpoints. */
    paginatorFactory?: (queryset: QuerySet<TModel>) => Paginator<TModel, SerializerOutput<TSerializer>>;
}

/**
 * Base class for creating RESTful API viewsets with built-in CRUD operations.
 * Provides list, retrieve, create, update, and delete methods with filtering,
 * search, pagination, and ordering support.
 */
export abstract class ModelViewSet<
    TModel extends Record<string, unknown>,
    TSerializer extends ModelSerializerClass<TModel, SerializerSchema, SerializerSchema, SerializerSchema>,
> {
    static readonly BRAND = 'tango.resources.model_view_set' as const;
    static readonly actions: readonly ViewSetActionDescriptor[] = [];
    readonly __tangoBrand: typeof ModelViewSet.BRAND = ModelViewSet.BRAND;
    protected readonly serializerClass: TSerializer;
    protected readonly filters?: FilterSet<TModel>;
    protected readonly orderingFields: (keyof TModel)[];
    protected readonly searchFields: (keyof TModel)[];
    protected readonly paginatorFactory?: (
        queryset: QuerySet<TModel>
    ) => Paginator<TModel, SerializerOutput<TSerializer>>;
    private serializer?: InstanceType<TSerializer>;

    constructor(config: ModelViewSetConfig<TModel, TSerializer>) {
        this.serializerClass = config.serializer;
        this.filters = config.filters;
        this.orderingFields = config.orderingFields ?? [];
        this.searchFields = config.searchFields ?? [];
        this.paginatorFactory = config.paginatorFactory;
    }

    /**
     * Return the custom action descriptors declared by a viewset or constructor.
     */
    static getActions(
        viewsetOrConstructor: AnyModelViewSet | (new (...args: never[]) => AnyModelViewSet)
    ): readonly ResolvedViewSetActionDescriptor[] {
        const viewset = ModelViewSet.isModelViewSet(viewsetOrConstructor) ? viewsetOrConstructor : null;

        const constructorValue = viewset
            ? (viewset.constructor as { actions?: readonly ViewSetActionDescriptor[] })
            : (viewsetOrConstructor as { actions?: readonly ViewSetActionDescriptor[] });
        const actions = Array.isArray(constructorValue.actions) ? constructorValue.actions : [];

        return actions.map((action) => ({
            ...action,
            path: viewset
                ? viewset.resolveActionPath(action)
                : ModelViewSet.resolvePathFromDescriptor(action.name, action.path),
        }));
    }

    /**
     * Narrow an unknown value to `ModelViewSet`.
     */
    static isModelViewSet(value: unknown): value is ModelViewSet<Record<string, unknown>, AnyModelSerializerClass> {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === ModelViewSet.BRAND
        );
    }

    /**
     * Preserve literal action inference while validating the descriptor shape.
     */
    static defineViewSetActions<const T extends readonly ViewSetActionDescriptor[]>(actions: T): T {
        return actions;
    }

    private static resolvePathFromDescriptor(name: string, explicitPath?: string): string {
        const normalized = (explicitPath?.trim() || ModelViewSet.toKebabCase(name)).replace(/^\/+|\/+$/g, '');
        if (!normalized) {
            throw new Error(`Invalid custom action path for '${name}'.`);
        }
        return normalized;
    }

    private static toKebabCase(input: string): string {
        return input
            .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
            .replace(/[_\s]+/g, '-')
            .toLowerCase();
    }

    /**
     * Return the serializer class that owns this resource contract.
     */
    getSerializerClass(): TSerializer {
        return this.serializerClass;
    }

    /**
     * Return the serializer instance for the current resource.
     */
    getSerializer(): InstanceType<TSerializer> {
        if (!this.serializer) {
            this.serializer = new this.serializerClass() as InstanceType<TSerializer>;
        }

        return this.serializer;
    }

    /**
     * Describe the public HTTP contract that this resource contributes to OpenAPI generation.
     */
    describeOpenAPI(): ModelViewSetOpenAPIDescription<TModel, TSerializer> {
        return {
            model: this.requireModelMetadata(),
            outputSchema: this.getSerializer().getOutputSchema() as TSerializer['outputSchema'],
            createSchema: this.getSerializer().getCreateSchema() as TSerializer['createSchema'],
            updateSchema: this.getSerializer().getUpdateSchema() as TSerializer['updateSchema'],
            searchFields: this.searchFields,
            orderingFields: this.orderingFields,
            lookupField: this.getManager().meta.pk as keyof TModel,
            lookupParam: 'id',
            allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
            usesDefaultOffsetPagination: !this.paginatorFactory,
            actions: ModelViewSet.getActions(this as unknown as AnyModelViewSet),
        };
    }

    /**
     * List endpoint with filtering, search, ordering, and offset pagination.
     */
    async list(ctx: RequestContext): Promise<TangoResponse> {
        try {
            const params = ctx.request.queryParams;
            const baseQueryset = this.getManager().query();
            const paginator = this.getPaginator(baseQueryset);
            paginator.parse(params);

            let qs = baseQueryset;

            if (this.filters) {
                const filterInputs = this.filters
                    .withFieldParsers(inferModelFieldParsers(this.getSerializer().getModel()))
                    .apply(params);
                if (filterInputs.length > 0) {
                    qs = qs.filter(Q.and(...filterInputs));
                }
            }

            const search = params.getSearch();
            if (search && this.searchFields.length > 0) {
                const searchFilters: FilterInput<TModel>[] = this.searchFields.map((field) => {
                    const lookup = `${String(field)}__icontains`;
                    return { [lookup]: search } as FilterInput<TModel>;
                });
                qs = qs.filter(Q.or(...searchFilters));
            }

            const ordering = params.getOrdering();
            if (ordering.length > 0) {
                const orderTokens = ordering.filter((field) => {
                    const cleanField = field.startsWith('-') ? field.slice(1) : field;
                    return this.orderingFields.includes(cleanField as keyof TModel);
                });
                if (orderTokens.length > 0) {
                    qs = qs.orderBy(...orderTokens.map((token) => token as keyof TModel | `-${string & keyof TModel}`));
                }
            }

            qs = paginator.apply(qs);
            const resultPromise = qs.fetch();
            const totalCountPromise = paginator.needsTotalCount()
                ? qs.count()
                : Promise.resolve<number | undefined>(undefined);
            const [result, totalCount] = await Promise.all([resultPromise, totalCountPromise]);
            const serializer = this.getSerializer();
            const response = paginator.toResponse(
                result.results.map((row) => serializer.toRepresentation(row)) as SerializerOutput<TSerializer>[],
                { totalCount }
            );

            return TangoResponse.json(response as unknown as JsonValue, { status: 200 });
        } catch (error) {
            return this.handleError(error);
        }
    }

    /**
     * Retrieve endpoint for a single resource by id.
     */
    async retrieve(_ctx: RequestContext, id: string): Promise<TangoResponse> {
        try {
            const manager = this.getManager();
            const pk = manager.meta.pk;
            const filterById = { [pk]: id } as FilterInput<TModel>;
            const result = await manager.query().filter(filterById).fetchOne();

            if (!result) {
                throw new NotFoundError(`No ${manager.meta.table} record found for ${String(pk)}=${id}.`);
            }

            return TangoResponse.json(this.getSerializer().toRepresentation(result) as JsonValue, { status: 200 });
        } catch (error) {
            return this.handleError(error);
        }
    }

    /**
     * Create endpoint: validate input, persist, and return serialized output.
     */
    async create(ctx: RequestContext): Promise<TangoResponse> {
        try {
            const body = await ctx.request.json();
            const result = await this.getSerializer().create(body);

            return TangoResponse.created(undefined, result as JsonValue);
        } catch (error) {
            return this.handleError(error);
        }
    }

    /**
     * Update endpoint: validate partial payload and persist by id.
     */
    async update(ctx: RequestContext, id: string): Promise<TangoResponse> {
        try {
            const body = await ctx.request.json();
            const pkValue = id as TModel[keyof TModel];
            const result = await this.getSerializer().update(pkValue, body);

            return TangoResponse.json(result as JsonValue, { status: 200 });
        } catch (error) {
            return this.handleError(error);
        }
    }

    /**
     * Destroy endpoint: delete a resource by id.
     */
    async destroy(_ctx: RequestContext, id: string): Promise<TangoResponse> {
        try {
            const pkValue = id as TModel[keyof TModel];

            await this.getManager().delete(pkValue);

            return TangoResponse.noContent();
        } catch (error) {
            return this.handleError(error);
        }
    }

    protected getPaginator(queryset: QuerySet<TModel>): Paginator<TModel, SerializerOutput<TSerializer>> {
        if (this.paginatorFactory) {
            return this.paginatorFactory(queryset);
        }
        return new OffsetPaginator<TModel>(queryset) as Paginator<TModel, SerializerOutput<TSerializer>>;
    }

    protected getManager(): ManagerLike<TModel> {
        return this.getSerializer().getManager();
    }

    /**
     * Convert thrown errors into normalized HTTP responses.
     */
    protected handleError(error: unknown): TangoResponse {
        const httpError = HttpErrorFactory.toHttpError(error);
        return TangoResponse.json(httpError.body as JsonValue, { status: httpError.status });
    }

    /**
     * Resolve route path segment(s) for a custom action.
     * Override this in subclasses to customize path derivation globally.
     */
    protected resolveActionPath(action: ViewSetActionDescriptor): string {
        return ModelViewSet.resolvePathFromDescriptor(action.name, action.path);
    }

    private requireModelMetadata(): ResourceModelLike<TModel> & {
        metadata: NonNullable<ResourceModelLike<TModel>['metadata']>;
    } {
        const model = this.getSerializer().getModel();

        if (!model.metadata) {
            throw new Error('OpenAPI generation requires Tango model metadata on ModelViewSet models.');
        }

        return model as ResourceModelLike<TModel> & {
            metadata: NonNullable<ResourceModelLike<TModel>['metadata']>;
        };
    }
}
