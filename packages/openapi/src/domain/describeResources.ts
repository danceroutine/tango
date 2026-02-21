import type { APIViewMethod, ModelSerializerClass, SerializerSchema } from '@danceroutine/tango-resources';
import type { OpenAPIViewSetDescriptor, OpenAPIGenericAPIViewDescriptor, OpenAPIAPIViewDescriptor } from './types';

export function describeViewSet(descriptor: Omit<OpenAPIViewSetDescriptor, 'kind'>): OpenAPIViewSetDescriptor;
export function describeViewSet<
    TModel extends Record<string, unknown>,
    TSerializer extends ModelSerializerClass<TModel, SerializerSchema, SerializerSchema, SerializerSchema>,
>(
    descriptor: Omit<OpenAPIViewSetDescriptor<TModel, TSerializer>, 'kind'>
): OpenAPIViewSetDescriptor<TModel, TSerializer>;
export function describeViewSet(descriptor: Omit<OpenAPIViewSetDescriptor, 'kind'>) {
    return {
        kind: 'viewset',
        ...descriptor,
    };
}

export function describeGenericAPIView(
    descriptor: Omit<OpenAPIGenericAPIViewDescriptor, 'kind'>
): OpenAPIGenericAPIViewDescriptor;
export function describeGenericAPIView<
    TModel extends Record<string, unknown>,
    TSerializer extends ModelSerializerClass<TModel, SerializerSchema, SerializerSchema, SerializerSchema>,
>(
    descriptor: Omit<OpenAPIGenericAPIViewDescriptor<TModel, TSerializer>, 'kind'>
): OpenAPIGenericAPIViewDescriptor<TModel, TSerializer>;
export function describeGenericAPIView(descriptor: Omit<OpenAPIGenericAPIViewDescriptor, 'kind'>) {
    return {
        kind: 'generic',
        ...descriptor,
    };
}

export function describeAPIView(descriptor: Omit<OpenAPIAPIViewDescriptor, 'kind'>): OpenAPIAPIViewDescriptor;
export function describeAPIView<
    TMethods extends Partial<Record<APIViewMethod, OpenAPIAPIViewDescriptor['methods'][APIViewMethod]>>,
>(descriptor: Omit<OpenAPIAPIViewDescriptor, 'kind'> & { methods: TMethods }): OpenAPIAPIViewDescriptor;
export function describeAPIView(descriptor: Omit<OpenAPIAPIViewDescriptor, 'kind'>) {
    return {
        kind: 'api',
        ...descriptor,
    };
}
