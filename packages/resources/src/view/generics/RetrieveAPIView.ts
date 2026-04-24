import { RetrieveModelMixin } from '../mixins/RetrieveModelMixin';
import type { TangoResponse } from '@danceroutine/tango-core';
import { RequestContext } from '../../context/index';
import type { AnyModelSerializer } from '../../serializer/index';

/**
 * Generic API view for endpoints that retrieve a single resource by lookup.
 */
export abstract class RetrieveAPIView<
    TModel extends Record<string, unknown>,
    TSerializer extends AnyModelSerializer<TModel>,
> extends RetrieveModelMixin<TModel, TSerializer> {
    protected override get(ctx: RequestContext): Promise<TangoResponse> {
        return super.get(ctx);
    }
}
