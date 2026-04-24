import { GenericAPIView } from '../GenericAPIView';
import type { TangoResponse } from '@danceroutine/tango-core';
import { RequestContext } from '../../context/index';
import type { AnyModelSerializer } from '../../serializer/index';

/**
 * Mixin that wires `PUT` and `PATCH` requests to the generic update implementation.
 */
export abstract class UpdateModelMixin<
    TModel extends Record<string, unknown>,
    TSerializer extends AnyModelSerializer<TModel>,
> extends GenericAPIView<TModel, TSerializer> {
    protected update(ctx: RequestContext): Promise<TangoResponse> {
        return this.performUpdate(ctx);
    }

    protected override put(ctx: RequestContext): Promise<TangoResponse> {
        return this.update(ctx);
    }

    protected override patch(ctx: RequestContext): Promise<TangoResponse> {
        return this.update(ctx);
    }
}
