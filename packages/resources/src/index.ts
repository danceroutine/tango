/**
 * Bundled exports for Django-style domain drill-down imports, plus curated
 * top-level symbols for TS-native ergonomic imports.
 */
export * as context from './context/index';
export * as filters from './filters/index';
export * as pagination from './pagination/index';
export * as paginators from './paginators/index';
export * as resource from './resource/index';
export * as serializer from './serializer/index';
export * as viewset from './viewset/index';
export * as view from './view/index';

export { RequestContext } from './context/index';
export type { BaseUser } from './context/index';
export {
    FilterSet,
    type AliasFilterDeclaration,
    type FieldFilterDeclaration,
    type FilterLookup,
    type FilterResolver,
    type FilterSetDefineConfig,
    type FilterValueParser,
} from './filters/index';
export type { FilterType, RangeOperator } from './filters/index';
export {
    CursorPaginator,
    OffsetPaginator,
    CursorPaginationInput,
    OffsetPaginationInput,
    type Page,
    type BasePaginatedResponse,
    type CursorPaginatedResponse,
    type OffsetPaginatedResponse,
    type PaginatedResponse,
    type Paginator,
} from './pagination/index';
export {
    Serializer,
    ModelSerializer,
    relation,
    type SerializerClass,
    type AnySerializerClass,
    type SerializerCreateInput,
    type SerializerUpdateInput,
    type SerializerOutput,
    type SerializerSchema,
    type ModelSerializerClass,
    type AnyModelSerializer,
    type AnyModelSerializerClass,
    type ModelSerializerRelationFields,
    type ManyToManyManagerKeys,
    type ManyToManyRelationField,
    type ManyToManyReadStrategy,
    type ManyToManyWriteStrategy,
} from './serializer/index';
export { ModelViewSet } from './viewset/index';
export type {
    ModelViewSetOpenAPIDescription,
    ModelViewSetConfig,
    ViewSetActionDescriptor,
    ViewSetActionMethod,
    ViewSetActionScope,
    ResolvedViewSetActionDescriptor,
} from './viewset/index';
export {
    APIView,
    GenericAPIView,
    ListModelMixin,
    CreateModelMixin,
    RetrieveModelMixin,
    UpdateModelMixin,
    DestroyModelMixin,
    ListAPIView,
    CreateAPIView,
    RetrieveAPIView,
    ListCreateAPIView,
    RetrieveUpdateAPIView,
    RetrieveDestroyAPIView,
    RetrieveUpdateDestroyAPIView,
} from './view/index';
export type { APIViewMethod, GenericAPIViewConfig, GenericAPIViewOpenAPIDescription } from './view/index';
export type { ResourceModelFieldMetadata, ResourceModelLike, ResourceModelMetadata } from './resource/index';
