import { GenericAPIView } from '../GenericAPIView';
import type { TangoResponse } from '@danceroutine/tango-core';
import { RequestContext } from '../../context/index';
import type { AnyModelSerializer } from '../../serializer/index';

/**
 * Mixin that wires `GET` requests to the generic retrieve implementation.
 */
export abstract class RetrieveModelMixin<
    TModel extends Record<string, unknown>,
    TSerializer extends AnyModelSerializer<TModel>,
> extends GenericAPIView<TModel, TSerializer> {
    protected retrieve(ctx: RequestContext): Promise<TangoResponse> {
        return this.performRetrieve(ctx);
    }

    protected override get(ctx: RequestContext): Promise<TangoResponse> {
        return this.retrieve(ctx);
    }
}
