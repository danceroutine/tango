import { z } from 'zod';
import { generateSchemaFromModel, generateSchemaFromZod } from '../../mappers/schema';
import type {
    OpenAPIAPIViewDescriptor,
    OpenAPIGeneratorConfig,
    OpenAPIGenericAPIViewDescriptor,
    OpenAPIOperationOverride,
    OpenAPIResourceDescriptor,
    OpenAPIViewSetDescriptor,
    OpenAPISpec,
    OperationObject,
    ParameterObject,
    PathItemObject,
    ReferenceObject,
    RequestBodyObject,
    ResponseObject,
    SchemaObject,
} from '../../domain';

const JSON_CONTENT_TYPE = 'application/json';
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
type HttpMethod = (typeof HTTP_METHODS)[number];
type PathMethodKey = Lowercase<HttpMethod>;

type ResourceModelMetadata = {
    name: string;
    fields: Array<{
        name: string;
        type: string;
        notNull?: boolean;
        default?: unknown;
        primaryKey?: boolean;
    }>;
};

function toOpenAPIModel(metadata: ResourceModelMetadata) {
    return {
        name: metadata.name,
        fields: Object.fromEntries(
            metadata.fields.map((field) => [
                field.name,
                {
                    type: field.type,
                    nullable: field.notNull !== true,
                    default: field.default,
                    primaryKey: field.primaryKey,
                },
            ])
        ),
    };
}

function normalizePath(path: string): string {
    const trimmed = path.trim();
    if (!trimmed) {
        throw new Error('OpenAPI paths must not be empty.');
    }
    if (/(^|\/):/.test(trimmed)) {
        throw new Error(`OpenAPI paths must use {param} syntax, received '${trimmed}'.`);
    }

    const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    if (withLeadingSlash === '/') {
        return '/';
    }

    return withLeadingSlash.replace(/\/+$/g, '');
}

function joinPath(base: string, segment: string): string {
    const normalizedSegment = segment.replace(/^\/+|\/+$/g, '');
    return base === '/' ? `/${normalizedSegment}` : `${base}/${normalizedSegment}`;
}

function toMethodKey(method: HttpMethod): PathMethodKey {
    return method.toLowerCase() as PathMethodKey;
}

function isReferenceObject(value: unknown): value is ReferenceObject {
    return typeof value === 'object' && value !== null && typeof (value as { $ref?: unknown }).$ref === 'string';
}

function isZodSchema(value: unknown): value is z.ZodType {
    // oxlint-disable-next-line eslint-js/no-restricted-syntax
    return value instanceof z.ZodType;
}

function toSchema(value: z.ZodType | SchemaObject | ReferenceObject): SchemaObject | ReferenceObject {
    if (isReferenceObject(value)) {
        return value;
    }
    if (isZodSchema(value)) {
        return generateSchemaFromZod(value);
    }
    return value;
}

function arraySchema(items: SchemaObject | ReferenceObject): SchemaObject {
    return {
        type: 'array',
        items,
    };
}

function paginatedResultsSchema(items: SchemaObject | ReferenceObject): SchemaObject {
    return {
        type: 'object',
        properties: {
            count: { type: 'integer' },
            next: { type: 'string' },
            previous: { type: 'string' },
            results: arraySchema(items),
        },
        required: ['count', 'results'],
    };
}

function jsonResponse(description: string, schema?: SchemaObject | ReferenceObject): ResponseObject {
    return schema
        ? {
              description,
              content: {
                  [JSON_CONTENT_TYPE]: {
                      schema,
                  },
              },
          }
        : { description };
}

function jsonRequestBody(schema: SchemaObject | ReferenceObject, required: boolean = true): RequestBodyObject {
    return {
        required,
        content: {
            [JSON_CONTENT_TYPE]: {
                schema,
            },
        },
    };
}

