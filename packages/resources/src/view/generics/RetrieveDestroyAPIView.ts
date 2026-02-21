import { GenericAPIView } from '../GenericAPIView';
import type { TangoResponse } from '@danceroutine/tango-core';
import { RequestContext } from '../../context/index';
import type { ModelSerializerClass, SerializerSchema } from '../../serializer/index';

/**
 * Generic API view for endpoints that retrieve and delete a single resource.
 */
export abstract class RetrieveDestroyAPIView<
    TModel extends Record<string, unknown>,
    TSerializer extends ModelSerializerClass<TModel, SerializerSchema, SerializerSchema, SerializerSchema>,
> extends GenericAPIView<TModel, TSerializer> {
    protected override get(ctx: RequestContext): Promise<TangoResponse> {
        return this.performRetrieve(ctx);
    }

    protected override delete(ctx: RequestContext): Promise<TangoResponse> {
        return this.performDestroy(ctx);
    }
}
