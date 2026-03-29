import { GenericAPIView } from '../GenericAPIView';
import type { TangoResponse } from '@danceroutine/tango-core';
import { RequestContext } from '../../context/index';
import type { ModelSerializerClass, SerializerSchema } from '../../serializer/index';

/**
 * Mixin that wires `GET` requests to the generic list implementation.
 */
export abstract class ListModelMixin<
    TModel extends Record<string, unknown>,
    TSerializer extends ModelSerializerClass<TModel, SerializerSchema, SerializerSchema, SerializerSchema>,
> extends GenericAPIView<TModel, TSerializer> {
    protected list(ctx: RequestContext): Promise<TangoResponse> {
        return this.performList(ctx);
    }

    protected override get(ctx: RequestContext): Promise<TangoResponse> {
        return this.list(ctx);
    }
}
