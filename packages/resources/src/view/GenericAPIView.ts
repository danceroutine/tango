import { HttpErrorFactory, TangoResponse, type JsonValue, NotFoundError } from '@danceroutine/tango-core';
import { Q, type FilterInput, type ManagerLike, type QuerySet } from '@danceroutine/tango-orm';
import type { OffsetPaginatedResponse, Paginator } from '../pagination/index';
import { OffsetPaginator } from '../paginators/OffsetPaginator';
import { APIView } from './APIView';
import { RequestContext } from '../context/index';
import type { FilterSet } from '../filters/index';
import { inferModelFieldParsers } from '../filters/inferModelFieldParsers';
import type { GenericAPIViewOpenAPIDescription } from '../resource/index';
import type { AnyModelSerializer, SerializerOutput } from '../serializer/index';
import type { ResourceModelLike } from '../resource/index';

type SearchFieldRef<TModel extends Record<string, unknown>> = Extract<keyof TModel, string> | string;

export interface GenericAPIViewConfig<
    TModel extends Record<string, unknown>,
    TSerializer extends AnyModelSerializer<TModel>,
> {
    serializer: TSerializer;
    filters?: FilterSet<TModel>;
    orderingFields?: (keyof TModel)[];
    searchFields?: SearchFieldRef<TModel>[];
    lookupField?: keyof TModel;
    lookupParam?: string;
    paginatorFactory?: (queryset: QuerySet<TModel>) => Paginator<TModel, SerializerOutput<TSerializer>>;
}

/**
 * Generic API base class that centralizes query/build/validation helpers.
 */
export abstract class GenericAPIView<
    TModel extends Record<string, unknown>,
    TSerializer extends AnyModelSerializer<TModel>,
