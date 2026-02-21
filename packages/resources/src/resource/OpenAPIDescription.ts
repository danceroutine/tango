import type { APIViewMethod } from '../view/APIView';
import type { ResolvedViewSetActionDescriptor } from '../viewset/ModelViewSet';
import type { ResourceModelLike } from './ResourceModelLike';
import type { ModelSerializerClass, SerializerSchema } from '../serializer/index';

export type GenericAPIViewOpenAPIDescription<
    TModel extends Record<string, unknown>,
    TSerializer extends ModelSerializerClass<TModel, SerializerSchema, SerializerSchema, SerializerSchema>,
> = {
    model: ResourceModelLike<TModel> & { metadata: NonNullable<ResourceModelLike<TModel>['metadata']> };
    outputSchema: TSerializer['outputSchema'];
    createSchema: TSerializer['createSchema'];
    updateSchema: TSerializer['updateSchema'];
    searchFields: readonly (keyof TModel)[];
    orderingFields: readonly (keyof TModel)[];
    lookupField: keyof TModel;
    lookupParam: string;
    allowedMethods: readonly APIViewMethod[];
    usesDefaultOffsetPagination: boolean;
};

export type ModelViewSetOpenAPIDescription<
    TModel extends Record<string, unknown>,
    TSerializer extends ModelSerializerClass<TModel, SerializerSchema, SerializerSchema, SerializerSchema>,
> = GenericAPIViewOpenAPIDescription<TModel, TSerializer> & {
    actions: readonly ResolvedViewSetActionDescriptor[];
};
