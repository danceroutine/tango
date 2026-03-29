import { CreateModelMixin } from '../mixins/CreateModelMixin';
import type { TangoResponse } from '@danceroutine/tango-core';
import { RequestContext } from '../../context/index';
import type { ModelSerializerClass, SerializerSchema } from '../../serializer/index';

/**
 * Generic API view for endpoints that only support resource creation.
 */
export abstract class CreateAPIView<
    TModel extends Record<string, unknown>,
    TSerializer extends ModelSerializerClass<TModel, SerializerSchema, SerializerSchema, SerializerSchema>,
> extends CreateModelMixin<TModel, TSerializer> {
    protected override post(ctx: RequestContext): Promise<TangoResponse> {
        return super.post(ctx);
    }
}
