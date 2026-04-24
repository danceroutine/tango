import { GenericAPIView } from '../GenericAPIView';
import type { TangoResponse } from '@danceroutine/tango-core';
import { RequestContext } from '../../context/index';
import type { AnyModelSerializer } from '../../serializer/index';

/**
 * Generic API view for full detail endpoints that retrieve, update, and delete.
 */
export abstract class RetrieveUpdateDestroyAPIView<
    TModel extends Record<string, unknown>,
    TSerializer extends AnyModelSerializer<TModel>,
> extends GenericAPIView<TModel, TSerializer> {
    protected override get(ctx: RequestContext): Promise<TangoResponse> {
        return this.performRetrieve(ctx);
    }

    protected override put(ctx: RequestContext): Promise<TangoResponse> {
        return this.performUpdate(ctx);
    }

    protected override patch(ctx: RequestContext): Promise<TangoResponse> {
        return this.performUpdate(ctx);
    }

    protected override delete(ctx: RequestContext): Promise<TangoResponse> {
        return this.performDestroy(ctx);
    }
}