function withOverride(
    operation: OperationObject,
    override: OpenAPIOperationOverride | undefined,
    fallbackTags: string[]
): OperationObject {
    if (!override) {
        return operation;
    }

    const nextOperation: OperationObject = {
        ...operation,
        summary: override.summary ?? operation.summary,
        description: override.description ?? operation.description,
        tags: override.tags ?? operation.tags ?? fallbackTags,
        parameters: override.parameters ?? operation.parameters,
        requestBody: override.requestBody
            ? jsonRequestBody(toSchema(override.requestBody.schema), override.requestBody.required ?? true)
            : operation.requestBody,
        responses: operation.responses,
    };

    if (override.responses) {
        nextOperation.responses = Object.fromEntries(
            Object.entries(override.responses).map(([status, response]) => {
                return [
                    status,
                    jsonResponse(response.description, response.schema ? toSchema(response.schema) : undefined),
                ];
            })
        );
        return nextOperation;
    }

    if (override.responseSchema || override.responseStatus || override.responseDescription) {
        const status = override.responseStatus ?? '200';
        nextOperation.responses = {
            [status]: jsonResponse(
                override.responseDescription ?? 'Successful response',
                override.responseSchema ? toSchema(override.responseSchema) : undefined
            ),
        };
    }

    return nextOperation;
}

function ensurePath(paths: Record<string, PathItemObject>, path: string): PathItemObject {
    const existing = paths[path];
    if (existing) {
        return existing;
    }

    const created: PathItemObject = {};
    paths[path] = created;
    return created;
}

function setOperation(
    paths: Record<string, PathItemObject>,
    path: string,
    method: HttpMethod,
    operation: OperationObject
): void {
    const pathItem = ensurePath(paths, path);
    pathItem[toMethodKey(method)] = operation;
}

function buildListParameters(
    searchFields: readonly string[],
    orderingFields: readonly string[],
    usesDefaultOffsetPagination: boolean
): ParameterObject[] {
    const parameters: ParameterObject[] = [];

    if (usesDefaultOffsetPagination) {
        parameters.push(
            {
                name: 'limit',
                in: 'query',
                schema: { type: 'integer' },
            },
            {
                name: 'offset',
                in: 'query',
                schema: { type: 'integer' },
            }
        );
    }

    if (searchFields.length > 0) {
        parameters.push({
            name: 'search',
            in: 'query',
            schema: { type: 'string' },
        });
    }

    if (orderingFields.length > 0) {
        parameters.push({
            name: 'ordering',
            in: 'query',
            schema: { type: 'string' },
        });
    }

    return parameters;
}

function buildPathParameter(name: string): ParameterObject {
    return {
        name,
        in: 'path',
        required: true,
        schema: { type: 'string' },
    };
}

function stringifyFields(fields: readonly unknown[]): string[] {
    return fields.map(String);
}

function titleize(input: string): string {
    return input
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[-_]+/g, ' ')
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function validateGenericDetailPath(detailPath: string, lookupParam: string): void {
    if (!detailPath.includes(`{${lookupParam}}`)) {
        throw new Error(`GenericAPIView detail paths must include '{${lookupParam}}', received '${detailPath}'.`);
    }
}

function ensureModelSchema(schemas: Record<string, SchemaObject>, metadata: ResourceModelMetadata): void {
    schemas[metadata.name] = generateSchemaFromModel(toOpenAPIModel(metadata));
}

