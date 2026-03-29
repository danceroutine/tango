import { APIView } from '@danceroutine/tango-resources';
import type { RequestContext } from '@danceroutine/tango-resources';
import { TangoResponse } from '@danceroutine/tango-core';

/**
 * Small APIView example that shows where fully custom endpoints fit beside
 * manager-backed resources in the same Express application.
 */
export class HealthAPIView extends APIView {
    protected override async get(_ctx: RequestContext): Promise<TangoResponse> {
        return TangoResponse.json({
            status: 'ok',
            source: 'api-view',
        });
    }
}
