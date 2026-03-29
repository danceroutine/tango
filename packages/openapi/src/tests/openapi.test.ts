import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import * as openapi from '../index';
import * as generators from '../generators/index';
import * as mappers from '../mappers/index';
import { generateOpenAPISpec } from '../generators/spec/generateOpenAPISpec';
import { aManager } from '@danceroutine/tango-testing';
import { ModelSerializer, ModelViewSet } from '@danceroutine/tango-resources';

type PostRecord = {
    id: number;
    title: string;
};

const postReadSchema = z.object({
    id: z.number(),
    title: z.string(),
});

const postWriteSchema = z.object({
    title: z.string(),
});

const postModel = {
    objects: aManager<PostRecord>({
        meta: {
            table: 'posts',
            pk: 'id',
            columns: {
                id: 'int',
                title: 'text',
            },
        },
    }),
    metadata: {
        name: 'Post',
        fields: [
            { name: 'id', type: 'serial', primaryKey: true },
            { name: 'title', type: 'text', notNull: true },
        ],
    },
};

class PostSerializer extends ModelSerializer<
    PostRecord,
    typeof postWriteSchema,
    ReturnType<typeof postWriteSchema.partial>,
    typeof postReadSchema
> {
    static readonly model = postModel;
    static readonly createSchema = postWriteSchema;
    static readonly updateSchema = postWriteSchema.partial();
    static readonly outputSchema = postReadSchema;
}

class PostViewSet extends ModelViewSet<PostRecord, typeof PostSerializer> {}

describe('openapi exports', () => {
    it('exposes the public OpenAPI API surface', () => {
        expect(typeof openapi.generateOpenAPISpec).toBe('function');
        expect(typeof openapi.generateSchemaFromModel).toBe('function');
        expect(typeof openapi.generateSchemaFromZod).toBe('function');
        expect(typeof openapi.mapTypeToOpenAPI).toBe('function');
        expect(typeof openapi.describeViewSet).toBe('function');
        expect(typeof openapi.describeGenericAPIView).toBe('function');
        expect(typeof openapi.describeAPIView).toBe('function');
        expect(typeof generators.spec.generateOpenAPISpec).toBe('function');
        expect(typeof mappers.schema.generateSchemaFromModel).toBe('function');
        expect(typeof mappers.schema.generateSchemaFromZod).toBe('function');
        expect(typeof mappers.schema.mapTypeToOpenAPI).toBe('function');
    });
});

describe('schema mapping', () => {
    it('maps known and unknown field types', () => {
        expect(openapi.mapTypeToOpenAPI('uuid')).toBe('string');
        expect(openapi.mapTypeToOpenAPI('int')).toBe('integer');
        expect(openapi.mapTypeToOpenAPI('jsonb')).toBe('object');
        expect(openapi.mapTypeToOpenAPI('unknown-type')).toBe('string');
    });

    it('generates schema required fields correctly', () => {
        const schema = openapi.generateSchemaFromModel({
            name: 'Post',
            fields: {
                id: { type: 'serial', primaryKey: true },
                title: { type: 'text', description: 'Post title' },
                subtitle: { type: 'text', nullable: true },
                createdAt: { type: 'timestamptz', default: 'now()' },
            },
        });

        expect(schema.type).toBe('object');
        expect(schema.properties?.id).toEqual({ type: 'integer', description: undefined });
        expect(schema.properties?.title).toEqual({ type: 'string', description: 'Post title' });
        expect(schema.required).toEqual(['title']);
    });

    it('omits required array when no fields are required', () => {
        const schema = openapi.generateSchemaFromModel({
            name: 'Meta',
            fields: {
                id: { type: 'serial', primaryKey: true },
                info: { type: 'jsonb', nullable: true },
                createdAt: { type: 'timestamptz', default: 'now()' },
            },
        });
        expect(schema.required).toBeUndefined();
    });
});

describe('spec generation', () => {
    it('generates spec from resource descriptors', () => {
        const viewset = new PostViewSet({
            serializer: PostSerializer,
        });

        const spec = generateOpenAPISpec({
            title: 'Blog API',
            version: '1.0.0',
            description: 'Blog endpoints',
            servers: [{ url: 'http://localhost:3000' }],
            resources: [openapi.describeViewSet({ basePath: 'posts', resource: viewset })],
        });

        expect(spec.openapi).toBe('3.1.0');
        expect(spec.info.title).toBe('Blog API');
        expect(spec.paths['/posts']?.get?.summary).toBe('List Posts');
        expect(spec.paths['/posts/{id}']?.put?.summary).toBe('Update Post');
        expect(spec.paths['/posts/{id}']?.delete?.responses['204']?.description).toBe('Deleted');
        expect(spec.components?.schemas?.Post?.type).toBe('object');
    });

    it('returns empty paths and schemas when no resources are provided', () => {
        const spec = generateOpenAPISpec({
            title: 'Empty',
            version: '1.0.0',
        });

        expect(spec.paths).toEqual({});
        expect(spec.components?.schemas).toEqual({});
    });
});
