/**
 * Bundled exports for Django-style domain drill-down imports, plus curated
 * top-level symbols for TS-native ergonomic imports.
 */
export * as domain from './domain/index';
export * as generators from './generators/index';
export * as mappers from './mappers/index';

export type {
    OpenAPIAPIViewDescriptor,
    OpenAPIGeneratorConfig,
    OpenAPIModel,
    OpenAPIModelFieldMeta,
    OpenAPIOptions,
    OpenAPIOperationOverride,
    OpenAPIResponseOverride,
    OpenAPIResourceDescriptor,
    OpenAPISchemaInput,
    OpenAPISpec,
    OpenAPIGenericAPIViewDescriptor,
    OpenAPIViewSetDescriptor,
} from './domain/index';
export { describeAPIView, describeGenericAPIView, describeViewSet } from './domain/index';
export { generateOpenAPISpec } from './generators/index';
export { generateSchemaFromModel, generateSchemaFromZod, mapTypeToOpenAPI } from './mappers/index';
