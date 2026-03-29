import type {
    APIView,
    APIViewMethod,
    GenericAPIView,
    ModelSerializerClass,
    ModelViewSet,
    SerializerSchema,
} from '@danceroutine/tango-resources';
import type { z } from 'zod';

/** Model field metadata used by low-level model-to-schema OpenAPI generation. */
export type OpenAPIModelFieldMeta = {
    type: string;
    description?: string;
    nullable?: boolean;
    default?: unknown;
    primaryKey?: boolean;
};

/** Minimal model shape consumed by low-level OpenAPI mappers. */
export type OpenAPIModel = {
    name: string;
    fields: Record<string, OpenAPIModelFieldMeta>;
};

/** OpenAPI `$ref` object. */
export type ReferenceObject = { $ref: string };

/** OpenAPI schema object subset used by Tango. */
export type SchemaObject = {
    type?: string;
    description?: string;
    nullable?: boolean;
    default?: unknown;
    properties?: Record<string, SchemaObject | ReferenceObject>;
    required?: string[];
    items?: SchemaObject | ReferenceObject;
    additionalProperties?: boolean | SchemaObject | ReferenceObject;
    enum?: unknown[];
    oneOf?: Array<SchemaObject | ReferenceObject>;
    anyOf?: Array<SchemaObject | ReferenceObject>;
    allOf?: Array<SchemaObject | ReferenceObject>;
    format?: string;
    [key: string]: unknown;
};

/** Schema inputs accepted by resource-aware OpenAPI descriptors. */
export type OpenAPISchemaInput = z.ZodType | SchemaObject | ReferenceObject;

/** OpenAPI media type object. */
export type MediaTypeObject = {
    schema: SchemaObject | ReferenceObject;
};

/** OpenAPI response object. */
export type ResponseObject = {
    description: string;
    content?: Record<string, MediaTypeObject>;
};

/** OpenAPI parameter object. */
export type ParameterObject = {
    name: string;
    in: 'query' | 'path' | 'header' | 'cookie';
    required?: boolean;
    schema: SchemaObject | ReferenceObject;
    description?: string;
};

/** OpenAPI request body object. */
export type RequestBodyObject = {
    required?: boolean;
    content: Record<string, MediaTypeObject>;
};

/** OpenAPI operation object subset. */
export type OperationObject = {
    summary?: string;
    description?: string;
    tags?: string[];
    parameters?: ParameterObject[];
    requestBody?: RequestBodyObject;
    responses: Record<string, ResponseObject>;
};

/** Override shape for one explicit response. */
export type OpenAPIResponseOverride = {
    description: string;
    schema?: OpenAPISchemaInput;
};

/** Override shape for one operation. */
export type OpenAPIOperationOverride = {
    summary?: string;
    description?: string;
    tags?: string[];
    parameters?: ParameterObject[];
    requestBody?: {
        required?: boolean;
        schema: OpenAPISchemaInput;
    };
    responseStatus?: string;
    responseDescription?: string;
    responseSchema?: OpenAPISchemaInput;
    responses?: Record<string, OpenAPIResponseOverride>;
};

/** OpenAPI path item object subset. */
export type PathItemObject = {
    get?: OperationObject;
    post?: OperationObject;
    put?: OperationObject;
    patch?: OperationObject;
    delete?: OperationObject;
};

/** OpenAPI components object subset. */
export type ComponentsObject = {
    schemas?: Record<string, SchemaObject>;
    securitySchemes?: Record<string, Record<string, unknown>>;
};

/** Root OpenAPI specification document shape. */
export interface OpenAPISpec {
    openapi: string;
    info: {
        title: string;
        version: string;
        description?: string;
    };
    servers?: Array<{ url: string; description?: string }>;
    paths: Record<string, PathItemObject>;
    components?: ComponentsObject;
}

/** Options for generating an OpenAPI spec document. */
export interface OpenAPIOptions {
    title: string;
    version: string;
    description?: string;
    servers?: Array<{ url: string; description?: string }>;
}

export type OpenAPIViewSetDescriptor<
    TModel extends Record<string, unknown> = Record<string, unknown>,
    TSerializer extends ModelSerializerClass<
        TModel,
        SerializerSchema,
        SerializerSchema,
        SerializerSchema
    > = ModelSerializerClass<TModel, SerializerSchema, SerializerSchema, SerializerSchema>,
> = {
    kind: 'viewset';
    basePath: string;
    resource: ModelViewSet<TModel, TSerializer>;
    tags?: string[];
    actions?: Record<string, OpenAPIOperationOverride>;
};

export type OpenAPIGenericAPIViewDescriptor<
    TModel extends Record<string, unknown> = Record<string, unknown>,
    TSerializer extends ModelSerializerClass<
        TModel,
        SerializerSchema,
        SerializerSchema,
        SerializerSchema
    > = ModelSerializerClass<TModel, SerializerSchema, SerializerSchema, SerializerSchema>,
> = {
    kind: 'generic';
    collectionPath?: string;
    detailPath?: string;
    resource: GenericAPIView<TModel, TSerializer>;
    tags?: string[];
    methods?: Partial<Record<APIViewMethod, OpenAPIOperationOverride>>;
};

export type OpenAPIAPIViewDescriptor = {
    kind: 'api';
    path: string;
    resource: APIView;
    tags?: string[];
    methods: Partial<Record<APIViewMethod, OpenAPIOperationOverride>>;
};

type AnyOpenAPIViewSetDescriptor = OpenAPIViewSetDescriptor<
    // oxlint-disable-next-line typescript/no-explicit-any
    any,
    // oxlint-disable-next-line typescript/no-explicit-any
    any
>;

type AnyOpenAPIGenericAPIViewDescriptor = OpenAPIGenericAPIViewDescriptor<
    // oxlint-disable-next-line typescript/no-explicit-any
    any,
    // oxlint-disable-next-line typescript/no-explicit-any
    any
>;

export type OpenAPIResourceDescriptor =
    | AnyOpenAPIViewSetDescriptor
    | AnyOpenAPIGenericAPIViewDescriptor
    | OpenAPIAPIViewDescriptor;

/** Extended generator configuration used by Tango's OpenAPI builder. */
export type OpenAPIGeneratorConfig = OpenAPIOptions & {
    resources?: OpenAPIResourceDescriptor[];
};
