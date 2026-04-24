import { GenericAPIView } from '../GenericAPIView';
import type { TangoResponse } from '@danceroutine/tango-core';
import { RequestContext } from '../../context/index';
import type { AnyModelSerializer } from '../../serializer/index';

/**
 * Generic API view for endpoints that retrieve and update a single resource.
 */
export abstract class RetrieveUpdateAPIView<
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
}