function registerViewSetDescriptor(
    paths: Record<string, PathItemObject>,
    schemas: Record<string, SchemaObject>,
    descriptor: OpenAPIViewSetDescriptor
): void {
    const metadata = descriptor.resource.describeOpenAPI();
    const modelName = metadata.model.metadata.name;
    const tags = descriptor.tags ?? [modelName];
    const collectionPath = normalizePath(descriptor.basePath);
    const detailPath = collectionPath === '/' ? '/{id}' : `${collectionPath}/{id}`;
    const readSchema = toSchema(metadata.outputSchema);
    const writeSchema = toSchema(metadata.createSchema);
    const updateSchema = toSchema(metadata.updateSchema);

    ensureModelSchema(schemas, metadata.model.metadata);

    const listOperation = withOverride(
        {
            summary: `List ${modelName}s`,
            tags,
            parameters: buildListParameters(
                stringifyFields(metadata.searchFields),
                stringifyFields(metadata.orderingFields),
                metadata.usesDefaultOffsetPagination
            ),
            responses: {
                '200': jsonResponse(
                    'Successful response',
                    metadata.usesDefaultOffsetPagination ? paginatedResultsSchema(readSchema) : undefined
                ),
            },
        },
        undefined,
        tags
    );

    setOperation(paths, collectionPath, 'GET', listOperation);
    setOperation(paths, collectionPath, 'POST', {
        summary: `Create ${modelName}`,
        tags,
        requestBody: jsonRequestBody(writeSchema),
        responses: {
            '201': jsonResponse('Created', readSchema),
        },
    });
    setOperation(paths, detailPath, 'GET', {
        summary: `Get ${modelName}`,
        tags,
        parameters: [buildPathParameter('id')],
        responses: {
            '200': jsonResponse('Successful response', readSchema),
            '404': { description: 'Not found' },
        },
    });
    const updateResponses = {
        '200': jsonResponse('Updated', readSchema),
        '404': { description: 'Not found' },
    };
    setOperation(paths, detailPath, 'PUT', {
        summary: `Update ${modelName}`,
        tags,
        parameters: [buildPathParameter('id')],
        requestBody: jsonRequestBody(updateSchema),
        responses: updateResponses,
    });
    setOperation(paths, detailPath, 'PATCH', {
        summary: `Update ${modelName}`,
        tags,
        parameters: [buildPathParameter('id')],
        requestBody: jsonRequestBody(updateSchema),
        responses: updateResponses,
    });
    setOperation(paths, detailPath, 'DELETE', {
        summary: `Delete ${modelName}`,
        tags,
        parameters: [buildPathParameter('id')],
        responses: {
            '204': { description: 'Deleted' },
            '404': { description: 'Not found' },
        },
    });

    for (const action of metadata.actions) {
        const actionPath =
            action.scope === 'detail' ? joinPath(detailPath, action.path) : joinPath(collectionPath, action.path);
        const baseOperation: OperationObject = {
            summary: titleize(action.name),
            tags,
            ...(action.scope === 'detail' ? { parameters: [buildPathParameter('id')] } : {}),
            responses: {
                '200': { description: 'Successful response' },
            },
        };

        const override = descriptor.actions?.[action.name];
        for (const method of action.methods) {
            setOperation(paths, actionPath, method, withOverride(baseOperation, override, tags));
        }
    }
}

function registerGenericDescriptor(
    paths: Record<string, PathItemObject>,
    schemas: Record<string, SchemaObject>,
    descriptor: OpenAPIGenericAPIViewDescriptor
): void {
    if (!descriptor.collectionPath && !descriptor.detailPath) {
        throw new Error('GenericAPIView OpenAPI descriptors require at least one of collectionPath or detailPath.');
    }

    const metadata = descriptor.resource.describeOpenAPI();
    const modelName = metadata.model.metadata.name;
    const tags = descriptor.tags ?? [modelName];
    const readSchema = toSchema(metadata.outputSchema);
    const writeSchema = toSchema(metadata.createSchema);
    const updateSchema = toSchema(metadata.updateSchema);
    const allowed = new Set(metadata.allowedMethods);

    ensureModelSchema(schemas, metadata.model.metadata);

    if (descriptor.collectionPath) {
        const collectionPath = normalizePath(descriptor.collectionPath);
        if (allowed.has('GET')) {
            setOperation(
                paths,
                collectionPath,
                'GET',
                withOverride(
                    {
                        summary: `List ${modelName}s`,
                        tags,
                        parameters: buildListParameters(
                            stringifyFields(metadata.searchFields),
                            stringifyFields(metadata.orderingFields),
                            metadata.usesDefaultOffsetPagination
                        ),
                        responses: {
                            '200': jsonResponse(
                                'Successful response',
                                metadata.usesDefaultOffsetPagination ? paginatedResultsSchema(readSchema) : undefined
                            ),
                        },
                    },
                    descriptor.methods?.GET,
                    tags
                )
            );
        }

        if (allowed.has('POST')) {
            setOperation(
                paths,
                collectionPath,
                'POST',
                withOverride(
                    {
                        summary: `Create ${modelName}`,
                        tags,
                        requestBody: jsonRequestBody(writeSchema),
                        responses: {
                            '201': jsonResponse('Created', readSchema),
                        },
                    },
                    descriptor.methods?.POST,
                    tags
                )
            );
        }
    }

    if (descriptor.detailPath) {
        const detailPath = normalizePath(descriptor.detailPath);
        validateGenericDetailPath(detailPath, metadata.lookupParam);
        const detailParameters = [buildPathParameter(metadata.lookupParam)];

        if (allowed.has('GET')) {
            setOperation(
                paths,
                detailPath,
                'GET',
                withOverride(
                    {
                        summary: `Get ${modelName}`,
                        tags,
                        parameters: detailParameters,
                        responses: {
                            '200': jsonResponse('Successful response', readSchema),
                            '404': { description: 'Not found' },
                        },
                    },
                    descriptor.methods?.GET,
                    tags
                )
            );
        }

        if (allowed.has('PUT')) {
            setOperation(
                paths,
                detailPath,
                'PUT',
                withOverride(
                    {
                        summary: `Update ${modelName}`,
                        tags,
                        parameters: detailParameters,
                        requestBody: jsonRequestBody(updateSchema),
                        responses: {
                            '200': jsonResponse('Updated', readSchema),
                            '404': { description: 'Not found' },
                        },
                    },
                    descriptor.methods?.PUT,
                    tags
                )
            );
        }

        if (allowed.has('PATCH')) {
            setOperation(
                paths,
                detailPath,
                'PATCH',
                withOverride(
                    {
                        summary: `Update ${modelName}`,
                        tags,
                        parameters: detailParameters,
                        requestBody: jsonRequestBody(updateSchema),
                        responses: {
                            '200': jsonResponse('Updated', readSchema),
                            '404': { description: 'Not found' },
                        },
                    },
                    descriptor.methods?.PATCH,
                    tags
                )
            );
        }

        if (allowed.has('DELETE')) {
            setOperation(
                paths,
                detailPath,
                'DELETE',
                withOverride(
                    {
                        summary: `Delete ${modelName}`,
                        tags,
                        parameters: detailParameters,
                        responses: {
                            '204': { description: 'Deleted' },
                            '404': { description: 'Not found' },
                        },
                    },
                    descriptor.methods?.DELETE,
                    tags
                )
            );
        }
    }
}

