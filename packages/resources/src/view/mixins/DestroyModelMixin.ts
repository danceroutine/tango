import { GenericAPIView } from '../GenericAPIView';
import type { TangoResponse } from '@danceroutine/tango-core';
import { RequestContext } from '../../context/index';
import type { ModelSerializerClass, SerializerSchema } from '../../serializer/index';

/**
 * Mixin that wires `DELETE` requests to the generic destroy implementation.
 */
export abstract class DestroyModelMixin<
    TModel extends Record<string, unknown>,
    TSerializer extends ModelSerializerClass<TModel, SerializerSchema, SerializerSchema, SerializerSchema>,
> extends GenericAPIView<TModel, TSerializer> {
    protected destroy(ctx: RequestContext): Promise<TangoResponse> {
        return this.performDestroy(ctx);
    }

    protected override delete(ctx: RequestContext): Promise<TangoResponse> {
        return this.destroy(ctx);
    }
}