> extends APIView {
    protected readonly serializerClass: TSerializer;
    protected readonly filters?: FilterSet<TModel>;
    protected readonly orderingFields: readonly (keyof TModel)[];
    protected readonly searchFields: readonly SearchFieldRef<TModel>[];
    protected readonly lookupField?: keyof TModel;
    protected readonly lookupParam: string;
    protected readonly paginatorFactory?: (
        queryset: QuerySet<TModel>
    ) => Paginator<TModel, SerializerOutput<TSerializer>>;
    private serializer?: InstanceType<TSerializer>;

    constructor(config: GenericAPIViewConfig<TModel, TSerializer>) {
        super();
        this.serializerClass = config.serializer;
        this.filters = config.filters;
        this.orderingFields = config.orderingFields ?? [];
        this.searchFields = config.searchFields ?? [];
        this.lookupField = config.lookupField;
        this.lookupParam = config.lookupParam ?? 'id';
        this.paginatorFactory = config.paginatorFactory;
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
    describeOpenAPI(): GenericAPIViewOpenAPIDescription<TModel, TSerializer> {
        const model = this.requireModelMetadata();
        return {
            model,
            outputSchema: this.getOutputSchema(),
            createSchema: this.getCreateSchema(),
            updateSchema: this.getUpdateSchema(),
            searchFields: this.searchFields,
            orderingFields: this.orderingFields,
            lookupField: this.lookupField ?? this.getLookupFieldFromMetadata(model),
            lookupParam: this.lookupParam,
            allowedMethods: this.getAllowedMethods(),
            usesDefaultOffsetPagination: !this.paginatorFactory,
        };
    }

    protected getManager(): ManagerLike<TModel> {
        return this.getSerializer().getManager();
    }

    protected getOutputSchema(): TSerializer['outputSchema'] {
        return this.getSerializer().getOutputSchema() as TSerializer['outputSchema'];
    }

    protected getCreateSchema(): TSerializer['createSchema'] {
        return this.getSerializer().getCreateSchema() as TSerializer['createSchema'];
    }

    protected getUpdateSchema(): TSerializer['updateSchema'] {
        return this.getSerializer().getUpdateSchema() as TSerializer['updateSchema'];
    }

    protected getLookupField(): keyof TModel {
        return this.lookupField ?? (this.getManager().meta.pk as keyof TModel);
    }

    protected getLookupValue(ctx: RequestContext): string | null {
        const value = ctx.params[this.lookupParam]?.trim();
        return value || null;
    }

    protected getPaginator(queryset: QuerySet<TModel>): Paginator<TModel, SerializerOutput<TSerializer>> {
        if (this.paginatorFactory) {
            return this.paginatorFactory(queryset);
        }
        return new OffsetPaginator<TModel>(queryset) as Paginator<TModel, SerializerOutput<TSerializer>>;
    }

    protected async performList(ctx: RequestContext): Promise<TangoResponse> {
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
            const rows = await serializer.serializeMany(result.items);
            const response = paginator.toResponse(rows as SerializerOutput<TSerializer>[], {
                totalCount,
            }) as OffsetPaginatedResponse<SerializerOutput<TSerializer>>;

            return TangoResponse.json(response as unknown as JsonValue, { status: 200 });
        } catch (error) {
            return this.handleError(error);
        }
    }

    protected async performCreate(ctx: RequestContext): Promise<TangoResponse> {
        try {
            const body = await ctx.request.json();
            const result = await this.getSerializer().create(body);

            return TangoResponse.created(undefined, result as JsonValue);
        } catch (error) {
            return this.handleError(error);
        }
    }

    protected async performRetrieve(ctx: RequestContext): Promise<TangoResponse> {
        try {
            const value = this.getLookupValue(ctx);
            if (!value) {
                throw new NotFoundError('Lookup parameter was not provided.');
            }

            const lookupField = this.getLookupField();
            const filterByLookup = { [lookupField]: value } as FilterInput<TModel>;
            const result = await this.getManager().query().filter(filterByLookup).fetchOne();
            if (!result) {
                throw new NotFoundError(
                    `No ${this.getManager().meta.table} record found for ${String(lookupField)}=${value}.`
                );
            }

            return TangoResponse.json((await this.getSerializer().serialize(result)) as JsonValue, { status: 200 });
        } catch (error) {
            return this.handleError(error);
        }
    }

    protected async performUpdate(ctx: RequestContext): Promise<TangoResponse> {
        try {
            const value = this.getLookupValue(ctx);
            if (!value) {
                throw new NotFoundError('Lookup parameter was not provided.');
            }

            const body = await ctx.request.json();
            const result = await this.getSerializer().update(value as TModel[keyof TModel], body);

            return TangoResponse.json(result as JsonValue, { status: 200 });
        } catch (error) {
            return this.handleError(error);
        }
    }

    protected async performDestroy(ctx: RequestContext): Promise<TangoResponse> {
        try {
            const value = this.getLookupValue(ctx);
            if (!value) {
                throw new NotFoundError('Lookup parameter was not provided.');
            }

            await this.getManager().delete(value as TModel[keyof TModel]);
            return TangoResponse.noContent();
        } catch (error) {
            return this.handleError(error);
        }
    }

    protected handleError(error: unknown): TangoResponse {
        const httpError = HttpErrorFactory.toHttpError(error);
        return TangoResponse.json(httpError.body as JsonValue, { status: httpError.status });
    }

    private requireModelMetadata(): ResourceModelLike<TModel> & {
        metadata: NonNullable<ResourceModelLike<TModel>['metadata']>;
    } {
        const model = this.getSerializer().getModel();

        if (!model.metadata) {
            throw new Error('OpenAPI generation requires Tango model metadata on GenericAPIView models.');
        }

        return model as ResourceModelLike<TModel> & {
            metadata: NonNullable<ResourceModelLike<TModel>['metadata']>;
        };
    }

    private getLookupFieldFromMetadata(
        model: ResourceModelLike<TModel> & {
            metadata: NonNullable<ResourceModelLike<TModel>['metadata']>;
        }
    ): keyof TModel {
        const primaryKeyField = model.metadata.fields.find((field) => field.primaryKey);

        if (!primaryKeyField) {
            throw new Error('OpenAPI generation requires a primary key field in Tango model metadata.');
        }

        return primaryKeyField.name as keyof TModel;
    }
}