function registerAPIViewDescriptor(paths: Record<string, PathItemObject>, descriptor: OpenAPIAPIViewDescriptor): void {
    const path = normalizePath(descriptor.path);
    const allowed = new Set(descriptor.resource.getAllowedMethods());
    const methods = Object.entries(descriptor.methods) as Array<[HttpMethod, OpenAPIOperationOverride]>;

    for (const [method, override] of methods) {
        if (!allowed.has(method)) {
            throw new Error(
                `APIView method '${method}' is not implemented on ${descriptor.resource.constructor.name}.`
            );
        }

        setOperation(
            paths,
            path,
            method,
            withOverride(
                {
                    summary:
                        `${method} ${titleize(descriptor.resource.constructor.name.replace(/APIView$/, ''))}`.trim(),
                    responses: {
                        [(override.responseStatus ?? '200') as string]: jsonResponse(
                            override.responseDescription ?? 'Successful response',
                            override.responseSchema ? toSchema(override.responseSchema) : undefined
                        ),
                    },
                },
                override,
                descriptor.tags ?? [descriptor.resource.constructor.name.replace(/APIView$/, '') || 'APIView']
            )
        );
    }
}

/**
 * Build an OpenAPI 3.1 document from Tango resource configuration.
 */
export function generateOpenAPISpec(config: OpenAPIGeneratorConfig): OpenAPISpec {
    const paths: Record<string, PathItemObject> = {};
    const schemas: Record<string, SchemaObject> = {};

    for (const resource of config.resources ?? []) {
        registerDescriptor(paths, schemas, resource);
    }

    return {
        openapi: '3.1.0',
        info: {
            title: config.title,
            version: config.version,
            description: config.description,
        },
        servers: config.servers,
        paths,
        components: {
            schemas,
        },
    };
}

function registerDescriptor(
    paths: Record<string, PathItemObject>,
    schemas: Record<string, SchemaObject>,
    descriptor: OpenAPIResourceDescriptor
): void {
    if (descriptor.kind === 'viewset') {
        registerViewSetDescriptor(paths, schemas, descriptor);
        return;
    }

    if (descriptor.kind === 'generic') {
        registerGenericDescriptor(paths, schemas, descriptor);
        return;
    }

    registerAPIViewDescriptor(paths, descriptor);
}
