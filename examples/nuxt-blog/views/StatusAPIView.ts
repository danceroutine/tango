import { APIView } from '@danceroutine/tango-resources';
import type { RequestContext } from '@danceroutine/tango-resources';
import { TangoResponse } from '@danceroutine/tango-core';

export class StatusAPIView extends APIView {
    protected override async get(_ctx: RequestContext): Promise<TangoResponse> {
        return TangoResponse.json({ ok: true, source: 'api-view' });
    }
}
