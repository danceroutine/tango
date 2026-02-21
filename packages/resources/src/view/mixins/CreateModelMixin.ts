import { GenericAPIView } from '../GenericAPIView';
import type { TangoResponse } from '@danceroutine/tango-core';
import { RequestContext } from '../../context/index';
import type { ModelSerializerClass, SerializerSchema } from '../../serializer/index';

/**
 * Mixin that wires `POST` requests to the generic create implementation.
 */
export abstract class CreateModelMixin<
    TModel extends Record<string, unknown>,
    TSerializer extends ModelSerializerClass<TModel, SerializerSchema, SerializerSchema, SerializerSchema>,
> extends GenericAPIView<TModel, TSerializer> {
    protected create(ctx: RequestContext): Promise<TangoResponse> {
        return this.performCreate(ctx);
    }

    protected override post(ctx: RequestContext): Promise<TangoResponse> {
        return this.create(ctx);
    }
}
