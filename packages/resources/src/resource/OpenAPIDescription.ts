import type { APIViewMethod } from '../view/APIView';
import type { ResolvedViewSetActionDescriptor } from '../viewset/ModelViewSet';
import type { ResourceModelLike } from './ResourceModelLike';
import type { AnyModelSerializer } from '../serializer/index';

type SearchFieldRef<TModel extends Record<string, unknown>> = Extract<keyof TModel, string> | string;

export type GenericAPIViewOpenAPIDescription<
    TModel extends Record<string, unknown>,
    TSerializer extends AnyModelSerializer<TModel> = AnyModelSerializer<TModel>,
> = {
    model: ResourceModelLike<TModel> & { metadata: NonNullable<ResourceModelLike<TModel>['metadata']> };
    outputSchema: TSerializer['outputSchema'];
    createSchema: TSerializer['createSchema'];
    updateSchema: TSerializer['updateSchema'];
    searchFields: readonly SearchFieldRef<TModel>[];
    orderingFields: readonly (keyof TModel)[];
    lookupField: keyof TModel;
    lookupParam: string;
    allowedMethods: readonly APIViewMethod[];
    usesDefaultOffsetPagination: boolean;
};

export type ModelViewSetOpenAPIDescription<
    TModel extends Record<string, unknown>,
    TSerializer extends AnyModelSerializer<TModel> = AnyModelSerializer<TModel>,
> = GenericAPIViewOpenAPIDescription<TModel, TSerializer> & {
    actions: readonly ResolvedViewSetActionDescriptor[];
};
