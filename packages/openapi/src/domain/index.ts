/**
 * Domain boundary barrel: centralizes this subdomain's public contract.
 */

export type {
    ComponentsObject,
    MediaTypeObject,
    OperationObject,
    OpenAPIAPIViewDescriptor,
    OpenAPIModel,
    OpenAPIModelFieldMeta,
    OpenAPIOptions,
    OpenAPIOperationOverride,
    OpenAPIResponseOverride,
    OpenAPIResourceDescriptor,
    OpenAPISchemaInput,
    OpenAPISpec,
    OpenAPIGeneratorConfig,
    OpenAPIGenericAPIViewDescriptor,
    OpenAPIViewSetDescriptor,
    ParameterObject,
    PathItemObject,
    ReferenceObject,
    RequestBodyObject,
    ResponseObject,
    SchemaObject,
} from './types';
export { describeAPIView, describeGenericAPIView, describeViewSet } from './describeResources';
