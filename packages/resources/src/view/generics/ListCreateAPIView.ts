import { GenericAPIView } from '../GenericAPIView';
import type { TangoResponse } from '@danceroutine/tango-core';
import { RequestContext } from '../../context/index';
import type { AnyModelSerializer } from '../../serializer/index';

/**
 * Generic API view for collection endpoints that list and create resources.
 */
export abstract class ListCreateAPIView<
    TModel extends Record<string, unknown>,
    TSerializer extends AnyModelSerializer<TModel>,
> extends GenericAPIView<TModel, TSerializer> {
    protected override get(ctx: RequestContext): Promise<TangoResponse> {
        return this.performList(ctx);
    }

    protected override post(ctx: RequestContext): Promise<TangoResponse> {
        return this.performCreate(ctx);
    }
}
