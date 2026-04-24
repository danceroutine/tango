import { ListModelMixin } from '../mixins/ListModelMixin';
import type { TangoResponse } from '@danceroutine/tango-core';
import { RequestContext } from '../../context/index';
import type { AnyModelSerializer } from '../../serializer/index';

/**
 * Generic API view for endpoints that only expose a list operation.
 */
export abstract class ListAPIView<
    TModel extends Record<string, unknown>,
    TSerializer extends AnyModelSerializer<TModel>,
> extends ListModelMixin<TModel, TSerializer> {
    protected override get(ctx: RequestContext): Promise<TangoResponse> {
        return super.get(ctx);
    }
}
